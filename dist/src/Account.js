"use strict";
// https://www.lanindex.com/12306%E8%B4%AD%E7%A5%A8%E6%B5%81%E7%A8%8B%E5%85%A8%E8%A7%A3%E6%9E%90/
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var winston = require("winston");
var FileCookieStore_1 = require("./FileCookieStore");
var Station_1 = require("./Station");
var request = require("request");
var querystring = require("querystring");
var fs = require("fs");
var readline = require("readline");
var process = require("process");
var Rx = require("@reactivex/rxjs");
var chalk = require("chalk");
var columnify = require("columnify");
var Account = /** @class */ (function () {
    function Account(name, userPassword) {
        this.checkUserTimer = Rx.Observable.timer(0, 1000 * 60 * 20);
        this.stations = new Station_1.Station();
        this.SYSTEM_BUSSY = "System is bussy";
        this.SYSTEM_MOVED = "Moved Temporarily";
        this.headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17",
            "Host": "kyfw.12306.cn",
            "Origin": "https://kyfw.12306.cn",
            "Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/"
        };
        this.TICKET_TITLE = ['', '', '', '车次', '起始', '终点', '出发', '到达', '出发', '到达', '历时', '', '',
            '日期', '', '', '', '', '', '', '', '高级软卧', '', '软卧', '软座', '特等座', '无座',
            '', '硬卧', '硬座', '二等座', '一等座', '商务座'];
        this.query = false;
        this.orders = [];
        this.nextOrderNum = 0;
        this.sjLfTicketInit = new Rx.Subject();
        this.sjQueryLfTicket = new Rx.Subject();
        this.sjSmOReqCheckUser = new Rx.Subject();
        this.sjSmOrderReq = new Rx.Subject();
        this.sjCPasInitDc = new Rx.Subject();
        this.sjGetPassengers = new Rx.Subject();
        this.sjCheckOrderInfo = new Rx.ReplaySubject();
        this.sjGetQueueCount = new Rx.Subject();
        this.sjGetPassCodeNew = new Rx.Subject();
        this.sjConfirmSingle4Q = new Rx.Subject();
        this.sjQueryOrderWaitT = new Rx.ReplaySubject();
        this.userName = name;
        this.userPassword = userPassword;
        this.setRequest();
        this.build();
    }
    /**
     * 检查网络异常
     */
    Account.prototype.isSystemBussy = function (body) {
        return body.indexOf("网络可能存在问题，请您重试一下") > 0;
    };
    Account.prototype.setRequest = function () {
        var cookieFileName = "./cookies/" + this.userName + ".json";
        var fileStore = new FileCookieStore_1.FileCookieStore(cookieFileName, { encrypt: false });
        fileStore.option = { encrypt: false };
        this.cookiejar = request.jar(fileStore);
        this.request = request.defaults({ jar: this.cookiejar });
    };
    Account.prototype.nextOrder = function () {
        this.nextOrderNum = (this.nextOrderNum + 1) % this.orders.length;
        return this.orders[this.nextOrderNum];
    };
    Account.prototype.currentOrder = function () {
        return this.orders[this.nextOrderNum];
    };
    Account.prototype.createOrder = function (trainDates, backTrainDate, _a, planTrains, planPepoles, seatClasses) {
        var _this = this;
        var fromStationName = _a[0], toStationName = _a[1], passStationName = _a[2];
        trainDates.forEach(function (trainDate) {
            _this.orders.push({
                trainDate: trainDate,
                backTrainDate: backTrainDate,
                fromStationName: fromStationName,
                toStationName: toStationName,
                passStationName: passStationName,
                PLAN_TRAINS: planTrains,
                planPepoles: planPepoles,
                FROM_STATION: _this.stations.getStationCode(fromStationName),
                TO_STATION: _this.stations.getStationCode(toStationName),
                seatClasses: seatClasses
            });
        });
        return this;
    };
    Account.prototype.orderWaitTime = function () {
        var _this = this;
        var sjOrderWaitTime = new Rx.Subject();
        this.buildLoginFlow(sjOrderWaitTime)
            .subscribe(function () { return _this.sjQueryOrderWaitT.next(); });
        sjOrderWaitTime.next();
    };
    Account.prototype.cancelOrderQueue = function () {
        this.cancelQueueNoCompleteOrder()
            .then(function (x) {
            if (x.status && x.data.existError == 'N') {
                console.log(chalk(templateObject_1 || (templateObject_1 = __makeTemplateObject(["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"], ["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"]))));
            }
            else {
                console.error(x);
            }
        }, function (error) { return console.error(error); });
    };
    Account.prototype.submit = function () {
        var _this = this;
        var sjL = new Rx.Subject();
        var sjCheckUser = new Rx.Subject();
        this.buildLoginFlow(sjL)
            .subscribe(function () {
            _this.buildOrderFlow().next();
            _this.scptCheckUserTimer =
                _this.checkUserTimer.subscribe(function (i) {
                    // console.log(i);
                    sjCheckUser.next();
                });
        });
        //
        this.buildCheckUserFlow(sjCheckUser)
            .subscribe(function () { return winston.debug("Check user done"); });
        sjL.next();
    };
    Account.prototype.buildAuthFlow = function (subject, sjNewAppToken, sjAppToken) {
        var _this = this;
        if (sjNewAppToken === void 0) { sjNewAppToken = new Rx.ReplaySubject(); }
        if (sjAppToken === void 0) { sjAppToken = new Rx.ReplaySubject(); }
        var sjCaptcha = new Rx.ReplaySubject();
        var sjLogin = new Rx.ReplaySubject();
        var sjMyPage = new Rx.Subject();
        subject.subscribe(sjCaptcha);
        sjCaptcha.mergeMap(function () { return _this.getCaptcha(); })
            .mergeMap(function () { return _this.checkCaptcha().then(function () {
            // 校验码成功后进行授权认证
            console.log(chalk(templateObject_2 || (templateObject_2 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
        }, function (err) {
            // 校验失败，重新校验
            console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"]))));
            return Promise.reject(err);
        }); })
            .retry(Number.MAX_SAFE_INTEGER)
            .subscribe(function () { return sjLogin.next(1); }, function (err) { return console.error(err); });
        sjLogin
            .mergeMap(function () {
            return _this.userAuthenticate()
                .then(function () {
                console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
            }, function (err) {
                /*
                {"result_message":"密码输入错误。如果输错次数超过4次，用户将被锁定。","result_code":1}
                {"result_message":"验证码校验失败","result_code":"5"}
                */
                if (typeof err.result_code == "undefined") {
                    return Promise.reject(err);
                }
                else {
                    console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err.result_message));
                    return err;
                    // if(error.result_code === 1) {
                    //   throw error.result_message;
                    // }else if(error.result_code === 5) {
                    //   this.sjCaptcha.next();
                    // }else {
                    //   this.sjCaptcha.next();
                    // }
                }
            });
        })
            .retry(Number.MAX_SAFE_INTEGER)
            .subscribe(function (err) {
            // 登录失败将重新从校验码开始
            if (err) {
                sjCaptcha.next(1);
            }
            else {
                sjNewAppToken.next();
            }
        });
        ;
        sjNewAppToken
            .mergeMap(function () { return _this.getNewAppToken(); })
            .subscribe(function (newapptk) {
            sjAppToken.next(newapptk);
        }, function (err) {
            sjCaptcha.next(1);
        });
        sjAppToken
            .mergeMap(function (newapptk) { return _this.getAppToken(newapptk)
            .then(function (x) { return ; }, function (err) {
            console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"]))));
            console.log(err);
            if (err.result_code && err.result_code === 2) {
                return err;
            }
            else {
                return Promise.reject(err);
            }
        }); })
            .retry(Number.MAX_SAFE_INTEGER)
            .subscribe(function (err) {
            if (err) {
                sjCaptcha.next(1);
            }
            else {
                sjMyPage.next();
            }
        }, function (error) {
            console.log(error);
        });
        return sjMyPage;
    };
    Account.prototype.build = function () {
        var _this = this;
        this.sjQueryOrderWaitT
            .mergeMap(function (orderRequest) {
            return _this.queryOrderWaitTime(orderRequest && (orderRequest.token || ""))
                .then(function (orderQueue) {
                if (orderQueue.status) {
                    if (orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
                        return console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["Your ticket order number is {red.bold ", "}"], ["Your ticket order number is {red.bold ", "}"])), orderQueue.data.orderId));
                    }
                    else if (orderQueue.data.waitTime === -2) {
                        if (orderQueue.data.msg) {
                            return console.log(chalk(templateObject_8 || (templateObject_8 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), orderQueue.data.msg));
                        }
                        return console.log(orderQueue);
                    }
                    else if (orderQueue.data.waitTime === -3) {
                        return console.log("Your ticket request has been canceled!");
                    }
                    else if (orderQueue.data.waitTime === -4) {
                        console.log("Your ticket request is being processed, please wait a moment!");
                    }
                    else {
                        console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"], ["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
                    }
                }
                else {
                    console.log(orderQueue);
                }
                return new Promise(function (resolve, reject) {
                    setTimeout(function (x) {
                        reject();
                    }, 4000);
                });
            }, function (err) {
                console.error(err);
                return Promise.reject(err);
            });
        })
            .retry(Number.MAX_SAFE_INTEGER)
            .subscribe(function (orderRequest) {
            console.log(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
            _this.scptCheckUserTimer && _this.scptCheckUserTimer.unsubscribe();
        }, function (err) { return console.log(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); });
    };
    Account.prototype.buildLoginFlow = function (observable) {
        var _this = this;
        var sjLoginInit = new Rx.ReplaySubject();
        var sjCaptcha = new Rx.Subject();
        var sjNewAppToken = new Rx.ReplaySubject();
        var sjAppToken = new Rx.ReplaySubject();
        observable.subscribe(sjLoginInit);
        // 登录初始化
        sjLoginInit
            .mergeMap(function (order) { return _this.loginInit(); })
            .retry(Number.MAX_SAFE_INTEGER)
            .map(function (order) { return _this.checkAuthentication(_this.cookiejar._jar.toJSON().cookies); })
            .subscribe(function (tokens) {
            if (tokens.tk) {
                return sjAppToken.next(tokens.tk);
            }
            else if (tokens.uamtk) {
                return sjNewAppToken.next();
            }
            sjCaptcha.next(1);
        });
        return this.buildAuthFlow(sjCaptcha, sjNewAppToken, sjAppToken);
    };
    Account.prototype.buildQueryLeftTicketFlow = function (observable) {
        var _this = this;
        var sjQueryLfTicket = new Rx.ReplaySubject();
        observable.subscribe(sjQueryLfTicket);
        return sjQueryLfTicket
            .do(function (order) {
            // this.setOrder(order);
            if (_this.query) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
            }
        })
            .mergeMap(function (order) {
            return _this.queryLeftTickets(order.trainDate, order.fromStationName, order.toStationName, order.PLAN_TRAINS)
                .then(function (trains) {
                order.trains = trains;
                return order;
            }, function (err) { return console.error(err); });
        })
            .mergeMap(function (order) {
            if (order.passStationName) {
                if (!order.fromToPassTrains) {
                    return _this.queryLeftTickets(order.trainDate, order.fromStationName, order.passStationName, order.PLAN_TRAINS)
                        .then(function (passTrains) {
                        order.fromToPassTrains = passTrains.map(function (train) { return train[3]; });
                        return order;
                    });
                }
                else {
                    return Promise.resolve(order);
                }
            }
            else {
                return Promise.resolve(order);
            }
        })
            .map(function (order) {
            if (order.fromToPassTrains) {
                order.trains = order.trains.filter(function (train) { return order.fromToPassTrains.includes(train[3]); });
            }
            return order;
        })
            .map(function (order) {
            var trains = order.trains || [];
            var planTrains = [], that = _this;
            trains.some(function (train) {
                return order.seatClasses.some(function (seat) {
                    var seatNum = _this.TICKET_TITLE.indexOf(seat);
                    if (train[seatNum] == "有" || train[seatNum] > 0) {
                        console.log(order.trainDate + "/" + train[3] + "/" + train[seatNum]);
                        if (order.PLAN_TRAINS.includes(train[3])) {
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
    };
    Account.prototype.buildOrderFlow = function () {
        var _this = this;
        var sjQueryLfTicket = new Rx.Subject();
        var sjSmOReqCheckUser = new Rx.Subject();
        // 初始化查询火车余票页面
        this.sjLfTicketInit.subscribe(function () {
            _this.leftTicketInit()
                .then(function () { return sjQueryLfTicket.next(_this.nextOrder()); }, function (error) {
                winston.error(error);
            });
        });
        this.buildQueryLeftTicketFlow(sjQueryLfTicket)
            .subscribe(function (order) {
            if (order.availableTrains.length > 0) {
                _this.query = false;
                // process.stdout.write(chalk`{yellow 有可购买余票 ${planTrain.toString()}}`);
                order.trainSecretStr = order.availableTrains[0][0];
                sjSmOReqCheckUser.next(order);
            }
            else {
                // console.log(chalk`{yellow 没有可购买余票 ${this.TRAIN_DATE[i]}}`);
                process.stdout.write(chalk(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"], ["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"])), order.fromStationName, order.toStationName, order.passStationName ? '途经' + order.passStationName + ' ' : '', order.trainDate));
                setTimeout(function () {
                    sjQueryLfTicket.next(_this.nextOrder());
                }, 1500);
                _this.query = true;
            }
        }, function (err) {
            console.error(err);
        });
        this.buildCheckUserFlow(sjSmOReqCheckUser)
            .subscribe(function (order) { return _this.sjSmOrderReq.next(_this.currentOrder()); });
        // Step 11 预提交订单，Post
        this.sjSmOrderReq.subscribe(function (order) {
            console.log("submit order request");
            _this.submitOrderRequest(order)
                .then(function (body) {
                if (body.status) {
                    winston.debug(chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["{yellow Submit Order Request success!}"], ["{yellow Submit Order Request success!}"]))));
                    _this.sjCPasInitDc.next(order);
                }
                else {
                    // 您还有未处理的订单
                    // 该车次暂不办理业务
                    console.error(chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.messages[0]));
                }
            }, function (error) {
                winston.error("SubmitOrderRequest error " + error);
                _this.sjSmOrderReq.next(order);
            });
        });
        // Step 12 模拟跳转页面InitDc，Post
        this.sjCPasInitDc.subscribe(function (order) {
            _this.confirmPassengerInitDc().then(function (orderRequest) {
                winston.debug("confirmPassenger Init Dc success! " + orderRequest.token);
                order.request = orderRequest;
                // console.log(orderRequest.ticketInfo);
                if (_this.passengers) {
                    order.request.passengers = _this.passengers;
                    _this.sjCheckOrderInfo.next(order);
                }
                else {
                    _this.sjGetPassengers.next(order);
                }
            }, function (error) {
                if (error == _this.SYSTEM_BUSSY) {
                    console.log(error);
                    _this.sjCPasInitDc.next(order);
                }
                else if (error == _this.SYSTEM_MOVED) {
                    console.log(error);
                    _this.sjCPasInitDc.next(order);
                }
                else {
                    console.error(error);
                }
            }).catch(function (error) { return console.error(error); });
        });
        // Step 13 常用联系人确定，Post
        this.sjGetPassengers.subscribe(function (order) {
            _this.getPassengers(order.request.token).then(function (passengers) {
                _this.passengers = passengers;
                order.request.passengers = passengers;
                _this.sjCheckOrderInfo.next(order);
            }, function (error) {
                winston.error(error + " Retry get passengers");
                _this.sjGetPassengers.next(order);
            })
                .catch(function (error) { return winston.error(error); });
        });
        this.sjCheckOrderInfo
            .mergeMap(function (order) {
            // Step 14 购票人确定，Post
            return _this.checkOrderInfo(order.request.token, order.request.passengers.data.normal_passengers, order.planPepoles)
                .then(function (orderInfo) {
                // console.log(orderInfo);
                order.request.orderInfo = orderInfo;
                return order;
            }, function (err) {
                if (err == "没有相关联系人") {
                    return err;
                }
                else {
                    return Promise.reject(err);
                }
            });
        })
            .retry(100)
            .mergeMap(function (order) {
            if (typeof order == "string") {
                return Promise.reject(order);
            }
            else {
                return Promise.resolve(order);
            }
        })
            .mergeMap(function (order) {
            return _this.getQueueCount(order.request.token, order.request.orderRequest, order.request.ticketInfo)
                .then(function (response) {
                order.request.queueInfo = response;
                return order;
            }, function (err) { return Promise.reject(err); });
        })
            .subscribe(function (order) {
            // console.log(order.queueInfo);
            // 若 Step 14 中的 "ifShowPassCode" = "Y"，那么多了输入验证码这一步，Post
            if (order.request.orderInfo.data.ifShowPassCode == "Y") {
                _this.sjGetPassCodeNew.next(order);
            }
            else {
                // Step 17 确认购买，Post
                _this.sjConfirmSingle4Q.next(order);
            }
        }, function (err) { return console.error(err); });
        this.sjGetPassCodeNew.subscribe(function (order) {
            // Step 16 乘客买票验证码，Get POST
            _this.getPassCodeNew().then(function () { return _this.checkRandCodeAnsyn(); })
                .then(function (x) {
                console.log(x);
                _this.sjConfirmSingle4Q.next(order);
            }, function (error) { return console.error(error); });
        });
        this.sjConfirmSingle4Q.subscribe(function (order) {
            _this.confirmSingleForQueue(order.request.token, order.request.passengers.data.normal_passengers, order.request.ticketInfo, order.planPepoles)
                .then(function (x) {
                if (x.status && x.data.submitStatus) {
                    // Step 18 查询排队等待时间！
                    _this.sjQueryOrderWaitT.next(order);
                }
                else {
                    /**
                    { validateMessagesShowId: '_validatorMessage',
                      status: true,
                      httpstatus: 200,
                      data: { errMsg: '余票不足！', submitStatus: false },
                      messages: [],
                      validateMessages: {} }
                    */
                    console.log(chalk(templateObject_15 || (templateObject_15 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), x.data.errMsg));
                    // 重新开始查询
                    sjQueryLfTicket.next(_this.nextOrder());
                }
            }, function (error) {
                console.error(error);
                _this.sjConfirmSingle4Q.next(order);
            });
        });
        return this.sjLfTicketInit;
    };
    Account.prototype.buildCheckUserFlow = function (observable) {
        var _this = this;
        var sjCheckUser = new Rx.ReplaySubject();
        var sjLogin = new Rx.Subject();
        var sjAuthed = new Rx.Subject();
        observable.subscribe(sjCheckUser);
        // Step 10 验证登录，Post
        sjCheckUser
            .mergeMap(function () { return _this.checkUser(); })
            .retry(1000)
            .subscribe(function (body) {
            if (body.data.flag) {
                // console.log('login success');
                sjAuthed.next();
            }
            else {
                sjLogin.next();
            }
            // console.log("submit order request check user");
        }, function (err) {
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
            .subscribe(function () { return sjAuthed.next(); }, function (err) { return console.error(err); });
        return sjAuthed;
    };
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
    Account.prototype.queryLeftTickets = function (trainDate, fromStationName, toStationName, trainNames) {
        var _this = this;
        if (!trainDate) {
            console.log(chalk(templateObject_16 || (templateObject_16 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"], ["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"]))));
            return Promise.reject();
        }
        this.BACK_TRAIN_DATE = trainDate;
        if (!fromStationName) {
            console.log(chalk(templateObject_17 || (templateObject_17 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"]))));
            return Promise.reject();
        }
        this.FROM_STATION_NAME = fromStationName;
        if (!toStationName) {
            console.log(chalk(templateObject_18 || (templateObject_18 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"]))));
            return Promise.reject();
        }
        this.TO_STATION_NAME = toStationName;
        this.FROM_STATION = this.stations.getStationCode(fromStationName);
        this.TO_STATION = this.stations.getStationCode(toStationName);
        return Rx.Observable.of(1)
            .mergeMap(function () { return _this.queryLeftTicket(trainDate)
            .then(function (trainsData) { return trainsData; }, function (err) {
            console.error(chalk(templateObject_19 || (templateObject_19 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), error));
            return Promise.reject(err);
        }); })
            .retry(Number.MAX_SAFE_INTEGER)
            .map(function (trainsData) { return trainsData.result; })
            .map(function (result) {
            var trains = [];
            result.forEach(function (element) {
                var train = element.split("|");
                train[4] = _this.stations.getStationName(train[4]);
                train[5] = _this.stations.getStationName(train[5]);
                train[6] = _this.stations.getStationName(train[6]);
                train[7] = _this.stations.getStationName(train[7]);
                train[11] = train[11] == "IS_TIME_NOT_BUY" ? "列车停运" : train[11];
                // train[11] = train[11] == "N" ? "无票":train[11];
                // train[11] = train[11] == "Y" ? "有票":train[11];
                // 匹配输入的列车名称的正则表达式条件
                if (!trainNames || trainNames.filter(function (tn) { return train[3].match(new RegExp(tn)) != null; }).length > 0) {
                    trains.push(train);
                }
            });
            return trains;
        })
            .toPromise();
    };
    /**
     * 查询列车余票信息
     *
     * @param trainDate 乘车日期
     * @param fromStationName 出发站
     * @param passStationName 途经站
     * @param toStationName 到达站
     *
     * @return void
     */
    Account.prototype.passStationTickets = function (trainDate, fromStationName, passStationName, toStationName, trainNames) {
        var _this = this;
        var planTrainNames = (trainNames ? trainNames.split(',') : null);
        this.queryLeftTickets(trainDate, fromStationName, toStationName, planTrainNames)
            .then(function (trains) {
            trains = trains.map(function (train) { return train[3]; });
            _this.queryLeftTickets(trainDate, fromStationName, passStationName, planTrainNames)
                .then(function (passTrains) {
                var result = passTrains.filter(function (train) { return trains.includes(train[3]); });
                result = _this.renderTrainListTitle(result);
                _this.renderLeftTickets(result);
            });
        });
    };
    /**
     * 查询列车余票信息
     *
     * @param trainDate 乘车日期
     * @param fromStationName 出发站
     * @param toStationName 到达站
     * @param trainNames 列车
     *
     * @return void
     */
    Account.prototype.leftTickets = function (trainDate, fromStationName, toStationName, trainNames) {
        var _this = this;
        this.queryLeftTickets(trainDate, fromStationName, toStationName, (trainNames ? trainNames.split(',') : null))
            .then(function (trains) {
            trains = _this.renderTrainListTitle(trains);
            _this.renderLeftTickets(trains);
        });
    };
    Account.prototype.renderTrainListTitle = function (trains) {
        var title = this.TICKET_TITLE.map(function (t) { return chalk(templateObject_20 || (templateObject_20 = __makeTemplateObject(["{blue ", "}"], ["{blue ", "}"])), t); });
        trains.forEach(function (train, index) {
            if (index % 30 === 0) {
                trains.splice(index, 0, title);
            }
        });
        return trains;
    };
    Account.prototype.renderLeftTickets = function (trains) {
        var columns = columnify(trains, {
            columnSplitter: '|',
            columns: ["3", "4", "5", "6", "7", "8", "9", "10", "11", "20", "21", "22", "23", "24", "25",
                "26", "27", "28", "29", "30", "31", "32"]
        });
        console.log(columns);
    };
    Account.prototype.myOrderNoCompleteReport = function () {
        var _this = this;
        var subjectOrderNoComplete = new Rx.Subject();
        subjectOrderNoComplete.subscribe(function () {
            _this.initNoComplete().then(function () {
                _this.queryMyOrderNoComplete().then(function (x) {
                    var columns = columnify(x, {
                        columnSplitter: ' | '
                    });
                    console.log(columns);
                }, function (error) {
                    console.error(error);
                    setTimeout(function () { return subjectOrderNoComplete.next(); }, 1000);
                });
            }, function (error) { return console.error(error); });
        });
        subjectOrderNoComplete.next();
    };
    Account.prototype.loginInit = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/login/init";
        var options = {
            url: url,
            method: "GET",
            headers: this.headers
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    return reject(error.toString());
                if (response.statusCode === 200) {
                    return resolve();
                }
                reject(response.statusCode);
            });
        });
    };
    Account.prototype.getCaptcha = function () {
        var _this = this;
        var data = {
            "login_site": "E",
            "module": "login",
            "rand": "sjrand",
            "0.17231872703389062": ""
        };
        var param = querystring.stringify(data, null, null);
        var url = "https://kyfw.12306.cn/passport/captcha/captcha-image?" + param;
        var options = {
            url: url,
            headers: this.headers
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error) {
                    console.error(error);
                    reject(error);
                }
            }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function () {
                resolve();
            });
        });
    };
    Account.prototype.questionCaptcha = function () {
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(function (resolve, reject) {
            rl.question(chalk(templateObject_21 || (templateObject_21 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positionStr) {
                rl.close();
                if (typeof positionStr == "string") {
                    var positions_1 = [];
                    positionStr.split(',').forEach(function (el) { return positions_1 = positions_1.concat(el.split(' ')); });
                    resolve(positions_1.map(function (position) {
                        switch (position) {
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
                }
                else {
                    reject("输入格式错误");
                }
            });
        });
    };
    Account.prototype.checkCaptcha = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/passport/captcha/captcha-check";
        return new Promise(function (resolve, reject) {
            _this.questionCaptcha().then(function (positions) {
                var data = {
                    "answer": positions,
                    "login_site": "E",
                    "rand": "sjrand"
                };
                var options = {
                    url: url,
                    headers: _this.headers,
                    method: 'POST',
                    form: data
                };
                _this.request(options, function (error, response, body) {
                    if (error) {
                        console.error(error);
                    }
                    if (response.statusCode === 200) {
                        body = JSON.parse(body);
                        // console.log(body.result_message);
                        if (body.result_code == 4) {
                            resolve();
                        }
                        reject();
                    }
                    else {
                        console.log('error: ' + response.statusCode);
                        console.log(response.text);
                        reject();
                    }
                });
            }, function (error) {
                console.error(error);
            });
        });
    };
    Account.prototype.userAuthenticate = function () {
        var _this = this;
        // 发送登录信息
        var data = {
            "appid": "otn",
            "username": this.userName,
            "password": this.userPassword
        };
        var url = "https://kyfw.12306.cn/passport/web/login";
        var options = {
            url: url,
            headers: this.headers,
            method: 'POST',
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    return reject(error);
                if (response.statusCode === 200) {
                    // console.log(body);
                    body = JSON.parse(body);
                    // console.log(body.result_message);
                    if (body.result_code == 2) {
                        throw body.result_message;
                    }
                    else if (body.result_code != 0) {
                        reject(body);
                    }
                    else {
                        resolve(body.uamtk);
                    }
                }
                else {
                    reject(response);
                }
            });
        });
    };
    Account.prototype.getNewAppToken = function () {
        var _this = this;
        var data = {
            "appid": "otn"
        };
        var options = {
            url: "https://kyfw.12306.cn/passport/web/auth/uamtk",
            headers: this.headers,
            method: 'POST',
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    // console.log(body);
                    body = JSON.parse(body);
                    console.log(body.result_message);
                    if (body.result_code == 0) {
                        resolve(body.newapptk);
                    }
                    else {
                        reject(body);
                    }
                }
                else {
                    reject(response);
                }
            });
        });
    };
    Account.prototype.getMy12306 = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.request({
                url: "https://kyfw.12306.cn/otn/index/initMy12306",
                headers: _this.headers,
                method: "GET"
            }, function (error, response, body) {
                if (response.statusCode === 200) {
                    console.log("Got my 12306");
                    return resolve();
                }
                reject();
            });
        });
    };
    Account.prototype.checkAuthentication = function (cookies) {
        var uamtk = "", tk = "";
        for (var i = 0; i < cookies.length; i++) {
            if (cookies[i].key == "uamtk") {
                uamtk = cookies[i].value;
            }
            if (cookies[i].key == "tk") {
                tk = cookies[i].value;
            }
        }
        return {
            uamtk: uamtk,
            tk: tk
        };
    };
    /**
     *
     */
    Account.prototype.getAppToken = function (newapptk) {
        var _this = this;
        var data = {
            "tk": newapptk
        };
        var options = {
            url: "https://kyfw.12306.cn/otn/uamauthclient",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17",
                "Host": "kyfw.12306.cn",
                "Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/",
                'content-type': 'application/x-www-form-urlencoded'
            },
            method: 'POST',
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    // console.log(body);
                    body = JSON.parse(body);
                    console.log(body.result_message);
                    if (body.result_code == 0) {
                        resolve(body.apptk);
                    }
                    else {
                        reject(body);
                    }
                }
                else {
                    reject(response.statusCode);
                }
            });
        });
    };
    Account.prototype.leftTicketInit = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/leftTicket/init";
        return new Promise(function (resolve, reject) {
            _this.request(url, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    return resolve();
                }
                reject(response.statusText);
            });
        });
    };
    Account.prototype.queryLeftTicket = function (trainDate) {
        var _this = this;
        var query = {
            "leftTicketDTO.train_date": trainDate,
            "leftTicketDTO.from_station": this.FROM_STATION,
            "leftTicketDTO.to_station": this.TO_STATION,
            "purpose_codes": "ADULT"
        };
        var param = querystring.stringify(query);
        var url = "https://kyfw.12306.cn/otn/leftTicket/queryZ?" + param;
        return new Promise(function (resolve, reject) {
            _this.request(url, function (error, response, body) {
                if (error) {
                    return reject(error.toString());
                }
                // console.log(response.statusCode);
                // console.log(body);
                if (response.statusCode === 200) {
                    if (!body) {
                        return reject(response.statusCode);
                    }
                    if (body.indexOf("请您重试一下") > 0) {
                        reject("系统繁忙!");
                    }
                    else {
                        try {
                            var data = JSON.parse(body).data;
                        }
                        catch (err) {
                            console.log(body);
                            reject(err);
                        }
                        resolve(data);
                    }
                }
                else {
                    console.log(response.statusCode);
                    reject();
                }
            });
        });
    };
    Account.prototype.checkUser = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/login/checkUser";
        var data = {
            "_json_att": ""
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "If-Modified-Since": "0",
                "Cache-Control": "no-cache",
                "Referer": "https://kyfw.12306.cn/otn/leftTicket/init"
            }),
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    return reject(error);
                if (response.statusCode === 200) {
                    body = JSON.parse(body);
                    return resolve(body);
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.submitOrderRequest = function (_a) {
        var _this = this;
        var trainSecretStr = _a.trainSecretStr, trainDate = _a.trainDate, backTrainDate = _a.backTrainDate, fromStationName = _a.fromStationName, toStationName = _a.toStationName;
        var url = "https://kyfw.12306.cn/otn/leftTicket/submitOrderRequest";
        var data = {
            "secretStr": querystring.unescape(trainSecretStr),
            "train_date": trainDate,
            "back_train_date": backTrainDate,
            "tour_flag": "dc",
            "purpose_codes": "ADULT",
            "query_from_station_name": fromStationName,
            "query_to_station_name": toStationName,
            "undefined": ""
        };
        // url = url + "secretStr="+secretStr+"&train_date=2018-01-31&back_train_date=2018-01-30&tour_flag=dc&purpose_codes=ADULT&query_from_station_name=上海&query_to_station_name=徐州东&undefined";
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "If-Modified-Since": "0",
                "Cache-Control": "no-cache",
                "Referer": "https://kyfw.12306.cn/otn/leftTicket/init"
            }),
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    body = JSON.parse(body);
                    return resolve(body);
                }
                reject(response.statusCode);
            });
        });
    };
    Account.prototype.confirmPassengerInitDc = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/initDc";
        var data = {
            "_json_att": ""
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Content-Type": "application/x-www-form-urlencoded",
                "Referer": "https://kyfw.12306.cn/otn/leftTicket/init",
                "Upgrade-Insecure-Requests": 1
            }),
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    if (_this.isSystemBussy(body)) {
                        return reject(_this.SYSTEM_BUSSY);
                    }
                    if (body) {
                        // Get Repeat Submit Token
                        var token = body.match(/var globalRepeatSubmitToken = '(.*?)';/);
                        var ticketInfoForPassengerForm = body.match(/var ticketInfoForPassengerForm=(.*?);/);
                        var orderRequestDTO = body.match(/var orderRequestDTO=(.*?);/);
                        if (token) {
                            return resolve({
                                token: token[1],
                                ticketInfo: ticketInfoForPassengerForm && JSON.parse(ticketInfoForPassengerForm[1].replace(/'/g, "\"")),
                                orderRequest: orderRequestDTO && JSON.parse(orderRequestDTO[1].replace(/'/g, "\""))
                            });
                        }
                    }
                    return reject(_this.SYSTEM_BUSSY);
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.getPassengers = function (token) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/getPassengerDTOs";
        var data = {
            "_json_att": "",
            "REPEAT_SUBMIT_TOKEN": token
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            }),
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    if ((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
                        return resolve(JSON.parse(body));
                    }
                }
                reject(response.statusMessage);
            });
        });
    };
    /* seat type
    ‘软卧’ => ‘4’,
    ‘二等座’ => ‘O’,
    ‘一等座’ => ‘M’,
    ‘硬座’ => ‘1’,
     */
    Account.prototype.getPassengerTickets = function (passengers, planPepoles) {
        var tickets = [];
        passengers.forEach(function (passenger) {
            if (planPepoles.includes(passenger.passenger_name)) {
                //座位类型,0,票类型(成人/儿童),name,身份类型(身份证/军官证....),身份证,电话号码,保存状态
                var ticket = "O" +
                    ",0," +
                    /*limit_tickets[aA].ticket_type*/ "1" + "," +
                    passenger.passenger_name + "," +
                    passenger.passenger_id_type_code + "," +
                    passenger.passenger_id_no + "," +
                    (passenger.phone_no || "") + "," +
                    "N";
                tickets.push(ticket);
            }
        });
        return tickets.join("_");
    };
    Account.prototype.getOldPassengers = function (passengers, planPepoles) {
        var tickets = [];
        passengers.forEach(function (passenger) {
            if (planPepoles.includes(passenger.passenger_name)) {
                //name,身份类型,身份证,1_
                var ticket = passenger.passenger_name + "," +
                    passenger.passenger_id_type_code + "," +
                    passenger.passenger_id_no + "," +
                    "1";
                tickets.push(ticket);
            }
        });
        return tickets.join("_") + "_";
    };
    Account.prototype.checkOrderInfo = function (submitToken, passengers, planPepoles) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo";
        var passengerTicketStr = this.getPassengerTickets(passengers, planPepoles);
        var data = {
            "cancel_flag": 2,
            "bed_level_order_num": "000000000000000000000000000000",
            "passengerTicketStr": passengerTicketStr,
            "oldPassengerStr": this.getOldPassengers(passengers, planPepoles),
            "tour_flag": "dc",
            "randCode": "",
            "whatsSelect": 1,
            "_json_att": "",
            "REPEAT_SUBMIT_TOKEN": submitToken
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            }),
            form: data
        };
        return new Promise(function (resolve, reject) {
            if (!passengerTicketStr) {
                throw "没有相关联系人";
            }
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    if ((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
                        var result = JSON.parse(body);
                        /*
                          { validateMessagesShowId: '_validatorMessage',
                            url: '/leftTicket/init',
                            status: false,
                            httpstatus: 200,
                            messages: [ '系统忙，请稍后重试' ],
                            validateMessages: {} }
                         */
                        if (result.status) {
                            return resolve(result);
                        }
                        else {
                            return reject(result.messages[0]);
                        }
                    }
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.getQueueCount = function (token, orderRequestDTO, ticketInfo) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/getQueueCount";
        var data = {
            "train_date": new Date(orderRequestDTO.train_date.time).toString(),
            "train_no": orderRequestDTO.train_no,
            "stationTrainCode": orderRequestDTO.station_train_code,
            "seatType": 1,
            "fromStationTelecode": orderRequestDTO.from_station_telecode,
            "toStationTelecode": orderRequestDTO.to_station_telecode,
            "leftTicket": ticketInfo.queryLeftTicketRequestDTO.ypInfoDetail,
            "purpose_codes": "00",
            "train_location": ticketInfo.train_location,
            "_json_att": "",
            "REPEAT_SUBMIT_TOKEN": token
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            }),
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    if ((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
                        /*
                          { validateMessagesShowId: '_validatorMessage',
                            status: false,
                            httpstatus: 200,
                            messages: [ '系统繁忙，请稍后重试！' ],
                            validateMessages: {} }
                         */
                        var result = JSON.parse(body);
                        if (result.status) {
                            return resolve(result);
                        }
                        else {
                            return reject(result.messages[0]);
                        }
                    }
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.getPassCodeNew = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/passcodeNew/getPassCodeNew?module=passenger&rand=randp&" + Math.random(0, 1);
        var options = {
            url: url,
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            })
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode !== 200)
                    reject(response.statusMessage);
            }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function () {
                resolve();
            });
        });
    };
    Account.prototype.checkRandCodeAnsyn = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/passcodeNew/checkRandCodeAnsyn";
        var data = {
            randCode: "",
            rand: "randp"
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            }),
            form: data
        };
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(function (resolve, reject) {
            rl.question('Please input randcode:', function (positions) {
                rl.close();
                options.form.randCode = positions;
                _this.request(options, function (error, response, body) {
                    if (error)
                        throw error;
                    if (response.statusCode === 200) {
                        if ((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
                            return resolve(JSON.parse(body));
                        }
                    }
                    reject(response.statusMessage);
                });
            });
        });
    };
    Account.prototype.confirmSingleForQueue = function (token, passengers, ticketInfoForPassengerForm, planPepoles) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/confirmSingleForQueue";
        var data = {
            "passengerTicketStr": this.getPassengerTickets(passengers, planPepoles),
            "oldPassengerStr": this.getOldPassengers(passengers, planPepoles),
            "randCode": "",
            "purpose_codes": ticketInfoForPassengerForm.purpose_codes,
            "key_check_isChange": ticketInfoForPassengerForm.key_check_isChange,
            "leftTicketStr": ticketInfoForPassengerForm.leftTicketStr,
            "train_location": ticketInfoForPassengerForm.train_location,
            "choose_seats": "",
            "seatDetailType": "000",
            "whatsSelect": 1,
            "roomType": "00",
            "dwAll": "N",
            "_json_att": "",
            "REPEAT_SUBMIT_TOKEN": token
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            }),
            form: data
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    if ((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
                        return resolve(JSON.parse(body));
                    }
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.queryOrderWaitTime = function (token) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/queryOrderWaitTime";
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            }),
            form: {
                "random": new Date().getTime(),
                "tourFlag": "dc",
                "_json_att": "",
                "REPEAT_SUBMIT_TOKEN": token
            },
            json: true
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    reject(error);
                if (response.statusCode === 200) {
                    if ((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
                        return resolve(body);
                    }
                    if (_this.isSystemBussy(body)) {
                        return reject(_this.SYSTEM_BUSSY);
                    }
                    return reject(body);
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.cancelQueueNoCompleteOrder = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/queryOrder/cancelQueueNoCompleteMyOrder";
        var data = {
            tourFlag: "dc"
        };
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/confirmPassenger/initDc"
            }),
            form: data,
            json: true
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    if ((response.headers["content-type"] || response.headers["Content-Type"]).indexOf("application/json") > -1) {
                        return resolve(body);
                    }
                    if (_this.isSystemBussy(body)) {
                        return reject(_this.SYSTEM_BUSSY);
                    }
                    return reject(body);
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.initNoComplete = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/queryOrder/initNoComplete";
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/queryOrder/initNoComplete"
            }),
            form: {
                "_json_att": ""
            }
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    return resolve(body);
                }
                else {
                    reject(response.statusCode);
                }
            });
        });
    };
    Account.prototype.myOrderNoComplete = function () {
        var _this = this;
        var sjOrderNoComplete = new Rx.Subject();
        sjOrderNoComplete.mergeMap(function () { return _this.queryMyOrderNoComplete(); })
            .subscribe(function (x) {
            /*
              { validateMessagesShowId: '_validatorMessage',
                status: true,
                httpstatus: 200,
                data: { orderDBList: [ [Object] ], to_page: 'db' },
                messages: [],
                validateMessages: {} }
             */
            if (!x.data) {
                console.error(chalk(templateObject_22 || (templateObject_22 = __makeTemplateObject(["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"], ["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"]))));
                return;
            }
            var tickets = [];
            if (x.data.orderCacheDTO) {
                var orderCache_1 = x.data.orderCacheDTO;
                orderCache_1.tickets.forEach(function (ticket) {
                    tickets.push({
                        "排队号": orderCache_1.queueName,
                        "等待时间": orderCache_1.waitTime,
                        "等待人数": orderCache_1.waitCount,
                        "余票数": orderCache_1.ticketCount,
                        "乘车日期": orderCache_1.trainDate.slice(0, 10),
                        "车次": orderCache_1.stationTrainCode,
                        "出发站": orderCache_1.fromStationName,
                        "到达站": orderCache_1.toStationName,
                        "座位等级": ticket.seatTypeName,
                        "乘车人": ticket.passengerName
                    });
                });
            }
            else if (x.data.orderDBList) {
                x.data.orderDBList.forEach(function (order) {
                    // console.log(chalk`订单号 {yellow.bold ${order.sequence_no}}`)
                    order.tickets.forEach(function (ticket) {
                        tickets.push({
                            "订单号": ticket.sequence_no,
                            // "订票号": ticket.ticket_no,
                            "乘车日期": chalk(templateObject_23 || (templateObject_23 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.train_date.slice(0, 10)),
                            // "下单时间": ticket.reserve_time,
                            "付款截至时间": chalk(templateObject_24 || (templateObject_24 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), ticket.pay_limit_time),
                            "金额": chalk(templateObject_25 || (templateObject_25 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_price / 100),
                            "状态": chalk(templateObject_26 || (templateObject_26 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_status_name),
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
        }, function (err) { return console.error('没有未完成订单'); });
        var sjL = new Rx.Subject();
        this.buildLoginFlow(sjL)
            .subscribe(function () { return sjOrderNoComplete.next(); });
        sjL.next();
    };
    Account.prototype.queryMyOrderNoComplete = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/queryOrder/queryMyOrderNoComplete";
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/queryOrder/initNoComplete"
            }),
            form: {
                "_json_att": ""
            },
            json: true
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                if (error)
                    throw error;
                if (response.statusCode === 200) {
                    if (body.status) {
                        // console.log(body);
                        /**
                          { validateMessagesShowId: '_validatorMessage',
                            status: true,
                            httpstatus: 200,
                            messages: [],
                            validateMessages: {} }
                         */
                        return resolve(body);
                    }
                    return reject(body.messages);
                }
                else {
                    reject(response.statusCode);
                }
            });
        });
    };
    return Account;
}());
exports.Account = Account;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUEsSUFBSSxDQUFDLENBQUM7b0JBQ0wsTUFBTSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDOUIsQ0FBQztZQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUgsY0FBQztBQUFELENBaG5EQSxBQWduREMsSUFBQTtBQWhuRFksMEJBQU8iLCJmaWxlIjoic3JjL0FjY291bnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgLy8gaHR0cHM6Ly93d3cubGFuaW5kZXguY29tLzEyMzA2JUU4JUI0JUFEJUU3JUE1JUE4JUU2JUI1JTgxJUU3JUE4JThCJUU1JTg1JUE4JUU4JUE3JUEzJUU2JTlFJTkwL1xyXG5cclxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XHJcbmltcG9ydCB7RmlsZUNvb2tpZVN0b3JlfSBmcm9tICcuL0ZpbGVDb29raWVTdG9yZSc7XHJcbmltcG9ydCB7U3RhdGlvbn0gZnJvbSAnLi9TdGF0aW9uJztcclxuaW1wb3J0IHJlcXVlc3QgPSByZXF1aXJlKCdyZXF1ZXN0Jyk7XHJcbmltcG9ydCBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XHJcbmltcG9ydCBmcyA9IHJlcXVpcmUoJ2ZzJyk7XHJcbmltcG9ydCByZWFkbGluZSA9IHJlcXVpcmUoJ3JlYWRsaW5lJyk7XHJcbmltcG9ydCBwcm9jZXNzID0gcmVxdWlyZSgncHJvY2VzcycpO1xyXG5pbXBvcnQgUnggPSByZXF1aXJlKCdAcmVhY3RpdmV4L3J4anMnKTtcclxuaW1wb3J0IGNoYWxrID0gcmVxdWlyZSgnY2hhbGsnKTtcclxuaW1wb3J0IGNvbHVtbmlmeSA9IHJlcXVpcmUoJ2NvbHVtbmlmeScpO1xyXG5cclxuZXhwb3J0IGNsYXNzIEFjY291bnQge1xyXG4gIHB1YmxpYyB1c2VyTmFtZSA6IHN0cmluZztcclxuICBwdWJsaWMgdXNlclBhc3N3b3JkIDogc3RyaW5nO1xyXG4gIHByaXZhdGUgY2hlY2tVc2VyVGltZXIgPSBSeC5PYnNlcnZhYmxlLnRpbWVyKDAsIDEwMDAqNjAqMjApO1xyXG4gIHByaXZhdGUgc2NwdENoZWNrVXNlclRpbWVyOiBSeC5TdWJzY3JpcHRpb247XHJcblxyXG4gIHByaXZhdGUgc3RhdGlvbnM6IFN0YXRpb24gPSBuZXcgU3RhdGlvbigpO1xyXG4gIHByaXZhdGUgcGFzc2VuZ2Vyczogb2JqZWN0O1xyXG5cclxuICBwcml2YXRlIFNZU1RFTV9CVVNTWSA9IFwiU3lzdGVtIGlzIGJ1c3N5XCI7XHJcbiAgcHJpdmF0ZSBTWVNURU1fTU9WRUQgPSBcIk1vdmVkIFRlbXBvcmFyaWx5XCI7XHJcblxyXG4gIHByaXZhdGUgcmVxdWVzdDogcmVxdWVzdC5SZXF1ZXN0QVBJPGFueSwgYW55LCBhbnk+O1xyXG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XHJcbiAgcHVibGljIGhlYWRlcnM6IG9iamVjdCA9IHtcclxuICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCJcclxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxyXG4gICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxyXG4gICAgLFwiT3JpZ2luXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuXCJcclxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcclxuICB9O1xyXG5cclxuICBwcml2YXRlIFRJQ0tFVF9USVRMRSA9IFsnJywgJycsICcnLCAn6L2m5qyhJywgJ+i1t+WniycsICfnu4jngrknLCAn5Ye65Y+RJywgJ+WIsOi+vicsICflh7rlj5EnLCAn5Yiw6L6+JywgJ+WOhuaXticsICcnLCAnJyxcclxuICAgICAgICAgICAgICAgJ+aXpeacnycsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAn6auY57qn6L2v5Y2nJywgJycsICfova/ljacnLCAn6L2v5bqnJywgJ+eJueetieW6pycsICfml6DluqcnLFxyXG4gICAgICAgICAgICAgICAnJywgJ+ehrOWNpycsICfnoazluqcnLCAn5LqM562J5bqnJywgJ+S4gOetieW6pycsICfllYbliqHluqcnXTtcclxuXHJcbiAgcHJpdmF0ZSBxdWVyeSA9IGZhbHNlO1xyXG5cclxuICBwcml2YXRlIG9yZGVyczogQXJyYXk8b2JqZWN0PiA9IFtdO1xyXG5cclxuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHVzZXJQYXNzd29yZDogc3RyaW5nKSB7XHJcbiAgICB0aGlzLnVzZXJOYW1lID0gbmFtZTtcclxuICAgIHRoaXMudXNlclBhc3N3b3JkID0gdXNlclBhc3N3b3JkO1xyXG5cclxuICAgIHRoaXMuc2V0UmVxdWVzdCgpO1xyXG4gICAgdGhpcy5idWlsZCgpO1xyXG5cclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOajgOafpee9kee7nOW8guW4uFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaXNTeXN0ZW1CdXNzeShib2R5OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBib2R5LmluZGV4T2YoXCLnvZHnu5zlj6/og73lrZjlnKjpl67popjvvIzor7fmgqjph43or5XkuIDkuItcIikgPiAwO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHNldFJlcXVlc3QoKSB7XHJcbiAgICBsZXQgY29va2llRmlsZU5hbWU6IHN0cmluZyA9IFwiLi9jb29raWVzL1wiK3RoaXMudXNlck5hbWUrXCIuanNvblwiO1xyXG4gICAgdmFyIGZpbGVTdG9yZSA9IG5ldyBGaWxlQ29va2llU3RvcmUoY29va2llRmlsZU5hbWUsIHtlbmNyeXB0OiBmYWxzZX0pO1xyXG4gICAgZmlsZVN0b3JlLm9wdGlvbiA9IHtlbmNyeXB0OiBmYWxzZX07XHJcblxyXG4gICAgdGhpcy5jb29raWVqYXIgPSByZXF1ZXN0LmphcihmaWxlU3RvcmUpO1xyXG5cclxuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3QuZGVmYXVsdHMoe2phcjogdGhpcy5jb29raWVqYXJ9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbmV4dE9yZGVyTnVtOiBOdW1iZXIgPSAwO1xyXG4gIHByaXZhdGUgbmV4dE9yZGVyKCkge1xyXG4gICAgdGhpcy5uZXh0T3JkZXJOdW0gPSAodGhpcy5uZXh0T3JkZXJOdW0rMSkldGhpcy5vcmRlcnMubGVuZ3RoO1xyXG4gICAgcmV0dXJuIHRoaXMub3JkZXJzW3RoaXMubmV4dE9yZGVyTnVtXTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY3VycmVudE9yZGVyKCkge1xyXG4gICAgcmV0dXJuIHRoaXMub3JkZXJzW3RoaXMubmV4dE9yZGVyTnVtXTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjcmVhdGVPcmRlcih0cmFpbkRhdGVzOiBBcnJheTxzdHJpbmc+LCBiYWNrVHJhaW5EYXRlOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgIFtmcm9tU3RhdGlvbk5hbWUsIHRvU3RhdGlvbk5hbWUsIHBhc3NTdGF0aW9uTmFtZV0sXHJcbiAgICAgICAgICAgICAgICAgICAgIHBsYW5UcmFpbnM6IEFycmF5PHN0cmluZz4sIHBsYW5QZXBvbGVzOiBBcnJheTxzdHJpbmc+LCBzZWF0Q2xhc3NlczogQXJyYXk8c3RyaW5nPik6IHRoaXMge1xyXG4gICAgdHJhaW5EYXRlcy5mb3JFYWNoKHRyYWluRGF0ZT0+IHtcclxuICAgICAgdGhpcy5vcmRlcnMucHVzaCh7XHJcbiAgICAgICAgdHJhaW5EYXRlOiB0cmFpbkRhdGVcclxuICAgICAgICAsYmFja1RyYWluRGF0ZTogYmFja1RyYWluRGF0ZVxyXG4gICAgICAgICxmcm9tU3RhdGlvbk5hbWU6IGZyb21TdGF0aW9uTmFtZTtcclxuICAgICAgICAsdG9TdGF0aW9uTmFtZTogdG9TdGF0aW9uTmFtZTtcclxuICAgICAgICAscGFzc1N0YXRpb25OYW1lOiBwYXNzU3RhdGlvbk5hbWUsXHJcbiAgICAgICAgLFBMQU5fVFJBSU5TOiBwbGFuVHJhaW5zO1xyXG4gICAgICAgICxwbGFuUGVwb2xlczogcGxhblBlcG9sZXM7XHJcbiAgICAgICAgLEZST01fU1RBVElPTjogdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShmcm9tU3RhdGlvbk5hbWUpO1xyXG4gICAgICAgICxUT19TVEFUSU9OOiB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKHRvU3RhdGlvbk5hbWUpO1xyXG4gICAgICAgICxzZWF0Q2xhc3Nlczogc2VhdENsYXNzZXNcclxuICAgICAgfSlcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG9yZGVyV2FpdFRpbWUoKSB7XHJcbiAgICBsZXQgc2pPcmRlcldhaXRUaW1lID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIHRoaXMuYnVpbGRMb2dpbkZsb3coc2pPcmRlcldhaXRUaW1lKVxyXG4gICAgICAuc3Vic2NyaWJlKCgpPT50aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQoKSk7XHJcbiAgICBzak9yZGVyV2FpdFRpbWUubmV4dCgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNhbmNlbE9yZGVyUXVldWUoKSB7XHJcbiAgICB0aGlzLmNhbmNlbFF1ZXVlTm9Db21wbGV0ZU9yZGVyKClcclxuICAgICAgLnRoZW4oeD0+IHtcclxuICAgICAgICBpZih4LnN0YXR1cyAmJiB4LmRhdGEuZXhpc3RFcnJvciA9PSAnTicpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOaOkumYn+iuouWNleW3suWPlua2iH1gKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKHgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3VibWl0KCk6IHZvaWQge1xyXG4gICAgbGV0IHNqTCA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pDaGVja1VzZXIgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gICAgdGhpcy5idWlsZExvZ2luRmxvdyhzakwpXHJcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcclxuICAgICAgICB0aGlzLmJ1aWxkT3JkZXJGbG93KCkubmV4dCgpO1xyXG4gICAgICAgIHRoaXMuc2NwdENoZWNrVXNlclRpbWVyID1cclxuICAgICAgICAgIHRoaXMuY2hlY2tVc2VyVGltZXIuc3Vic2NyaWJlKChpKT0+IHtcclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coaSk7XHJcbiAgICAgICAgICAgIHNqQ2hlY2tVc2VyLm5leHQoKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICAvL1xyXG4gICAgdGhpcy5idWlsZENoZWNrVXNlckZsb3coc2pDaGVja1VzZXIpXHJcbiAgICAgIC5zdWJzY3JpYmUoKCk9PndpbnN0b24uZGVidWcoXCJDaGVjayB1c2VyIGRvbmVcIikpO1xyXG5cclxuICAgIHNqTC5uZXh0KCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkQXV0aEZsb3coc3ViamVjdDogUnguU3ViamVjdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2pOZXdBcHBUb2tlbjogUnguUmVwbGF5U3ViamVjdCA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNqQXBwVG9rZW46IFJ4LlJlcGxheVN1YmplY3QgPSBuZXcgUnguUmVwbGF5U3ViamVjdCgpKSB7XHJcbiAgICBsZXQgc2pDYXB0Y2hhID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKTtcclxuICAgIGxldCBzakxvZ2luID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKTtcclxuICAgIGxldCBzak15UGFnZSA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcblxyXG4gICAgc3ViamVjdC5zdWJzY3JpYmUoc2pDYXB0Y2hhKTtcclxuXHJcbiAgICBzakNhcHRjaGEubWVyZ2VNYXAoKCk9PnRoaXMuZ2V0Q2FwdGNoYSgpKVxyXG4gICAgICAgICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuY2hlY2tDYXB0Y2hhKCkudGhlbigoKT0+e1xyXG4gICAgICAgICAgICAgIC8vIOagoemqjOeggeaIkOWKn+WQjui/m+ihjOaOiOadg+iupOivgVxyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOmqjOivgeeggeagoemqjOaIkOWKn31gKTtcclxuICAgICAgICAgICAgfSxlcnI9PiB7XHJcbiAgICAgICAgICAgICAgLy8g5qCh6aqM5aSx6LSl77yM6YeN5paw5qCh6aqMXHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjH1gKTtcclxuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgfSkpXHJcbiAgICAgICAgICAgIC5yZXRyeShOdW1iZXIuTUFYX1NBRkVfSU5URUdFUilcclxuICAgICAgICAgICAgLnN1YnNjcmliZSgoKT0+c2pMb2dpbi5uZXh0KDEpLCBlcnI9PmNvbnNvbGUuZXJyb3IoZXJyKSk7XHJcblxyXG4gICAgc2pMb2dpblxyXG4gICAgICAubWVyZ2VNYXAoKCk9PlxyXG4gICAgICAgIHRoaXMudXNlckF1dGhlbnRpY2F0ZSgpXHJcbiAgICAgICAgICAgIC50aGVuKCgpPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOeZu+W9leaIkOWKn31gKTtcclxuICAgICAgICAgICAgfSxlcnI9PiB7XHJcbiAgICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi5a+G56CB6L6T5YWl6ZSZ6K+v44CC5aaC5p6c6L6T6ZSZ5qyh5pWw6LaF6L+HNOasoe+8jOeUqOaIt+Wwhuiiq+mUgeWumuOAglwiLFwicmVzdWx0X2NvZGVcIjoxfVxyXG4gICAgICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLpqozor4HnoIHmoKHpqozlpLHotKVcIixcInJlc3VsdF9jb2RlXCI6XCI1XCJ9XHJcbiAgICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgICBpZih0eXBlb2YgZXJyLnJlc3VsdF9jb2RlID09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke2Vyci5yZXN1bHRfbWVzc2FnZX19YCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyO1xyXG4gICAgICAgICAgICAgICAgLy8gaWYoZXJyb3IucmVzdWx0X2NvZGUgPT09IDEpIHtcclxuICAgICAgICAgICAgICAgIC8vICAgdGhyb3cgZXJyb3IucmVzdWx0X21lc3NhZ2U7XHJcbiAgICAgICAgICAgICAgICAvLyB9ZWxzZSBpZihlcnJvci5yZXN1bHRfY29kZSA9PT0gNSkge1xyXG4gICAgICAgICAgICAgICAgLy8gICB0aGlzLnNqQ2FwdGNoYS5uZXh0KCk7XHJcbiAgICAgICAgICAgICAgICAvLyB9ZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICAgICAgICAgIC8vIH1cclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgIClcclxuICAgICAgLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxyXG4gICAgICAuc3Vic2NyaWJlKChlcnIpPT4ge1xyXG4gICAgICAgIC8vIOeZu+W9leWksei0peWwhumHjeaWsOS7juagoemqjOeggeW8gOWni1xyXG4gICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgc2pDYXB0Y2hhLm5leHQoMSk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgc2pOZXdBcHBUb2tlbi5uZXh0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgICAgO1xyXG5cclxuICAgIHNqTmV3QXBwVG9rZW5cclxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmdldE5ld0FwcFRva2VuKCkpXHJcbiAgICAgIC5zdWJzY3JpYmUoKG5ld2FwcHRrOiBzdHJpbmcpPT4ge1xyXG4gICAgICAgIHNqQXBwVG9rZW4ubmV4dChuZXdhcHB0aylcclxuICAgICAgfSxlcnI9PiB7XHJcbiAgICAgICAgc2pDYXB0Y2hhLm5leHQoMSk7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgIHNqQXBwVG9rZW5cclxuICAgICAgLm1lcmdlTWFwKChuZXdhcHB0azogc3RyaW5nKT0+dGhpcy5nZXRBcHBUb2tlbihuZXdhcHB0aylcclxuICAgICAgICAudGhlbigoeDogc3RyaW5nKSA9PiAsIChlcnI6IGFueSk9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg6I635Y+WVG9rZW7lpLHotKV9YCk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICAgICAgaWYoZXJyLnJlc3VsdF9jb2RlICYmIGVyci5yZXN1bHRfY29kZSA9PT0gMikge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KSlcclxuICAgICAgLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxyXG4gICAgICAuc3Vic2NyaWJlKChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgc2pDYXB0Y2hhLm5leHQoMSk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgc2pNeVBhZ2UubmV4dCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHNqTXlQYWdlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZCgpIHtcclxuXHJcbiAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRUXHJcbiAgICAgICAgLm1lcmdlTWFwKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PlxyXG4gICAgICAgICAgdGhpcy5xdWVyeU9yZGVyV2FpdFRpbWUob3JkZXJSZXF1ZXN0JiYob3JkZXJSZXF1ZXN0LnRva2VufHxcIlwiKSlcclxuICAgICAgICAgICAgLnRoZW4ob3JkZXJRdWV1ZT0+IHtcclxuICAgICAgICAgICAgICBpZihvcmRlclF1ZXVlLnN0YXR1cykge1xyXG4gICAgICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAwIHx8IG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYFlvdXIgdGlja2V0IG9yZGVyIG51bWJlciBpcyB7cmVkLmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEub3JkZXJJZH19YCk7XHJcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0yKXtcclxuICAgICAgICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLm1zZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEubXNnfX1gKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XHJcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0zKXtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKFwiWW91ciB0aWNrZXQgcmVxdWVzdCBoYXMgYmVlbiBjYW5jZWxlZCFcIik7XHJcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC00KXtcclxuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJZb3VyIHRpY2tldCByZXF1ZXN0IGlzIGJlaW5nIHByb2Nlc3NlZCwgcGxlYXNlIHdhaXQgYSBtb21lbnQhXCIpO1xyXG4gICAgICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg5o6S6Zif5Lq65pWw77yaJHtvcmRlclF1ZXVlLmRhdGEud2FpdENvdW50fX0g6aKE6K6h562J5b6F5pe26Ze077yaJHtwYXJzZUludChvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgLyAxLjUpfSDliIbpkp9gKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICAgICAgICAgIH0sIDQwMDApO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9LGVycj0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgIClcclxuICAgICAgLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxyXG4gICAgICAuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDnu5PmnZ99YCk7XHJcbiAgICAgICAgdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXImJnRoaXMuc2NwdENoZWNrVXNlclRpbWVyLnVuc3Vic2NyaWJlKCk7XHJcbiAgICAgIH0sZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZExvZ2luRmxvdyhvYnNlcnZhYmxlOiBSeC5PYnNlcnZhYmxlKTogdm9pZCB7XHJcbiAgICBsZXQgc2pMb2dpbkluaXQgPSBuZXcgUnguUmVwbGF5U3ViamVjdCgpO1xyXG4gICAgbGV0IHNqQ2FwdGNoYSA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pOZXdBcHBUb2tlbiA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pBcHBUb2tlbiA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcblxyXG4gICAgb2JzZXJ2YWJsZS5zdWJzY3JpYmUoc2pMb2dpbkluaXQpO1xyXG5cclxuICAgIC8vIOeZu+W9leWIneWni+WMllxyXG4gICAgc2pMb2dpbkluaXRcclxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT50aGlzLmxvZ2luSW5pdCgpKVxyXG4gICAgICAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXHJcbiAgICAgIC5tYXAob3JkZXIgPT4gdGhpcy5jaGVja0F1dGhlbnRpY2F0aW9uKHRoaXMuY29va2llamFyLl9qYXIudG9KU09OKCkuY29va2llcykpXHJcbiAgICAgIC5zdWJzY3JpYmUodG9rZW5zPT4ge1xyXG4gICAgICAgIGlmKHRva2Vucy50aykge1xyXG4gICAgICAgICAgcmV0dXJuIHNqQXBwVG9rZW4ubmV4dCh0b2tlbnMudGspO1xyXG4gICAgICAgIH1lbHNlIGlmKHRva2Vucy51YW10aykge1xyXG4gICAgICAgICAgcmV0dXJuIHNqTmV3QXBwVG9rZW4ubmV4dCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzakNhcHRjaGEubmV4dCgxKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRBdXRoRmxvdyhzakNhcHRjaGEsIHNqTmV3QXBwVG9rZW4sIHNqQXBwVG9rZW4pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzakxmVGlja2V0SW5pdCAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqUXVlcnlMZlRpY2tldCAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pTbU9SZXFDaGVja1VzZXIgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHNqU21PcmRlclJlcSAgICAgICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBzakNQYXNJbml0RGMgICAgICAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgc2pHZXRQYXNzZW5nZXJzICAgICA9IG5ldyBSeC5TdWJqZWN0PG9iamVjdD4oKTtcclxuICBwcml2YXRlIHNqQ2hlY2tPcmRlckluZm8gICAgPSBuZXcgUnguUmVwbGF5U3ViamVjdDxvYmplY3Q+KCk7XHJcbiAgcHJpdmF0ZSBzakdldFF1ZXVlQ291bnQgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqR2V0UGFzc0NvZGVOZXcgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pDb25maXJtU2luZ2xlNFEgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzalF1ZXJ5T3JkZXJXYWl0VCAgID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKTtcclxuXHJcbiAgcHJpdmF0ZSBidWlsZFF1ZXJ5TGVmdFRpY2tldEZsb3cob2JzZXJ2YWJsZTogUnguT2JzZXJ2YWJsZSk6IFJ4Lk9ic2VydmFibGUge1xyXG4gICAgbGV0IHNqUXVlcnlMZlRpY2tldCA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcblxyXG4gICAgb2JzZXJ2YWJsZS5zdWJzY3JpYmUoc2pRdWVyeUxmVGlja2V0KTtcclxuXHJcbiAgICByZXR1cm4gc2pRdWVyeUxmVGlja2V0XHJcbiAgICAgIC5kbyhvcmRlcj0+e1xyXG4gICAgICAgIC8vIHRoaXMuc2V0T3JkZXIob3JkZXIpO1xyXG4gICAgICAgIGlmKHRoaXMucXVlcnkpIHtcclxuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xyXG4gICAgICAgICAgcHJvY2Vzcy5zdGRvdXQuY3Vyc29yVG8oMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgICAubWVyZ2VNYXAob3JkZXI9PlxyXG4gICAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyhvcmRlci50cmFpbkRhdGUsIG9yZGVyLmZyb21TdGF0aW9uTmFtZSwgb3JkZXIudG9TdGF0aW9uTmFtZSwgb3JkZXIuUExBTl9UUkFJTlMpXHJcbiAgICAgICAgICAudGhlbigodHJhaW5zKT0+IHtcclxuICAgICAgICAgICAgb3JkZXIudHJhaW5zID0gdHJhaW5zO1xyXG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgICB9LGVycj0+Y29uc29sZS5lcnJvcihlcnIpKVxyXG4gICAgICApXHJcbiAgICAgIC5tZXJnZU1hcChvcmRlcj0+e1xyXG4gICAgICAgIGlmKG9yZGVyLnBhc3NTdGF0aW9uTmFtZSkge1xyXG4gICAgICAgICAgaWYoIW9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucXVlcnlMZWZ0VGlja2V0cyhvcmRlci50cmFpbkRhdGUsIG9yZGVyLmZyb21TdGF0aW9uTmFtZSwgb3JkZXIucGFzc1N0YXRpb25OYW1lLCBvcmRlci5QTEFOX1RSQUlOUylcclxuICAgICAgICAgICAgICAudGhlbihwYXNzVHJhaW5zPT4ge1xyXG4gICAgICAgICAgICAgICAgb3JkZXIuZnJvbVRvUGFzc1RyYWlucyA9IHBhc3NUcmFpbnMubWFwKHRyYWluID0+IHRyYWluWzNdKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBvcmRlcjtcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShvcmRlcik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShvcmRlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgICAubWFwKG9yZGVyPT4ge1xyXG4gICAgICAgIGlmKG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcclxuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IG9yZGVyLnRyYWlucy5maWx0ZXIodHJhaW4gPT4gb3JkZXIuZnJvbVRvUGFzc1RyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5tYXAob3JkZXI9PiB7XHJcbiAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XHJcblxyXG4gICAgICAgIHZhciBwbGFuVHJhaW5zID0gW10sIHRoYXQgPSB0aGlzO1xyXG4gICAgICAgIHRyYWlucy5zb21lKHRyYWluID0+IHtcclxuICAgICAgICAgIHJldHVybiBvcmRlci5zZWF0Q2xhc3Nlcy5zb21lKHNlYXQgPT4ge1xyXG4gICAgICAgICAgICB2YXIgc2VhdE51bSA9IHRoaXMuVElDS0VUX1RJVExFLmluZGV4T2Yoc2VhdCk7XHJcbiAgICAgICAgICAgIGlmKHRyYWluW3NlYXROdW1dID09IFwi5pyJXCIgfHwgdHJhaW5bc2VhdE51bV0gPiAwKSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXIudHJhaW5EYXRlK1wiL1wiK3RyYWluWzNdK1wiL1wiK3RyYWluW3NlYXROdW1dKTtcclxuICAgICAgICAgICAgICBpZihvcmRlci5QTEFOX1RSQUlOUy5pbmNsdWRlcyh0cmFpblszXSkpIHtcclxuICAgICAgICAgICAgICAgIHBsYW5UcmFpbnMucHVzaCh0cmFpbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG9yZGVyLmF2YWlsYWJsZVRyYWlucyA9IHBsYW5UcmFpbnM7XHJcbiAgICAgICAgcmV0dXJuIG9yZGVyO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRPcmRlckZsb3coKTogUnguT2JzZXJ2YWJsZSB7XHJcblxyXG4gICAgbGV0IHNqUXVlcnlMZlRpY2tldCA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pTbU9SZXFDaGVja1VzZXIgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxyXG4gICAgdGhpcy5zakxmVGlja2V0SW5pdC5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMubGVmdFRpY2tldEluaXQoKVxyXG4gICAgICAgIC50aGVuKCgpPT5zalF1ZXJ5TGZUaWNrZXQubmV4dCh0aGlzLm5leHRPcmRlcigpKSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0RmxvdyhzalF1ZXJ5TGZUaWNrZXQpXHJcbiAgICAgIC5zdWJzY3JpYmUob3JkZXI9PiB7XHJcbiAgICAgICAgaWYob3JkZXIuYXZhaWxhYmxlVHJhaW5zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgIHRoaXMucXVlcnkgPSBmYWxzZTtcclxuICAgICAgICAgIC8vIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYHt5ZWxsb3cg5pyJ5Y+v6LSt5Lmw5L2Z56WoICR7cGxhblRyYWluLnRvU3RyaW5nKCl9fWApO1xyXG4gICAgICAgICAgb3JkZXIudHJhaW5TZWNyZXRTdHIgPSBvcmRlci5hdmFpbGFibGVUcmFpbnNbMF1bMF07XHJcbiAgICAgICAgICBzalNtT1JlcUNoZWNrVXNlci5uZXh0KG9yZGVyKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOayoeacieWPr+i0reS5sOS9meelqCAke3RoaXMuVFJBSU5fREFURVtpXX19YCk7XHJcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShjaGFsa2DmsqHmnInlj6/otK3kubDkvZnnpagge3llbGxvdyAke29yZGVyLmZyb21TdGF0aW9uTmFtZX19IOWIsCB7eWVsbG93ICR7b3JkZXIudG9TdGF0aW9uTmFtZX19ICR7b3JkZXIucGFzc1N0YXRpb25OYW1lPyfpgJTnu48nK29yZGVyLnBhc3NTdGF0aW9uTmFtZSsnICc6Jyd9e3llbGxvdyAke29yZGVyLnRyYWluRGF0ZX19YCk7XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpPT4ge1xyXG4gICAgICAgICAgICBzalF1ZXJ5TGZUaWNrZXQubmV4dCh0aGlzLm5leHRPcmRlcigpKTtcclxuICAgICAgICAgIH0sIDE1MDApO1xyXG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LGVycj0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYnVpbGRDaGVja1VzZXJGbG93KHNqU21PUmVxQ2hlY2tVc2VyKVxyXG4gICAgICAuc3Vic2NyaWJlKG9yZGVyPT50aGlzLnNqU21PcmRlclJlcS5uZXh0KHRoaXMuY3VycmVudE9yZGVyKCkpKTtcclxuXHJcbiAgICAvLyBTdGVwIDExIOmihOaPkOS6pOiuouWNle+8jFBvc3RcclxuICAgIHRoaXMuc2pTbU9yZGVyUmVxLnN1YnNjcmliZShvcmRlcj0+IHtcclxuICAgICAgY29uc29sZS5sb2coXCJzdWJtaXQgb3JkZXIgcmVxdWVzdFwiKTtcclxuICAgICAgdGhpcy5zdWJtaXRPcmRlclJlcXVlc3Qob3JkZXIpXHJcbiAgICAgICAgLnRoZW4oKGJvZHkpPT4ge1xyXG4gICAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcclxuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhjaGFsa2B7eWVsbG93IFN1Ym1pdCBPcmRlciBSZXF1ZXN0IHN1Y2Nlc3MhfWApO1xyXG4gICAgICAgICAgICB0aGlzLnNqQ1Bhc0luaXREYy5uZXh0KG9yZGVyKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgLy8g5oKo6L+Y5pyJ5pyq5aSE55CG55qE6K6i5Y2VXHJcbiAgICAgICAgICAgIC8vIOivpei9puasoeaaguS4jeWKnueQhuS4muWKoVxyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke2JvZHkubWVzc2FnZXNbMF19fWApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pTbU9yZGVyUmVxLm5leHQob3JkZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxMiDmqKHmi5/ot7PovazpobXpnaJJbml0RGPvvIxQb3N0XHJcbiAgICB0aGlzLnNqQ1Bhc0luaXREYy5zdWJzY3JpYmUob3JkZXI9PiB7XHJcbiAgICAgIHRoaXMuY29uZmlybVBhc3NlbmdlckluaXREYygpLnRoZW4oKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgICB3aW5zdG9uLmRlYnVnKFwiY29uZmlybVBhc3NlbmdlciBJbml0IERjIHN1Y2Nlc3MhIFwiK29yZGVyUmVxdWVzdC50b2tlbik7XHJcbiAgICAgICAgb3JkZXIucmVxdWVzdCA9IG9yZGVyUmVxdWVzdDtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlclJlcXVlc3QudGlja2V0SW5mbyk7XHJcbiAgICAgICAgaWYodGhpcy5wYXNzZW5nZXJzKSB7XHJcbiAgICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMgPSB0aGlzLnBhc3NlbmdlcnM7XHJcbiAgICAgICAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm8ubmV4dChvcmRlcik7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5zakdldFBhc3NlbmdlcnMubmV4dChvcmRlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICBpZihlcnJvciA9PSB0aGlzLlNZU1RFTV9CVVNTWSkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dChvcmRlcik7XHJcbiAgICAgICAgfWVsc2UgaWYoZXJyb3IgPT0gdGhpcy5TWVNURU1fTU9WRUQpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQob3JkZXIpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkuY2F0Y2goZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDEzIOW4uOeUqOiBlOezu+S6uuehruWumu+8jFBvc3RcclxuICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLnN1YnNjcmliZSgob3JkZXI6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMuZ2V0UGFzc2VuZ2VycyhvcmRlci5yZXF1ZXN0LnRva2VuKS50aGVuKHBhc3NlbmdlcnM9PiB7XHJcbiAgICAgICAgdGhpcy5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcclxuICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xyXG4gICAgICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5uZXh0KG9yZGVyKTtcclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvciArIFwiIFJldHJ5IGdldCBwYXNzZW5nZXJzXCIpO1xyXG4gICAgICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLm5leHQob3JkZXIpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3I9PiB3aW5zdG9uLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm9cclxuICAgICAgLm1lcmdlTWFwKChvcmRlcjogb2JqZWN0KT0+XHJcbiAgICAgICAgLy8gU3RlcCAxNCDotK3npajkurrnoa7lrprvvIxQb3N0XHJcbiAgICAgICAgdGhpcy5jaGVja09yZGVySW5mbyhvcmRlci5yZXF1ZXN0LnRva2VuLCBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMuZGF0YS5ub3JtYWxfcGFzc2VuZ2Vycywgb3JkZXIucGxhblBlcG9sZXMpXHJcbiAgICAgICAgICAgIC50aGVuKG9yZGVySW5mbyA9PiB7XHJcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlckluZm8pO1xyXG4gICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5vcmRlckluZm8gPSBvcmRlckluZm87XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgICAgICAgfSxlcnIgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycjtcclxuICAgICAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSkpXHJcbiAgICAgIC5yZXRyeSgxMDApXHJcbiAgICAgIC5tZXJnZU1hcCgob3JkZXIpPT4ge1xyXG4gICAgICAgIGlmKHR5cGVvZiBvcmRlciA9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3Qob3JkZXIpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUob3JkZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XHJcbiAgICAgIC5tZXJnZU1hcChvcmRlciA9PlxyXG4gICAgICAgIHRoaXMuZ2V0UXVldWVDb3VudChvcmRlci5yZXF1ZXN0LnRva2VuLCBvcmRlci5yZXF1ZXN0Lm9yZGVyUmVxdWVzdCwgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvKVxyXG4gICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKT0+e1xyXG4gICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnF1ZXVlSW5mbyA9IHJlc3BvbnNlO1xyXG4gICAgICAgICAgICByZXR1cm4gb3JkZXJcclxuICAgICAgICAgIH0sIGVycj0+UHJvbWlzZS5yZWplY3QoZXJyKSlcclxuICAgICAgKVxyXG4gICAgICAuc3Vic2NyaWJlKG9yZGVyID0+IHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlci5xdWV1ZUluZm8pO1xyXG4gICAgICAgIC8vIOiLpSBTdGVwIDE0IOS4reeahCBcImlmU2hvd1Bhc3NDb2RlXCIgPSBcIllcIu+8jOmCo+S5iOWkmuS6hui+k+WFpemqjOivgeeggei/meS4gOatpe+8jFBvc3RcclxuICAgICAgICBpZihvcmRlci5yZXF1ZXN0Lm9yZGVySW5mby5kYXRhLmlmU2hvd1Bhc3NDb2RlID09IFwiWVwiKSB7XHJcbiAgICAgICAgICB0aGlzLnNqR2V0UGFzc0NvZGVOZXcubmV4dChvcmRlcik7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgLy8gU3RlcCAxNyDnoa7orqTotK3kubDvvIxQb3N0XHJcbiAgICAgICAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLm5leHQob3JkZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxlcnI9PmNvbnNvbGUuZXJyb3IoZXJyKSk7XHJcblxyXG4gICAgdGhpcy5zakdldFBhc3NDb2RlTmV3LnN1YnNjcmliZSgob3JkZXI6IG9iamVjdCk9PiB7XHJcbiAgICAgIC8vIFN0ZXAgMTYg5LmY5a6i5Lmw56Wo6aqM6K+B56CB77yMR2V0IFBPU1RcclxuICAgICAgdGhpcy5nZXRQYXNzQ29kZU5ldygpLnRoZW4oKCk9PiB0aGlzLmNoZWNrUmFuZENvZGVBbnN5bigpKVxyXG4gICAgICAgIC50aGVuKHg9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyh4KTtcclxuICAgICAgICAgIHRoaXMuc2pDb25maXJtU2luZ2xlNFEubmV4dChvcmRlcik7XHJcbiAgICAgICAgfSxlcnJvcj0+Y29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5zdWJzY3JpYmUoKG9yZGVyOiBvYmplY3QpPT4ge1xyXG4gICAgICB0aGlzLmNvbmZpcm1TaW5nbGVGb3JRdWV1ZShvcmRlci5yZXF1ZXN0LnRva2VuLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMuZGF0YS5ub3JtYWxfcGFzc2VuZ2VycyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5wbGFuUGVwb2xlcylcclxuICAgICAgICAudGhlbih4PT4ge1xyXG4gICAgICAgICAgaWYoeC5zdGF0dXMgJiYgeC5kYXRhLnN1Ym1pdFN0YXR1cykge1xyXG4gICAgICAgICAgICAvLyBTdGVwIDE4IOafpeivouaOkumYn+etieW+heaXtumXtO+8gVxyXG4gICAgICAgICAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQob3JkZXIpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxyXG4gICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcclxuICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgICAgZGF0YTogeyBlcnJNc2c6ICfkvZnnpajkuI3otrPvvIEnLCBzdWJtaXRTdGF0dXM6IGZhbHNlIH0sXHJcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxyXG4gICAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cclxuICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7eC5kYXRhLmVyck1zZ319YCk7XHJcbiAgICAgICAgICAgIC8vIOmHjeaWsOW8gOWni+afpeivolxyXG4gICAgICAgICAgICBzalF1ZXJ5TGZUaWNrZXQubmV4dCh0aGlzLm5leHRPcmRlcigpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5zakxmVGlja2V0SW5pdDtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRDaGVja1VzZXJGbG93KG9ic2VydmFibGU6IFJ4Lk9ic2VydmFibGUpOiBSeC5PYnNlcnZhYmxlIHtcclxuICAgIGxldCBzakNoZWNrVXNlciA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pMb2dpbiA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pBdXRoZWQgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gICAgb2JzZXJ2YWJsZS5zdWJzY3JpYmUoc2pDaGVja1VzZXIpO1xyXG5cclxuICAgIC8vIFN0ZXAgMTAg6aqM6K+B55m75b2V77yMUG9zdFxyXG4gICAgc2pDaGVja1VzZXJcclxuICAgICAgLm1lcmdlTWFwKCgpID0+IHRoaXMuY2hlY2tVc2VyKCkpXHJcbiAgICAgIC5yZXRyeSgxMDAwKVxyXG4gICAgICAuc3Vic2NyaWJlKChib2R5KSA9PiB7XHJcbiAgICAgICAgICBpZihib2R5LmRhdGEuZmxhZykge1xyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZygnbG9naW4gc3VjY2VzcycpO1xyXG4gICAgICAgICAgICBzakF1dGhlZC5uZXh0KCk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIHNqTG9naW4ubmV4dCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3VibWl0IG9yZGVyIHJlcXVlc3QgY2hlY2sgdXNlclwiKTtcclxuICAgICAgICB9LCBlcnI9PntcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJDaGVjayB1c2VyIGVycm9yIFwiKTtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcclxuICAgICAgICAgIC8qIFRPRE8gYWRkIHJlbG9naW4gbG9naWNcclxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxyXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgIGRhdGE6IHsgZmxhZzogZmFsc2UgfSxcclxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxyXG4gICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAqL1xyXG4gICAgICAgICAgc2pMb2dpbi5uZXh0KCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgdGhpcy5idWlsZEF1dGhGbG93KHNqTG9naW4pXHJcbiAgICAgIC5zdWJzY3JpYmUoKCk9PnNqQXV0aGVkLm5leHQoKSxlcnI9PmNvbnNvbGUuZXJyb3IoZXJyKSk7XHJcbiAgICByZXR1cm4gc2pBdXRoZWQ7XHJcbiAgfVxyXG5cclxuXHJcbiAgLyoqXHJcbiAgICog5p+l6K+i5YiX6L2m5L2Z56Wo5L+h5oGvXHJcbiAgICpcclxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xyXG4gICAqIEBwYXJhbSBmcm9tU3RhdGlvbk5hbWUg5Ye65Y+R56uZXHJcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXHJcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXHJcbiAgICpcclxuICAgKiBAcmV0dXJuIFByb21pc2VcclxuICAgKi9cclxuICBwdWJsaWMgcXVlcnlMZWZ0VGlja2V0cyh0cmFpbkRhdGU6IHN0cmluZywgZnJvbVN0YXRpb25OYW1lOiBzdHJpbmcsIHRvU3RhdGlvbk5hbWU6IHN0cmluZywgdHJhaW5OYW1lczogQXJyYXk8c3RyaW5nPnxudWxsKTogUHJvbWlzZTxBcnJheTxhbnk+PiB7XHJcbiAgICBpZighdHJhaW5EYXRlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5LmY6L2m5pel5pyffWApO1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcclxuICAgIH1cclxuICAgIHRoaXMuQkFDS19UUkFJTl9EQVRFID0gdHJhaW5EYXRlO1xyXG5cclxuICAgIGlmKCFmcm9tU3RhdGlvbk5hbWUpIHtcclxuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXlh7rlj5Hnq5l9YCk7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5GUk9NX1NUQVRJT05fTkFNRSA9IGZyb21TdGF0aW9uTmFtZTtcclxuXHJcbiAgICBpZighdG9TdGF0aW9uTmFtZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWIsOi+vuermX1gKTtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLlRPX1NUQVRJT05fTkFNRSA9IHRvU3RhdGlvbk5hbWU7XHJcblxyXG4gICAgdGhpcy5GUk9NX1NUQVRJT04gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKGZyb21TdGF0aW9uTmFtZSk7XHJcbiAgICB0aGlzLlRPX1NUQVRJT04gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKHRvU3RhdGlvbk5hbWUpO1xyXG5cclxuICAgIHJldHVybiBSeC5PYnNlcnZhYmxlLm9mKDEpXHJcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5xdWVyeUxlZnRUaWNrZXQodHJhaW5EYXRlKVxyXG4gICAgICAgICAgICAgICAgICAgICAgLnRoZW4oKHRyYWluc0RhdGEpPT50cmFpbnNEYXRhLGVycj0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7eWVsbG93LmJvbGQgJHtlcnJvcn19YCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgfSkpXHJcbiAgICAgIC5yZXRyeShOdW1iZXIuTUFYX1NBRkVfSU5URUdFUilcclxuICAgICAgLm1hcCh0cmFpbnNEYXRhID0+IHRyYWluc0RhdGEucmVzdWx0KVxyXG4gICAgICAubWFwKHJlc3VsdCA9PiB7XHJcbiAgICAgICAgbGV0IHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4gPSBbXTtcclxuXHJcbiAgICAgICAgcmVzdWx0LmZvckVhY2goKGVsZW1lbnQ6IHN0cmluZyk9PiB7XHJcbiAgICAgICAgICBsZXQgdHJhaW46IEFycmF5PHN0cmluZz4gPSBlbGVtZW50LnNwbGl0KFwifFwiKTtcclxuICAgICAgICAgIHRyYWluWzRdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls0XSk7XHJcbiAgICAgICAgICB0cmFpbls1XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNV0pO1xyXG4gICAgICAgICAgdHJhaW5bNl0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzZdKTtcclxuICAgICAgICAgIHRyYWluWzddID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls3XSk7XHJcbiAgICAgICAgICB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJJU19USU1FX05PVF9CVVlcIiA/IFwi5YiX6L2m5YGc6L+QXCI6dHJhaW5bMTFdO1xyXG4gICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiTlwiID8gXCLml6DnpahcIjp0cmFpblsxMV07XHJcbiAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJZXCIgPyBcIuacieelqFwiOnRyYWluWzExXTtcclxuICAgICAgICAgIC8vIOWMuemFjei+k+WFpeeahOWIl+i9puWQjeensOeahOato+WImeihqOi+vuW8j+adoeS7tlxyXG4gICAgICAgICAgaWYoIXRyYWluTmFtZXMgfHwgdHJhaW5OYW1lcy5maWx0ZXIodG49PnRyYWluWzNdLm1hdGNoKG5ldyBSZWdFeHAodG4pKSAhPSBudWxsKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHRyYWlucy5wdXNoKHRyYWluKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdHJhaW5zO1xyXG4gICAgICB9KVxyXG4gICAgICAudG9Qcm9taXNlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0cmFpbkRhdGUg5LmY6L2m5pel5pyfXHJcbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcclxuICAgKiBAcGFyYW0gcGFzc1N0YXRpb25OYW1lIOmAlOe7j+ermVxyXG4gICAqIEBwYXJhbSB0b1N0YXRpb25OYW1lIOWIsOi+vuermVxyXG4gICAqXHJcbiAgICogQHJldHVybiB2b2lkXHJcbiAgICovXHJcbiAgcHVibGljIHBhc3NTdGF0aW9uVGlja2V0cyh0cmFpbkRhdGU6IHN0cmluZywgZnJvbVN0YXRpb25OYW1lOiBzdHJpbmcsIHBhc3NTdGF0aW9uTmFtZTogc3RyaW5nLCB0b1N0YXRpb25OYW1lOiBzdHJpbmcsIHRyYWluTmFtZXM6IHN0cmluZykge1xyXG4gICAgbGV0IHBsYW5UcmFpbk5hbWVzOiBBcnJheTxzdHJpbmc+fG51bGwgPSAodHJhaW5OYW1lcyA/IHRyYWluTmFtZXMuc3BsaXQoJywnKTpudWxsKTtcclxuICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyh0cmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGxhblRyYWluTmFtZXMpXHJcbiAgICAgIC50aGVuKHRyYWlucz0+IHtcclxuICAgICAgICB0cmFpbnMgPSB0cmFpbnMubWFwKHRyYWluID0+IHRyYWluWzNdKTtcclxuICAgICAgICB0aGlzLnF1ZXJ5TGVmdFRpY2tldHModHJhaW5EYXRlLCBmcm9tU3RhdGlvbk5hbWUsIHBhc3NTdGF0aW9uTmFtZSwgcGxhblRyYWluTmFtZXMpXHJcbiAgICAgICAgICAudGhlbihwYXNzVHJhaW5zPT4ge1xyXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcGFzc1RyYWlucy5maWx0ZXIodHJhaW4gPT4gdHJhaW5zLmluY2x1ZGVzKHRyYWluWzNdKSk7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMucmVuZGVyVHJhaW5MaXN0VGl0bGUocmVzdWx0KTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJMZWZ0VGlja2V0cyhyZXN1bHQpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog5p+l6K+i5YiX6L2m5L2Z56Wo5L+h5oGvXHJcbiAgICpcclxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xyXG4gICAqIEBwYXJhbSBmcm9tU3RhdGlvbk5hbWUg5Ye65Y+R56uZXHJcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXHJcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXHJcbiAgICpcclxuICAgKiBAcmV0dXJuIHZvaWRcclxuICAgKi9cclxuICBwdWJsaWMgbGVmdFRpY2tldHModHJhaW5EYXRlOiBzdHJpbmcsIGZyb21TdGF0aW9uTmFtZTogc3RyaW5nLCB0b1N0YXRpb25OYW1lOiBzdHJpbmcsIHRyYWluTmFtZXM6IHN0cmluZykge1xyXG4gICAgdGhpcy5xdWVyeUxlZnRUaWNrZXRzKHRyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCAodHJhaW5OYW1lcyA/IHRyYWluTmFtZXMuc3BsaXQoJywnKTpudWxsKSlcclxuICAgICAgLnRoZW4odHJhaW5zPT4ge1xyXG4gICAgICAgIHRyYWlucyA9IHRoaXMucmVuZGVyVHJhaW5MaXN0VGl0bGUodHJhaW5zKTtcclxuICAgICAgICB0aGlzLnJlbmRlckxlZnRUaWNrZXRzKHRyYWlucyk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJUcmFpbkxpc3RUaXRsZSh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KTogQXJyYXk8QXJyYXk8c3RyaW5nPj4ge1xyXG4gICAgdmFyIHRpdGxlID0gdGhpcy5USUNLRVRfVElUTEUubWFwKHQ9PmNoYWxrYHtibHVlICR7dH19YCk7XHJcblxyXG4gICAgdHJhaW5zLmZvckVhY2goKHRyYWluLCBpbmRleCk9PiB7XHJcbiAgICAgIGlmKGluZGV4ICUgMzAgPT09IDApIHtcclxuICAgICAgICB0cmFpbnMuc3BsaWNlKGluZGV4LCAwLCB0aXRsZSk7XHJcbiAgICAgIH1cclxuICAgIH0pXHJcbiAgICByZXR1cm4gdHJhaW5zO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJMZWZ0VGlja2V0cyh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KSB7XHJcbiAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0cmFpbnMsIHtcclxuICAgICAgY29sdW1uU3BsaXR0ZXI6ICd8JyxcclxuICAgICAgY29sdW1uczogW1wiM1wiLCBcIjRcIiwgXCI1XCIsIFwiNlwiLCBcIjdcIiwgXCI4XCIsIFwiOVwiLCBcIjEwXCIsIFwiMTFcIiwgXCIyMFwiLCBcIjIxXCIsIFwiMjJcIiwgXCIyM1wiLCBcIjI0XCIsIFwiMjVcIixcclxuICAgICAgICAgICAgICAgIFwiMjZcIiwgXCIyN1wiLCBcIjI4XCIsIFwiMjlcIiwgXCIzMFwiLCBcIjMxXCIsIFwiMzJcIl1cclxuICAgIH0pXHJcblxyXG4gICAgY29uc29sZS5sb2coY29sdW1ucyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbXlPcmRlck5vQ29tcGxldGVSZXBvcnQoKSB7XHJcbiAgICB2YXIgc3ViamVjdE9yZGVyTm9Db21wbGV0ZSA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcblxyXG4gICAgc3ViamVjdE9yZGVyTm9Db21wbGV0ZS5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMuaW5pdE5vQ29tcGxldGUoKS50aGVuKCgpPT4ge1xyXG4gICAgICAgIHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpLnRoZW4oeD0+IHtcclxuICAgICAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkoeCwge1xyXG4gICAgICAgICAgICAgIGNvbHVtblNwbGl0dGVyOiAnIHwgJ1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xyXG4gICAgICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpPT4gc3ViamVjdE9yZGVyTm9Db21wbGV0ZS5uZXh0KCksIDEwMDApXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSwgZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzdWJqZWN0T3JkZXJOb0NvbXBsZXRlLm5leHQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBsb2dpbkluaXQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2luaXRcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybCxcclxuICAgICAgbWV0aG9kOiBcIkdFVFwiLFxyXG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlOiBvYmplY3QsIHJlamVjdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcclxuICAgICAgICBpZihlcnJvcikgcmV0dXJuIHJlamVjdChlcnJvci50b1N0cmluZygpKTtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENhcHRjaGEoKTogUHJvbWlzZSB7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXHJcbiAgICAgICAgICBcIm1vZHVsZVwiOiBcImxvZ2luXCIsXHJcbiAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIixcclxuICAgICAgICAgIFwiMC4xNzIzMTg3MjcwMzM4OTA2MlwiOlwiXCJcclxuICAgICAgfTtcclxuXHJcbiAgICB2YXIgcGFyYW0gPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgbnVsbClcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtaW1hZ2U/XCIrcGFyYW07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSkgPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVzdGlvbkNhcHRjaGEoKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcclxuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKT0+IHtcclxuICAgICAgcmwucXVlc3Rpb24oY2hhbGtge3JlZC5ib2xkIOivt+i+k+WFpemqjOivgeeggX06YCwgKHBvc2l0aW9uU3RyKSA9PiB7XHJcbiAgICAgICAgcmwuY2xvc2UoKTtcclxuXHJcbiAgICAgICAgaWYodHlwZW9mIHBvc2l0aW9uU3RyID09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgIGxldCBwb3NpdGlvbnM6IEFycmF5PHN0cmluZz4gPSBbXTtcclxuICAgICAgICAgIHBvc2l0aW9uU3RyLnNwbGl0KCcsJykuZm9yRWFjaChlbD0+cG9zaXRpb25zPXBvc2l0aW9ucy5jb25jYXQoZWwuc3BsaXQoJyAnKSkpO1xyXG4gICAgICAgICAgcmVzb2x2ZShwb3NpdGlvbnMubWFwKChwb3NpdGlvbjogc3RyaW5nKT0+IHtcclxuICAgICAgICAgICAgc3dpdGNoKHBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjFcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDQ1XCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjJcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjExMCw0NVwiO1xyXG4gICAgICAgICAgICAgIGNhc2UgXCIzXCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIxODAsNDVcIjtcclxuICAgICAgICAgICAgICBjYXNlIFwiNFwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDQ1XCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjVcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDExMFwiO1xyXG4gICAgICAgICAgICAgIGNhc2UgXCI2XCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIxMTAsMTEwXCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjdcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjE4MCwxMTBcIjtcclxuICAgICAgICAgICAgICBjYXNlIFwiOFwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDExMFwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KS5qb2luKCcsJykpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChcIui+k+WFpeagvOW8j+mUmeivr1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrQ2FwdGNoYSgpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtY2hlY2tcIjtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKSA9PiB7XHJcbiAgICAgIHRoaXMucXVlc3Rpb25DYXB0Y2hhKCkudGhlbihwb3NpdGlvbnM9PiB7XHJcbiAgICAgICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICAgIFwiYW5zd2VyXCI6IHBvc2l0aW9ucyxcclxuICAgICAgICAgICAgXCJsb2dpbl9zaXRlXCI6IFwiRVwiLFxyXG4gICAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIlxyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgICAgICB1cmw6IHVybFxyXG4gICAgICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICAgICAsZm9ybTogZGF0YVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KSA9PiB7XHJcbiAgICAgICAgICBpZihlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keS5yZXN1bHRfbWVzc2FnZSk7XHJcbiAgICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gNCkge1xyXG4gICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coJ2Vycm9yOiAnKyByZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgICAgICAgY29uc29sZS5sb2cocmVzcG9uc2UudGV4dCk7XHJcbiAgICAgICAgICAgIHJlamVjdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9LCBlcnJvcj0+e1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1c2VyQXV0aGVudGljYXRlKCk6IFByb21pc2Uge1xyXG4gICAgLy8g5Y+R6YCB55m75b2V5L+h5oGvXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxyXG4gICAgICAgICAgLFwidXNlcm5hbWVcIjogdGhpcy51c2VyTmFtZVxyXG4gICAgICAgICAgLFwicGFzc3dvcmRcIjogdGhpcy51c2VyUGFzc3dvcmRcclxuICAgICAgICB9O1xyXG5cclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvbG9naW5cIjtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiByZWplY3QoZXJyb3IpO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMikge1xyXG4gICAgICAgICAgICB0aHJvdyBib2R5LnJlc3VsdF9tZXNzYWdlO1xyXG4gICAgICAgICAgfWVsc2UgaWYoYm9keS5yZXN1bHRfY29kZSAhPSAwKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChib2R5KTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShib2R5LnVhbXRrKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TmV3QXBwVG9rZW4oKTogUHJvbWlzZSB7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxyXG4gICAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID17XHJcbiAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2F1dGgvdWFtdGtcIlxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xyXG4gICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XHJcbiAgICAgICAgICAgIHJlc29sdmUoYm9keS5uZXdhcHB0ayk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIHJlamVjdChib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2UpXHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRNeTEyMzA2KCk6IFByb21pc2Uge1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qoe1xyXG4gICAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2luZGV4L2luaXRNeTEyMzA2XCJcclxuICAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgICxtZXRob2Q6IFwiR0VUXCJ9LFxyXG4gICAgICAgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIkdvdCBteSAxMjMwNlwiKTtcclxuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdCgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja0F1dGhlbnRpY2F0aW9uKGNvb2tpZXM6IG9iamVjdCkge1xyXG4gICAgdmFyIHVhbXRrID0gXCJcIiwgdGsgPSBcIlwiO1xyXG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGNvb2tpZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgaWYoY29va2llc1tpXS5rZXkgPT0gXCJ1YW10a1wiKSB7XHJcbiAgICAgICAgdWFtdGsgPSBjb29raWVzW2ldLnZhbHVlO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInRrXCIpIHtcclxuICAgICAgICB0ayA9IGNvb2tpZXNbaV0udmFsdWU7XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHJldHVybiB7XHJcbiAgICAgIHVhbXRrOiB1YW10ayxcclxuICAgICAgdGs6IHRrXHJcbiAgICB9O1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICpcclxuICAgKi9cclxuICBwcml2YXRlIGdldEFwcFRva2VuKG5ld2FwcHRrOiBzdHJpbmcpIHtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJ0a1wiOiBuZXdhcHB0a1xyXG4gICAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3VhbWF1dGhjbGllbnRcIlxyXG4gICAgICAsaGVhZGVyczoge1xyXG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDYuMTsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4xNyAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8yNC4wLjEzMTIuNjAgU2FmYXJpLzUzNy4xN1wiXHJcbiAgICAgICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxyXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcclxuICAgICAgICAsJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXHJcbiAgICAgIH1cclxuICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5KTtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYm9keS5yZXN1bHRfbWVzc2FnZSk7XHJcbiAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShib2R5LmFwcHRrKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgbGVmdFRpY2tldEluaXQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KHVybCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNUZXh0KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcXVlcnlMZWZ0VGlja2V0KHRyYWluRGF0ZSk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdmFyIHF1ZXJ5ID0ge1xyXG4gICAgICBcImxlZnRUaWNrZXREVE8udHJhaW5fZGF0ZVwiOiB0cmFpbkRhdGVcclxuICAgICAgLFwibGVmdFRpY2tldERUTy5mcm9tX3N0YXRpb25cIjogdGhpcy5GUk9NX1NUQVRJT05cclxuICAgICAgLFwibGVmdFRpY2tldERUTy50b19zdGF0aW9uXCI6IHRoaXMuVE9fU1RBVElPTlxyXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiQURVTFRcIlxyXG4gICAgfVxyXG5cclxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShxdWVyeSk7XHJcblxyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L3F1ZXJ5Wj9cIitwYXJhbTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdCh1cmwsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB7XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yLnRvU3RyaW5nKCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5KTtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKCFib2R5KSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZihib2R5LmluZGV4T2YoXCLor7fmgqjph43or5XkuIDkuItcIikgPiAwKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChcIuezu+e7n+e5geW/mSFcIik7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGJvZHkpLmRhdGE7XHJcbiAgICAgICAgICAgIH1jYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhib2R5KTtcclxuICAgICAgICAgICAgICByZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja1VzZXIoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2NoZWNrVXNlclwiO1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxyXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiByZWplY3QoZXJyb3IpO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpXHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdWJtaXRPcmRlclJlcXVlc3Qoe3RyYWluU2VjcmV0U3RyLCB0cmFpbkRhdGUsIGJhY2tUcmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZX0pOiBQcm9taXNlPG9iamVjdD4gIHtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvc3VibWl0T3JkZXJSZXF1ZXN0XCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwic2VjcmV0U3RyXCI6IHF1ZXJ5c3RyaW5nLnVuZXNjYXBlKHRyYWluU2VjcmV0U3RyKVxyXG4gICAgICAsXCJ0cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxyXG4gICAgICAsXCJiYWNrX3RyYWluX2RhdGVcIjogYmFja1RyYWluRGF0ZVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICAgICxcInF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lXCI6IGZyb21TdGF0aW9uTmFtZVxyXG4gICAgICAsXCJxdWVyeV90b19zdGF0aW9uX25hbWVcIjogdG9TdGF0aW9uTmFtZVxyXG4gICAgICAsXCJ1bmRlZmluZWRcIjpcIlwiXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIHVybCA9IHVybCArIFwic2VjcmV0U3RyPVwiK3NlY3JldFN0citcIiZ0cmFpbl9kYXRlPTIwMTgtMDEtMzEmYmFja190cmFpbl9kYXRlPTIwMTgtMDEtMzAmdG91cl9mbGFnPWRjJnB1cnBvc2VfY29kZXM9QURVTFQmcXVlcnlfZnJvbV9zdGF0aW9uX25hbWU95LiK5rW3JnF1ZXJ5X3RvX3N0YXRpb25fbmFtZT3lvpDlt57kuJwmdW5kZWZpbmVkXCI7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcclxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxyXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVBhc3NlbmdlckluaXREYygpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgICAsXCJVcGdyYWRlLUluc2VjdXJlLVJlcXVlc3RzXCI6MVxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYoYm9keSkge1xyXG4gICAgICAgICAgICAvLyBHZXQgUmVwZWF0IFN1Ym1pdCBUb2tlblxyXG4gICAgICAgICAgICB2YXIgdG9rZW4gPSBib2R5Lm1hdGNoKC92YXIgZ2xvYmFsUmVwZWF0U3VibWl0VG9rZW4gPSAnKC4qPyknOy8pO1xyXG4gICAgICAgICAgICB2YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0gPSBib2R5Lm1hdGNoKC92YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm09KC4qPyk7Lyk7XHJcbiAgICAgICAgICAgIHZhciBvcmRlclJlcXVlc3REVE8gPSBib2R5Lm1hdGNoKC92YXIgb3JkZXJSZXF1ZXN0RFRPPSguKj8pOy8pO1xyXG4gICAgICAgICAgICBpZih0b2tlbikge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHtcclxuICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlblsxXVxyXG4gICAgICAgICAgICAgICAgLHRpY2tldEluZm86IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtJiZKU09OLnBhcnNlKHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxyXG4gICAgICAgICAgICAgICAgLG9yZGVyUmVxdWVzdDogb3JkZXJSZXF1ZXN0RFRPJiZKU09OLnBhcnNlKG9yZGVyUmVxdWVzdERUT1sxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2Vycyh0b2tlbjogc3RyaW5nKTogUHJvbWlzZTxvYmplY3Q+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8b2JqZWN0PigocmVzb2x2ZTogRnVuY3Rpb24sIHJlamVjdDogRnVuY3Rpb24pPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoSlNPTi5wYXJzZShib2R5KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgLyogc2VhdCB0eXBlXHJcbiAg4oCY6L2v5Y2n4oCZID0+IOKAmDTigJksXHJcbiAg4oCY5LqM562J5bqn4oCZID0+IOKAmE/igJksXHJcbiAg4oCY5LiA562J5bqn4oCZID0+IOKAmE3igJksXHJcbiAg4oCY56Gs5bqn4oCZID0+IOKAmDHigJksXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKTogc3RyaW5nIHtcclxuICAgIHZhciB0aWNrZXRzID0gW107XHJcbiAgICBwYXNzZW5nZXJzLmZvckVhY2gocGFzc2VuZ2VyPT4ge1xyXG4gICAgICBpZihwbGFuUGVwb2xlcy5pbmNsdWRlcyhwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUpKSB7XHJcbiAgICAgICAgLy/luqfkvY3nsbvlnossMCznpajnsbvlnoso5oiQ5Lq6L+WEv+erpSksbmFtZSzouqvku73nsbvlnoso6Lqr5Lu96K+BL+WGm+WumOivgS4uLi4pLOi6q+S7veivgSznlLXor53lj7fnoIEs5L+d5a2Y54q25oCBXHJcbiAgICAgICAgdmFyIHRpY2tldCA9IC8qcGFzc2VuZ2VyLnNlYXRfdHlwZSovIFwiT1wiICtcclxuICAgICAgICAgICAgICAgIFwiLDAsXCIgK1xyXG4gICAgICAgICAgICAgICAgLypsaW1pdF90aWNrZXRzW2FBXS50aWNrZXRfdHlwZSovXCIxXCIgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICAocGFzc2VuZ2VyLnBob25lX25vIHx8IFwiXCIgKSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIFwiTlwiO1xyXG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGlja2V0cy5qb2luKFwiX1wiKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk6IHN0cmluZyB7XHJcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xyXG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcclxuICAgICAgaWYocGxhblBlcG9sZXMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xyXG4gICAgICAgIC8vbmFtZSzouqvku73nsbvlnoss6Lqr5Lu96K+BLDFfXHJcbiAgICAgICAgdmFyIHRpY2tldCA9XHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBcIjFcIjtcclxuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcykge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NoZWNrT3JkZXJJbmZvXCI7XHJcblxyXG4gICAgdmFyIHBhc3NlbmdlclRpY2tldFN0ciA9IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiY2FuY2VsX2ZsYWdcIjogMlxyXG4gICAgICAsXCJiZWRfbGV2ZWxfb3JkZXJfbnVtXCI6IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCJcclxuICAgICAgLFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHBhc3NlbmdlclRpY2tldFN0clxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInJhbmRDb2RlXCI6IFwiXCJcclxuICAgICAgLFwid2hhdHNTZWxlY3RcIjoxXHJcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogc3VibWl0VG9rZW5cclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlOiBGdW5jdGlvbiwgcmVqZWN0OiBGdW5jdGlvbik9PiB7XHJcbiAgICAgIGlmKCFwYXNzZW5nZXJUaWNrZXRTdHIpIHtcclxuICAgICAgICB0aHJvdyBcIuayoeacieebuOWFs+iBlOezu+S6ulwiO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgICB1cmw6ICcvbGVmdFRpY2tldC9pbml0JyxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf5b+Z77yM6K+356iN5ZCO6YeN6K+VJyBdLFxyXG4gICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgaWYocmVzdWx0LnN0YXR1cykge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KHJlc3VsdC5tZXNzYWdlc1swXSlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UXVldWVDb3VudCh0b2tlbiwgb3JkZXJSZXF1ZXN0RFRPLCB0aWNrZXRJbmZvKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UXVldWVDb3VudFwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwidHJhaW5fZGF0ZVwiOiBuZXcgRGF0ZShvcmRlclJlcXVlc3REVE8udHJhaW5fZGF0ZS50aW1lKS50b1N0cmluZygpXHJcbiAgICAgICxcInRyYWluX25vXCI6IG9yZGVyUmVxdWVzdERUTy50cmFpbl9ub1xyXG4gICAgICAsXCJzdGF0aW9uVHJhaW5Db2RlXCI6IG9yZGVyUmVxdWVzdERUTy5zdGF0aW9uX3RyYWluX2NvZGVcclxuICAgICAgLFwic2VhdFR5cGVcIjoxXHJcbiAgICAgICxcImZyb21TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLmZyb21fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0XCI6IHRpY2tldEluZm8ucXVlcnlMZWZ0VGlja2V0UmVxdWVzdERUTy55cEluZm9EZXRhaWxcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIjAwXCJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxyXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbICfns7vnu5/nuYHlv5nvvIzor7fnqI3lkI7ph43or5XvvIEnIF0sXHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgaWYocmVzdWx0LnN0YXR1cykge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KHJlc3VsdC5tZXNzYWdlc1swXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBhc3NDb2RlTmV3KCkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9nZXRQYXNzQ29kZU5ldz9tb2R1bGU9cGFzc2VuZ2VyJnJhbmQ9cmFuZHAmXCIrTWF0aC5yYW5kb20oMCwxKTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlIT09MjAwKSByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcclxuICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja1JhbmRDb2RlQW5zeW4oKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2NoZWNrUmFuZENvZGVBbnN5blwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIHJhbmRDb2RlOiBcIlwiLFxyXG4gICAgICByYW5kOiBcInJhbmRwXCJcclxuICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XHJcbiAgICAgIGlucHV0OiBwcm9jZXNzLnN0ZGluLFxyXG4gICAgICBvdXRwdXQ6IHByb2Nlc3Muc3Rkb3V0XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHJsLnF1ZXN0aW9uKCdQbGVhc2UgaW5wdXQgcmFuZGNvZGU6JywgKHBvc2l0aW9ucykgPT4ge1xyXG4gICAgICAgIHJsLmNsb3NlKCk7XHJcblxyXG4gICAgICAgIG9wdGlvbnMuZm9ybS5yYW5kQ29kZSA9IHBvc2l0aW9ucztcclxuICAgICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgICB9KVxyXG4gICAgICB9KTtcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNvbmZpcm1TaW5nbGVGb3JRdWV1ZSh0b2tlbiwgcGFzc2VuZ2VycywgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0sIHBsYW5QZXBvbGVzKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvY29uZmlybVNpbmdsZUZvclF1ZXVlXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJyYW5kQ29kZVwiOlwiXCJcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5wdXJwb3NlX2NvZGVzXHJcbiAgICAgICxcImtleV9jaGVja19pc0NoYW5nZVwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5rZXlfY2hlY2tfaXNDaGFuZ2VcclxuICAgICAgLFwibGVmdFRpY2tldFN0clwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5sZWZ0VGlja2V0U3RyXHJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnRyYWluX2xvY2F0aW9uXHJcbiAgICAgICxcImNob29zZV9zZWF0c1wiOiBcIlwiXHJcbiAgICAgICxcInNlYXREZXRhaWxUeXBlXCI6IFwiMDAwXCJcclxuICAgICAgLFwid2hhdHNTZWxlY3RcIjogMVxyXG4gICAgICAsXCJyb29tVHlwZVwiOiBcIjAwXCJcclxuICAgICAgLFwiZHdBbGxcIjogXCJOXCJcclxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbikge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcInJhbmRvbVwiOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxyXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxyXG4gICAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSByZWplY3QoZXJyb3IpO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNhbmNlbFF1ZXVlTm9Db21wbGV0ZU9yZGVyKCkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2NhbmNlbFF1ZXVlTm9Db21wbGV0ZU15T3JkZXJcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICB0b3VyRmxhZzogXCJkY1wiXHJcbiAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgICAgLGpzb246IHRydWVcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKHRoaXMuaXNTeXN0ZW1CdXNzeShib2R5KSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHRoaXMuU1lTVEVNX0JVU1NZKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5pdE5vQ29tcGxldGUoKSB7XHJcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIjtcclxuICAgIGxldCBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSlcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG15T3JkZXJOb0NvbXBsZXRlKCkge1xyXG4gICAgbGV0IHNqT3JkZXJOb0NvbXBsZXRlID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIHNqT3JkZXJOb0NvbXBsZXRlLm1lcmdlTWFwKCgpPT4gdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXHJcbiAgICAgIC5zdWJzY3JpYmUoKHgpPT57XHJcbiAgICAgICAgLypcclxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxyXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgIGRhdGE6IHsgb3JkZXJEQkxpc3Q6IFsgW09iamVjdF0gXSwgdG9fcGFnZTogJ2RiJyB9LFxyXG4gICAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cclxuICAgICAgICAgKi9cclxuICAgICAgICAgaWYoIXguZGF0YSkge1xyXG4gICAgICAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGtge3llbGxvdyDmsqHmnInmnKrlrozmiJDorqLljZV9YClcclxuICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgIH1cclxuICAgICAgICBsZXQgdGlja2V0cyA9IFtdO1xyXG4gICAgICAgIGlmKHguZGF0YS5vcmRlckNhY2hlRFRPKSB7XHJcbiAgICAgICAgICBsZXQgb3JkZXJDYWNoZSA9IHguZGF0YS5vcmRlckNhY2hlRFRPO1xyXG4gICAgICAgICAgb3JkZXJDYWNoZS50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xyXG4gICAgICAgICAgICB0aWNrZXRzLnB1c2goe1xyXG4gICAgICAgICAgICAgIFwi5o6S6Zif5Y+3XCI6IG9yZGVyQ2FjaGUucXVldWVOYW1lLFxyXG4gICAgICAgICAgICAgIFwi562J5b6F5pe26Ze0XCI6IG9yZGVyQ2FjaGUud2FpdFRpbWUsXHJcbiAgICAgICAgICAgICAgXCLnrYnlvoXkurrmlbBcIjogb3JkZXJDYWNoZS53YWl0Q291bnQsXHJcbiAgICAgICAgICAgICAgXCLkvZnnpajmlbBcIjogb3JkZXJDYWNoZS50aWNrZXRDb3VudCxcclxuICAgICAgICAgICAgICBcIuS5mOi9puaXpeacn1wiOiBvcmRlckNhY2hlLnRyYWluRGF0ZS5zbGljZSgwLDEwKSxcclxuICAgICAgICAgICAgICBcIui9puasoVwiOiBvcmRlckNhY2hlLnN0YXRpb25UcmFpbkNvZGUsXHJcbiAgICAgICAgICAgICAgXCLlh7rlj5Hnq5lcIjogb3JkZXJDYWNoZS5mcm9tU3RhdGlvbk5hbWUsXHJcbiAgICAgICAgICAgICAgXCLliLDovr7nq5lcIjogb3JkZXJDYWNoZS50b1N0YXRpb25OYW1lLFxyXG4gICAgICAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0VHlwZU5hbWUsXHJcbiAgICAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3Nlbmdlck5hbWVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgfWVsc2UgaWYoeC5kYXRhLm9yZGVyREJMaXN0KXtcclxuXHJcbiAgICAgICAgICB4LmRhdGEub3JkZXJEQkxpc3QuZm9yRWFjaChvcmRlcj0+IHtcclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coY2hhbGtg6K6i5Y2V5Y+3IHt5ZWxsb3cuYm9sZCAke29yZGVyLnNlcXVlbmNlX25vfX1gKVxyXG4gICAgICAgICAgICBvcmRlci50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xyXG4gICAgICAgICAgICAgIHRpY2tldHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBcIuiuouWNleWPt1wiOiB0aWNrZXQuc2VxdWVuY2Vfbm8sXHJcbiAgICAgICAgICAgICAgICAvLyBcIuiuouelqOWPt1wiOiB0aWNrZXQudGlja2V0X25vLFxyXG4gICAgICAgICAgICAgICAgXCLkuZjovabml6XmnJ9cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRyYWluX2RhdGUuc2xpY2UoMCwxMCl9fWAsXHJcbiAgICAgICAgICAgICAgICAvLyBcIuS4i+WNleaXtumXtFwiOiB0aWNrZXQucmVzZXJ2ZV90aW1lLFxyXG4gICAgICAgICAgICAgICAgXCLku5jmrL7miKroh7Pml7bpl7RcIjogY2hhbGtge3JlZC5ib2xkICR7dGlja2V0LnBheV9saW1pdF90aW1lfX1gLFxyXG4gICAgICAgICAgICAgICAgXCLph5Hpop1cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRpY2tldF9wcmljZS8xMDB9fWAsXHJcbiAgICAgICAgICAgICAgICBcIueKtuaAgVwiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudGlja2V0X3N0YXR1c19uYW1lfX1gLFxyXG4gICAgICAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3NlbmdlckRUTy5wYXNzZW5nZXJfbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi6L2m5qyhXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8uc3RhdGlvbl90cmFpbl9jb2RlLFxyXG4gICAgICAgICAgICAgICAgXCLlh7rlj5Hnq5lcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy5mcm9tX3N0YXRpb25fbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi5Yiw6L6+56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8udG9fc3RhdGlvbl9uYW1lLFxyXG4gICAgICAgICAgICAgICAgXCLluqfkvY1cIjogdGlja2V0LnNlYXRfbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0X3R5cGVfbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi5LmY6L2m5Lq657G75Z6LXCI6IHRpY2tldC50aWNrZXRfdHlwZV9uYW1lXHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0aWNrZXRzLCB7XHJcbiAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJ3wnXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xyXG4gICAgICB9LCBlcnI9PmNvbnNvbGUuZXJyb3IoJ+ayoeacieacquWujOaIkOiuouWNlScpKTtcclxuXHJcbiAgICBsZXQgc2pMID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIHRoaXMuYnVpbGRMb2dpbkZsb3coc2pMKVxyXG4gICAgICAuc3Vic2NyaWJlKCgpPT5zak9yZGVyTm9Db21wbGV0ZS5uZXh0KCkpXHJcblxyXG4gICAgc2pMLm5leHQoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpIHtcclxuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9xdWVyeU15T3JkZXJOb0NvbXBsZXRlXCI7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5Lm1lc3NhZ2VzKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbn1cclxuIl19
