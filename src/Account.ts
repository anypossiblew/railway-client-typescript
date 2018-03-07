 // https://www.lanindex.com/12306%E8%B4%AD%E7%A5%A8%E6%B5%81%E7%A8%8B%E5%85%A8%E8%A7%A3%E6%9E%90/

import winston = require('winston');
import {FileCookieStore} from './FileCookieStore';
import {Station} from './Station';
import request = require('request');
import querystring = require('querystring');
import fs = require('fs');
import readline = require('readline');
import process = require('process');
import Rx from 'rxjs/Rx';
import { Observable, ObservableInput } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import 'rxjs/add/observable/bindCallback';
import chalk = require('chalk');
import columnify = require('columnify');
import beeper = require('beeper');
import child_process = require('child_process');

import {OrderSubmitRequest, IOrder, Order} from './Order';

interface OrderSubmitRequest {
  token: string;
  ticketInfo: object;
  orderRequest: object;
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

  private rawRequest: (options:any|undefined|null, cb:any)=>any;
  private request: (options?:any|undefined|null)=>Observable<any>;
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
    this.rawRequest = request.defaults({jar: this.cookiejar});
    this.request = Observable.bindCallback<Array<any>>(this.rawRequest, (error, response, body)=> {
      if(error) throw error;
      if(response.statusCode !== 200) throw ['http error', response.statusCode, response.statusMessage].join(' ');
      return body;
    });
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

    // this.request = request.defaults({jar: this.cookiejar});

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

      this.orders.push(
        new Order(trainDate, backTrainDate, fromStationName, toStationName, passStationName, planTrains, planPepoles, seatClasses)
      );
    });

    return this;
  }

  public submit(): void {
    this.observableLoginInit()
      // 检查未完成订单
      .mergeMap(()=> this.queryMyOrderNoComplete())
      .do(body=> {
        if(body.data) {
          this.printMyOrderNoComplete(body);
          if(body.data.orderCacheDTO) {
            throw '您还有排队订单';
          }else if(body.data.orderDBList){
            throw '您还有未完成订单';
          }
        }
      })
      // 准备好后进行订票流程
      .subscribe(()=>{
        this.buildOrderFlow();

        this.scptCheckUserTimer =
          this.checkUserTimer.subscribe((i)=> {
            this.observableCheckUser()
              .subscribe(()=>winston.debug("Check user done"));
          });
      },err=> {
        console.log(chalk`{red.bold ${err}}`);
      });
  }

  public orderWaitTime() {
    this.observableLoginInit()
      .subscribe(()=>{
        this.obsQueryOrderWaitT(new Order())
          .subscribe((orderRequest: object)=> {
              console.log(chalk`{yellow 结束}`);
              this.destroy();
            }
            ,err=>console.log(chalk`{yellow 错误结束 ${err}}`)
            ,()=>{
              this.destroy();
            }
          );
      }
      ,err=>console.log(chalk`{yellow 错误结束 ${err}}`)
      ,()=>{
        this.destroy();
      });
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

  public destroy() {
    this.scptCheckUserTimer&&this.scptCheckUserTimer.unsubscribe();
  }

  private observableCheckCaptcha(): Observable<void> {
    return Observable.of(1)
      .mergeMap(()=>this.getCaptcha())
      .mergeMap(()=>this.checkCaptcha()
                        .do(()=>
                          // 校验码成功后进行授权认证
                          console.log(chalk`{green.bold 验证码校验成功}`)
                        )
      )
      .retryWhen(error$=>
        error$.do(()=>console.log(chalk`{yellow.bold 校验失败，重新校验}`))
      );
  }

  private observableLogin(): Observable<void> {
    return Observable.of(1)
      .mergeMap(()=>this.observableCheckCaptcha())
      .mergeMap(()=>
        this.userAuthenticate()
          .do(()=>console.log(chalk`{green.bold 登录成功}`))
      )
      .retryWhen(error$=>
        error$.mergeMap(err=> {
          /*
          {"result_message":"密码输入错误。如果输错次数超过4次，用户将被锁定。","result_code":1}
          {"result_message":"验证码校验失败","result_code":"5"}
          */
          if(typeof err.result_code == "undefined") {
            return Observable.timer(1000);
          }
          return Observable.throw(err);
        })
      )
      .catch(err=> {
        console.log(chalk`{yellow.bold ${err.result_message}}`);
        return Observable.throw(err);
      });
  }

  private observableNewAppToken(): Observable<string> {
    return Observable.of(1)
      .mergeMap(()=>this.getNewAppToken())
      .retryWhen(error$=>
        error$.do(err=>winston.error(err))
          .mergeMap(err=> {
            return this.observableLogin();
          })
      );
  }

  private observableAppToken(newapptk: string): Observable<string> {
    let newAppToken = newapptk;
    return Observable.create((observer: Observer<string>)=> {
        observer.next(newAppToken);
        observer.complete();
      })
      .mergeMap((newapptk: string)=>this.getAppToken(newapptk))
      .retryWhen(error$=>
        error$.do(err=>winston.error(err))
          .mergeMap(err=> {
            console.log(chalk`{yellow.bold 获取Token失败}`);
            winston.debug(err);
            if(err.result_code && err.result_code === 2) {
              return this.observableNewAppToken().do((newapptk)=>newAppToken = newapptk);
            }else {
              return Observable.timer(500);
            }
          })
      );
  }

  private observableLoginInit(): Observable<string> {

    // 登录初始化
    return Observable.of(1)
      .mergeMap(order=>this.loginInit())
      .retry(1000)
      .map(order => this.checkAuthentication(this.cookiejar._jar.toJSON().cookies))
      .mergeMap(tokens=> {
        if(tokens.tk) {
          return this.observableAppToken(tokens.tk);
        }else if(tokens.uamtk) {
          return this.observableNewAppToken()
            .mergeMap(newapptk=>this.observableAppToken(newapptk));
        }
        return this.observableLogin()
          .mergeMap(()=>this.observableNewAppToken())
          .mergeMap(newapptk=>this.observableAppToken(newapptk));
      });
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

  private buildQueryLeftTicketFlow(order: IOrder): Observable<IOrder> {

    return Observable.of(order)
      // 获取余票信息
      .mergeMap((order: IOrder): ObservableInput<IOrder> =>
        this.queryLeftTickets(order.trainDate, order.fromStation, order.toStation, order.planTrains)
          .map((trains)=> {
            order.trains = trains;
            return order;
          })
      )
      // 获取途经站车次信息
      .mergeMap((order: IOrder): ObservableInput<IOrder> => {
        if(order.passStation) {
          if(!order.fromToPassTrains) {
            return this.queryLeftTickets(order.trainDate, order.fromStation, order.passStation, order.planTrains)
              .map(passTrains=> {
                order.fromToPassTrains = passTrains.map(train=> train[3]);
                return order;
              });
          }
        }
        return Observable.of(order);
      })
      // 按途经站车次过滤
      .map((order: IOrder): IOrder => {
        if(order.fromToPassTrains) {
          order.trains = order.trains.filter(train => order.fromToPassTrains.includes(train[3]));
        }
        return order;
      })
      // 按时间范围过滤
      .map((order: IOrder): IOrder => {
        if(order.planTimes) {
          let trains = order.trains||[];
          order.trains = trains.filter(train=> {
            return (order.planTimes[0]?order.planTimes[0]<=train[8]:true)&&(order.planTimes[1]?order.planTimes[1]>=train[8]:true);
          });
        }

        return order;
      })
      // 根据字段排序
      .map((order: IOrder): IOrder => {
        if(order.planOrderBy) {
          order.trains = order.trains.sort(this.fieldSorter(order.planOrderBy));
        }
        return order;
      })
      // 计算可购买车次信息
      .map((order: IOrder): IOrder => {
        let trains = order.trains||[];

        let planTrains: Array<Array<string>> = [], that = this;
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

  private recursiveQueryLeftTicket(): Observable<Order> {
    return Observable.create((observer: Observer<Order>)=> {
        observer.next(this.nextOrder());
      })
      .mergeMap((order: Order)=>this.buildQueryLeftTicketFlow(order))
      .do(()=> {
        if(this.query) {
          process.stdout.clearLine();
          process.stdout.cursorTo(0);
        }
      })
      .map(order=> {
        if(order.availableTrains.length > 0) {
          this.query = false;
          // process.stdout.write(chalk`{yellow 有可购买余票 ${planTrain.toString()}}`);
          order.trainSecretStr = order.availableTrains[0][0];
          return order;
        }else {
          this.query = true;
          throw chalk`没有可购买余票 {yellow ${order.fromStationName}} 到 {yellow ${order.toStationName}} ${order.passStationName?'到'+order.passStationName+' ':''}{yellow ${order.trainDate}}`;
        }
      })
      .retryWhen(error$=>error$.do(err=>process.stdout.write(err)).delay(500))
      // 检查用户登录状态
      // .mergeMap((order: Order)=>this.observableCheckUser().map(()=>order))

      // Step 11 预提交订单，Post
      .switchMap((order: Order)=>{
        console.log(chalk`预提交订单 {yellow ${order.fromStationName}} 到 {yellow ${order.toStationName}} 日期 {yellow ${order.trainDate}}`);
        return Observable.of(1)
          .mergeMap(()=>this.submitOrderRequest(order))
          .retryWhen(error$=>
              error$.do(err=>winston.debug("SubmitOrderRequest error " + err)
                .delay(500))
          )
          .map(body=>[order, body]);
      })
      .map(([order, body])=>{
        if(body.status) {
          winston.debug(chalk`{blue Submit Order Request success!}`);
          return order;
        }else {
          // 您还有未处理的订单
          // 该车次暂不办理业务
          winston.error(chalk`{red.bold ${body.messages[0]}}`);
          // this.destroy();
          throw chalk`{red.bold ${body.messages[0]}}`;
        }
      })
      // Step 12 模拟跳转页面InitDc，Post
      .mergeMap(order=>
        this.confirmPassengerInitDc()
          .retryWhen(error$=>
            error$.mergeMap((err)=> {
                if(err == this.SYSTEM_BUSSY) {
                  console.log(err);
                  return Observable.timer(500);
                }else if(err == this.SYSTEM_MOVED) {
                  console.log(err);
                  return Observable.timer(500);
                }
                return Observable.throw(err);
              })
          )
          .map(orderSubmitRequest=>[order, orderSubmitRequest])
      )
      // Step 13 常用联系人确定，Post
      .switchMap(([order, orderRequest])=> {
        winston.debug("confirmPassenger Init Dc success! "+orderRequest.token);
        order.request = orderRequest;
        if(this.passengers) {
          order.request.passengers = this.passengers;
          return Observable.of(order);
        }else {
          return this.getPassengers(order.request.token)
            .retryWhen(error$=>
                error$.do((err)=>winston.error(chalk`{red.bold ${err}}`))
                .delay(500)
            )
            .map(passengers=> {
              this.passengers = passengers;
              order.request.passengers = passengers;
              return order;
            });
        }
      })
      // Step 14 购票人确定，Post
      .switchMap((order: Order)=>
        this.checkOrderInfo(order.request.token, order.request.passengers.data.normal_passengers, order.planPepoles)
          .retryWhen(error$=>
            error$.do(err=>winston.error(err)).mergeMap(err=> {
              if(err == "没有相关联系人") {
                return Observable.throw(err);
              }else {
                return Observable.timer(500)
              }
            })
          )
          .map(body=>{
            order.request.orderInfo = body;
            return order;
          })
      )
      // Step 15 准备进入排队，Post
      .switchMap((order: Order)=>{
        console.log(chalk`准备进入排队`);
        return this.getQueueCount(order.request.token, order.request.orderRequest, order.request.ticketInfo)
          .map(body=>{
            winston.debug(body);
            order.request.queueInfo = body;
            return order;
          })
      })
      .switchMap((order: Order)=> {
        // 若 Step 14 中的 "ifShowPassCode" = "Y"，那么多了输入验证码这一步，Post
        if(order.request.orderInfo.data.ifShowPassCode == "Y") {
          return this.observableGetPassCodeNew(order);
        }else {
          return Observable.of(order);
        }
      })
      .switchMap((order: Order)=>{
        console.log(chalk`提交排队订单`);
        return this.confirmSingleForQueue(order.request.token,
                                          order.request.passengers.data.normal_passengers,
                                          order.request.ticketInfo,
                                          order.planPepoles)
            .retryWhen(error$=>error$.delay(100))
            .map(body=> {
              if(body.status && body.data.submitStatus) {
                return order;
              }else {
                /**
                { validateMessagesShowId: '_validatorMessage',
                  status: true,
                  httpstatus: 200,
                  data: { errMsg: '余票不足！', submitStatus: false },
                  messages: [],
                  validateMessages: {} }
                */
                console.error(chalk`{red.bold ${body.data.errMsg}}`)
                throw 'retry';
              }
            })
      })
      .retryWhen(error$=>error$.do(err=>winston.error(chalk`{yellow.bold ${err}}`))
          .mergeMap((err)=> {
            if(err == 'retry') {
              return Observable.timer(500);
            }else {
              return Observable.throw(err);
            }
          })
      );
  }

  private observableGetPassengers(order: Order): Observable<any> {
    return Observable.of(1)
      .mergeMap(()=>
        this.getPassengers(order.request.token)
            .retryWhen(error$=>
                error$.do((err)=>winston.error(chalk`{red.bold ${err}}`))
                .delay(500)
            )
      )
  }

  private observableGetPassCodeNew(order: Order): Observable<any> {
    return Observable.of(1)
      .switchMap(()=> this.getPassCodeNew())
      .switchMap(()=> this.checkRandCodeAnsyn())
  }

  private buildOrderFlow() {

    // 初始化查询火车余票页面
    return Observable.of(1)
      .mergeMap(()=>this.leftTicketInit())
      .switchMap(()=>this.recursiveQueryLeftTicket())
      // Step 18 查询排队等待时间！
      .subscribe(
        (order: Order)=> {
          this.obsQueryOrderWaitT(order)
            .subscribe(()=> {
                console.log(chalk`{yellow 结束}`);
                this.destroy();
              },err=>winston.error(chalk`{yellow 错误结束 ${err}}`));
        },
        err=>{
          winston.error(chalk`{red.bold ${JSON.stringify(err)}}`);
          this.destroy();
        });
  }

  private observableCheckUser(): Observable<void> {

    // Step 10 验证登录，Post
    return Observable.of(1)
      .mergeMap(() => this.checkUser())
      .retryWhen(error$=>error$.do((err)=>console.error("Check user error "+err)))
      .mergeMap(body=> {
        if(body.data.flag) {
          return Observable.of(body);
        }else {
          return this.observableLoginInit();
        }
      });
  }

  private obsQueryOrderWaitT(order: Order): Observable<void> {
    return Observable.of(order)
        .mergeMap((order: Order)=> this.queryOrderWaitTime(""))
        .map(orderQueue=> {
          winston.debug(JSON.stringify(orderQueue));
          /**
          {
            "validateMessagesShowId": "_validatorMessage",
            "status": true,
            "httpstatus": 200,
            "data": {
              "queryOrderWaitTimeStatus": true,
              "count": 0,
              "waitTime": 2444,
              "requestId": 6376727285634797000,
              "waitCount": 2000,
              "tourFlag": "dc",
              "orderId": null
            },
            "messages": [],
            "validateMessages": {}
          }
          */
          if(orderQueue.status) {
            if(orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
              // 0.5秒响一次，响铃30分钟
              beeper(60*30*2);
              return console.log(chalk`您的车票订单号是 {red.bold ${orderQueue.data.orderId}}`);
            }else if(orderQueue.data.waitTime === -2){
              if(orderQueue.data.msg) {
                return console.log(chalk`{yellow.bold ${orderQueue.data.msg}}`);
              }
              return console.log(orderQueue);
            }else if(orderQueue.data.waitTime === -3){
              return console.log("您的车票订单已经取消!");
            }else if(orderQueue.data.waitTime === -4){
              console.log("您的车票订单正在处理, 请稍等...");
            }else {
              console.log(chalk`排队人数：{yellow.bold ${orderQueue.data.waitCount}} 预计等待时间：{yellow.bold ${parseInt(orderQueue.data.waitTime / 1.5)}} 分钟`);
            }
          }else {
            console.log(orderQueue);
          }
          throw 'retry';
        })
        .retryWhen((errors)=>errors.do((err)=>{
          if(err!='retry') {
            winston.error(err)
          }
        }).delay(4000))
        ;
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
  public queryLeftTickets(trainDate: string, fromStation: string, toStation: string, trainNames?: ReadonlyArray<string>): Observable<Array<any>> {
    if(!trainDate) {
      console.log(chalk`{yellow 请输入乘车日期}`);
      return Observable.throw('请输入乘车日期');
    }
    // this.BACK_TRAIN_DATE = trainDate;

    if(!fromStation) {
      console.log(chalk`{yellow 请输入出发站}`);
      return Observable.throw('请输入出发站');
    }
    // this.FROM_STATION_NAME = fromStationName;

    if(!toStation) {
      console.log(chalk`{yellow 请输入到达站}`);
      return Observable.throw('请输入到达站');
    }
    // this.TO_STATION_NAME = toStationName;

    return Observable.of(1)
      .mergeMap(()=>this.queryLeftTicket({trainDate: trainDate,
                                          fromStation: fromStation,
                                          toStation: toStation})
                                        )
      // .retry(Number.MAX_SAFE_INTEGER)
      .retryWhen((errors$)=>errors$.do(()=>process.stdout.write(".")).delay(1500))
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
      });
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

    let planTrains: ReadonlyArray<string>|undefined =
      typeof f == "string" ? f.split(','):(typeof filter == "string" ? filter.split(','):undefined);
    let planTimes: ReadonlyArray<string>|undefined =
      typeof t == "string" ? t.split(','):(typeof time == "string" ? time.split(','):undefined);
    let planOrderBy: Array<string|number>|undefined =
      typeof o == "string" ? o.split(','):(typeof orderby == "string" ? orderby.split(','):undefined);

    if(planOrderBy) {
      planOrderBy = planOrderBy.map((fieldName:string|number) => {
        if(fieldName[0] === '-' || fieldName[0] === '+') {
          return fieldName[0]+this.TICKET_TITLE.indexOf(fieldName.substring(1));
        }
        return this.TICKET_TITLE.indexOf(fieldName);
      });
    }

    this.buildQueryLeftTicketFlow({
        trainDate: trainDate
        ,backTrainDate: trainDate
        ,fromStationName: fromStationName
        ,toStationName: toStationName
        ,fromStation: fromStation
        ,toStation: toStation
        ,passStation: passStation
        ,planTrains: planTrains
        ,planTimes: planTimes
        ,planOrderBy: planOrderBy
        ,seatClasses: []
      })
      .subscribe((order: IOrder) => {
        let trains = this.renderTrainListTitle(order.trains);
        if(trains.length === 0) {
          return console.log(chalk`{yellow 没有符合条件的车次}`)
        }
        this.renderLeftTickets(trains);
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
    this.initNoComplete()
      .mergeMap(()=>
        this.queryMyOrderNoComplete()
          .retryWhen(error$=>error$.delay(500))
      )
      .subscribe(x=> {
          var columns = columnify(x, {
            columnSplitter: ' | '
          });

          console.log(columns);
        }, error=> {
          winston.error(error);
        })
  }

  public loginInit(): Observable<void> {
    var url = "https://kyfw.12306.cn/otn/login/init";
    var options = {
      url: url,
      method: "GET",
      headers: this.headers
    };

    return this.request(options);
  }

  private getCaptcha(): Observable<void> {

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

    return Observable.create((observer: Observer<void>)=> {
      this.rawRequest(options, (error: any, response: any, body: string) => {
        if(error) return observer.error(error);
      }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function(){
        observer.next();
      });
    });
  }

  private questionCaptcha(): Observable<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    return Observable.create((observer: Observer<string>)=> {
      let child = child_process.exec('captcha.BMP',()=>{});

      rl.question(chalk`{red.bold 请输入验证码}:`, (positionStr) => {
        rl.close();

        if(typeof positionStr == "string") {
          let positions: Array<string> = [];
          positionStr.split(',').forEach(el=>positions=positions.concat(el.split(' ')));
          observer.next(positions.map((position: string)=> {
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
            observer.complete();
          }else {
            observer.error("输入格式错误");
          }
      });
    });
  }

  private checkCaptcha(): Observable<void> {
    var url = "https://kyfw.12306.cn/passport/captcha/captcha-check";

    return this.questionCaptcha()
      .mergeMap(positions=>{
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
        return this.request(options)
          .map(body=>JSON.parse(body))
          .map(body=> {
            if(body.result_code == 4) {
              return body;
            }
            throw body.result_message;
          });
      });
  }

  private userAuthenticate(): Observable<string> {
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

    return this.request(options)
      .map(body=>JSON.parse(body))
      .map(body=> {
        if(body.result_code == 2) {
          throw body.result_message;
        }else if(body.result_code != 0) {
          throw body;
        }else {
          return body.uamtk;
        }
      });
  }

  private getNewAppToken(): Observable<string> {
    var data = {
          "appid": "otn"
      };

    var options ={
      url: "https://kyfw.12306.cn/passport/web/auth/uamtk"
      ,headers: this.headers
      ,method: 'POST'
      ,form: data
    };

    return this.request(options)
      .map(body=>JSON.parse(body))
      .map(body=> {
        winston.debug(body);
        if(body.result_code == 0) {
          return body.newapptk;
        }else {
          throw body;
        }
      });
  }

  private getAppToken(newapptk: string): Observable<string> {
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

    return this.request(options)
      .map(body=>JSON.parse(body))
      .map(body=> {
        winston.debug(body.result_message);
        if(body.result_code == 0) {
          return body.apptk;
        }else {
          throw body;
        }
      });
  }

  // private getMy12306(): Promise {
  //   return new Promise((resolve, reject)=> {
  //     this.request({
  //       url: "https://kyfw.12306.cn/otn/index/initMy12306"
  //      ,headers: this.headers
  //      ,method: "GET"},
  //      (error, response, body)=> {
  //       if(response.statusCode === 200) {
  //         console.log("Got my 12306");
  //         return resolve();
  //       }
  //       reject();
  //     });
  //   });
  // }

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

  private leftTicketInit(): Observable<void> {
    var url = "https://kyfw.12306.cn/otn/leftTicket/init";

    return this.request(url);
  }

  private queryLeftTicket({trainDate, fromStation, toStation}): Observable<any> {
    var query = {
      "leftTicketDTO.train_date": trainDate
      ,"leftTicketDTO.from_station": fromStation
      ,"leftTicketDTO.to_station": toStation
      ,"purpose_codes": "ADULT"
    }

    var param = querystring.stringify(query);

    var url = "https://kyfw.12306.cn/otn/leftTicket/queryZ?"+param;

    return this.request(url)
      .map(body=> {
        if(!body) {
          throw "系统返回无数据";
        }
        if(body.indexOf("请您重试一下") > 0) {
          throw "系统繁忙!";
        }else {
          try {
            var data = JSON.parse(body).data;
          }catch(err) {
            throw err;
          }
          // Resolved
          return data;
        }
      });
  }

  private checkUser(): Observable<void> {
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

    return this.request(options)
      .map(body=>JSON.parse(body));
  }

  private submitOrderRequest({trainSecretStr, trainDate, backTrainDate, fromStationName, toStationName}): Observable<object>  {

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

    return this.request(options)
      .map(body=>JSON.parse(body));
  }

  private confirmPassengerInitDc(): Observable<OrderSubmitRequest> {
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

    return this.request(options)
      .map(body=> {
        if(this.isSystemBussy(body)) {
          throw this.SYSTEM_BUSSY;
        }
        if(body) {
          // Get Repeat Submit Token
          var token = body.match(/var globalRepeatSubmitToken = '(.*?)';/);
          var ticketInfoForPassengerForm = body.match(/var ticketInfoForPassengerForm=(.*?);/);
          var orderRequestDTO = body.match(/var orderRequestDTO=(.*?);/);
          if(token) {
            return {
              token: token[1]
              ,ticketInfo: ticketInfoForPassengerForm&&JSON.parse(ticketInfoForPassengerForm[1].replace(/'/g, "\""))
              ,orderRequest: orderRequestDTO&&JSON.parse(orderRequestDTO[1].replace(/'/g, "\""))
            };
          }
        }
        throw this.SYSTEM_BUSSY;
      });
  }

  private getPassengers(token: string): Observable<any> {
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

    return this.request(options)
      .map(body=> JSON.parse(body));
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

  private checkOrderInfo(submitToken, passengers, planPepoles): Observable<any> {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo";

    var passengerTicketStr = this.getPassengerTickets(passengers, planPepoles);
    if(!passengerTicketStr) {
      return Observable.throw("没有相关联系人");
    }

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

    return this.request(options)
      .map(body=> JSON.parse(body))
      .map(body=> {
        /*
          { validateMessagesShowId: '_validatorMessage',
            url: '/leftTicket/init',
            status: false,
            httpstatus: 200,
            messages: [ '系统忙，请稍后重试' ],
            validateMessages: {} }
         */
        if(body.status) {
          return body;
        }else {
          throw body.messages[0];
        }
      });
  }

  private getQueueCount(token, orderRequestDTO, ticketInfo): Observable<any> {
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

    return this.request(options)
      .map(body=> JSON.parse(body))
      .map(body=> {
        /*
          { validateMessagesShowId: '_validatorMessage',
            status: false,
            httpstatus: 200,
            messages: [ '系统繁忙，请稍后重试！' ],
            validateMessages: {} }
         */
        if(body.status) {
          return body;
        }else {
          throw body.messages[0];
        }
      });
  }

  private getPassCodeNew(): Observable<void> {
    var url = "https://kyfw.12306.cn/otn/passcodeNew/getPassCodeNew?module=passenger&rand=randp&"+Math.random(0,1);
    var options = {
      url: url
      ,headers: Object.assign(Object.assign({}, this.headers), {
        "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
      })
    };

    return Observable.create((observer: Observer<void>)=> {
      this.rawRequest(options, (error, response, body)=> {
        if(error) return observer.error(error);
        if(response.statusCode!==200)
          observer.error(response.statusMessage);
      }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function(){
        observer.next();
        observer.complete();
      });
    });

  }

  private checkRandCodeAnsyn(): Observable<any> {
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

    return this.questionCaptcha()
      .mergeMap(positions=>{
        options.form.randCode = positions;
        return this.request(options);
      })
      .map(body=> JSON.parse(body));
  }

  private confirmSingleForQueue(token, passengers, ticketInfoForPassengerForm, planPepoles): Observable<any> {
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

    return this.request(options)
      .map(body=> JSON.parse(body));
  }

  private queryOrderWaitTime(token: string): Observable<any> {
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

    return this.request(options);
  }

  private cancelQueueNoCompleteOrder(): Observable<any> {
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

    return this.request(options)
      .map(body=> {
        if(this.isSystemBussy(body)) {
          throw this.SYSTEM_BUSSY;
        }
        return body;
      });
  }

  private initNoComplete(): Observable<any> {
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

    return this.request(options);
  }

  public myOrderNoComplete() {
    this.observableLoginInit()
      .mergeMap(()=> this.queryMyOrderNoComplete())
      .subscribe((x)=>{
        /*
          { validateMessagesShowId: '_validatorMessage',
            status: true,
            httpstatus: 200,
            data: { orderDBList: [ [Object] ], to_page: 'db' },
            messages: [],
            validateMessages: {} }
         */
         this.printMyOrderNoComplete(x);
      }, err=>console.error(err));
  }

  private printMyOrderNoComplete(x) {
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
  }

  private queryMyOrderNoComplete(): Observable<any> {
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

    return this.request(options)
      .map(body=> {
        if(body.status) {
          // console.log(body);
          /**
            { validateMessagesShowId: '_validatorMessage',
              status: true,
              httpstatus: 200,
              messages: [],
              validateMessages: {} }
           */
          return body;
        }
        throw body.messages;
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
  private cancelNoCompleteMyOrder(sequenceNo: string, cancelId: string = 'cancel_order'): Observable<any> {
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

    return this.request(options);
  }

  public cancelNoCompleteOrder(sequenceNo: string, cancelId: string = 'cancel_order') {
    this.observableLoginInit()
      .mergeMap(()=>this.cancelNoCompleteMyOrder(sequenceNo, cancelId))
      .subscribe((body)=>{
          // {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,"data":{},"messages":[],"validateMessages":{}}
          if (body.data.existError == "Y") {
            winston.error(chalk`{red ${body.data.errorMsg}}`);
          } else {
            console.warn(chalk`{yellow 订单 ${sequenceNo} 已取消}`);
          }
        }
      ,err=>winston.error(chalk`{red ${JSON.stringify(err)}}`)
      );
  }
}
