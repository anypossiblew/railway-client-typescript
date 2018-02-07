import {FileCookieStore} from './FileCookieStore';
import request = require('request');
import querystring = require('querystring');
import fs = require('fs');
import readline = require('readline');
import process = require('process');
import Rx = require('@reactivex/rxjs');
import chalk = require('chalk');

export class Account {
  public userName : string;
  public userPassword : string;
  public TRAIN_DATE: string;
  public BACK_TRAIN_DATE: string;
  public PLAN_TRAINS: Array<string>;
  public PLAN_PEPOLES: Array<string>;

  private SYSTEM_BUSSY = "System is bussy";
  private SYSTEM_MOVED = "Moved Temporarily";

  private request: request.RequestAPI<any, any, any>;
  private cookiejar: any;
  public headers: object = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    ,"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17"
    ,"Host": "kyfw.12306.cn"
    ,"Origin": "https://kyfw.12306.cn"
    ,"Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/"
  };

  constructor(name: string, userPassword: string) {
    this.userName = name;
    this.userPassword = userPassword;

    this.setRequest();
    this.buildLoginFlow();
    this.buildOrderFlow();
  }

  /**
   * 检查网络异常
   */
  private isSystemBussy(body: string): boolean {
    return body.indexOf("网络可能存在问题，请您重试一下") > 0;
  }

  public setRequest() {
    var fileStore = new FileCookieStore("./cookies/"+this.userName+".json", {encrypt: false});
    fileStore.option = {encrypt: false};

    this.cookiejar = request.jar(fileStore);

    this.request = request.defaults({jar: this.cookiejar});
  }

  public createOrder(trainDate: string, backTrainDate: string, planTrains: Array<string>, planPepoles: Array<string>): this {
    this.TRAIN_DATE = trainDate;
    this.BACK_TRAIN_DATE = backTrainDate;
    this.PLAN_TRAINS = planTrains;
    this.PLAN_PEPOLES = planPepoles;
    return this;
  }

  // Login init
  private sjLoginInit   = new Rx.Subject();
  // Check Captcha
  private sjCaptcha     = new Rx.Subject();
  // Login
  private sjLogin       = new Rx.Subject();
  // Get new app token
  private sjNewAppToken = new Rx.Subject();
  // Get app token
  private sjAppToken    = new Rx.Subject<string>();
  // Get my main page
  private sjMyPage      = new Rx.Subject();

  private sjLfTicketInit      = new Rx.Subject();
  private sjQueryLfTicket     = new Rx.Subject();
  private sjSmOReqCheckUser   = new Rx.Subject<string>();
  private sjSmOrderReq        = new Rx.Subject<string>();
  private sjCPasInitDc        = new Rx.Subject<string>();
  private sjGetPassengers     = new Rx.Subject<object>();
  private sjCheckOrderInfo    = new Rx.Subject<object>();
  private sjGetQueueCount     = new Rx.Subject();
  private sjGetPassCodeNew    = new Rx.Subject();
  private sjConfirmSingle4Q   = new Rx.Subject();
  private sjQueryOrderWaitT   = new Rx.Subject();

  private buildOrderFlow() {
    // 初始化查询火车余票页面
    this.sjLfTicketInit.subscribe(()=> {
      this.leftTicketInit()
        .then(()=>this.sjQueryLfTicket.next(), (error: any)=> {
          console.error(error);
        });
    });

    // 查询火车余票
    this.sjQueryLfTicket.subscribe(()=> {
      this.queryLeftTicket().then(trainsData => {
        //console.log(trainsData);
        var trains = trainsData.result;

        console.log("查询到火车数量 "+trains.length);
        var planTrain, that = this;
        trains.forEach(function(train) {
          train = train.split("|");

          if(train[30] == "有" || (train[30] > 0 && train[30] != "无" && train[30] != "0")) {
            console.log(train[3]);
            if(that.PLAN_TRAINS.includes(train[3])) {
              planTrain = train;
            }
          }
        });

        if(planTrain) {
          this.sjSmOReqCheckUser.next(planTrain[0]);
        }

      }, err => {
        console.error(err);
        setTimeout(()=> {
          this.sjQueryLfTicket.next();
        }, 1500);
      });
    });

    // Step 10 验证登录，Post
    this.sjSmOReqCheckUser.subscribe((train: string)=> {
      console.log("submit order request check user");
      this.checkUser().then(()=>this.sjSmOrderReq.next(train), error => {
        console.error("Check user error " + error);
        this.sjSmOReqCheckUser.next(train);
      });
    });

    // Step 11 预提交订单，Post
    this.sjSmOrderReq.subscribe((train: string)=> {
      console.log("submit order request");
      this.submitOrderRequest(train).then((x)=> {
        console.log("Submit Order Request success!")
        this.sjCPasInitDc.next();
      }, error=> {
        console.error("SubmitOrderRequest error " + error);
        this.sjSmOrderReq.next(train);
      })
    });

    // Step 12 模拟跳转页面InitDc，Post
    this.sjCPasInitDc.subscribe((train: string)=> {
      this.confirmPassengerInitDc().then((orderRequest: object)=> {
        console.log("confirmPassenger Init Dc success! "+orderRequest.token);
        // console.log(orderRequest.ticketInfo);
        this.sjGetPassengers.next(orderRequest);
      }, error=> {
        if(error == this.SYSTEM_BUSSY) {
          console.log(error);
          this.sjCPasInitDc.next();
        }else if(error == this.SYSTEM_MOVED) {
          console.log(error);
          this.sjCPasInitDc.next();
        }else {
          console.error(error);
        }
      }).catch(error=> console.error(error));
    });

    // Step 13 常用联系人确定，Post
    this.sjGetPassengers.subscribe((orderRequest: object)=> {
      this.getPassengers(orderRequest.token).then(passengers=> {
        orderRequest.passengers = passengers;
        this.sjCheckOrderInfo.next(orderRequest);
      }, error=> {
        console.error(error + " Retry get passengers");
        this.sjGetPassengers.next(orderRequest);
      })
      .catch(error=> console.error(error));
    });

    // Step 14 购票人确定，Post
    this.sjCheckOrderInfo.subscribe((orderRequest: object)=> {
      this.checkOrderInfo(orderRequest.token, orderRequest.passengers.data.normal_passengers)
        .then(orderInfo=> {
          console.log(orderInfo);
          // Step 15 准备进入排队，Post
          this.getQueueCount(orderRequest.token, orderRequest.orderRequest, orderRequest.ticketInfo)
            .then(x=> {
              console.log(x);
              // 若 Step 14 中的 "ifShowPassCode" = "Y"，那么多了输入验证码这一步，Post
              if(orderInfo.data.ifShowPassCode == "Y") {
                this.sjGetPassCodeNew.next(orderRequest);
              }else {
                // Step 17 确认购买，Post
                this.sjConfirmSingle4Q.next(orderRequest);
              }
            }, error=> {
              console.error(error);
          });
        }, error=> {
          console.error(error);
          this.sjCheckOrderInfo.next(orderRequest);
      });
    });

    this.sjGetPassCodeNew.subscribe((orderRequest: object)=> {
      // Step 16 乘客买票验证码，Get POST
      this.getPassCodeNew().then(()=> this.checkRandCodeAnsyn())
        .then(x=> {
          console.log(x);
          this.sjConfirmSingle4Q.next(orderRequest);
        },error=>console.error(error));
    });

    this.sjConfirmSingle4Q.subscribe((orderRequest: object)=> {
      this.confirmSingleForQueue(orderRequest.token, orderRequest.passengers.data.normal_passengers, orderRequest.ticketInfo)
        .then(x=>{
          if(x.status && x.data.submitStatus) {
            // Step 18 查询排队等待时间！
            this.sjQueryOrderWaitT.next(orderRequest);
          }else {
            console.log(x);
          }
        }, error=> {
          console.error(error);
          this.sjConfirmSingle4Q.next(orderRequest);
      });
    });

    this.sjQueryOrderWaitT.subscribe((orderRequest: object)=> {
      this.queryOrderWaitTime(orderRequest.token)
        .then(orderQueue=> {
          if(orderQueue.status) {
            if(orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
              console.log(chalk`Your ticket order number is {red.bold ${orderQueue.data.orderId}}`);
            }else if(orderQueue.data.waitTime === -2){
              console.log(orderQueue);
            }else if(orderQueue.data.waitTime === -3){
              console.log("Your ticket request has been canceled!");
            }else if(orderQueue.data.waitTime === -4){
              console.log("Your ticket request is being processed, please wait a moment!");
              setTimeout(x=> {
                this.sjQueryOrderWaitT.next(orderRequest);
              }, 4000);
            }else {
              console.log(chalk`{yellow.bold 排队人数：${orderQueue.data.waitCount}} 预计等待时间：${parseInt(orderQueue.data.waitTime / 1.5)} 分钟`);
              setTimeout(x=> {
                this.sjQueryOrderWaitT.next(orderRequest);
              }, 4000);
            }
          }else {
            console.log(orderQueue);
            setTimeout(x=> {
              this.sjQueryOrderWaitT.next(orderRequest);
            }, 4000);
          }
        }, error=> {
          console.log(chalk.bgBlue(error+" ReCheck Order waiting time"));
          setTimeout(x=> {
            this.sjQueryOrderWaitT.next(orderRequest);
          }, 4000);
        });
    });
  }

  private buildLoginFlow(): void {
    this.sjLoginInit.subscribe(()=> {
      this.loginInit()
        .then(()=>{
          var tokens = this.checkAuthentication(this.cookiejar._jar.toJSON().cookies);
          if(tokens.tk) {
            return this.sjAppToken.next(tokens.tk);
          }else if(tokens.uamtk) {
            return this.sjNewAppToken.next();
          }
          this.sjCaptcha.next();
        })
        .catch((error: any)=> {
          console.error(error);
        });
    });

    this.sjCaptcha.subscribe(()=> {
      this.getCaptcha().then(()=> this.checkCaptcha())
        .then(()=> {
          // 校验码成功后进行授权认证
          console.log(chalk`{green.bold 验证码校验成功}`);
          this.sjLogin.next();
        }, (error: any)=> {
          // 校验失败，重新校验
          console.log(chalk`{yellow.bold 校验失败，重新校验}`);
          this.sjCaptcha.next();
        });
    });

    this.sjLogin.subscribe(()=> {
      this.userAuthenticate()
        .then(()=>this.sjNewAppToken.next(), (error: any)=>this.sjLogin.next()) // TODO this.sjCaptcha.next();
        .catch((error: any)=>console.error(error));
    });

    this.sjNewAppToken.subscribe(()=> {
      this.getNewAppToken()
        .then((newapptk: string)=> this.sjAppToken.next(newapptk), (error: any)=> {
          this.sjCaptcha.next();
        });
    });

    this.sjAppToken.subscribe((newapptk: string)=> {
      this.getAppToken(newapptk).then((x: string) => {
        this.sjMyPage.next();
      }, (error: any)=> {
        console.log(chalk`{yellow.bold 获取Token失败，${error}}`);
        setTimeout(x=> this.sjAppToken.next(newapptk), 1000);
      });
    });

    this.sjMyPage.subscribe(()=> {
      this.getMy12306()
        .then(()=> {
          console.log(chalk`{green.bold 登录成功}`);
          this.sjLfTicketInit.next();
        });
    });
  }

  public submit(): void {
    this.sjLoginInit.next();
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

  private checkCaptcha(): Promise {
    var url = "https://kyfw.12306.cn/passport/captcha/captcha-check";

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve, reject) => {
      rl.question(chalk`{red.bold 请输入验证码}:`, (positions) => {
        rl.close();

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
            console.error(error);
          }
          if(response.statusCode === 200) {
            body = JSON.parse(body);
            console.log(body.result_message);
            if(body.result_code == 4) {
              resolve();
            }
            reject();
          }else {
            console.log('error: '+ response.statusCode);
            console.log(response.text);
            reject();
          }
        });
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
          console.log(body);
          body = JSON.parse(body);
          console.log(body.result_message);
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
          console.log(body.result_message);
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
          // console.log(body);
          body = JSON.parse(body);
          console.log(body.result_message);
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

  private queryLeftTicket(): Promise<void> {
    var query = {
      "leftTicketDTO.train_date": this.TRAIN_DATE
      ,"leftTicketDTO.from_station":"SHH"
      ,"leftTicketDTO.to_station":"UUH"
      ,"purpose_codes": "ADULT"
    }

    var param = querystring.stringify(query);

    var url = "https://kyfw.12306.cn/otn/leftTicket/queryZ?"+param;

    return new Promise((resolve, reject)=> {
      this.request(url, (error, response, body)=> {
        if(error) throw error;
        // console.log(response.statusCode);
        // console.log(body);
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
          reject();
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
        if(error) throw error;

        if(response.statusCode === 200) {
          body = JSON.parse(body)
          if(body.data.flag) {
            return resolve();
          }
          return reject(body);
        }
        reject(response.statusMessage);
      });
    });
  }

  private submitOrderRequest(secretStr: string): Promise<object>  {
    var url = "https://kyfw.12306.cn/otn/leftTicket/submitOrderRequest";

    var data = {
      "secretStr": querystring.unescape(secretStr)
      ,"train_date": this.TRAIN_DATE
      ,"back_train_date": this.BACK_TRAIN_DATE
      ,"tour_flag": "dc"
      ,"purpose_codes": "ADULT"
      ,"query_from_station_name": "上海"
      ,"query_to_station_name": "徐州东"
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
          if(body.status) {
            return resolve(body);
          }
          return reject(body.messages[0]);
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

  private getPassengers(token: string): Promise {
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

    return new Promise((resolve, reject)=> {
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
  private getPassengerTickets(passengers): string {
    var tickets = [];
    passengers.forEach(passenger=> {
      if(this.PLAN_PEPOLES.includes(passenger.passenger_name)) {
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

  private getOldPassengers(passengers): string {
    var tickets = [];
    passengers.forEach(passenger=> {
      if(this.PLAN_PEPOLES.includes(passenger.passenger_name)) {
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

  private checkOrderInfo(submitToken, passengers) {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo";

    var data = {
      "cancel_flag": 2
      ,"bed_level_order_num": "000000000000000000000000000000"
      ,"passengerTicketStr": this.getPassengerTickets(passengers)
      ,"oldPassengerStr": this.getOldPassengers(passengers)
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

    return new Promise((resolve, reject)=> {
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
            return resolve(JSON.parse(body));
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

  private confirmSingleForQueue(token, passengers, ticketInfoForPassengerForm) {
    var url = "https://kyfw.12306.cn/otn/confirmPassenger/confirmSingleForQueue";
    var data = {
      "passengerTicketStr": this.getPassengerTickets(passengers)
      ,"oldPassengerStr": this.getOldPassengers(passengers)
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
}
