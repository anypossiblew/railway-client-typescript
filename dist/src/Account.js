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
var beeper = require("beeper");
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
    Account.prototype.destroy = function () {
        this.scptCheckUserTimer && this.scptCheckUserTimer.unsubscribe();
    };
    Account.prototype.build = function () {
        var _this = this;
        this.sjQueryOrderWaitT
            .mergeMap(function (orderRequest) {
            return _this.queryOrderWaitTime(orderRequest && (orderRequest.token || ""))
                .then(function (orderQueue) {
                if (orderQueue.status) {
                    if (orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
                        // 0.5秒响一次，响铃30分钟
                        beeper(60 * 30 * 2);
                        return console.log(chalk(templateObject_2 || (templateObject_2 = __makeTemplateObject(["Your ticket order number is {red.bold ", "}"], ["Your ticket order number is {red.bold ", "}"])), orderQueue.data.orderId));
                    }
                    else if (orderQueue.data.waitTime === -2) {
                        if (orderQueue.data.msg) {
                            return console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), orderQueue.data.msg));
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
                        console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"], ["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
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
            console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
            _this.destroy();
        }, function (err) { return console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); });
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
            console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
        }, function (err) {
            // 校验失败，重新校验
            console.log(chalk(templateObject_8 || (templateObject_8 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"]))));
            return Promise.reject(err);
        }); })
            .retry(Number.MAX_SAFE_INTEGER)
            .subscribe(function () { return sjLogin.next(1); }, function (err) { return console.error(err); });
        /**
         * 如何在 mergeMap + retry 模式中区分需要重试的错误和正常不需要重试的错误，
         * 如果把不需要重试的错误和正确结果都通过resolve返回则需要什么样的方式进行区别
         */
        sjLogin
            .mergeMap(function () {
            return _this.userAuthenticate()
                .then(function () {
                console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
                return Promise.resolve();
            }, function (err) {
                /*
                {"result_message":"密码输入错误。如果输错次数超过4次，用户将被锁定。","result_code":1}
                {"result_message":"验证码校验失败","result_code":"5"}
                */
                if (typeof err.result_code == "undefined") {
                    return Promise.reject(err);
                }
                else {
                    console.log(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err.result_message));
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
            console.log(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"]))));
            winston.debug(err);
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
                        winston.debug(order.trainDate + "/" + train[3] + "/" + seat + "/" + train[seatNum]);
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
            .do(function () {
            if (_this.query) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
            }
        })
            .subscribe(function (order) {
            if (order.availableTrains.length > 0) {
                _this.query = false;
                // process.stdout.write(chalk`{yellow 有可购买余票 ${planTrain.toString()}}`);
                order.trainSecretStr = order.availableTrains[0][0];
                sjSmOReqCheckUser.next(order);
            }
            else {
                process.stdout.write(chalk(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"], ["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"])), order.fromStationName, order.toStationName, order.passStationName ? '到' + order.passStationName + ' ' : '', order.trainDate));
                // process.stdout.write(".......");
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
            winston.debug("submit order request");
            _this.submitOrderRequest(order)
                .then(function (body) {
                if (body.status) {
                    winston.debug(chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["{yellow Submit Order Request success!}"], ["{yellow Submit Order Request success!}"]))));
                    _this.sjCPasInitDc.next(order);
                }
                else {
                    // 您还有未处理的订单
                    // 该车次暂不办理业务
                    winston.error(chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.messages[0]));
                    _this.destroy();
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
        }, function (err) {
            winston.error(chalk(templateObject_15 || (templateObject_15 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), JSON.stringify(err)));
            _this.destroy();
        });
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
                    console.log(chalk(templateObject_16 || (templateObject_16 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), x.data.errMsg));
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
            console.log(chalk(templateObject_17 || (templateObject_17 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"], ["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"]))));
            return Promise.reject();
        }
        this.BACK_TRAIN_DATE = trainDate;
        if (!fromStationName) {
            console.log(chalk(templateObject_18 || (templateObject_18 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"]))));
            return Promise.reject();
        }
        this.FROM_STATION_NAME = fromStationName;
        if (!toStationName) {
            console.log(chalk(templateObject_19 || (templateObject_19 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"]))));
            return Promise.reject();
        }
        this.TO_STATION_NAME = toStationName;
        this.FROM_STATION = this.stations.getStationCode(fromStationName);
        this.TO_STATION = this.stations.getStationCode(toStationName);
        return Rx.Observable.of(1)
            .mergeMap(function () { return _this.queryLeftTicket(trainDate)
            .then(function (trainsData) { return trainsData; }, function (err) {
            process.stdout.write(".");
            return Promise.reject(err);
        }); })
            .retryWhen(function (errors) { return errors.delay(1500); })
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
                        return reject(error);
                    }
                    if (response.statusCode === 200) {
                        body = JSON.parse(body);
                        winston.debug(body.result_message);
                        if (body.result_code == 4) {
                            resolve();
                        }
                        reject();
                    }
                    else {
                        winston.debug('error: ' + response.statusCode);
                        reject();
                    }
                });
            }, function (error) {
                winston.error(error);
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
                    winston.debug(body);
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
                    body = JSON.parse(body);
                    winston.debug(body.result_message);
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
                    reject(response.statusCode);
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
    Account.prototype.cancelNoCompleteMyOrder = function (sequenceNo, cancelId) {
        var _this = this;
        if (cancelId === void 0) { cancelId = 'cancel_order'; }
        var url = "https://kyfw.12306.cn/otn/queryOrder/cancelNoCompleteMyOrder";
        var options = {
            url: url,
            method: "POST",
            headers: Object.assign(Object.assign({}, this.headers), {
                "Referer": "https://kyfw.12306.cn/otn/queryOrder/initNoComplete"
            }),
            form: {
                "sequence_no": sequenceNo,
                "cancel_flag": cancelId,
                "_json_att": ""
            },
            json: true
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
    Account.prototype.cancelNoCompleteOrder = function (sequenceNo, cancelId) {
        var _this = this;
        if (cancelId === void 0) { cancelId = 'cancel_order'; }
        var sjCancelOrder = new Rx.Subject();
        this.buildLoginFlow(sjCancelOrder)
            .subscribe(function () {
            _this.cancelNoCompleteMyOrder(sequenceNo, cancelId)
                .then(function (body) {
                // {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,"data":{},"messages":[],"validateMessages":{}}
                if (body.data.existError == "Y") {
                    winston.error(chalk(templateObject_27 || (templateObject_27 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), body.data.errorMsg));
                }
                else {
                    winston.warn(chalk(templateObject_28 || (templateObject_28 = __makeTemplateObject(["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"], ["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"])), sequenceNo));
                }
            }, function (err) { return winston.error(chalk(templateObject_29 || (templateObject_29 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), JSON.stringify(err))); });
        });
        sjCancelOrder.next();
    };
    return Account;
}());
exports.Account = Account;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFDLEVBQUMsVUFBQSxHQUFHLElBQUUsT0FBQSxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssaUZBQUEsT0FBUSxFQUFtQixHQUFHLEtBQXRCLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUksRUFBbEQsQ0FBa0QsQ0FBQyxDQUFDO1FBQy9ELENBQUMsQ0FBQyxDQUFDO1FBRUwsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3ZCLENBQUM7SUFDSCxjQUFDO0FBQUQsQ0FyckRBLEFBcXJEQyxJQUFBO0FBcnJEWSwwQkFBTyIsImZpbGUiOiJzcmMvQWNjb3VudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiAvLyBodHRwczovL3d3dy5sYW5pbmRleC5jb20vMTIzMDYlRTglQjQlQUQlRTclQTUlQTglRTYlQjUlODElRTclQTglOEIlRTUlODUlQTglRTglQTclQTMlRTYlOUUlOTAvXHJcblxyXG5pbXBvcnQgd2luc3RvbiA9IHJlcXVpcmUoJ3dpbnN0b24nKTtcclxuaW1wb3J0IHtGaWxlQ29va2llU3RvcmV9IGZyb20gJy4vRmlsZUNvb2tpZVN0b3JlJztcclxuaW1wb3J0IHtTdGF0aW9ufSBmcm9tICcuL1N0YXRpb24nO1xyXG5pbXBvcnQgcmVxdWVzdCA9IHJlcXVpcmUoJ3JlcXVlc3QnKTtcclxuaW1wb3J0IHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcclxuaW1wb3J0IGZzID0gcmVxdWlyZSgnZnMnKTtcclxuaW1wb3J0IHJlYWRsaW5lID0gcmVxdWlyZSgncmVhZGxpbmUnKTtcclxuaW1wb3J0IHByb2Nlc3MgPSByZXF1aXJlKCdwcm9jZXNzJyk7XHJcbmltcG9ydCBSeCA9IHJlcXVpcmUoJ0ByZWFjdGl2ZXgvcnhqcycpO1xyXG5pbXBvcnQgY2hhbGsgPSByZXF1aXJlKCdjaGFsaycpO1xyXG5pbXBvcnQgY29sdW1uaWZ5ID0gcmVxdWlyZSgnY29sdW1uaWZ5Jyk7XHJcbmltcG9ydCBiZWVwZXIgPSByZXF1aXJlKCdiZWVwZXInKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBBY2NvdW50IHtcclxuICBwdWJsaWMgdXNlck5hbWUgOiBzdHJpbmc7XHJcbiAgcHVibGljIHVzZXJQYXNzd29yZCA6IHN0cmluZztcclxuICBwcml2YXRlIGNoZWNrVXNlclRpbWVyID0gUnguT2JzZXJ2YWJsZS50aW1lcigwLCAxMDAwKjYwKjIwKTtcclxuICBwcml2YXRlIHNjcHRDaGVja1VzZXJUaW1lcjogUnguU3Vic2NyaXB0aW9uO1xyXG5cclxuICBwcml2YXRlIHN0YXRpb25zOiBTdGF0aW9uID0gbmV3IFN0YXRpb24oKTtcclxuICBwcml2YXRlIHBhc3NlbmdlcnM6IG9iamVjdDtcclxuXHJcbiAgcHJpdmF0ZSBTWVNURU1fQlVTU1kgPSBcIlN5c3RlbSBpcyBidXNzeVwiO1xyXG4gIHByaXZhdGUgU1lTVEVNX01PVkVEID0gXCJNb3ZlZCBUZW1wb3JhcmlseVwiO1xyXG5cclxuICBwcml2YXRlIHJlcXVlc3Q6IHJlcXVlc3QuUmVxdWVzdEFQSTxhbnksIGFueSwgYW55PjtcclxuICBwcml2YXRlIGNvb2tpZWphcjogYW55O1xyXG4gIHB1YmxpYyBoZWFkZXJzOiBvYmplY3QgPSB7XHJcbiAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOFwiXHJcbiAgICAsXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgNi4xOyBXT1c2NCkgQXBwbGVXZWJLaXQvNTM3LjE3IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzI0LjAuMTMxMi42MCBTYWZhcmkvNTM3LjE3XCJcclxuICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcclxuICAgICxcIk9yaWdpblwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jblwiXHJcbiAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzcG9ydD9yZWRpcmVjdD0vb3RuL1wiXHJcbiAgfTtcclxuXHJcbiAgcHJpdmF0ZSBUSUNLRVRfVElUTEUgPSBbJycsICcnLCAnJywgJ+i9puasoScsICfotbflp4snLCAn57uI54K5JywgJ+WHuuWPkScsICfliLDovr4nLCAn5Ye65Y+RJywgJ+WIsOi+vicsICfljobml7YnLCAnJywgJycsXHJcbiAgICAgICAgICAgICAgICfml6XmnJ8nLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ+mrmOe6p+i9r+WNpycsICcnLCAn6L2v5Y2nJywgJ+i9r+W6pycsICfnibnnrYnluqcnLCAn5peg5bqnJyxcclxuICAgICAgICAgICAgICAgJycsICfnoazljacnLCAn56Gs5bqnJywgJ+S6jOetieW6pycsICfkuIDnrYnluqcnLCAn5ZWG5Yqh5bqnJ107XHJcblxyXG4gIHByaXZhdGUgcXVlcnkgPSBmYWxzZTtcclxuXHJcbiAgcHJpdmF0ZSBvcmRlcnM6IEFycmF5PG9iamVjdD4gPSBbXTtcclxuXHJcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB1c2VyUGFzc3dvcmQ6IHN0cmluZykge1xyXG4gICAgdGhpcy51c2VyTmFtZSA9IG5hbWU7XHJcbiAgICB0aGlzLnVzZXJQYXNzd29yZCA9IHVzZXJQYXNzd29yZDtcclxuXHJcbiAgICB0aGlzLnNldFJlcXVlc3QoKTtcclxuICAgIHRoaXMuYnVpbGQoKTtcclxuXHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDmo4Dmn6XnvZHnu5zlvILluLhcclxuICAgKi9cclxuICBwcml2YXRlIGlzU3lzdGVtQnVzc3koYm9keTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYm9keS5pbmRleE9mKFwi572R57uc5Y+v6IO95a2Y5Zyo6Zeu6aKY77yM6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzZXRSZXF1ZXN0KCkge1xyXG4gICAgbGV0IGNvb2tpZUZpbGVOYW1lOiBzdHJpbmcgPSBcIi4vY29va2llcy9cIit0aGlzLnVzZXJOYW1lK1wiLmpzb25cIjtcclxuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKGNvb2tpZUZpbGVOYW1lLCB7ZW5jcnlwdDogZmFsc2V9KTtcclxuICAgIGZpbGVTdG9yZS5vcHRpb24gPSB7ZW5jcnlwdDogZmFsc2V9O1xyXG5cclxuICAgIHRoaXMuY29va2llamFyID0gcmVxdWVzdC5qYXIoZmlsZVN0b3JlKTtcclxuXHJcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG5leHRPcmRlck51bTogTnVtYmVyID0gMDtcclxuICBwcml2YXRlIG5leHRPcmRlcigpIHtcclxuICAgIHRoaXMubmV4dE9yZGVyTnVtID0gKHRoaXMubmV4dE9yZGVyTnVtKzEpJXRoaXMub3JkZXJzLmxlbmd0aDtcclxuICAgIHJldHVybiB0aGlzLm9yZGVyc1t0aGlzLm5leHRPcmRlck51bV07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGN1cnJlbnRPcmRlcigpIHtcclxuICAgIHJldHVybiB0aGlzLm9yZGVyc1t0aGlzLm5leHRPcmRlck51bV07XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY3JlYXRlT3JkZXIodHJhaW5EYXRlczogQXJyYXk8c3RyaW5nPiwgYmFja1RyYWluRGF0ZTogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICBbZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLFxyXG4gICAgICAgICAgICAgICAgICAgICBwbGFuVHJhaW5zOiBBcnJheTxzdHJpbmc+LCBwbGFuUGVwb2xlczogQXJyYXk8c3RyaW5nPiwgc2VhdENsYXNzZXM6IEFycmF5PHN0cmluZz4pOiB0aGlzIHtcclxuICAgIHRyYWluRGF0ZXMuZm9yRWFjaCh0cmFpbkRhdGU9PiB7XHJcbiAgICAgIHRoaXMub3JkZXJzLnB1c2goe1xyXG4gICAgICAgIHRyYWluRGF0ZTogdHJhaW5EYXRlXHJcbiAgICAgICAgLGJhY2tUcmFpbkRhdGU6IGJhY2tUcmFpbkRhdGVcclxuICAgICAgICAsZnJvbVN0YXRpb25OYW1lOiBmcm9tU3RhdGlvbk5hbWU7XHJcbiAgICAgICAgLHRvU3RhdGlvbk5hbWU6IHRvU3RhdGlvbk5hbWU7XHJcbiAgICAgICAgLHBhc3NTdGF0aW9uTmFtZTogcGFzc1N0YXRpb25OYW1lLFxyXG4gICAgICAgICxQTEFOX1RSQUlOUzogcGxhblRyYWlucztcclxuICAgICAgICAscGxhblBlcG9sZXM6IHBsYW5QZXBvbGVzO1xyXG4gICAgICAgICxGUk9NX1NUQVRJT046IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUoZnJvbVN0YXRpb25OYW1lKTtcclxuICAgICAgICAsVE9fU1RBVElPTjogdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZSh0b1N0YXRpb25OYW1lKTtcclxuICAgICAgICAsc2VhdENsYXNzZXM6IHNlYXRDbGFzc2VzXHJcbiAgICAgIH0pXHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHB1YmxpYyBvcmRlcldhaXRUaW1lKCkge1xyXG4gICAgbGV0IHNqT3JkZXJXYWl0VGltZSA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICB0aGlzLmJ1aWxkTG9naW5GbG93KHNqT3JkZXJXYWl0VGltZSlcclxuICAgICAgLnN1YnNjcmliZSgoKT0+dGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KCkpO1xyXG4gICAgc2pPcmRlcldhaXRUaW1lLm5leHQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjYW5jZWxPcmRlclF1ZXVlKCkge1xyXG4gICAgdGhpcy5jYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpXHJcbiAgICAgIC50aGVuKHg9PiB7XHJcbiAgICAgICAgaWYoeC5zdGF0dXMgJiYgeC5kYXRhLmV4aXN0RXJyb3IgPT0gJ04nKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDmjpLpmJ/orqLljZXlt7Llj5bmtoh9YCk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcih4KTtcclxuICAgICAgICB9XHJcbiAgICAgIH0sIGVycm9yPT4gY29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHN1Ym1pdCgpOiB2b2lkIHtcclxuICAgIGxldCBzakwgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gICAgbGV0IHNqQ2hlY2tVc2VyID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIHRoaXMuYnVpbGRMb2dpbkZsb3coc2pMKVxyXG4gICAgICAuc3Vic2NyaWJlKCgpPT57XHJcbiAgICAgICAgdGhpcy5idWlsZE9yZGVyRmxvdygpLm5leHQoKTtcclxuICAgICAgICB0aGlzLnNjcHRDaGVja1VzZXJUaW1lciA9XHJcbiAgICAgICAgICB0aGlzLmNoZWNrVXNlclRpbWVyLnN1YnNjcmliZSgoaSk9PiB7XHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGkpO1xyXG4gICAgICAgICAgICBzakNoZWNrVXNlci5uZXh0KCk7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgLy9cclxuICAgIHRoaXMuYnVpbGRDaGVja1VzZXJGbG93KHNqQ2hlY2tVc2VyKVxyXG4gICAgICAuc3Vic2NyaWJlKCgpPT53aW5zdG9uLmRlYnVnKFwiQ2hlY2sgdXNlciBkb25lXCIpKTtcclxuXHJcbiAgICBzakwubmV4dCgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGRlc3Ryb3koKSB7XHJcbiAgICB0aGlzLnNjcHRDaGVja1VzZXJUaW1lciYmdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXIudW5zdWJzY3JpYmUoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGQoKSB7XHJcblxyXG4gICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VFxyXG4gICAgICAgIC5tZXJnZU1hcCgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT5cclxuICAgICAgICAgIHRoaXMucXVlcnlPcmRlcldhaXRUaW1lKG9yZGVyUmVxdWVzdCYmKG9yZGVyUmVxdWVzdC50b2tlbnx8XCJcIikpXHJcbiAgICAgICAgICAgIC50aGVuKG9yZGVyUXVldWU9PiB7XHJcbiAgICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5zdGF0dXMpIHtcclxuICAgICAgICAgICAgICAgIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gMCB8fCBvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICAgIC8vIDAuNeenkuWTjeS4gOasoe+8jOWTjemTgzMw5YiG6ZKfXHJcbiAgICAgICAgICAgICAgICAgIGJlZXBlcig2MCozMCoyKTtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYFlvdXIgdGlja2V0IG9yZGVyIG51bWJlciBpcyB7cmVkLmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEub3JkZXJJZH19YCk7XHJcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0yKXtcclxuICAgICAgICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLm1zZykge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEubXNnfX1gKTtcclxuICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XHJcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0zKXtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKFwiWW91ciB0aWNrZXQgcmVxdWVzdCBoYXMgYmVlbiBjYW5jZWxlZCFcIik7XHJcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC00KXtcclxuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJZb3VyIHRpY2tldCByZXF1ZXN0IGlzIGJlaW5nIHByb2Nlc3NlZCwgcGxlYXNlIHdhaXQgYSBtb21lbnQhXCIpO1xyXG4gICAgICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg5o6S6Zif5Lq65pWw77yaJHtvcmRlclF1ZXVlLmRhdGEud2FpdENvdW50fX0g6aKE6K6h562J5b6F5pe26Ze077yaJHtwYXJzZUludChvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgLyAxLjUpfSDliIbpkp9gKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICAgICAgICAgIH0sIDQwMDApO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9LGVycj0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgIClcclxuICAgICAgLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxyXG4gICAgICAuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDnu5PmnZ99YCk7XHJcbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XHJcbiAgICAgIH0sZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YCkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZEF1dGhGbG93KHN1YmplY3Q6IFJ4LlN1YmplY3QsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNqTmV3QXBwVG9rZW46IFJ4LlJlcGxheVN1YmplY3QgPSBuZXcgUnguUmVwbGF5U3ViamVjdCgpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzakFwcFRva2VuOiBSeC5SZXBsYXlTdWJqZWN0ID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKSkge1xyXG4gICAgbGV0IHNqQ2FwdGNoYSA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pMb2dpbiA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pNeVBhZ2UgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICAgIHN1YmplY3Quc3Vic2NyaWJlKHNqQ2FwdGNoYSk7XHJcblxyXG4gICAgc2pDYXB0Y2hhLm1lcmdlTWFwKCgpPT50aGlzLmdldENhcHRjaGEoKSlcclxuICAgICAgICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmNoZWNrQ2FwdGNoYSgpLnRoZW4oKCk9PntcclxuICAgICAgICAgICAgICAvLyDmoKHpqoznoIHmiJDlip/lkI7ov5vooYzmjojmnYPorqTor4FcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDpqozor4HnoIHmoKHpqozmiJDlip99YCk7XHJcbiAgICAgICAgICAgIH0sZXJyPT4ge1xyXG4gICAgICAgICAgICAgIC8vIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjFxyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDmoKHpqozlpLHotKXvvIzph43mlrDmoKHpqox9YCk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgIH0pKVxyXG4gICAgICAgICAgICAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXHJcbiAgICAgICAgICAgIC5zdWJzY3JpYmUoKCk9PnNqTG9naW4ubmV4dCgxKSwgZXJyPT5jb25zb2xlLmVycm9yKGVycikpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5aaC5L2V5ZyoIG1lcmdlTWFwICsgcmV0cnkg5qih5byP5Lit5Yy65YiG6ZyA6KaB6YeN6K+V55qE6ZSZ6K+v5ZKM5q2j5bi45LiN6ZyA6KaB6YeN6K+V55qE6ZSZ6K+v77yMXHJcbiAgICAgKiDlpoLmnpzmiorkuI3pnIDopoHph43or5XnmoTplJnor6/lkozmraPnoa7nu5Pmnpzpg73pgJrov4dyZXNvbHZl6L+U5Zue5YiZ6ZyA6KaB5LuA5LmI5qC355qE5pa55byP6L+b6KGM5Yy65YirXHJcbiAgICAgKi9cclxuICAgIHNqTG9naW5cclxuICAgICAgLm1lcmdlTWFwKCgpPT5cclxuICAgICAgICB0aGlzLnVzZXJBdXRoZW50aWNhdGUoKVxyXG4gICAgICAgICAgICAudGhlbigoKT0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDnmbvlvZXmiJDlip99YCk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9LGVycj0+IHtcclxuICAgICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLlr4bnoIHovpPlhaXplJnor6/jgILlpoLmnpzovpPplJnmrKHmlbDotoXov4c05qyh77yM55So5oi35bCG6KKr6ZSB5a6a44CCXCIsXCJyZXN1bHRfY29kZVwiOjF9XHJcbiAgICAgICAgICAgICAge1wicmVzdWx0X21lc3NhZ2VcIjpcIumqjOivgeeggeagoemqjOWksei0pVwiLFwicmVzdWx0X2NvZGVcIjpcIjVcIn1cclxuICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgIGlmKHR5cGVvZiBlcnIucmVzdWx0X2NvZGUgPT0gXCJ1bmRlZmluZWRcIikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyLnJlc3VsdF9tZXNzYWdlfX1gKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBlcnI7XHJcbiAgICAgICAgICAgICAgICAvLyBpZihlcnJvci5yZXN1bHRfY29kZSA9PT0gMSkge1xyXG4gICAgICAgICAgICAgICAgLy8gICB0aHJvdyBlcnJvci5yZXN1bHRfbWVzc2FnZTtcclxuICAgICAgICAgICAgICAgIC8vIH1lbHNlIGlmKGVycm9yLnJlc3VsdF9jb2RlID09PSA1KSB7XHJcbiAgICAgICAgICAgICAgICAvLyAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICAgICAgICAgIC8vIH1lbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xyXG4gICAgICAgICAgICAgICAgLy8gfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgKVxyXG4gICAgICAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXHJcbiAgICAgIC5zdWJzY3JpYmUoZXJyPT4ge1xyXG4gICAgICAgIC8vIOeZu+W9leWksei0peWwhumHjeaWsOS7juagoemqjOeggeW8gOWni1xyXG4gICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgc2pDYXB0Y2hhLm5leHQoMSk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgc2pOZXdBcHBUb2tlbi5uZXh0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuXHJcbiAgICBzak5ld0FwcFRva2VuXHJcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5nZXROZXdBcHBUb2tlbigpKVxyXG4gICAgICAuc3Vic2NyaWJlKChuZXdhcHB0azogc3RyaW5nKT0+IHtcclxuICAgICAgICBzakFwcFRva2VuLm5leHQobmV3YXBwdGspXHJcbiAgICAgIH0sZXJyPT4ge1xyXG4gICAgICAgIHNqQ2FwdGNoYS5uZXh0KDEpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICBzakFwcFRva2VuXHJcbiAgICAgIC5tZXJnZU1hcCgobmV3YXBwdGs6IHN0cmluZyk9PnRoaXMuZ2V0QXBwVG9rZW4obmV3YXBwdGspXHJcbiAgICAgICAgLnRoZW4oKHg6IHN0cmluZykgPT4gLCAoZXJyOiBhbnkpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOiOt+WPllRva2Vu5aSx6LSlfWApO1xyXG4gICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhlcnIpO1xyXG4gICAgICAgICAgaWYoZXJyLnJlc3VsdF9jb2RlICYmIGVyci5yZXN1bHRfY29kZSA9PT0gMikge1xyXG4gICAgICAgICAgICByZXR1cm4gZXJyO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KSlcclxuICAgICAgLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxyXG4gICAgICAuc3Vic2NyaWJlKChlcnI6IGFueSkgPT4ge1xyXG4gICAgICAgIGlmKGVycikge1xyXG4gICAgICAgICAgc2pDYXB0Y2hhLm5leHQoMSk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgc2pNeVBhZ2UubmV4dCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHNqTXlQYWdlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZExvZ2luRmxvdyhvYnNlcnZhYmxlOiBSeC5PYnNlcnZhYmxlKTogdm9pZCB7XHJcbiAgICBsZXQgc2pMb2dpbkluaXQgPSBuZXcgUnguUmVwbGF5U3ViamVjdCgpO1xyXG4gICAgbGV0IHNqQ2FwdGNoYSA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pOZXdBcHBUb2tlbiA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pBcHBUb2tlbiA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcblxyXG4gICAgb2JzZXJ2YWJsZS5zdWJzY3JpYmUoc2pMb2dpbkluaXQpO1xyXG5cclxuICAgIC8vIOeZu+W9leWIneWni+WMllxyXG4gICAgc2pMb2dpbkluaXRcclxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT50aGlzLmxvZ2luSW5pdCgpKVxyXG4gICAgICAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXHJcbiAgICAgIC5tYXAob3JkZXIgPT4gdGhpcy5jaGVja0F1dGhlbnRpY2F0aW9uKHRoaXMuY29va2llamFyLl9qYXIudG9KU09OKCkuY29va2llcykpXHJcbiAgICAgIC5zdWJzY3JpYmUodG9rZW5zPT4ge1xyXG4gICAgICAgIGlmKHRva2Vucy50aykge1xyXG4gICAgICAgICAgcmV0dXJuIHNqQXBwVG9rZW4ubmV4dCh0b2tlbnMudGspO1xyXG4gICAgICAgIH1lbHNlIGlmKHRva2Vucy51YW10aykge1xyXG4gICAgICAgICAgcmV0dXJuIHNqTmV3QXBwVG9rZW4ubmV4dCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBzakNhcHRjaGEubmV4dCgxKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRBdXRoRmxvdyhzakNhcHRjaGEsIHNqTmV3QXBwVG9rZW4sIHNqQXBwVG9rZW4pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzakxmVGlja2V0SW5pdCAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqUXVlcnlMZlRpY2tldCAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pTbU9SZXFDaGVja1VzZXIgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHNqU21PcmRlclJlcSAgICAgICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBzakNQYXNJbml0RGMgICAgICAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgc2pHZXRQYXNzZW5nZXJzICAgICA9IG5ldyBSeC5TdWJqZWN0PG9iamVjdD4oKTtcclxuICBwcml2YXRlIHNqQ2hlY2tPcmRlckluZm8gICAgPSBuZXcgUnguUmVwbGF5U3ViamVjdDxvYmplY3Q+KCk7XHJcbiAgcHJpdmF0ZSBzakdldFF1ZXVlQ291bnQgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqR2V0UGFzc0NvZGVOZXcgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pDb25maXJtU2luZ2xlNFEgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzalF1ZXJ5T3JkZXJXYWl0VCAgID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKTtcclxuXHJcbiAgcHJpdmF0ZSBidWlsZFF1ZXJ5TGVmdFRpY2tldEZsb3cob2JzZXJ2YWJsZTogUnguT2JzZXJ2YWJsZSk6IFJ4Lk9ic2VydmFibGUge1xyXG4gICAgbGV0IHNqUXVlcnlMZlRpY2tldCA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XHJcblxyXG4gICAgb2JzZXJ2YWJsZS5zdWJzY3JpYmUoc2pRdWVyeUxmVGlja2V0KTtcclxuXHJcbiAgICByZXR1cm4gc2pRdWVyeUxmVGlja2V0XHJcbiAgICAgIC5tZXJnZU1hcChvcmRlcj0+XHJcbiAgICAgICAgdGhpcy5xdWVyeUxlZnRUaWNrZXRzKG9yZGVyLnRyYWluRGF0ZSwgb3JkZXIuZnJvbVN0YXRpb25OYW1lLCBvcmRlci50b1N0YXRpb25OYW1lLCBvcmRlci5QTEFOX1RSQUlOUylcclxuICAgICAgICAgIC50aGVuKCh0cmFpbnMpPT4ge1xyXG4gICAgICAgICAgICBvcmRlci50cmFpbnMgPSB0cmFpbnM7XHJcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcclxuICAgICAgICAgIH0sZXJyPT5jb25zb2xlLmVycm9yKGVycikpXHJcbiAgICAgIClcclxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT57XHJcbiAgICAgICAgaWYob3JkZXIucGFzc1N0YXRpb25OYW1lKSB7XHJcbiAgICAgICAgICBpZighb3JkZXIuZnJvbVRvUGFzc1RyYWlucykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5xdWVyeUxlZnRUaWNrZXRzKG9yZGVyLnRyYWluRGF0ZSwgb3JkZXIuZnJvbVN0YXRpb25OYW1lLCBvcmRlci5wYXNzU3RhdGlvbk5hbWUsIG9yZGVyLlBMQU5fVFJBSU5TKVxyXG4gICAgICAgICAgICAgIC50aGVuKHBhc3NUcmFpbnM9PiB7XHJcbiAgICAgICAgICAgICAgICBvcmRlci5mcm9tVG9QYXNzVHJhaW5zID0gcGFzc1RyYWlucy5tYXAodHJhaW4gPT4gdHJhaW5bM10pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG9yZGVyKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG9yZGVyKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5tYXAob3JkZXI9PiB7XHJcbiAgICAgICAgaWYob3JkZXIuZnJvbVRvUGFzc1RyYWlucykge1xyXG4gICAgICAgICAgb3JkZXIudHJhaW5zID0gb3JkZXIudHJhaW5zLmZpbHRlcih0cmFpbiA9PiBvcmRlci5mcm9tVG9QYXNzVHJhaW5zLmluY2x1ZGVzKHRyYWluWzNdKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiBvcmRlcjtcclxuICAgICAgfSlcclxuICAgICAgLm1hcChvcmRlcj0+IHtcclxuICAgICAgICBsZXQgdHJhaW5zID0gb3JkZXIudHJhaW5zfHxbXTtcclxuXHJcbiAgICAgICAgdmFyIHBsYW5UcmFpbnMgPSBbXSwgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgdHJhaW5zLnNvbWUodHJhaW4gPT4ge1xyXG4gICAgICAgICAgcmV0dXJuIG9yZGVyLnNlYXRDbGFzc2VzLnNvbWUoc2VhdCA9PiB7XHJcbiAgICAgICAgICAgIHZhciBzZWF0TnVtID0gdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihzZWF0KTtcclxuICAgICAgICAgICAgaWYodHJhaW5bc2VhdE51bV0gPT0gXCLmnIlcIiB8fCB0cmFpbltzZWF0TnVtXSA+IDApIHtcclxuICAgICAgICAgICAgICB3aW5zdG9uLmRlYnVnKG9yZGVyLnRyYWluRGF0ZStcIi9cIit0cmFpblszXStcIi9cIitzZWF0K1wiL1wiK3RyYWluW3NlYXROdW1dKTtcclxuICAgICAgICAgICAgICBpZihvcmRlci5QTEFOX1RSQUlOUy5pbmNsdWRlcyh0cmFpblszXSkpIHtcclxuICAgICAgICAgICAgICAgIHBsYW5UcmFpbnMucHVzaCh0cmFpbik7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIG9yZGVyLmF2YWlsYWJsZVRyYWlucyA9IHBsYW5UcmFpbnM7XHJcbiAgICAgICAgcmV0dXJuIG9yZGVyO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRPcmRlckZsb3coKTogUnguT2JzZXJ2YWJsZSB7XHJcblxyXG4gICAgbGV0IHNqUXVlcnlMZlRpY2tldCA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICBsZXQgc2pTbU9SZXFDaGVja1VzZXIgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxyXG4gICAgdGhpcy5zakxmVGlja2V0SW5pdC5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMubGVmdFRpY2tldEluaXQoKVxyXG4gICAgICAgIC50aGVuKCgpPT5zalF1ZXJ5TGZUaWNrZXQubmV4dCh0aGlzLm5leHRPcmRlcigpKSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0RmxvdyhzalF1ZXJ5TGZUaWNrZXQpXHJcbiAgICAgIC5kbygoKT0+IHtcclxuICAgICAgICBpZih0aGlzLnF1ZXJ5KSB7XHJcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcclxuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLnN1YnNjcmliZShvcmRlcj0+IHtcclxuICAgICAgICBpZihvcmRlci5hdmFpbGFibGVUcmFpbnMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgdGhpcy5xdWVyeSA9IGZhbHNlO1xyXG4gICAgICAgICAgLy8gcHJvY2Vzcy5zdGRvdXQud3JpdGUoY2hhbGtge3llbGxvdyDmnInlj6/otK3kubDkvZnnpaggJHtwbGFuVHJhaW4udG9TdHJpbmcoKX19YCk7XHJcbiAgICAgICAgICBvcmRlci50cmFpblNlY3JldFN0ciA9IG9yZGVyLmF2YWlsYWJsZVRyYWluc1swXVswXTtcclxuICAgICAgICAgIHNqU21PUmVxQ2hlY2tVc2VyLm5leHQob3JkZXIpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYOayoeacieWPr+i0reS5sOS9meelqCB7eWVsbG93ICR7b3JkZXIuZnJvbVN0YXRpb25OYW1lfX0g5YiwIHt5ZWxsb3cgJHtvcmRlci50b1N0YXRpb25OYW1lfX0gJHtvcmRlci5wYXNzU3RhdGlvbk5hbWU/J+WIsCcrb3JkZXIucGFzc1N0YXRpb25OYW1lKycgJzonJ317eWVsbG93ICR7b3JkZXIudHJhaW5EYXRlfX1gKTtcclxuICAgICAgICAgIC8vIHByb2Nlc3Muc3Rkb3V0LndyaXRlKFwiLi4uLi4uLlwiKTtcclxuXHJcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpPT4ge1xyXG4gICAgICAgICAgICBzalF1ZXJ5TGZUaWNrZXQubmV4dCh0aGlzLm5leHRPcmRlcigpKTtcclxuICAgICAgICAgIH0sIDE1MDApO1xyXG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LGVycj0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XHJcbiAgICAgIH0pO1xyXG5cclxuICAgIHRoaXMuYnVpbGRDaGVja1VzZXJGbG93KHNqU21PUmVxQ2hlY2tVc2VyKVxyXG4gICAgICAuc3Vic2NyaWJlKG9yZGVyPT50aGlzLnNqU21PcmRlclJlcS5uZXh0KHRoaXMuY3VycmVudE9yZGVyKCkpKTtcclxuXHJcbiAgICAvLyBTdGVwIDExIOmihOaPkOS6pOiuouWNle+8jFBvc3RcclxuICAgIHRoaXMuc2pTbU9yZGVyUmVxLnN1YnNjcmliZShvcmRlcj0+IHtcclxuICAgICAgd2luc3Rvbi5kZWJ1ZyhcInN1Ym1pdCBvcmRlciByZXF1ZXN0XCIpO1xyXG4gICAgICB0aGlzLnN1Ym1pdE9yZGVyUmVxdWVzdChvcmRlcilcclxuICAgICAgICAudGhlbigoYm9keSk9PiB7XHJcbiAgICAgICAgICBpZihib2R5LnN0YXR1cykge1xyXG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKGNoYWxrYHt5ZWxsb3cgU3VibWl0IE9yZGVyIFJlcXVlc3Qgc3VjY2VzcyF9YCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQob3JkZXIpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAvLyDmgqjov5jmnInmnKrlpITnkIbnmoTorqLljZVcclxuICAgICAgICAgICAgLy8g6K+l6L2m5qyh5pqC5LiN5Yqe55CG5Lia5YqhXHJcbiAgICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YCk7XHJcbiAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pTbU9yZGVyUmVxLm5leHQob3JkZXIpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxMiDmqKHmi5/ot7PovazpobXpnaJJbml0RGPvvIxQb3N0XHJcbiAgICB0aGlzLnNqQ1Bhc0luaXREYy5zdWJzY3JpYmUob3JkZXI9PiB7XHJcbiAgICAgIHRoaXMuY29uZmlybVBhc3NlbmdlckluaXREYygpLnRoZW4oKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgICB3aW5zdG9uLmRlYnVnKFwiY29uZmlybVBhc3NlbmdlciBJbml0IERjIHN1Y2Nlc3MhIFwiK29yZGVyUmVxdWVzdC50b2tlbik7XHJcbiAgICAgICAgb3JkZXIucmVxdWVzdCA9IG9yZGVyUmVxdWVzdDtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlclJlcXVlc3QudGlja2V0SW5mbyk7XHJcbiAgICAgICAgaWYodGhpcy5wYXNzZW5nZXJzKSB7XHJcbiAgICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMgPSB0aGlzLnBhc3NlbmdlcnM7XHJcbiAgICAgICAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm8ubmV4dChvcmRlcik7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5zakdldFBhc3NlbmdlcnMubmV4dChvcmRlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICBpZihlcnJvciA9PSB0aGlzLlNZU1RFTV9CVVNTWSkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dChvcmRlcik7XHJcbiAgICAgICAgfWVsc2UgaWYoZXJyb3IgPT0gdGhpcy5TWVNURU1fTU9WRUQpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQob3JkZXIpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkuY2F0Y2goZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDEzIOW4uOeUqOiBlOezu+S6uuehruWumu+8jFBvc3RcclxuICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLnN1YnNjcmliZSgob3JkZXI6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMuZ2V0UGFzc2VuZ2VycyhvcmRlci5yZXF1ZXN0LnRva2VuKS50aGVuKHBhc3NlbmdlcnM9PiB7XHJcbiAgICAgICAgdGhpcy5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcclxuICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xyXG4gICAgICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5uZXh0KG9yZGVyKTtcclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvciArIFwiIFJldHJ5IGdldCBwYXNzZW5nZXJzXCIpO1xyXG4gICAgICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLm5leHQob3JkZXIpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3I9PiB3aW5zdG9uLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm9cclxuICAgICAgLm1lcmdlTWFwKChvcmRlcjogb2JqZWN0KT0+XHJcbiAgICAgICAgLy8gU3RlcCAxNCDotK3npajkurrnoa7lrprvvIxQb3N0XHJcbiAgICAgICAgdGhpcy5jaGVja09yZGVySW5mbyhvcmRlci5yZXF1ZXN0LnRva2VuLCBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMuZGF0YS5ub3JtYWxfcGFzc2VuZ2Vycywgb3JkZXIucGxhblBlcG9sZXMpXHJcbiAgICAgICAgICAgIC50aGVuKG9yZGVySW5mbyA9PiB7XHJcbiAgICAgICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlckluZm8pO1xyXG4gICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5vcmRlckluZm8gPSBvcmRlckluZm87XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgICAgICAgfSxlcnIgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGVycjtcclxuICAgICAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgfSkpXHJcbiAgICAgIC5yZXRyeSgxMDApXHJcbiAgICAgIC5tZXJnZU1hcCgob3JkZXIpPT4ge1xyXG4gICAgICAgIGlmKHR5cGVvZiBvcmRlciA9PSBcInN0cmluZ1wiKSB7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3Qob3JkZXIpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUob3JkZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XHJcbiAgICAgIC5tZXJnZU1hcChvcmRlciA9PlxyXG4gICAgICAgIHRoaXMuZ2V0UXVldWVDb3VudChvcmRlci5yZXF1ZXN0LnRva2VuLCBvcmRlci5yZXF1ZXN0Lm9yZGVyUmVxdWVzdCwgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvKVxyXG4gICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKT0+e1xyXG4gICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnF1ZXVlSW5mbyA9IHJlc3BvbnNlO1xyXG4gICAgICAgICAgICByZXR1cm4gb3JkZXJcclxuICAgICAgICAgIH0sIGVycj0+UHJvbWlzZS5yZWplY3QoZXJyKSlcclxuICAgICAgKVxyXG4gICAgICAuc3Vic2NyaWJlKG9yZGVyID0+IHtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlci5xdWV1ZUluZm8pO1xyXG4gICAgICAgIC8vIOiLpSBTdGVwIDE0IOS4reeahCBcImlmU2hvd1Bhc3NDb2RlXCIgPSBcIllcIu+8jOmCo+S5iOWkmuS6hui+k+WFpemqjOivgeeggei/meS4gOatpe+8jFBvc3RcclxuICAgICAgICBpZihvcmRlci5yZXF1ZXN0Lm9yZGVySW5mby5kYXRhLmlmU2hvd1Bhc3NDb2RlID09IFwiWVwiKSB7XHJcbiAgICAgICAgICB0aGlzLnNqR2V0UGFzc0NvZGVOZXcubmV4dChvcmRlcik7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgLy8gU3RlcCAxNyDnoa7orqTotK3kubDvvIxQb3N0XHJcbiAgICAgICAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLm5leHQob3JkZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSxlcnI9PntcclxuICAgICAgICB3aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApO1xyXG4gICAgICAgIHRoaXMuZGVzdHJveSgpO1xyXG4gICAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqR2V0UGFzc0NvZGVOZXcuc3Vic2NyaWJlKChvcmRlcjogb2JqZWN0KT0+IHtcclxuICAgICAgLy8gU3RlcCAxNiDkuZjlrqLkubDnpajpqozor4HnoIHvvIxHZXQgUE9TVFxyXG4gICAgICB0aGlzLmdldFBhc3NDb2RlTmV3KCkudGhlbigoKT0+IHRoaXMuY2hlY2tSYW5kQ29kZUFuc3luKCkpXHJcbiAgICAgICAgLnRoZW4oeD0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKHgpO1xyXG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyKTtcclxuICAgICAgICB9LGVycm9yPT5jb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLnN1YnNjcmliZSgob3JkZXI6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMuY29uZmlybVNpbmdsZUZvclF1ZXVlKG9yZGVyLnJlcXVlc3QudG9rZW4sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnBsYW5QZXBvbGVzKVxyXG4gICAgICAgIC50aGVuKHg9PiB7XHJcbiAgICAgICAgICBpZih4LnN0YXR1cyAmJiB4LmRhdGEuc3VibWl0U3RhdHVzKSB7XHJcbiAgICAgICAgICAgIC8vIFN0ZXAgMTgg5p+l6K+i5o6S6Zif562J5b6F5pe26Ze077yBXHJcbiAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlcik7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxyXG4gICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgICAgICBkYXRhOiB7IGVyck1zZzogJ+S9meelqOS4jei2s++8gScsIHN1Ym1pdFN0YXR1czogZmFsc2UgfSxcclxuICAgICAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQgJHt4LmRhdGEuZXJyTXNnfX1gKTtcclxuICAgICAgICAgICAgLy8g6YeN5paw5byA5aeL5p+l6K+iXHJcbiAgICAgICAgICAgIHNqUXVlcnlMZlRpY2tldC5uZXh0KHRoaXMubmV4dE9yZGVyKCkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLm5leHQob3JkZXIpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aGlzLnNqTGZUaWNrZXRJbml0O1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZENoZWNrVXNlckZsb3cob2JzZXJ2YWJsZTogUnguT2JzZXJ2YWJsZSk6IFJ4Lk9ic2VydmFibGUge1xyXG4gICAgbGV0IHNqQ2hlY2tVc2VyID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKTtcclxuICAgIGxldCBzakxvZ2luID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIGxldCBzakF1dGhlZCA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgICBvYnNlcnZhYmxlLnN1YnNjcmliZShzakNoZWNrVXNlcik7XHJcblxyXG4gICAgLy8gU3RlcCAxMCDpqozor4HnmbvlvZXvvIxQb3N0XHJcbiAgICBzakNoZWNrVXNlclxyXG4gICAgICAubWVyZ2VNYXAoKCkgPT4gdGhpcy5jaGVja1VzZXIoKSlcclxuICAgICAgLnJldHJ5KDEwMDApXHJcbiAgICAgIC5zdWJzY3JpYmUoKGJvZHkpID0+IHtcclxuICAgICAgICAgIGlmKGJvZHkuZGF0YS5mbGFnKSB7XHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKCdsb2dpbiBzdWNjZXNzJyk7XHJcbiAgICAgICAgICAgIHNqQXV0aGVkLm5leHQoKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgc2pMb2dpbi5uZXh0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coXCJzdWJtaXQgb3JkZXIgcmVxdWVzdCBjaGVjayB1c2VyXCIpO1xyXG4gICAgICAgIH0sIGVycj0+e1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIkNoZWNrIHVzZXIgZXJyb3IgXCIpO1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xyXG4gICAgICAgICAgLyogVE9ETyBhZGQgcmVsb2dpbiBsb2dpY1xyXG4gICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxyXG4gICAgICAgICAgICBzdGF0dXM6IHRydWUsXHJcbiAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgICAgZGF0YTogeyBmbGFnOiBmYWxzZSB9LFxyXG4gICAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cclxuICAgICAgICAgICovXHJcbiAgICAgICAgICBzakxvZ2luLm5leHQoKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICB0aGlzLmJ1aWxkQXV0aEZsb3coc2pMb2dpbilcclxuICAgICAgLnN1YnNjcmliZSgoKT0+c2pBdXRoZWQubmV4dCgpLGVycj0+Y29uc29sZS5lcnJvcihlcnIpKTtcclxuICAgIHJldHVybiBzakF1dGhlZDtcclxuICB9XHJcblxyXG5cclxuICAvKipcclxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0cmFpbkRhdGUg5LmY6L2m5pel5pyfXHJcbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcclxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcclxuICAgKiBAcGFyYW0gdHJhaW5OYW1lcyDliJfovaZcclxuICAgKlxyXG4gICAqIEByZXR1cm4gUHJvbWlzZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBxdWVyeUxlZnRUaWNrZXRzKHRyYWluRGF0ZTogc3RyaW5nLCBmcm9tU3RhdGlvbk5hbWU6IHN0cmluZywgdG9TdGF0aW9uTmFtZTogc3RyaW5nLCB0cmFpbk5hbWVzOiBBcnJheTxzdHJpbmc+fG51bGwpOiBQcm9taXNlPEFycmF5PGFueT4+IHtcclxuICAgIGlmKCF0cmFpbkRhdGUpIHtcclxuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXkuZjovabml6XmnJ99YCk7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xyXG4gICAgfVxyXG4gICAgdGhpcy5CQUNLX1RSQUlOX0RBVEUgPSB0cmFpbkRhdGU7XHJcblxyXG4gICAgaWYoIWZyb21TdGF0aW9uTmFtZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWHuuWPkeermX1gKTtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XHJcbiAgICB9XHJcbiAgICB0aGlzLkZST01fU1RBVElPTl9OQU1FID0gZnJvbVN0YXRpb25OYW1lO1xyXG5cclxuICAgIGlmKCF0b1N0YXRpb25OYW1lKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5Yiw6L6+56uZfWApO1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcclxuICAgIH1cclxuICAgIHRoaXMuVE9fU1RBVElPTl9OQU1FID0gdG9TdGF0aW9uTmFtZTtcclxuXHJcbiAgICB0aGlzLkZST01fU1RBVElPTiA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUoZnJvbVN0YXRpb25OYW1lKTtcclxuICAgIHRoaXMuVE9fU1RBVElPTiA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUodG9TdGF0aW9uTmFtZSk7XHJcblxyXG4gICAgcmV0dXJuIFJ4Lk9ic2VydmFibGUub2YoMSlcclxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLnF1ZXJ5TGVmdFRpY2tldCh0cmFpbkRhdGUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAudGhlbigodHJhaW5zRGF0YSk9PnRyYWluc0RhdGEsIGVycj0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoXCIuXCIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcclxuICAgICAgICAgICAgICAgICAgICAgIH0pKVxyXG4gICAgICAvLyAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXHJcbiAgICAgIC5yZXRyeVdoZW4oKGVycm9ycyk9PmVycm9ycy5kZWxheSgxNTAwKSlcclxuICAgICAgLm1hcCh0cmFpbnNEYXRhID0+IHRyYWluc0RhdGEucmVzdWx0KVxyXG4gICAgICAubWFwKHJlc3VsdCA9PiB7XHJcbiAgICAgICAgbGV0IHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4gPSBbXTtcclxuXHJcbiAgICAgICAgcmVzdWx0LmZvckVhY2goKGVsZW1lbnQ6IHN0cmluZyk9PiB7XHJcbiAgICAgICAgICBsZXQgdHJhaW46IEFycmF5PHN0cmluZz4gPSBlbGVtZW50LnNwbGl0KFwifFwiKTtcclxuICAgICAgICAgIHRyYWluWzRdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls0XSk7XHJcbiAgICAgICAgICB0cmFpbls1XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNV0pO1xyXG4gICAgICAgICAgdHJhaW5bNl0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzZdKTtcclxuICAgICAgICAgIHRyYWluWzddID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls3XSk7XHJcbiAgICAgICAgICB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJJU19USU1FX05PVF9CVVlcIiA/IFwi5YiX6L2m5YGc6L+QXCI6dHJhaW5bMTFdO1xyXG4gICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiTlwiID8gXCLml6DnpahcIjp0cmFpblsxMV07XHJcbiAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJZXCIgPyBcIuacieelqFwiOnRyYWluWzExXTtcclxuICAgICAgICAgIC8vIOWMuemFjei+k+WFpeeahOWIl+i9puWQjeensOeahOato+WImeihqOi+vuW8j+adoeS7tlxyXG4gICAgICAgICAgaWYoIXRyYWluTmFtZXMgfHwgdHJhaW5OYW1lcy5maWx0ZXIodG49PnRyYWluWzNdLm1hdGNoKG5ldyBSZWdFeHAodG4pKSAhPSBudWxsKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHRyYWlucy5wdXNoKHRyYWluKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdHJhaW5zO1xyXG4gICAgICB9KVxyXG4gICAgICAudG9Qcm9taXNlKCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0cmFpbkRhdGUg5LmY6L2m5pel5pyfXHJcbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcclxuICAgKiBAcGFyYW0gcGFzc1N0YXRpb25OYW1lIOmAlOe7j+ermVxyXG4gICAqIEBwYXJhbSB0b1N0YXRpb25OYW1lIOWIsOi+vuermVxyXG4gICAqXHJcbiAgICogQHJldHVybiB2b2lkXHJcbiAgICovXHJcbiAgcHVibGljIHBhc3NTdGF0aW9uVGlja2V0cyh0cmFpbkRhdGU6IHN0cmluZywgZnJvbVN0YXRpb25OYW1lOiBzdHJpbmcsIHBhc3NTdGF0aW9uTmFtZTogc3RyaW5nLCB0b1N0YXRpb25OYW1lOiBzdHJpbmcsIHRyYWluTmFtZXM6IHN0cmluZykge1xyXG4gICAgbGV0IHBsYW5UcmFpbk5hbWVzOiBBcnJheTxzdHJpbmc+fG51bGwgPSAodHJhaW5OYW1lcyA/IHRyYWluTmFtZXMuc3BsaXQoJywnKTpudWxsKTtcclxuICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyh0cmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGxhblRyYWluTmFtZXMpXHJcbiAgICAgIC50aGVuKHRyYWlucz0+IHtcclxuICAgICAgICB0cmFpbnMgPSB0cmFpbnMubWFwKHRyYWluID0+IHRyYWluWzNdKTtcclxuICAgICAgICB0aGlzLnF1ZXJ5TGVmdFRpY2tldHModHJhaW5EYXRlLCBmcm9tU3RhdGlvbk5hbWUsIHBhc3NTdGF0aW9uTmFtZSwgcGxhblRyYWluTmFtZXMpXHJcbiAgICAgICAgICAudGhlbihwYXNzVHJhaW5zPT4ge1xyXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcGFzc1RyYWlucy5maWx0ZXIodHJhaW4gPT4gdHJhaW5zLmluY2x1ZGVzKHRyYWluWzNdKSk7XHJcbiAgICAgICAgICAgIHJlc3VsdCA9IHRoaXMucmVuZGVyVHJhaW5MaXN0VGl0bGUocmVzdWx0KTtcclxuICAgICAgICAgICAgdGhpcy5yZW5kZXJMZWZ0VGlja2V0cyhyZXN1bHQpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog5p+l6K+i5YiX6L2m5L2Z56Wo5L+h5oGvXHJcbiAgICpcclxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xyXG4gICAqIEBwYXJhbSBmcm9tU3RhdGlvbk5hbWUg5Ye65Y+R56uZXHJcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXHJcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXHJcbiAgICpcclxuICAgKiBAcmV0dXJuIHZvaWRcclxuICAgKi9cclxuICBwdWJsaWMgbGVmdFRpY2tldHModHJhaW5EYXRlOiBzdHJpbmcsIGZyb21TdGF0aW9uTmFtZTogc3RyaW5nLCB0b1N0YXRpb25OYW1lOiBzdHJpbmcsIHRyYWluTmFtZXM6IHN0cmluZykge1xyXG4gICAgdGhpcy5xdWVyeUxlZnRUaWNrZXRzKHRyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCAodHJhaW5OYW1lcyA/IHRyYWluTmFtZXMuc3BsaXQoJywnKTpudWxsKSlcclxuICAgICAgLnRoZW4odHJhaW5zPT4ge1xyXG4gICAgICAgIHRyYWlucyA9IHRoaXMucmVuZGVyVHJhaW5MaXN0VGl0bGUodHJhaW5zKTtcclxuICAgICAgICB0aGlzLnJlbmRlckxlZnRUaWNrZXRzKHRyYWlucyk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJUcmFpbkxpc3RUaXRsZSh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KTogQXJyYXk8QXJyYXk8c3RyaW5nPj4ge1xyXG4gICAgdmFyIHRpdGxlID0gdGhpcy5USUNLRVRfVElUTEUubWFwKHQ9PmNoYWxrYHtibHVlICR7dH19YCk7XHJcblxyXG4gICAgdHJhaW5zLmZvckVhY2goKHRyYWluLCBpbmRleCk9PiB7XHJcbiAgICAgIGlmKGluZGV4ICUgMzAgPT09IDApIHtcclxuICAgICAgICB0cmFpbnMuc3BsaWNlKGluZGV4LCAwLCB0aXRsZSk7XHJcbiAgICAgIH1cclxuICAgIH0pXHJcbiAgICByZXR1cm4gdHJhaW5zO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZW5kZXJMZWZ0VGlja2V0cyh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KSB7XHJcbiAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0cmFpbnMsIHtcclxuICAgICAgY29sdW1uU3BsaXR0ZXI6ICd8JyxcclxuICAgICAgY29sdW1uczogW1wiM1wiLCBcIjRcIiwgXCI1XCIsIFwiNlwiLCBcIjdcIiwgXCI4XCIsIFwiOVwiLCBcIjEwXCIsIFwiMTFcIiwgXCIyMFwiLCBcIjIxXCIsIFwiMjJcIiwgXCIyM1wiLCBcIjI0XCIsIFwiMjVcIixcclxuICAgICAgICAgICAgICAgIFwiMjZcIiwgXCIyN1wiLCBcIjI4XCIsIFwiMjlcIiwgXCIzMFwiLCBcIjMxXCIsIFwiMzJcIl1cclxuICAgIH0pXHJcblxyXG4gICAgY29uc29sZS5sb2coY29sdW1ucyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbXlPcmRlck5vQ29tcGxldGVSZXBvcnQoKSB7XHJcbiAgICB2YXIgc3ViamVjdE9yZGVyTm9Db21wbGV0ZSA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcblxyXG4gICAgc3ViamVjdE9yZGVyTm9Db21wbGV0ZS5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMuaW5pdE5vQ29tcGxldGUoKS50aGVuKCgpPT4ge1xyXG4gICAgICAgIHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpLnRoZW4oeD0+IHtcclxuICAgICAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkoeCwge1xyXG4gICAgICAgICAgICAgIGNvbHVtblNwbGl0dGVyOiAnIHwgJ1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xyXG4gICAgICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpPT4gc3ViamVjdE9yZGVyTm9Db21wbGV0ZS5uZXh0KCksIDEwMDApXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgfSwgZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzdWJqZWN0T3JkZXJOb0NvbXBsZXRlLm5leHQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBsb2dpbkluaXQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2luaXRcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybCxcclxuICAgICAgbWV0aG9kOiBcIkdFVFwiLFxyXG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlOiBvYmplY3QsIHJlamVjdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcclxuICAgICAgICBpZihlcnJvcikgcmV0dXJuIHJlamVjdChlcnJvci50b1N0cmluZygpKTtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENhcHRjaGEoKTogUHJvbWlzZSB7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXHJcbiAgICAgICAgICBcIm1vZHVsZVwiOiBcImxvZ2luXCIsXHJcbiAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIixcclxuICAgICAgICAgIFwiMC4xNzIzMTg3MjcwMzM4OTA2MlwiOlwiXCJcclxuICAgICAgfTtcclxuXHJcbiAgICB2YXIgcGFyYW0gPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgbnVsbClcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtaW1hZ2U/XCIrcGFyYW07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSkgPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVzdGlvbkNhcHRjaGEoKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcclxuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKT0+IHtcclxuICAgICAgcmwucXVlc3Rpb24oY2hhbGtge3JlZC5ib2xkIOivt+i+k+WFpemqjOivgeeggX06YCwgKHBvc2l0aW9uU3RyKSA9PiB7XHJcbiAgICAgICAgcmwuY2xvc2UoKTtcclxuXHJcbiAgICAgICAgaWYodHlwZW9mIHBvc2l0aW9uU3RyID09IFwic3RyaW5nXCIpIHtcclxuICAgICAgICAgIGxldCBwb3NpdGlvbnM6IEFycmF5PHN0cmluZz4gPSBbXTtcclxuICAgICAgICAgIHBvc2l0aW9uU3RyLnNwbGl0KCcsJykuZm9yRWFjaChlbD0+cG9zaXRpb25zPXBvc2l0aW9ucy5jb25jYXQoZWwuc3BsaXQoJyAnKSkpO1xyXG4gICAgICAgICAgcmVzb2x2ZShwb3NpdGlvbnMubWFwKChwb3NpdGlvbjogc3RyaW5nKT0+IHtcclxuICAgICAgICAgICAgc3dpdGNoKHBvc2l0aW9uKSB7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjFcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDQ1XCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjJcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjExMCw0NVwiO1xyXG4gICAgICAgICAgICAgIGNhc2UgXCIzXCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIxODAsNDVcIjtcclxuICAgICAgICAgICAgICBjYXNlIFwiNFwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDQ1XCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjVcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDExMFwiO1xyXG4gICAgICAgICAgICAgIGNhc2UgXCI2XCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIxMTAsMTEwXCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjdcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjE4MCwxMTBcIjtcclxuICAgICAgICAgICAgICBjYXNlIFwiOFwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDExMFwiO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KS5qb2luKCcsJykpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChcIui+k+WFpeagvOW8j+mUmeivr1wiKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrQ2FwdGNoYSgpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtY2hlY2tcIjtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKSA9PiB7XHJcbiAgICAgIHRoaXMucXVlc3Rpb25DYXB0Y2hhKCkudGhlbihwb3NpdGlvbnM9PiB7XHJcbiAgICAgICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICAgIFwiYW5zd2VyXCI6IHBvc2l0aW9ucyxcclxuICAgICAgICAgICAgXCJsb2dpbl9zaXRlXCI6IFwiRVwiLFxyXG4gICAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIlxyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgICAgICB1cmw6IHVybFxyXG4gICAgICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICAgICAsZm9ybTogZGF0YVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KSA9PiB7XHJcbiAgICAgICAgICBpZihlcnJvcikge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSA0KSB7XHJcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlamVjdCgpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKCdlcnJvcjogJysgcmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICAgIHJlamVjdCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgICB9LCBlcnJvcj0+e1xyXG4gICAgICAgIHdpbnN0b24uZXJyb3IoZXJyb3IpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1c2VyQXV0aGVudGljYXRlKCk6IFByb21pc2Uge1xyXG4gICAgLy8g5Y+R6YCB55m75b2V5L+h5oGvXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxyXG4gICAgICAgICAgLFwidXNlcm5hbWVcIjogdGhpcy51c2VyTmFtZVxyXG4gICAgICAgICAgLFwicGFzc3dvcmRcIjogdGhpcy51c2VyUGFzc3dvcmRcclxuICAgICAgICB9O1xyXG5cclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvbG9naW5cIjtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiByZWplY3QoZXJyb3IpO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMikge1xyXG4gICAgICAgICAgICB0aHJvdyBib2R5LnJlc3VsdF9tZXNzYWdlO1xyXG4gICAgICAgICAgfWVsc2UgaWYoYm9keS5yZXN1bHRfY29kZSAhPSAwKSB7XHJcbiAgICAgICAgICAgIHJlamVjdChib2R5KTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShib2R5LnVhbXRrKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2UpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TmV3QXBwVG9rZW4oKTogUHJvbWlzZSB7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxyXG4gICAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID17XHJcbiAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2F1dGgvdWFtdGtcIlxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIHdpbnN0b24uZGVidWcoYm9keSk7XHJcbiAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShib2R5Lm5ld2FwcHRrKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZSlcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE15MTIzMDYoKTogUHJvbWlzZSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vaW5kZXgvaW5pdE15MTIzMDZcIlxyXG4gICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAgLG1ldGhvZDogXCJHRVRcIn0sXHJcbiAgICAgICAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKFwiR290IG15IDEyMzA2XCIpO1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrQXV0aGVudGljYXRpb24oY29va2llczogb2JqZWN0KSB7XHJcbiAgICB2YXIgdWFtdGsgPSBcIlwiLCB0ayA9IFwiXCI7XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInVhbXRrXCIpIHtcclxuICAgICAgICB1YW10ayA9IGNvb2tpZXNbaV0udmFsdWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidGtcIikge1xyXG4gICAgICAgIHRrID0gY29va2llc1tpXS52YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdWFtdGs6IHVhbXRrLFxyXG4gICAgICB0azogdGtcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKlxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0QXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZykge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcInRrXCI6IG5ld2FwcHRrXHJcbiAgICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vdWFtYXV0aGNsaWVudFwiXHJcbiAgICAgICxoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgNi4xOyBXT1c2NCkgQXBwbGVXZWJLaXQvNTM3LjE3IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzI0LjAuMTMxMi42MCBTYWZhcmkvNTM3LjE3XCJcclxuICAgICAgICAsXCJIb3N0XCI6IFwia3lmdy4xMjMwNi5jblwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxyXG4gICAgICAgICwnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcclxuICAgICAgfVxyXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xyXG4gICAgICAgICAgICByZXNvbHZlKGJvZHkuYXBwdGspO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZWplY3QoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpXHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsZWZ0VGlja2V0SW5pdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCI7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3QodXJsLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c1RleHQpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVyeUxlZnRUaWNrZXQodHJhaW5EYXRlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgcXVlcnkgPSB7XHJcbiAgICAgIFwibGVmdFRpY2tldERUTy50cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLmZyb21fc3RhdGlvblwiOiB0aGlzLkZST01fU1RBVElPTlxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLnRvX3N0YXRpb25cIjogdGhpcy5UT19TVEFUSU9OXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvcXVlcnlaP1wiK3BhcmFtO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KHVybCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHtcclxuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoIWJvZHkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKGJvZHkuaW5kZXhPZihcIuivt+aCqOmHjeivleS4gOS4i1wiKSA+IDApIHtcclxuICAgICAgICAgICAgcmVqZWN0KFwi57O757uf57mB5b+ZIVwiKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoYm9keSkuZGF0YTtcclxuICAgICAgICAgICAgfWNhdGNoKGVycikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgY29uc29sZS5sb2cocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja1VzZXIoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2NoZWNrVXNlclwiO1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxyXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiByZWplY3QoZXJyb3IpO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpXHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzdWJtaXRPcmRlclJlcXVlc3Qoe3RyYWluU2VjcmV0U3RyLCB0cmFpbkRhdGUsIGJhY2tUcmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZX0pOiBQcm9taXNlPG9iamVjdD4gIHtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvc3VibWl0T3JkZXJSZXF1ZXN0XCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwic2VjcmV0U3RyXCI6IHF1ZXJ5c3RyaW5nLnVuZXNjYXBlKHRyYWluU2VjcmV0U3RyKVxyXG4gICAgICAsXCJ0cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxyXG4gICAgICAsXCJiYWNrX3RyYWluX2RhdGVcIjogYmFja1RyYWluRGF0ZVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICAgICxcInF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lXCI6IGZyb21TdGF0aW9uTmFtZVxyXG4gICAgICAsXCJxdWVyeV90b19zdGF0aW9uX25hbWVcIjogdG9TdGF0aW9uTmFtZVxyXG4gICAgICAsXCJ1bmRlZmluZWRcIjpcIlwiXHJcbiAgICB9O1xyXG5cclxuICAgIC8vIHVybCA9IHVybCArIFwic2VjcmV0U3RyPVwiK3NlY3JldFN0citcIiZ0cmFpbl9kYXRlPTIwMTgtMDEtMzEmYmFja190cmFpbl9kYXRlPTIwMTgtMDEtMzAmdG91cl9mbGFnPWRjJnB1cnBvc2VfY29kZXM9QURVTFQmcXVlcnlfZnJvbV9zdGF0aW9uX25hbWU95LiK5rW3JnF1ZXJ5X3RvX3N0YXRpb25fbmFtZT3lvpDlt57kuJwmdW5kZWZpbmVkXCI7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcclxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxyXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVBhc3NlbmdlckluaXREYygpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgICAsXCJVcGdyYWRlLUluc2VjdXJlLVJlcXVlc3RzXCI6MVxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYoYm9keSkge1xyXG4gICAgICAgICAgICAvLyBHZXQgUmVwZWF0IFN1Ym1pdCBUb2tlblxyXG4gICAgICAgICAgICB2YXIgdG9rZW4gPSBib2R5Lm1hdGNoKC92YXIgZ2xvYmFsUmVwZWF0U3VibWl0VG9rZW4gPSAnKC4qPyknOy8pO1xyXG4gICAgICAgICAgICB2YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0gPSBib2R5Lm1hdGNoKC92YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm09KC4qPyk7Lyk7XHJcbiAgICAgICAgICAgIHZhciBvcmRlclJlcXVlc3REVE8gPSBib2R5Lm1hdGNoKC92YXIgb3JkZXJSZXF1ZXN0RFRPPSguKj8pOy8pO1xyXG4gICAgICAgICAgICBpZih0b2tlbikge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHtcclxuICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlblsxXVxyXG4gICAgICAgICAgICAgICAgLHRpY2tldEluZm86IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtJiZKU09OLnBhcnNlKHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxyXG4gICAgICAgICAgICAgICAgLG9yZGVyUmVxdWVzdDogb3JkZXJSZXF1ZXN0RFRPJiZKU09OLnBhcnNlKG9yZGVyUmVxdWVzdERUT1sxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2Vycyh0b2tlbjogc3RyaW5nKTogUHJvbWlzZTxvYmplY3Q+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8b2JqZWN0PigocmVzb2x2ZTogRnVuY3Rpb24sIHJlamVjdDogRnVuY3Rpb24pPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoSlNPTi5wYXJzZShib2R5KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgLyogc2VhdCB0eXBlXHJcbiAg4oCY6L2v5Y2n4oCZID0+IOKAmDTigJksXHJcbiAg4oCY5LqM562J5bqn4oCZID0+IOKAmE/igJksXHJcbiAg4oCY5LiA562J5bqn4oCZID0+IOKAmE3igJksXHJcbiAg4oCY56Gs5bqn4oCZID0+IOKAmDHigJksXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKTogc3RyaW5nIHtcclxuICAgIHZhciB0aWNrZXRzID0gW107XHJcbiAgICBwYXNzZW5nZXJzLmZvckVhY2gocGFzc2VuZ2VyPT4ge1xyXG4gICAgICBpZihwbGFuUGVwb2xlcy5pbmNsdWRlcyhwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUpKSB7XHJcbiAgICAgICAgLy/luqfkvY3nsbvlnossMCznpajnsbvlnoso5oiQ5Lq6L+WEv+erpSksbmFtZSzouqvku73nsbvlnoso6Lqr5Lu96K+BL+WGm+WumOivgS4uLi4pLOi6q+S7veivgSznlLXor53lj7fnoIEs5L+d5a2Y54q25oCBXHJcbiAgICAgICAgdmFyIHRpY2tldCA9IC8qcGFzc2VuZ2VyLnNlYXRfdHlwZSovIFwiT1wiICtcclxuICAgICAgICAgICAgICAgIFwiLDAsXCIgK1xyXG4gICAgICAgICAgICAgICAgLypsaW1pdF90aWNrZXRzW2FBXS50aWNrZXRfdHlwZSovXCIxXCIgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICAocGFzc2VuZ2VyLnBob25lX25vIHx8IFwiXCIgKSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIFwiTlwiO1xyXG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xyXG4gICAgICB9XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGlja2V0cy5qb2luKFwiX1wiKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk6IHN0cmluZyB7XHJcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xyXG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcclxuICAgICAgaWYocGxhblBlcG9sZXMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xyXG4gICAgICAgIC8vbmFtZSzouqvku73nsbvlnoss6Lqr5Lu96K+BLDFfXHJcbiAgICAgICAgdmFyIHRpY2tldCA9XHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBcIjFcIjtcclxuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcykge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NoZWNrT3JkZXJJbmZvXCI7XHJcblxyXG4gICAgdmFyIHBhc3NlbmdlclRpY2tldFN0ciA9IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiY2FuY2VsX2ZsYWdcIjogMlxyXG4gICAgICAsXCJiZWRfbGV2ZWxfb3JkZXJfbnVtXCI6IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCJcclxuICAgICAgLFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHBhc3NlbmdlclRpY2tldFN0clxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInJhbmRDb2RlXCI6IFwiXCJcclxuICAgICAgLFwid2hhdHNTZWxlY3RcIjoxXHJcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogc3VibWl0VG9rZW5cclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlOiBGdW5jdGlvbiwgcmVqZWN0OiBGdW5jdGlvbik9PiB7XHJcbiAgICAgIGlmKCFwYXNzZW5nZXJUaWNrZXRTdHIpIHtcclxuICAgICAgICB0aHJvdyBcIuayoeacieebuOWFs+iBlOezu+S6ulwiO1xyXG4gICAgICB9XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgICB1cmw6ICcvbGVmdFRpY2tldC9pbml0JyxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf5b+Z77yM6K+356iN5ZCO6YeN6K+VJyBdLFxyXG4gICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgaWYocmVzdWx0LnN0YXR1cykge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KHJlc3VsdC5tZXNzYWdlc1swXSlcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UXVldWVDb3VudCh0b2tlbiwgb3JkZXJSZXF1ZXN0RFRPLCB0aWNrZXRJbmZvKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UXVldWVDb3VudFwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwidHJhaW5fZGF0ZVwiOiBuZXcgRGF0ZShvcmRlclJlcXVlc3REVE8udHJhaW5fZGF0ZS50aW1lKS50b1N0cmluZygpXHJcbiAgICAgICxcInRyYWluX25vXCI6IG9yZGVyUmVxdWVzdERUTy50cmFpbl9ub1xyXG4gICAgICAsXCJzdGF0aW9uVHJhaW5Db2RlXCI6IG9yZGVyUmVxdWVzdERUTy5zdGF0aW9uX3RyYWluX2NvZGVcclxuICAgICAgLFwic2VhdFR5cGVcIjoxXHJcbiAgICAgICxcImZyb21TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLmZyb21fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0XCI6IHRpY2tldEluZm8ucXVlcnlMZWZ0VGlja2V0UmVxdWVzdERUTy55cEluZm9EZXRhaWxcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIjAwXCJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIC8qXHJcbiAgICAgICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxyXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbICfns7vnu5/nuYHlv5nvvIzor7fnqI3lkI7ph43or5XvvIEnIF0sXHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgICAgaWYocmVzdWx0LnN0YXR1cykge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVqZWN0KHJlc3VsdC5tZXNzYWdlc1swXSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBhc3NDb2RlTmV3KCkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9nZXRQYXNzQ29kZU5ldz9tb2R1bGU9cGFzc2VuZ2VyJnJhbmQ9cmFuZHAmXCIrTWF0aC5yYW5kb20oMCwxKTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlIT09MjAwKSByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcclxuICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja1JhbmRDb2RlQW5zeW4oKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2NoZWNrUmFuZENvZGVBbnN5blwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIHJhbmRDb2RlOiBcIlwiLFxyXG4gICAgICByYW5kOiBcInJhbmRwXCJcclxuICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XHJcbiAgICAgIGlucHV0OiBwcm9jZXNzLnN0ZGluLFxyXG4gICAgICBvdXRwdXQ6IHByb2Nlc3Muc3Rkb3V0XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHJsLnF1ZXN0aW9uKCdQbGVhc2UgaW5wdXQgcmFuZGNvZGU6JywgKHBvc2l0aW9ucykgPT4ge1xyXG4gICAgICAgIHJsLmNsb3NlKCk7XHJcblxyXG4gICAgICAgIG9wdGlvbnMuZm9ybS5yYW5kQ29kZSA9IHBvc2l0aW9ucztcclxuICAgICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgICB9KVxyXG4gICAgICB9KTtcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNvbmZpcm1TaW5nbGVGb3JRdWV1ZSh0b2tlbiwgcGFzc2VuZ2VycywgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0sIHBsYW5QZXBvbGVzKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvY29uZmlybVNpbmdsZUZvclF1ZXVlXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJyYW5kQ29kZVwiOlwiXCJcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5wdXJwb3NlX2NvZGVzXHJcbiAgICAgICxcImtleV9jaGVja19pc0NoYW5nZVwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5rZXlfY2hlY2tfaXNDaGFuZ2VcclxuICAgICAgLFwibGVmdFRpY2tldFN0clwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5sZWZ0VGlja2V0U3RyXHJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnRyYWluX2xvY2F0aW9uXHJcbiAgICAgICxcImNob29zZV9zZWF0c1wiOiBcIlwiXHJcbiAgICAgICxcInNlYXREZXRhaWxUeXBlXCI6IFwiMDAwXCJcclxuICAgICAgLFwid2hhdHNTZWxlY3RcIjogMVxyXG4gICAgICAsXCJyb29tVHlwZVwiOiBcIjAwXCJcclxuICAgICAgLFwiZHdBbGxcIjogXCJOXCJcclxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbikge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcInJhbmRvbVwiOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxyXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxyXG4gICAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSByZWplY3QoZXJyb3IpO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNhbmNlbFF1ZXVlTm9Db21wbGV0ZU9yZGVyKCkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2NhbmNlbFF1ZXVlTm9Db21wbGV0ZU15T3JkZXJcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICB0b3VyRmxhZzogXCJkY1wiXHJcbiAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgICAgLGpzb246IHRydWVcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKHRoaXMuaXNTeXN0ZW1CdXNzeShib2R5KSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHRoaXMuU1lTVEVNX0JVU1NZKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgaW5pdE5vQ29tcGxldGUoKSB7XHJcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIjtcclxuICAgIGxldCBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSlcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG15T3JkZXJOb0NvbXBsZXRlKCkge1xyXG4gICAgbGV0IHNqT3JkZXJOb0NvbXBsZXRlID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIHNqT3JkZXJOb0NvbXBsZXRlLm1lcmdlTWFwKCgpPT4gdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXHJcbiAgICAgIC5zdWJzY3JpYmUoKHgpPT57XHJcbiAgICAgICAgLypcclxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxyXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgIGRhdGE6IHsgb3JkZXJEQkxpc3Q6IFsgW09iamVjdF0gXSwgdG9fcGFnZTogJ2RiJyB9LFxyXG4gICAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cclxuICAgICAgICAgKi9cclxuICAgICAgICAgaWYoIXguZGF0YSkge1xyXG4gICAgICAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGtge3llbGxvdyDmsqHmnInmnKrlrozmiJDorqLljZV9YClcclxuICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgIH1cclxuICAgICAgICBsZXQgdGlja2V0cyA9IFtdO1xyXG4gICAgICAgIGlmKHguZGF0YS5vcmRlckNhY2hlRFRPKSB7XHJcbiAgICAgICAgICBsZXQgb3JkZXJDYWNoZSA9IHguZGF0YS5vcmRlckNhY2hlRFRPO1xyXG4gICAgICAgICAgb3JkZXJDYWNoZS50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xyXG4gICAgICAgICAgICB0aWNrZXRzLnB1c2goe1xyXG4gICAgICAgICAgICAgIFwi5o6S6Zif5Y+3XCI6IG9yZGVyQ2FjaGUucXVldWVOYW1lLFxyXG4gICAgICAgICAgICAgIFwi562J5b6F5pe26Ze0XCI6IG9yZGVyQ2FjaGUud2FpdFRpbWUsXHJcbiAgICAgICAgICAgICAgXCLnrYnlvoXkurrmlbBcIjogb3JkZXJDYWNoZS53YWl0Q291bnQsXHJcbiAgICAgICAgICAgICAgXCLkvZnnpajmlbBcIjogb3JkZXJDYWNoZS50aWNrZXRDb3VudCxcclxuICAgICAgICAgICAgICBcIuS5mOi9puaXpeacn1wiOiBvcmRlckNhY2hlLnRyYWluRGF0ZS5zbGljZSgwLDEwKSxcclxuICAgICAgICAgICAgICBcIui9puasoVwiOiBvcmRlckNhY2hlLnN0YXRpb25UcmFpbkNvZGUsXHJcbiAgICAgICAgICAgICAgXCLlh7rlj5Hnq5lcIjogb3JkZXJDYWNoZS5mcm9tU3RhdGlvbk5hbWUsXHJcbiAgICAgICAgICAgICAgXCLliLDovr7nq5lcIjogb3JkZXJDYWNoZS50b1N0YXRpb25OYW1lLFxyXG4gICAgICAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0VHlwZU5hbWUsXHJcbiAgICAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3Nlbmdlck5hbWVcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgfWVsc2UgaWYoeC5kYXRhLm9yZGVyREJMaXN0KXtcclxuXHJcbiAgICAgICAgICB4LmRhdGEub3JkZXJEQkxpc3QuZm9yRWFjaChvcmRlcj0+IHtcclxuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coY2hhbGtg6K6i5Y2V5Y+3IHt5ZWxsb3cuYm9sZCAke29yZGVyLnNlcXVlbmNlX25vfX1gKVxyXG4gICAgICAgICAgICBvcmRlci50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xyXG4gICAgICAgICAgICAgIHRpY2tldHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICBcIuiuouWNleWPt1wiOiB0aWNrZXQuc2VxdWVuY2Vfbm8sXHJcbiAgICAgICAgICAgICAgICAvLyBcIuiuouelqOWPt1wiOiB0aWNrZXQudGlja2V0X25vLFxyXG4gICAgICAgICAgICAgICAgXCLkuZjovabml6XmnJ9cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRyYWluX2RhdGUuc2xpY2UoMCwxMCl9fWAsXHJcbiAgICAgICAgICAgICAgICAvLyBcIuS4i+WNleaXtumXtFwiOiB0aWNrZXQucmVzZXJ2ZV90aW1lLFxyXG4gICAgICAgICAgICAgICAgXCLku5jmrL7miKroh7Pml7bpl7RcIjogY2hhbGtge3JlZC5ib2xkICR7dGlja2V0LnBheV9saW1pdF90aW1lfX1gLFxyXG4gICAgICAgICAgICAgICAgXCLph5Hpop1cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRpY2tldF9wcmljZS8xMDB9fWAsXHJcbiAgICAgICAgICAgICAgICBcIueKtuaAgVwiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudGlja2V0X3N0YXR1c19uYW1lfX1gLFxyXG4gICAgICAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3NlbmdlckRUTy5wYXNzZW5nZXJfbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi6L2m5qyhXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8uc3RhdGlvbl90cmFpbl9jb2RlLFxyXG4gICAgICAgICAgICAgICAgXCLlh7rlj5Hnq5lcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy5mcm9tX3N0YXRpb25fbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi5Yiw6L6+56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8udG9fc3RhdGlvbl9uYW1lLFxyXG4gICAgICAgICAgICAgICAgXCLluqfkvY1cIjogdGlja2V0LnNlYXRfbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0X3R5cGVfbmFtZSxcclxuICAgICAgICAgICAgICAgIFwi5LmY6L2m5Lq657G75Z6LXCI6IHRpY2tldC50aWNrZXRfdHlwZV9uYW1lXHJcbiAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0aWNrZXRzLCB7XHJcbiAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJ3wnXHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xyXG4gICAgICB9LCBlcnI9PmNvbnNvbGUuZXJyb3IoJ+ayoeacieacquWujOaIkOiuouWNlScpKTtcclxuXHJcbiAgICBsZXQgc2pMID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIHRoaXMuYnVpbGRMb2dpbkZsb3coc2pMKVxyXG4gICAgICAuc3Vic2NyaWJlKCgpPT5zak9yZGVyTm9Db21wbGV0ZS5uZXh0KCkpXHJcblxyXG4gICAgc2pMLm5leHQoKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpIHtcclxuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9xdWVyeU15T3JkZXJOb0NvbXBsZXRlXCI7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgICAvKipcclxuICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXHJcbiAgICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5Lm1lc3NhZ2VzKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgPGRpdiBjbGFzcz1cInQtYnRuXCI+XHJcbnt7aWYgcGF5X2ZsYWc9PSdZJ319XHJcbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgaWQ9XCJjb250aW51ZVBheU5vTXlDb21wbGV0ZVwiIG9uY2xpY2s9XCJjb250aXVlUGF5Tm9Db21wbGV0ZU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywncGF5JylcIiAgY2xhc3M9XCJidG45MnNcIj7nu6fnu63mlK/ku5g8L2E+PC9kaXY+XHJcbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfb3JkZXInKVwiIGlkPVwiY2FuY2VsX2J1dHRvbl9wYXlcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2PlxyXG57ey9pZn19XHJcbnt7aWYgcGF5X3Jlc2lnbl9mbGFnPT0nWSd9fVxyXG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIGlkPVwiY29udGludWVQYXlOb015Q29tcGxldGVcIiBvbmNsaWNrPVwiY29udGl1ZVBheU5vQ29tcGxldGVPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ3Jlc2lnbicpO1wiICBjbGFzcz1cImJ0bjkyc1wiPue7p+e7reaUr+S7mDwvYT48L2Rpdj5cclxuXHQgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfcmVzaWduJylcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2PlxyXG57ey9pZn19XHJcblxyXG4gICAgICAgIDwvZGl2PlxyXG4gICovXHJcbiAgcHJpdmF0ZSBjYW5jZWxOb0NvbXBsZXRlTXlPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJykge1xyXG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2NhbmNlbE5vQ29tcGxldGVNeU9yZGVyXCI7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJzZXF1ZW5jZV9ub1wiOiBzZXF1ZW5jZU5vLFxyXG4gIFx0XHRcdFwiY2FuY2VsX2ZsYWdcIjogY2FuY2VsSWQsXHJcbiAgICAgICAgXCJfanNvbl9hdHRcIjpcIlwiXHJcbiAgICAgIH1cclxuICAgICAgLGpzb246IHRydWVcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBjYW5jZWxOb0NvbXBsZXRlT3JkZXIoc2VxdWVuY2VObzogc3RyaW5nLCBjYW5jZWxJZDogc3RyaW5nID0gJ2NhbmNlbF9vcmRlcicpIHtcclxuICAgIGxldCBzakNhbmNlbE9yZGVyID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAgIHRoaXMuYnVpbGRMb2dpbkZsb3coc2pDYW5jZWxPcmRlcilcclxuICAgICAgLnN1YnNjcmliZSgoKT0+e1xyXG4gICAgICAgIHRoaXMuY2FuY2VsTm9Db21wbGV0ZU15T3JkZXIoc2VxdWVuY2VObywgY2FuY2VsSWQpXHJcbiAgICAgICAgICAudGhlbihib2R5PT4ge1xyXG4gICAgICAgICAgICAvLyB7XCJ2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkXCI6XCJfdmFsaWRhdG9yTWVzc2FnZVwiLFwic3RhdHVzXCI6dHJ1ZSxcImh0dHBzdGF0dXNcIjoyMDAsXCJkYXRhXCI6e30sXCJtZXNzYWdlc1wiOltdLFwidmFsaWRhdGVNZXNzYWdlc1wiOnt9fVxyXG4gICAgICAgICAgICBpZiAoYm9keS5kYXRhLmV4aXN0RXJyb3IgPT0gXCJZXCIpIHtcclxuICBcdFx0XHRcdFx0XHR3aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQgJHtib2R5LmRhdGEuZXJyb3JNc2d9fWApO1xyXG4gIFx0XHRcdFx0XHR9IGVsc2Uge1xyXG4gIFx0XHRcdFx0XHRcdHdpbnN0b24ud2FybihjaGFsa2B7eWVsbG93IOiuouWNlSAke3NlcXVlbmNlTm99IOW3suWPlua2iH1gKTtcclxuICBcdFx0XHRcdFx0fVxyXG4gICAgICAgICAgfSxlcnI9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApKTtcclxuICAgICAgfSk7XHJcblxyXG4gICAgc2pDYW5jZWxPcmRlci5uZXh0KCk7XHJcbiAgfVxyXG59XHJcbiJdfQ==
