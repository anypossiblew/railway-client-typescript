 // https://www.lanindex.com/12306%E8%B4%AD%E7%A5%A8%E6%B5%81%E7%A8%8B%E5%85%A8%E8%A7%A3%E6%9E%90/

import winston = require('winston');
import {FileCookieStore} from './FileCookieStore';
import {Station} from './Station';
import request = require('request');
import querystring = require('querystring');
import fs = require('fs');
import readline = require('readline');
import process = require('process');
import Rx = require('@reactivex/rxjs');
// import { Observable, ObservableInput } from '@reactivex/rxjs';
import chalk = require('chalk');
import columnify = require('columnify');
import beeper = require('beeper');
import child_process = require('child_process');

interface Order extends Rx.ObservableInput {
  trainDate: string
  ,backTrainDate: string
  ,fromStationName: string
  ,toStationName: string
  ,passStationName?: string
  ,planTrains: Array<string>
  ,planPepoles: Array<string>
  ,planTimes?: Array<string>
  ,fromStation: string
  ,toStation: string
  ,passStation?: string
  ,seatClasses: Array<string>
  ,trains?: Array<Array<string>>

}

export class Account {
  public userName : string;
  public userPassword : string;
  private checkUserTimer = Rx.Observable.timer(1000*60*10, 1000*60*10); // 十分钟之后开始，每十分钟检查一次
  private scptCheckUserTimer?: Rx.Subscription;

  private stations: Station = new Station();
  private passengers?: object;

  private SYSTEM_BUSSY = "System is bussy";
  private SYSTEM_MOVED = "Moved Temporarily";

  private request?: request.RequestAPI<any, any, any>;
  private cookiejar: any;
  public headers: object = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    ,"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17"
    ,"Host": "kyfw.12306.cn"
    ,"Origin": "https://kyfw.12306.cn"
    ,"Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/"
  };

  private TICKET_TITLE = ['', '', '', '车次', '起始', '终点', '出发站', '到达站', '出发时', '到达时', '历时', '', '',
               '日期', '', '', '', '', '', '', '', '高级软卧', '', '软卧', '软座', '特等座', '无座',
               '', '硬卧', '硬座', '二等座', '一等座', '商务座'];

  private query = false;

  private orders: Array<Order> = [];

  constructor(name: string, userPassword: string) {
    this.userName = name;
    this.userPassword = userPassword;

    this.setRequest();
    this.build();
  }

  /**
   * 检查网络异常
   */
  private isSystemBussy(body: string): boolean {
    return body.indexOf("网络可能存在问题，请您重试一下") > 0;
  }

  public setRequest() {
    let cookieFileName: string = "./cookies/"+this.userName+".json";
    var fileStore = new FileCookieStore(cookieFileName, {encrypt: false});
    fileStore.option = {encrypt: false};

    this.cookiejar = request.jar(fileStore);

    this.request = request.defaults({jar: this.cookiejar});
  }

  private nextOrderNum: number = 0;
  private nextOrder() {
    this.nextOrderNum = (this.nextOrderNum + 1)%this.orders.length;
    return this.orders[this.nextOrderNum];
  }

  private currentOrder() {
    return this.orders[this.nextOrderNum];
  }

  public createOrder(trainDates: Array<string>, backTrainDate: string,
                     [fromStationName, toStationName, passStationName],
                     planTrains: Array<string>, planPepoles: Array<string>, seatClasses: Array<string>): this {
    trainDates.forEach(trainDate=> {
      if(!new Date(trainDate).toJSON()) {
        throw chalk`{red 乘车日期${trainDate}格式不正确，格式应该是yyyy-MM-dd}`;
      }
      if(new Date(trainDate).toJSON().slice(0,10) < new Date().toJSON().slice(0,10)) {
        throw chalk`{red 乘车日期应该为今天或以后}`;
      }
      this.orders.push({
        trainDate: trainDate
        ,backTrainDate: backTrainDate
        ,fromStationName: fromStationName
        ,toStationName: toStationName
        ,passStationName: passStationName
        ,planTrains: planTrains
        ,planPepoles: planPepoles
        ,fromStation: this.stations.getStationCode(fromStationName)
        ,toStation: this.stations.getStationCode(toStationName)
        ,passStation: this.stations.getStationCode(passStationName)
        ,seatClasses: seatClasses
      })
    });

    return this;
  }

  public orderWaitTime() {
    let sjOrderWaitTime = new Rx.Subject();
    this.buildLoginFlow(sjOrderWaitTime)
      .subscribe(()=>this.sjQueryOrderWaitT.next());
    sjOrderWaitTime.next();
  }

  public cancelOrderQueue() {
    this.cancelQueueNoCompleteOrder()
      .then(x=> {
        if(x.status && x.data.existError == 'N') {
          console.log(chalk`{green.bold 排队订单已取消}`);
        }else {
          console.error(x);
        }
      }, error=> console.error(error));
  }

  public submit(): void {
    let sjL = new Rx.Subject();
    let sjCheckUser = new Rx.Subject();
    this.buildLoginFlow(sjL)
      .subscribe(()=>{
        this.buildOrderFlow().next();
        this.scptCheckUserTimer =
          this.checkUserTimer.subscribe((i)=> {
            // console.log(i);
            sjCheckUser.next();
          });
      });

    //
    this.buildCheckUserFlow(sjCheckUser)
      .subscribe(()=>winston.debug("Check user done"));

    sjL.next();
  }

  public destroy() {
    this.scptCheckUserTimer&&this.scptCheckUserTimer.unsubscribe();
  }

  private build() {

    this.sjQueryOrderWaitT
        .mergeMap((orderRequest: object)=>
          this.queryOrderWaitTime(orderRequest&&(orderRequest.token||""))
            .then(orderQueue=> {
              if(orderQueue.status) {
                if(orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
                  // 0.5秒响一次，响铃30分钟
                  beeper(60*30*2);
                  return console.log(chalk`Your ticket order number is {red.bold ${orderQueue.data.orderId}}`);
                }else if(orderQueue.data.waitTime === -2){
                  if(orderQueue.data.msg) {
                    return console.log(chalk`{yellow.bold ${orderQueue.data.msg}}`);
                  }
                  return console.log(orderQueue);
                }else if(orderQueue.data.waitTime === -3){
                  return console.log("Your ticket request has been canceled!");
                }else if(orderQueue.data.waitTime === -4){
                  console.log("Your ticket request is being processed, please wait a moment!");
                }else {
                  console.log(chalk`{yellow.bold 排队人数：${orderQueue.data.waitCount}} 预计等待时间：${parseInt(orderQueue.data.waitTime / 1.5)} 分钟`);
                }
              }else {
                console.log(orderQueue);
              }
              return Promise.reject();
            },err=> {
              console.error(err);
              return Promise.reject(err);
            })
      )
      // .retry(Number.MAX_SAFE_INTEGER)
      .retryWhen((errors)=>errors.delay(4000))
      .subscribe((orderRequest: object)=> {
        console.log(chalk`{yellow 结束}`);
        this.destroy();
      },err=>console.log(chalk`{yellow 错误结束 ${err}}`));
  }

  private buildAuthFlow(subject: Rx.Subject,
                        sjNewAppToken: Rx.ReplaySubject = new Rx.ReplaySubject(),
                        sjAppToken: Rx.ReplaySubject = new Rx.ReplaySubject()) {
    let sjCaptcha = new Rx.ReplaySubject();
    let sjLogin = new Rx.ReplaySubject();
    let sjMyPage = new Rx.Subject();

    subject.subscribe(sjCaptcha);

    sjCaptcha.mergeMap(()=>this.getCaptcha())
            .mergeMap(()=>this.checkCaptcha().then(()=>{
              // 校验码成功后进行授权认证
              console.log(chalk`{green.bold 验证码校验成功}`);
            },err=> {
              // 校验失败，重新校验
              console.log(chalk`{yellow.bold 校验失败，重新校验}`);
              return Promise.reject(err);
            }))
            .retry(Number.MAX_SAFE_INTEGER)
            .subscribe(()=>sjLogin.next(1), err=>console.error(err));

    /**
     * 如何在 mergeMap + retry 模式中区分需要重试的错误和正常不需要重试的错误，
     * 如果把不需要重试的错误和正确结果都通过resolve返回则需要什么样的方式进行区别
     */
    sjLogin
      .mergeMap(()=>
        this.userAuthenticate()
            .then(()=> {
              console.log(chalk`{green.bold 登录成功}`);
              return Promise.resolve();
            },err=> {
              /*
              {"result_message":"密码输入错误。如果输错次数超过4次，用户将被锁定。","result_code":1}
              {"result_message":"验证码校验失败","result_code":"5"}
              */
              if(typeof err.result_code == "undefined") {
                return Promise.reject(err);
              }else {
                console.log(chalk`{yellow.bold ${err.result_message}}`);
                return err;
                // if(error.result_code === 1) {
                //   throw error.result_message;
                // }else if(error.result_code === 5) {
                //   this.sjCaptcha.next();
                // }else {
                //   this.sjCaptcha.next();
                // }
              }
            })
      )
      .retry(Number.MAX_SAFE_INTEGER)
      .subscribe(err=> {
        // 登录失败将重新从校验码开始
        if(err) {
          sjCaptcha.next(1);
        }else {
          sjNewAppToken.next();
        }
      });

    sjNewAppToken
      .mergeMap(()=>this.getNewAppToken())
      .subscribe((newapptk: string)=> {
        sjAppToken.next(newapptk)
      },(err: any) => {
        sjCaptcha.next(1);
      });

    sjAppToken
      .mergeMap((newapptk: string)=>this.getAppToken(newapptk)
        .then((x: string) => '', (err: any)=> {
          console.log(chalk`{yellow.bold 获取Token失败}`);
          winston.debug(err);
          if(err.result_code && err.result_code === 2) {
            return err;
          }else {
            return Promise.reject(err);
          }
        }))
      .retry(Number.MAX_SAFE_INTEGER)
      .subscribe((err: any) => {
        if(err) {
          sjCaptcha.next(1);
        }else {
          sjMyPage.next();
        }
      }, (error: any)=> {
        console.log(error);
      });

    return sjMyPage;
  }

  private buildLoginFlow(observable: Rx.Observable<any>): Rx.Observable<any> {
    let sjLoginInit = new Rx.ReplaySubject();
    let sjCaptcha = new Rx.Subject();
    let sjNewAppToken = new Rx.ReplaySubject<any>();
    let sjAppToken = new Rx.ReplaySubject<string>();

    observable.subscribe(sjLoginInit);

    // 登录初始化
    sjLoginInit
      .mergeMap(order=>this.loginInit())
      .retry(1000)
      .map(order => this.checkAuthentication(this.cookiejar._jar.toJSON().cookies))
      .subscribe(tokens=> {
        if(tokens.tk) {
          return sjAppToken.next(tokens.tk);
        }else if(tokens.uamtk) {
          return sjNewAppToken.next('');
        }
        sjCaptcha.next(1);
      });

    return this.buildAuthFlow(sjCaptcha, sjNewAppToken, sjAppToken);
  }

  /**
   * 数组多关键字段排序算法，字段默认为递减排序，如果字段前面带有+符号则为递增排序
   */
  private fieldSorter(fields: Array<string>) {
    return (a:any, b:any) => fields.map((o:string) => {
              let dir = -1;
              if (o[0] === '+') {
                dir = 1;
                o = o.substring(1);
              }else if(o[0] === '-') {
                o = o.substring(1);
              }
              return a[o] > b[o] ? dir : a[o] < b[o] ? -(dir) : 0;
          }).reduce((p, n) => p ? p : n, 0);
  }

  private sjLfTicketInit      = new Rx.Subject();
  private sjQueryLfTicket     = new Rx.Subject();
  private sjSmOReqCheckUser   = new Rx.Subject<string>();
  private sjSmOrderReq        = new Rx.Subject<string>();
  private sjCPasInitDc        = new Rx.Subject<string>();
  private sjGetPassengers     = new Rx.Subject<object>();
  private sjCheckOrderInfo    = new Rx.ReplaySubject<object>();
  private sjGetQueueCount     = new Rx.Subject();
  private sjGetPassCodeNew    = new Rx.Subject();
  private sjConfirmSingle4Q   = new Rx.Subject();
  private sjQueryOrderWaitT   = new Rx.ReplaySubject();

  private buildQueryLeftTicketFlow(observable: Rx.Observable<Order>): Rx.Observable<{}> {
    let sjQueryLfTicket = new Rx.ReplaySubject<Order>();

    observable.subscribe(sjQueryLfTicket);

    return sjQueryLfTicket
      // 获取余票信息
      .mergeMap((order: Order):Rx.ObservableInput<Order> =>
        this.queryLeftTickets(order.trainDate, order.fromStation, order.toStation, order.planTrains)
          .then((trains)=> {
            order.trains = trains;
            return order;
          },err=>console.error(err))
      )
      // 获取途经站车次信息
      .mergeMap((order: Order):Rx.ObservableInput<Order> => {
        if(order.passStation) {
          if(!order.fromToPassTrains) {
            return this.queryLeftTickets(order.trainDate, order.fromStation, order.passStation, order.planTrains)
              .then(passTrains=> {
                order.fromToPassTrains = passTrains.map(train => train[3]);
                return order;
              });
          }else {
            return Promise.resolve(order);
          }
        }else {
          return Promise.resolve(order);
        }
      })
      // 按途经站车次过滤
      .map((order: Order):Rx.ObservableInput<Order> => {
        if(order.fromToPassTrains) {
          order.trains = order.trains.filter(train => order.fromToPassTrains.includes(train[3]));
        }
        return order;
      })
      // 按时间范围过滤
      .map((order: Order) => {
        if(order.planTimes) {
          let trains = order.trains||[];
          order.trains = trains.filter(train=> {
            return (order.planTimes[0]?order.planTimes[0]<=train[8]:true)&&(order.planTimes[1]?order.planTimes[1]>=train[8]:true);
          });
        }

        return order;
      })
      // 根据字段排序
      .map((order: Order)=> {
        if(order.planOrderBy) {
          order.trains = order.trains.sort(this.fieldSorter(order.planOrderBy));
        }
        return order;
      })
      // 计算可购买车次信息
      .map((order: Order):Rx.ObservableInput<Order> => {
        let trains = order.trains||[];

        let planTrains: Array<string> = [], that = this;
        trains.some(train => {
          return order.seatClasses.some(seat => {
            var seatNum = this.TICKET_TITLE.indexOf(seat);
            if(train[seatNum] == "有" || train[seatNum] > 0) {
              winston.debug(order.trainDate+"/"+train[3]+"/"+seat+"/"+train[seatNum]);
              if(order.planTrains.includes(train[3])) {
                planTrains.push(train);
                return true;
              }
            }
            return false;
          });
        });

        order.availableTrains = planTrains;
        return order;
      });
  }

  private buildOrderFlow(): Rx.Observable {

    let sjQueryLfTicket = new Rx.Subject();
    let sjSmOReqCheckUser = new Rx.Subject();

    // 初始化查询火车余票页面
    this.sjLfTicketInit.subscribe(()=> {
      this.leftTicketInit()
        .then(()=>sjQueryLfTicket.next(this.nextOrder()), (error: any)=> {
          winston.error(error);
        });
    });

    this.buildQueryLeftTicketFlow(sjQueryLfTicket)
      .do(()=> {
        if(this.query) {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
        }
      })
      .subscribe(order=> {
        if(order.availableTrains.length > 0) {
          this.query = false;
          // process.stdout.write(chalk`{yellow 有可购买余票 ${planTrain.toString()}}`);
          order.trainSecretStr = order.availableTrains[0][0];
          sjSmOReqCheckUser.next(order);
        }else {
          process.stdout.write(chalk`没有可购买余票 {yellow ${order.fromStationName}} 到 {yellow ${order.toStationName}} ${order.passStationName?'到'+order.passStationName+' ':''}{yellow ${order.trainDate}}`);
          // process.stdout.write(".......");

          setTimeout(()=> {
            sjQueryLfTicket.next(this.nextOrder());
          }, 1500);
          this.query = true;
        }
      },err=> {
        console.error(err);
      });

    this.buildCheckUserFlow(sjSmOReqCheckUser)
      .subscribe(order=>this.sjSmOrderReq.next(this.currentOrder()));

    // Step 11 预提交订单，Post
    this.sjSmOrderReq.subscribe(order=> {
      winston.debug("submit order request");
      this.submitOrderRequest(order)
        .then((body)=> {
          if(body.status) {
            winston.debug(chalk`{yellow Submit Order Request success!}`);
            this.sjCPasInitDc.next(order);
          }else {
            // 您还有未处理的订单
            // 该车次暂不办理业务
            winston.error(chalk`{red.bold ${body.messages[0]}}`);
            this.destroy();
          }
        }, error=> {
          winston.error("SubmitOrderRequest error " + error);
          this.sjSmOrderReq.next(order);
        });
    });

    // Step 12 模拟跳转页面InitDc，Post
    this.sjCPasInitDc.subscribe(order=> {
      this.confirmPassengerInitDc().then((orderRequest: object)=> {
        winston.debug("confirmPassenger Init Dc success! "+orderRequest.token);
        order.request = orderRequest;
        // console.log(orderRequest.ticketInfo);
        if(this.passengers) {
          order.request.passengers = this.passengers;
          this.sjCheckOrderInfo.next(order);
        }else {
          this.sjGetPassengers.next(order);
        }
      }, error=> {
        if(error == this.SYSTEM_BUSSY) {
          console.log(error);
          this.sjCPasInitDc.next(order);
        }else if(error == this.SYSTEM_MOVED) {
          console.log(error);
          this.sjCPasInitDc.next(order);
        }else {
          console.error(error);
        }
      }).catch(error=> console.error(error));
    });

    // Step 13 常用联系人确定，Post
    this.sjGetPassengers.subscribe((order: object)=> {
      this.getPassengers(order.request.token).then(passengers=> {
        this.passengers = passengers;
        order.request.passengers = passengers;
        this.sjCheckOrderInfo.next(order);
      }, error=> {
        winston.error(error + " Retry get passengers");
        this.sjGetPassengers.next(order);
      })
      .catch(error=> winston.error(error));
    });

    this.sjCheckOrderInfo
      .mergeMap((order: object)=>
        // Step 14 购票人确定，Post
        this.checkOrderInfo(order.request.token, order.request.passengers.data.normal_passengers, order.planPepoles)
            .then(orderInfo => {
                // console.log(orderInfo);
                order.request.orderInfo = orderInfo;
                return order;
              }, err => {
                if(err == "没有相关联系人") {
                  return err;
                }else {
                  return Promise.reject(err);
                }
              }))
      .retry(1000)
      .mergeMap((order)=> {
        if(typeof order == "string") {
          return Promise.reject(order);
        }else {
          return Promise.resolve(order);
        }
      })
      // Step 15 准备进入排队，Post
      .mergeMap(order =>
        this.getQueueCount(order.request.token, order.request.orderRequest, order.request.ticketInfo)
          .then((response)=>{
            order.request.queueInfo = response;
            return order
          }, err=>Promise.reject(err))
      )
      .subscribe(order => {
        // console.log(order.queueInfo);
        // 若 Step 14 中的 "ifShowPassCode" = "Y"，那么多了输入验证码这一步，Post
        if(order.request.orderInfo.data.ifShowPassCode == "Y") {
          this.sjGetPassCodeNew.next(order);
        }else {
          // Step 17 确认购买，Post
          this.sjConfirmSingle4Q.next(order);
        }
      },err=>{
        winston.error(chalk`{red.bold ${JSON.stringify(err)}}`);
        this.destroy();
      });

    this.sjGetPassCodeNew.subscribe((order: object)=> {
      // Step 16 乘客买票验证码，Get POST
      this.getPassCodeNew().then(()=> this.checkRandCodeAnsyn())
        .then(x=> {
          console.log(x);
          this.sjConfirmSingle4Q.next(order);
        },error=>console.error(error));
    });

    this.sjConfirmSingle4Q.subscribe((order: object)=> {
      this.confirmSingleForQueue(order.request.token,
                                 order.request.passengers.data.normal_passengers,
                                 order.request.ticketInfo,
                                 order.planPepoles)
        .then(x=> {
          if(x.status && x.data.submitStatus) {
            // Step 18 查询排队等待时间！
            this.sjQueryOrderWaitT.next(order);
          }else {
            /**
            { validateMessagesShowId: '_validatorMessage',
              status: true,
              httpstatus: 200,
              data: { errMsg: '余票不足！', submitStatus: false },
              messages: [],
              validateMessages: {} }
            */
            console.log(chalk`{yellow.bold ${x.data.errMsg}}`);
            // 重新开始查询
            sjQueryLfTicket.next(this.nextOrder());
          }
        }, error=> {
          console.error(error);
          this.sjConfirmSingle4Q.next(order);
      });
    });

    return this.sjLfTicketInit;
  }

  private buildCheckUserFlow(observable: Rx.Observable): Rx.Observable {
    let sjCheckUser = new Rx.ReplaySubject();
    let sjLogin = new Rx.Subject();
    let sjAuthed = new Rx.Subject();
    observable.subscribe(sjCheckUser);

    // Step 10 验证登录，Post
    sjCheckUser
      .mergeMap(() => this.checkUser())
      .retry(1000)
      .subscribe((body) => {
          if(body.data.flag) {
            // console.log('login success');
            sjAuthed.next();
          }else {
            sjLogin.next();
          }
        // console.log("submit order request check user");
        }, err=>{
          console.error("Check user error ");
          console.error(err);
          /* TODO add relogin logic
          { validateMessagesShowId: '_validatorMessage',
            status: true,
            httpstatus: 200,
            data: { flag: false },
            messages: [],
            validateMessages: {} }
          */
          sjLogin.next();
        });

    this.buildAuthFlow(sjLogin)
      .subscribe(()=>sjAuthed.next(),err=>console.error(err));
    return sjAuthed;
  }


  /**
   * 查询列车余票信息
   *
   * @param trainDate 乘车日期
   * @param fromStationName 出发站
   * @param toStationName 到达站
   * @param trainNames 列车
   *
   * @return Promise
   */
  public queryLeftTickets(trainDate: string, fromStation: string, toStation: string, trainNames: Array<string>|null): Promise<Array<any>> {
    if(!trainDate) {
      console.log(chalk`{yellow 请输入乘车日期}`);
      return Promise.reject();
    }
    // this.BACK_TRAIN_DATE = trainDate;

    if(!fromStation) {
      console.log(chalk`{yellow 请输入出发站}`);
      return Promise.reject();
    }
    // this.FROM_STATION_NAME = fromStationName;

    if(!toStation) {
      console.log(chalk`{yellow 请输入到达站}`);
      return Promise.reject();
    }
    // this.TO_STATION_NAME = toStationName;

    return Rx.Observable.of(1)
      .mergeMap(()=>this.queryLeftTicket({trainDate: trainDate,
                                          fromStation: fromStation,
                                          toStation: toStation})
                      .then((trainsData)=>trainsData, err=> {
                        process.stdout.write(".");
                        return Promise.reject(err);
                      }))
      // .retry(Number.MAX_SAFE_INTEGER)
      .retryWhen((errors)=>errors.delay(1500))
      .map(trainsData => trainsData.result)
      .map(result => {
        let trains: Array<Array<string>> = [];

        result.forEach((element: string)=> {
          let train: Array<string> = element.split("|");
          train[4] = this.stations.getStationName(train[4]);
          train[5] = this.stations.getStationName(train[5]);
          train[6] = this.stations.getStationName(train[6]);
          train[7] = this.stations.getStationName(train[7]);
          train[11] = train[11] == "IS_TIME_NOT_BUY" ? "列车停运":train[11];
          // train[11] = train[11] == "N" ? "无票":train[11];
          // train[11] = train[11] == "Y" ? "有票":train[11];
          // 匹配输入的列车名称的正则表达式条件
          if(!trainNames || trainNames.filter(tn=>train[3].match(new RegExp(tn)) != null).length > 0) {
            trains.push(train);
          }
        });
        return trains;
      })
      .toPromise();
  }

  /**
   * 查询列车余票信息
   *
   * @param trainDate 乘车日期
   * @param fromStationName 出发站
   * @param toStationName 到达站
   * @param passStationName 途经站
   * @param trainNames 列车
   * @param f 车次过滤条件
   * @param t 时间过滤条件
   *
   * @return void
   */
  public leftTickets([trainDate, fromStationName, toStationName, passStationName], {filter,f,time,t,orderby,o}) {
    let fromStation: string = this.stations.getStationCode(fromStationName);
    let toStation: string = this.stations.getStationCode(toStationName);
    let passStation: string = this.stations.getStationCode(passStationName);

    let planTrains: Array<string>|null =
      typeof f == "string" ? f.split(','):(typeof filter == "string" ? filter.split(','):null);
    let planTimes: Array<string>|null =
      typeof t == "string" ? t.split(','):(typeof time == "string" ? time.split(','):null);
    let planOrderBy: Array<string>|null =
      typeof o == "string" ? o.split(','):(typeof orderby == "string" ? orderby.split(','):null);

    if(planOrderBy) {
      planOrderBy = planOrderBy.map((fieldName:string) => {
        if(fieldName[0] === '-' || fieldName[0] === '+') {
          return fieldName[0]+this.TICKET_TITLE.indexOf(fieldName.substring(1));
        }
        return this.TICKET_TITLE.indexOf(fieldName);
      });
    }

    const sjQueryLeftTickets = new Rx.Subject<Order>();

    this.buildQueryLeftTicketFlow(sjQueryLeftTickets)
      .subscribe((order: Order) => {
        let trains = this.renderTrainListTitle(order.trains);
        if(trains.length === 0) {
          return console.log(chalk`{yellow 没有符合条件的车次}`)
        }
        this.renderLeftTickets(trains);
      });

    sjQueryLeftTickets.next({
      trainDate: trainDate
      ,fromStation: fromStation
      ,toStation: toStation
      ,passStation: passStation
      ,planTrains: planTrains
      ,planTimes: planTimes
      ,planOrderBy: planOrderBy
      ,seatClasses: []
    });
  }

  private renderTrainListTitle(trains: Array<Array<string>>): Array<Array<string>> {
    var title = this.TICKET_TITLE.map(t=>chalk`{blue ${t}}`);

    trains.forEach((train, index)=> {
      if(index % 30 === 0) {
        trains.splice(index, 0, title);
      }
    })
    return trains;
  }

  private renderLeftTickets(trains: Array<Array<string>>) {
    var columns = columnify(trains, {
      columnSplitter: '|',
      columns: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "20", "21", "22", "23", "24", "25",
                "26", "27", "28", "29", "30", "31", "32"]
    })

    console.log(columns);
  }

  public myOrderNoCompleteReport() {
    var subjectOrderNoComplete = new Rx.Subject();

    subjectOrderNoComplete.subscribe(()=> {
      this.initNoComplete().then(()=> {
        this.queryMyOrderNoComplete().then(x=> {
            var columns = columnify(x, {
              columnSplitter: ' | '
            });

            console.log(columns);
          }, error=> {
            console.error(error);
            setTimeout(()=> subjectOrderNoComplete.next(), 1000)
          });
      }, error=> console.error(error));
    });

    subjectOrderNoComplete.next();
  }

  public loginInit(): Promise<void> {
    var url = "https://kyfw.12306.cn/otn/login/init";
    var options = {
      url: url,
      method: "GET",
      headers: this.headers
    };

    return new Promise<void>((resolve: object, reject: object)=> {
      this.request(options, (error, response, body) => {
        if(error) return reject(error.toString());

        if(response.statusCode === 200) {
          return resolve();
        }
        reject(response.statusCode);
      });
    });
  }

  private getCaptcha(): Promise {

    var data = {
          "login_site": "E",
          "module": "login",
          "rand": "sjrand",
          "0.17231872703389062":""
      };

    var param = querystring.stringify(data, null, null)
    var url = "https://kyfw.12306.cn/passport/captcha/captcha-image?"+param;
    var options = {
      url: url
      ,headers: this.headers
    };

    return new Promise((resolve, reject) => {
      this.request(options, (error, response, body) => {
        if(error) {
          console.error(error);
          reject(error);
        }
      }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function(){
        resolve();
      });
    });
  }

  private questionCaptcha(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return new Promise<string>((resolve: Function, reject: Function)=> {
      let child = child_process.exec('captcha.BMP',()=>{});

      rl.question(chalk`{red.bold 请输入验证码}:`, (positionStr) => {
        rl.close();

        if(typeof positionStr == "string") {
          let positions: Array<string> = [];
          positionStr.split(',').forEach(el=>positions=positions.concat(el.split(' ')));
          resolve(positions.map((position: string)=> {
            switch(position) {
              case "1":
                return "40,45";
              case "2":
                return "110,45";
              case "3":
                return "180,45";
              case "4":
                return "250,45";
              case "5":
                return "40,110";
              case "6":
                return "110,110";
              case "7":
                return "180,110";
              case "8":
                return "250,110";
            }
          }).join(','));
        }else {
          reject("输入格式错误");
        }
      });
    });
  }

  private checkCaptcha(): Promise {
    var url = "https://kyfw.12306.cn/passport/captcha/captcha-check";

    return new Promise<void>((resolve: Function, reject: Function) => {
      this.questionCaptcha().then(positions=> {
        var data = {
            "answer": positions,
            "login_site": "E",
            "rand": "sjrand"
          };

        var options = {
          url: url
          ,headers: this.headers
          ,method: 'POST'
          ,form: data
        };

        this.request(options, (error, response, body) => {
          if(error) {
            return reject(error);
          }
          if(response.statusCode === 200) {
            body = JSON.parse(body);
            winston.debug(body.result_message);
            if(body.result_code == 4) {
              resolve();
            }
            reject();
          }else {
            winston.debug('error: '+ response.statusCode);
            reject();
          }
        });
      }, error=>{
        winston.error(error);
      });
    });
  }

  private userAuthenticate(): Promise {
    // 发送登录信息
    var data = {
          "appid": "otn"
          ,"username": this.userName
          ,"password": this.userPassword
        };

    var url = "https://kyfw.12306.cn/passport/web/login";

    var options = {
      url: url
      ,headers: this.headers
      ,method: 'POST'
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) return reject(error);

        if(response.statusCode === 200) {
          // console.log(body);
          body = JSON.parse(body);
          // console.log(body.result_message);
          if(body.result_code == 2) {
            throw body.result_message;
          }else if(body.result_code != 0) {
            reject(body);
          }else {
            resolve(body.uamtk);
          }
        }else {
          reject(response);
        }
      });
    });
  }

  private getNewAppToken(): Promise {
    var data = {
          "appid": "otn"
      };

    var options ={
      url: "https://kyfw.12306.cn/passport/web/auth/uamtk"
      ,headers: this.headers
      ,method: 'POST'
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          // console.log(body);
          body = JSON.parse(body);
          winston.debug(body);
          if(body.result_code == 0) {
            resolve(body.newapptk);
          }else {
            reject(body);
          }
        }else {
          reject(response)
        }
      });
    });
  }

  private getMy12306(): Promise {
    return new Promise((resolve, reject)=> {
      this.request({
        url: "https://kyfw.12306.cn/otn/index/initMy12306"
       ,headers: this.headers
       ,method: "GET"},
       (error, response, body)=> {
        if(response.statusCode === 200) {
          console.log("Got my 12306");
          return resolve();
        }
        reject();
      });
    });
  }

  private checkAuthentication(cookies: object) {
    var uamtk = "", tk = "";
    for(var i = 0; i < cookies.length; i++) {
      if(cookies[i].key == "uamtk") {
        uamtk = cookies[i].value;
      }

      if(cookies[i].key == "tk") {
        tk = cookies[i].value;
      }
    }
    return {
      uamtk: uamtk,
      tk: tk
    };
  }

  /**
   *
   */
  private getAppToken(newapptk: string) {
    var data = {
          "tk": newapptk
      };
    var options = {
      url: "https://kyfw.12306.cn/otn/uamauthclient"
      ,headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17"
        ,"Host": "kyfw.12306.cn"
        ,"Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/"
        ,'content-type': 'application/x-www-form-urlencoded'
      }
      ,method: 'POST'
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          body = JSON.parse(body);
          winston.debug(body.result_message);
          if(body.result_code == 0) {
            resolve(body.apptk);
          }else {
            reject(body);
          }
        }else {
          reject(response.statusCode)
        }
      });
    });
  }

  private leftTicketInit(): Promise<void> {
    var url = "https://kyfw.12306.cn/otn/leftTicket/init";

    return new Promise((resolve, reject)=> {
      this.request(url, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          return resolve();
        }
        reject(response.statusText);
      });
    });
  }

  private queryLeftTicket({trainDate, fromStation, toStation}): Promise<void> {
    var query = {
      "leftTicketDTO.train_date": trainDate
      ,"leftTicketDTO.from_station": fromStation
      ,"leftTicketDTO.to_station": toStation
      ,"purpose_codes": "ADULT"
    }

    var param = querystring.stringify(query);

    var url = "https://kyfw.12306.cn/otn/leftTicket/queryZ?"+param;

    return new Promise((resolve, reject)=> {
      this.request(url, (error, response, body)=> {
        if(error) {
          return reject(error.toString());
        }
        if(response.statusCode === 200) {
          if(!body) {
            return reject(response.statusCode);
          }
          if(body.indexOf("请您重试一下") > 0) {
            reject("系统繁忙!");
          }else {
            try {
              var data = JSON.parse(body).data;
            }catch(err) {
              console.log(body);
              reject(err);
            }
            resolve(data);
          }
        }else {
          console.log(response.statusCode);
          reject(response.statusCode);
        }
      });
    });
  }

  private checkUser(): Promise<void> {
    var url = "https://kyfw.12306.cn/otn/login/checkUser";

    var data = {
      "_json_att": ""
    };

    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "If-Modified-Since": "0"
        ,"Cache-Control": "no-cache"
        ,"Referer": "https://kyfw.12306.cn/otn/leftTicket/init"
      })
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) return reject(error);

        if(response.statusCode === 200) {
          body = JSON.parse(body)
          return resolve(body);
        }
        reject(response.statusMessage);
      });
    });
  }

  private submitOrderRequest({trainSecretStr, trainDate, backTrainDate, fromStationName, toStationName}): Promise<object>  {

    var url = "https://kyfw.12306.cn/otn/leftTicket/submitOrderRequest";

    var data = {
      "secretStr": querystring.unescape(trainSecretStr)
      ,"train_date": trainDate
      ,"back_train_date": backTrainDate
      ,"tour_flag": "dc"
      ,"purpose_codes": "ADULT"
      ,"query_from_station_name": fromStationName
      ,"query_to_station_name": toStationName
      ,"undefined":""
    };

    // url = url + "secretStr="+secretStr+"&train_date=2018-01-31&back_train_date=2018-01-30&tour_flag=dc&purpose_codes=ADULT&query_from_station_name=上海&query_to_station_name=徐州东&undefined";
    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "If-Modified-Since": "0"
        ,"Cache-Control": "no-cache"
        ,"Referer": "https://kyfw.12306.cn/otn/leftTicket/init"
      })
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;
        if(response.statusCode === 200) {
          body = JSON.parse(body);
          return resolve(body);
        }
        reject(response.statusCode);
      });
    });
  }

  private confirmPassengerInitDc(): Promise {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/initDc";
    var data = {
      "_json_att": ""
    };
    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Content-Type": "application/x-www-form-urlencoded"
        ,"Referer": "https://kyfw.12306.cn/otn/leftTicket/init"
        ,"Upgrade-Insecure-Requests":1
      })
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          if(this.isSystemBussy(body)) {
            return reject(this.SYSTEM_BUSSY);
          }
          if(body) {
            // Get Repeat Submit Token
            var token = body.match(/var globalRepeatSubmitToken = '(.*?)';/);
            var ticketInfoForPassengerForm = body.match(/var ticketInfoForPassengerForm=(.*?);/);
            var orderRequestDTO = body.match(/var orderRequestDTO=(.*?);/);
            if(token) {
              return resolve({
                token: token[1]
                ,ticketInfo: ticketInfoForPassengerForm&&JSON.parse(ticketInfoForPassengerForm[1].replace(/'/g, "\""))
                ,orderRequest: orderRequestDTO&&JSON.parse(orderRequestDTO[1].replace(/'/g, "\""))
              });
            }
          }
          return reject(this.SYSTEM_BUSSY);
        }
        reject(response.statusMessage);
      });
    });
  }

  private getPassengers(token: string): Promise<object> {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/getPassengerDTOs";

    var data = {
      "_json_att": ""
      ,"REPEAT_SUBMIT_TOKEN": token
    };

    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
      ,form: data
    };

    return new Promise<object>((resolve: Function, reject: Function)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          if((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
            return resolve(JSON.parse(body));
          }
        }

        reject(response.statusMessage);
      });
    });

  }

  /* seat type
  ‘软卧’ => ‘4’,
  ‘二等座’ => ‘O’,
  ‘一等座’ => ‘M’,
  ‘硬座’ => ‘1’,
   */
  private getPassengerTickets(passengers, planPepoles): string {
    var tickets = [];
    passengers.forEach(passenger=> {
      if(planPepoles.includes(passenger.passenger_name)) {
        //座位类型,0,票类型(成人/儿童),name,身份类型(身份证/军官证....),身份证,电话号码,保存状态
        var ticket = /*passenger.seat_type*/ "O" +
                ",0," +
                /*limit_tickets[aA].ticket_type*/"1" + "," +
                passenger.passenger_name + "," +
                passenger.passenger_id_type_code + "," +
                passenger.passenger_id_no + "," +
                (passenger.phone_no || "" ) + "," +
                "N";
        tickets.push(ticket);
      }
    });

    return tickets.join("_");
  }

  private getOldPassengers(passengers, planPepoles): string {
    var tickets = [];
    passengers.forEach(passenger=> {
      if(planPepoles.includes(passenger.passenger_name)) {
        //name,身份类型,身份证,1_
        var ticket =
                passenger.passenger_name + "," +
                passenger.passenger_id_type_code + "," +
                passenger.passenger_id_no + "," +
                "1";
        tickets.push(ticket);
      }
    });

    return tickets.join("_")+"_";
  }

  private checkOrderInfo(submitToken, passengers, planPepoles) {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo";

    var passengerTicketStr = this.getPassengerTickets(passengers, planPepoles);

    var data = {
      "cancel_flag": 2
      ,"bed_level_order_num": "000000000000000000000000000000"
      ,"passengerTicketStr": passengerTicketStr
      ,"oldPassengerStr": this.getOldPassengers(passengers, planPepoles)
      ,"tour_flag": "dc"
      ,"randCode": ""
      ,"whatsSelect":1
      ,"_json_att": ""
      ,"REPEAT_SUBMIT_TOKEN": submitToken
    };

    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
      ,form: data
    };

    return new Promise((resolve: Function, reject: Function)=> {
      if(!passengerTicketStr) {
        throw "没有相关联系人";
      }
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          if((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
            let result = JSON.parse(body);
            /*
              { validateMessagesShowId: '_validatorMessage',
                url: '/leftTicket/init',
                status: false,
                httpstatus: 200,
                messages: [ '系统忙，请稍后重试' ],
                validateMessages: {} }
             */
            if(result.status) {
              return resolve(result);
            }else {
              return reject(result.messages[0])
            }
          }
        }

        reject(response.statusMessage);
      });
    });

  }

  private getQueueCount(token, orderRequestDTO, ticketInfo) {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/getQueueCount";
    var data = {
      "train_date": new Date(orderRequestDTO.train_date.time).toString()
      ,"train_no": orderRequestDTO.train_no
      ,"stationTrainCode": orderRequestDTO.station_train_code
      ,"seatType":1
      ,"fromStationTelecode": orderRequestDTO.from_station_telecode
      ,"toStationTelecode": orderRequestDTO.to_station_telecode
      ,"leftTicket": ticketInfo.queryLeftTicketRequestDTO.ypInfoDetail
      ,"purpose_codes": "00"
      ,"train_location": ticketInfo.train_location
      ,"_json_att": ""
      ,"REPEAT_SUBMIT_TOKEN": token
    };

    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          if((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
            /*
              { validateMessagesShowId: '_validatorMessage',
                status: false,
                httpstatus: 200,
                messages: [ '系统繁忙，请稍后重试！' ],
                validateMessages: {} }
             */
            let result = JSON.parse(body);
            if(result.status) {
              return resolve(result);
            }else {
              return reject(result.messages[0]);
            }
          }
        }

        reject(response.statusMessage);
      })
    })
  }

  private getPassCodeNew() {
    var url = "https://kyfw.12306.cn/otn/passcodeNew/getPassCodeNew?module=passenger&rand=randp&"+Math.random(0,1);
    var options = {
      url: url
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;
        if(response.statusCode!==200) reject(response.statusMessage);
      }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function(){
        resolve();
      });
    });

  }

  private checkRandCodeAnsyn() {
    var url = "https://kyfw.12306.cn/otn/passcodeNew/checkRandCodeAnsyn";
    var data = {
      randCode: "",
      rand: "randp"
    };
    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
      ,form: data
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve, reject)=> {
      rl.question('Please input randcode:', (positions) => {
        rl.close();

        options.form.randCode = positions;
        this.request(options, (error, response, body)=> {
          if(error) throw error;

          if(response.statusCode === 200) {
            if((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
              return resolve(JSON.parse(body));
            }
          }

          reject(response.statusMessage);
        })
      });
    })
  }

  private confirmSingleForQueue(token, passengers, ticketInfoForPassengerForm, planPepoles) {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/confirmSingleForQueue";
    var data = {
      "passengerTicketStr": this.getPassengerTickets(passengers, planPepoles)
      ,"oldPassengerStr": this.getOldPassengers(passengers, planPepoles)
      ,"randCode":""
      ,"purpose_codes": ticketInfoForPassengerForm.purpose_codes
      ,"key_check_isChange": ticketInfoForPassengerForm.key_check_isChange
      ,"leftTicketStr": ticketInfoForPassengerForm.leftTicketStr
      ,"train_location": ticketInfoForPassengerForm.train_location
      ,"choose_seats": ""
      ,"seatDetailType": "000"
      ,"whatsSelect": 1
      ,"roomType": "00"
      ,"dwAll": "N"
      ,"_json_att": ""
      ,"REPEAT_SUBMIT_TOKEN": token
    };

    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          if((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
            return resolve(JSON.parse(body));
          }
        }

        reject(response.statusMessage);
      })
    })
  }

  private queryOrderWaitTime(token) {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/queryOrderWaitTime";
    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
      ,form: {
        "random": new Date().getTime()
        ,"tourFlag": "dc"
        ,"_json_att": ""
        ,"REPEAT_SUBMIT_TOKEN": token
      }
      ,json: true
    };

    return new Promise((resolve: Function, reject: Function)=> {
      this.request(options, (error, response, body)=> {
        if(error) reject(error);

        if(response.statusCode === 200) {
          if((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
            return resolve(body);
          }
          if(this.isSystemBussy(body)) {
            return reject(this.SYSTEM_BUSSY);
          }
          return reject(body);
        }
        reject(response.statusMessage);
      });
    });
  }

  private cancelQueueNoCompleteOrder() {
    var url = "https://kyfw.12306.cn/otn/queryOrder/cancelQueueNoCompleteMyOrder";
    var data = {
      tourFlag: "dc"
    };
    var options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
      ,form: data
      ,json: true
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;
        if(response.statusCode === 200) {
          if((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
            return resolve(body);
          }
          if(this.isSystemBussy(body)) {
            return reject(this.SYSTEM_BUSSY);
          }
          return reject(body);
        }
        reject(response.statusMessage);
      });
    });
  }

  private initNoComplete() {
    let url = "https://kyfw.12306.cn/otn/queryOrder/initNoComplete";
    let options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/queryOrder/initNoComplete"
      })
      ,form: {
        "_json_att": ""
      }
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;
        if(response.statusCode === 200) {
          return resolve(body)
        }else {
          reject(response.statusCode);
        }
      });
    });
  }

  public myOrderNoComplete() {
    let sjOrderNoComplete = new Rx.Subject();
    sjOrderNoComplete.mergeMap(()=> this.queryMyOrderNoComplete())
      .subscribe((x)=>{
        /*
          { validateMessagesShowId: '_validatorMessage',
            status: true,
            httpstatus: 200,
            data: { orderDBList: [ [Object] ], to_page: 'db' },
            messages: [],
            validateMessages: {} }
         */
         if(!x.data) {
           console.error(chalk`{yellow 没有未完成订单}`)
           return;
         }
        let tickets = [];
        if(x.data.orderCacheDTO) {
          let orderCache = x.data.orderCacheDTO;
          orderCache.tickets.forEach(ticket=> {
            tickets.push({
              "排队号": orderCache.queueName,
              "等待时间": orderCache.waitTime,
              "等待人数": orderCache.waitCount,
              "余票数": orderCache.ticketCount,
              "乘车日期": orderCache.trainDate.slice(0,10),
              "车次": orderCache.stationTrainCode,
              "出发站": orderCache.fromStationName,
              "到达站": orderCache.toStationName,
              "座位等级": ticket.seatTypeName,
              "乘车人": ticket.passengerName
            });
          });

        }else if(x.data.orderDBList){

          x.data.orderDBList.forEach(order=> {
            // console.log(chalk`订单号 {yellow.bold ${order.sequence_no}}`)
            order.tickets.forEach(ticket=> {
              tickets.push({
                "订单号": ticket.sequence_no,
                // "订票号": ticket.ticket_no,
                "乘车日期": chalk`{yellow.bold ${ticket.train_date.slice(0,10)}}`,
                // "下单时间": ticket.reserve_time,
                "付款截至时间": chalk`{red.bold ${ticket.pay_limit_time}}`,
                "金额": chalk`{yellow.bold ${ticket.ticket_price/100}}`,
                "状态": chalk`{yellow.bold ${ticket.ticket_status_name}}`,
                "乘车人": ticket.passengerDTO.passenger_name,
                "车次": ticket.stationTrainDTO.station_train_code,
                "出发站": ticket.stationTrainDTO.from_station_name,
                "到达站": ticket.stationTrainDTO.to_station_name,
                "座位": ticket.seat_name,
                "座位等级": ticket.seat_type_name,
                "乘车人类型": ticket.ticket_type_name
              });
            });
          });
        }

        var columns = columnify(tickets, {
          columnSplitter: '|'
        });

        console.log(columns);
      }, err=>console.error('没有未完成订单'));

    let sjL = new Rx.Subject();
    this.buildLoginFlow(sjL)
      .subscribe(()=>sjOrderNoComplete.next())

    sjL.next();
  }

  private queryMyOrderNoComplete() {
    let url = "https://kyfw.12306.cn/otn/queryOrder/queryMyOrderNoComplete";
    let options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/queryOrder/initNoComplete"
      })
      ,form: {
        "_json_att": ""
      }
      ,json: true
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;
        if(response.statusCode === 200) {
          if(body.status) {
            // console.log(body);
            /**
              { validateMessagesShowId: '_validatorMessage',
                status: true,
                httpstatus: 200,
                messages: [],
                validateMessages: {} }
             */
            return resolve(body)
          }
          return reject(body.messages);
        }else {
          reject(response.statusCode);
        }
      });
    });
  }

  /**
  <div class="t-btn">
{{if pay_flag=='Y'}}
       <div class="btn"><a href="#nogo" id="continuePayNoMyComplete" onclick="contiuePayNoCompleteOrder('{{>sequence_no}}','pay')"  class="btn92s">继续支付</a></div>
       <div class="btn"><a href="#nogo" onclick="cancelMyOrder('{{>sequence_no}}','cancel_order')" id="cancel_button_pay" class="btn92">取消订单</a></div>
{{/if}}
{{if pay_resign_flag=='Y'}}
       <div class="btn"><a href="#nogo" id="continuePayNoMyComplete" onclick="contiuePayNoCompleteOrder('{{>sequence_no}}','resign');"  class="btn92s">继续支付</a></div>
	   <div class="btn"><a href="#nogo" onclick="cancelMyOrder('{{>sequence_no}}','cancel_resign')" class="btn92">取消订单</a></div>
{{/if}}

        </div>
  */
  private cancelNoCompleteMyOrder(sequenceNo: string, cancelId: string = 'cancel_order') {
    let url = "https://kyfw.12306.cn/otn/queryOrder/cancelNoCompleteMyOrder";
    let options = {
      url: url
      ,method: "POST"
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/queryOrder/initNoComplete"
      })
      ,form: {
        "sequence_no": sequenceNo,
  			"cancel_flag": cancelId,
        "_json_att":""
      }
      ,json: true
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;
        if(response.statusCode === 200) {
          return resolve(body);
        }else {
          reject(response.statusCode);
        }
      });
    });
  }

  public cancelNoCompleteOrder(sequenceNo: string, cancelId: string = 'cancel_order') {
    let sjCancelOrder = new Rx.Subject();
    this.buildLoginFlow(sjCancelOrder)
      .subscribe(()=>{
        this.cancelNoCompleteMyOrder(sequenceNo, cancelId)
          .then(body=> {
            // {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,"data":{},"messages":[],"validateMessages":{}}
            if (body.data.existError == "Y") {
  						winston.error(chalk`{red ${body.data.errorMsg}}`);
  					} else {
  						winston.warn(chalk`{yellow 订单 ${sequenceNo} 已取消}`);
  					}
          },err=>winston.error(chalk`{red ${JSON.stringify(err)}}`));
      });

    sjCancelOrder.next();
  }
}
