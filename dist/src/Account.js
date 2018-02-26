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
// import { Observable, ObservableInput } from '@reactivex/rxjs';
var chalk = require("chalk");
var columnify = require("columnify");
var beeper = require("beeper");
var Account = /** @class */ (function () {
    function Account(name, userPassword) {
        this.checkUserTimer = Rx.Observable.timer(1000 * 60 * 10, 1000 * 60 * 10); // 十分钟之后开始，每十分钟检查一次
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
        this.TICKET_TITLE = ['', '', '', '车次', '起始', '终点', '出发站', '到达站', '出发时', '到达时', '历时', '', '',
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
            if (!new Date(trainDate).toJSON()) {
                throw chalk(templateObject_1 || (templateObject_1 = __makeTemplateObject(["{red \u4E58\u8F66\u65E5\u671F", "\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u683C\u5F0F\u5E94\u8BE5\u662Fyyyy-MM-dd}"], ["{red \u4E58\u8F66\u65E5\u671F", "\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u683C\u5F0F\u5E94\u8BE5\u662Fyyyy-MM-dd}"])), trainDate);
            }
            if (new Date(trainDate).toJSON().slice(0, 10) < new Date().toJSON().slice(0, 10)) {
                throw chalk(templateObject_2 || (templateObject_2 = __makeTemplateObject(["{red \u4E58\u8F66\u65E5\u671F\u5E94\u8BE5\u4E3A\u4ECA\u5929\u6216\u4EE5\u540E}"], ["{red \u4E58\u8F66\u65E5\u671F\u5E94\u8BE5\u4E3A\u4ECA\u5929\u6216\u4EE5\u540E}"])));
            }
            _this.orders.push({
                trainDate: trainDate,
                backTrainDate: backTrainDate,
                fromStationName: fromStationName,
                toStationName: toStationName,
                passStationName: passStationName,
                planTrains: planTrains,
                planPepoles: planPepoles,
                fromStation: _this.stations.getStationCode(fromStationName),
                toStation: _this.stations.getStationCode(toStationName),
                passStation: _this.stations.getStationCode(passStationName),
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
                console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"], ["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"]))));
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
                        return console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["Your ticket order number is {red.bold ", "}"], ["Your ticket order number is {red.bold ", "}"])), orderQueue.data.orderId));
                    }
                    else if (orderQueue.data.waitTime === -2) {
                        if (orderQueue.data.msg) {
                            return console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), orderQueue.data.msg));
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
                        console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"], ["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
                    }
                }
                else {
                    console.log(orderQueue);
                }
                return Promise.reject();
            }, function (err) {
                console.error(err);
                return Promise.reject(err);
            });
        })
            .retryWhen(function (errors) { return errors.delay(4000); })
            .subscribe(function (orderRequest) {
            console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
            _this.destroy();
        }, function (err) { return console.log(chalk(templateObject_8 || (templateObject_8 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); });
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
            console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
        }, function (err) {
            // 校验失败，重新校验
            console.log(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"]))));
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
                console.log(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
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
                    console.log(chalk(templateObject_12 || (templateObject_12 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err.result_message));
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
            .then(function (x) { return ''; }, function (err) {
            console.log(chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"]))));
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
            .retry(1000)
            .map(function (order) { return _this.checkAuthentication(_this.cookiejar._jar.toJSON().cookies); })
            .subscribe(function (tokens) {
            if (tokens.tk) {
                return sjAppToken.next(tokens.tk);
            }
            else if (tokens.uamtk) {
                return sjNewAppToken.next('');
            }
            sjCaptcha.next(1);
        });
        return this.buildAuthFlow(sjCaptcha, sjNewAppToken, sjAppToken);
    };
    /**
     * 数组多关键字段排序算法，字段默认为递减排序，如果字段前面带有+符号则为递增排序
     */
    Account.prototype.fieldSorter = function (fields) {
        return function (a, b) { return fields.map(function (o) {
            var dir = -1;
            if (o[0] === '+') {
                dir = 1;
                o = o.substring(1);
            }
            else if (o[0] === '-') {
                o = o.substring(1);
            }
            return a[o] > b[o] ? dir : a[o] < b[o] ? -(dir) : 0;
        }).reduce(function (p, n) { return p ? p : n; }, 0); };
    };
    Account.prototype.buildQueryLeftTicketFlow = function (observable) {
        var _this = this;
        var sjQueryLfTicket = new Rx.ReplaySubject();
        observable.subscribe(sjQueryLfTicket);
        return sjQueryLfTicket
            .mergeMap(function (order) {
            return _this.queryLeftTickets(order.trainDate, order.fromStation, order.toStation, order.planTrains)
                .then(function (trains) {
                order.trains = trains;
                return order;
            }, function (err) { return console.error(err); });
        })
            .mergeMap(function (order) {
            if (order.passStation) {
                if (!order.fromToPassTrains) {
                    return _this.queryLeftTickets(order.trainDate, order.fromStation, order.passStation, order.planTrains)
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
            if (order.planTimes) {
                var trains = order.trains || [];
                order.trains = trains.filter(function (train) {
                    return (order.planTimes[0] ? order.planTimes[0] <= train[8] : true) && (order.planTimes[1] ? order.planTimes[1] >= train[8] : true);
                });
            }
            return order;
        })
            .map(function (order) {
            if (order.planOrderBy) {
                order.trains = order.trains.sort(_this.fieldSorter(order.planOrderBy));
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
                        if (order.planTrains.includes(train[3])) {
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
                process.stdout.write(chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"], ["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"])), order.fromStationName, order.toStationName, order.passStationName ? '到' + order.passStationName + ' ' : '', order.trainDate));
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
                    winston.debug(chalk(templateObject_15 || (templateObject_15 = __makeTemplateObject(["{yellow Submit Order Request success!}"], ["{yellow Submit Order Request success!}"]))));
                    _this.sjCPasInitDc.next(order);
                }
                else {
                    // 您还有未处理的订单
                    // 该车次暂不办理业务
                    winston.error(chalk(templateObject_16 || (templateObject_16 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.messages[0]));
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
            .retry(1000)
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
            winston.error(chalk(templateObject_17 || (templateObject_17 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), JSON.stringify(err)));
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
                    console.log(chalk(templateObject_18 || (templateObject_18 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), x.data.errMsg));
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
    Account.prototype.queryLeftTickets = function (trainDate, fromStation, toStation, trainNames) {
        var _this = this;
        if (!trainDate) {
            console.log(chalk(templateObject_19 || (templateObject_19 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"], ["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"]))));
            return Promise.reject();
        }
        // this.BACK_TRAIN_DATE = trainDate;
        if (!fromStation) {
            console.log(chalk(templateObject_20 || (templateObject_20 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"]))));
            return Promise.reject();
        }
        // this.FROM_STATION_NAME = fromStationName;
        if (!toStation) {
            console.log(chalk(templateObject_21 || (templateObject_21 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"]))));
            return Promise.reject();
        }
        // this.TO_STATION_NAME = toStationName;
        return Rx.Observable.of(1)
            .mergeMap(function () { return _this.queryLeftTicket({ trainDate: trainDate,
            fromStation: fromStation,
            toStation: toStation })
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
     * @param toStationName 到达站
     * @param passStationName 途经站
     * @param trainNames 列车
     * @param f 车次过滤条件
     * @param t 时间过滤条件
     *
     * @return void
     */
    Account.prototype.leftTickets = function (_a, _b) {
        var _this = this;
        var trainDate = _a[0], fromStationName = _a[1], toStationName = _a[2], passStationName = _a[3];
        var filter = _b.filter, f = _b.f, time = _b.time, t = _b.t, orderby = _b.orderby, o = _b.o;
        var fromStation = this.stations.getStationCode(fromStationName);
        var toStation = this.stations.getStationCode(toStationName);
        var passStation = this.stations.getStationCode(passStationName);
        var planTrains = typeof f == "string" ? f.split(',') : (typeof filter == "string" ? filter.split(',') : null);
        var planTimes = typeof t == "string" ? t.split(',') : (typeof time == "string" ? time.split(',') : null);
        var planOrderBy = typeof o == "string" ? o.split(',') : (typeof orderby == "string" ? orderby.split(',') : null);
        if (planOrderBy) {
            planOrderBy = planOrderBy.map(function (fieldName) {
                if (fieldName[0] === '-' || fieldName[0] === '+') {
                    return fieldName[0] + _this.TICKET_TITLE.indexOf(fieldName.substring(1));
                }
                return _this.TICKET_TITLE.indexOf(fieldName);
            });
        }
        var sjQueryLeftTickets = new Rx.Subject();
        this.buildQueryLeftTicketFlow(sjQueryLeftTickets)
            .subscribe(function (order) {
            var trains = _this.renderTrainListTitle(order.trains);
            if (trains.length === 0) {
                return console.log(chalk(templateObject_22 || (templateObject_22 = __makeTemplateObject(["{yellow \u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8F66\u6B21}"], ["{yellow \u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8F66\u6B21}"]))));
            }
            _this.renderLeftTickets(trains);
        });
        sjQueryLeftTickets.next({
            trainDate: trainDate,
            fromStation: fromStation,
            toStation: toStation,
            passStation: passStation,
            planTrains: planTrains,
            planTimes: planTimes,
            planOrderBy: planOrderBy,
            seatClasses: []
        });
    };
    Account.prototype.renderTrainListTitle = function (trains) {
        var title = this.TICKET_TITLE.map(function (t) { return chalk(templateObject_23 || (templateObject_23 = __makeTemplateObject(["{blue ", "}"], ["{blue ", "}"])), t); });
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
            rl.question(chalk(templateObject_24 || (templateObject_24 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positionStr) {
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
    Account.prototype.queryLeftTicket = function (_a) {
        var _this = this;
        var trainDate = _a.trainDate, fromStation = _a.fromStation, toStation = _a.toStation;
        var query = {
            "leftTicketDTO.train_date": trainDate,
            "leftTicketDTO.from_station": fromStation,
            "leftTicketDTO.to_station": toStation,
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
                console.error(chalk(templateObject_25 || (templateObject_25 = __makeTemplateObject(["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"], ["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"]))));
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
                            "乘车日期": chalk(templateObject_26 || (templateObject_26 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.train_date.slice(0, 10)),
                            // "下单时间": ticket.reserve_time,
                            "付款截至时间": chalk(templateObject_27 || (templateObject_27 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), ticket.pay_limit_time),
                            "金额": chalk(templateObject_28 || (templateObject_28 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_price / 100),
                            "状态": chalk(templateObject_29 || (templateObject_29 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_status_name),
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
                    winston.error(chalk(templateObject_30 || (templateObject_30 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), body.data.errorMsg));
                }
                else {
                    winston.warn(chalk(templateObject_31 || (templateObject_31 = __makeTemplateObject(["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"], ["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"])), sequenceNo));
                }
            }, function (err) { return winston.error(chalk(templateObject_32 || (templateObject_32 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), JSON.stringify(err))); });
        });
        sjCancelOrder.next();
    };
    return Account;
}());
exports.Account = Account;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29, templateObject_30, templateObject_31, templateObject_32;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUMsRUFBQyxVQUFBLEdBQUcsSUFBRSxPQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxpRkFBQSxPQUFRLEVBQW1CLEdBQUcsS0FBdEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBSSxFQUFsRCxDQUFrRCxDQUFDLENBQUM7UUFDL0QsQ0FBQyxDQUFDLENBQUM7UUFFTCxhQUFhLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUNILGNBQUM7QUFBRCxDQTV1REEsQUE0dURDLElBQUE7QUE1dURZLDBCQUFPIiwiZmlsZSI6InNyYy9BY2NvdW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiIC8vIGh0dHBzOi8vd3d3LmxhbmluZGV4LmNvbS8xMjMwNiVFOCVCNCVBRCVFNyVBNSVBOCVFNiVCNSU4MSVFNyVBOCU4QiVFNSU4NSVBOCVFOCVBNyVBMyVFNiU5RSU5MC9cblxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XG5pbXBvcnQge0ZpbGVDb29raWVTdG9yZX0gZnJvbSAnLi9GaWxlQ29va2llU3RvcmUnO1xuaW1wb3J0IHtTdGF0aW9ufSBmcm9tICcuL1N0YXRpb24nO1xuaW1wb3J0IHJlcXVlc3QgPSByZXF1aXJlKCdyZXF1ZXN0Jyk7XG5pbXBvcnQgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xuaW1wb3J0IGZzID0gcmVxdWlyZSgnZnMnKTtcbmltcG9ydCByZWFkbGluZSA9IHJlcXVpcmUoJ3JlYWRsaW5lJyk7XG5pbXBvcnQgcHJvY2VzcyA9IHJlcXVpcmUoJ3Byb2Nlc3MnKTtcbmltcG9ydCBSeCA9IHJlcXVpcmUoJ0ByZWFjdGl2ZXgvcnhqcycpO1xuLy8gaW1wb3J0IHsgT2JzZXJ2YWJsZSwgT2JzZXJ2YWJsZUlucHV0IH0gZnJvbSAnQHJlYWN0aXZleC9yeGpzJztcbmltcG9ydCBjaGFsayA9IHJlcXVpcmUoJ2NoYWxrJyk7XG5pbXBvcnQgY29sdW1uaWZ5ID0gcmVxdWlyZSgnY29sdW1uaWZ5Jyk7XG5pbXBvcnQgYmVlcGVyID0gcmVxdWlyZSgnYmVlcGVyJyk7XG5cbmludGVyZmFjZSBPcmRlciBleHRlbmRzIFJ4Lk9ic2VydmFibGVJbnB1dCB7XG4gIHRyYWluRGF0ZTogc3RyaW5nXG4gICxiYWNrVHJhaW5EYXRlOiBzdHJpbmdcbiAgLGZyb21TdGF0aW9uTmFtZTogc3RyaW5nXG4gICx0b1N0YXRpb25OYW1lOiBzdHJpbmdcbiAgLHBhc3NTdGF0aW9uTmFtZT86IHN0cmluZ1xuICAscGxhblRyYWluczogQXJyYXk8c3RyaW5nPlxuICAscGxhblBlcG9sZXM6IEFycmF5PHN0cmluZz5cbiAgLHBsYW5UaW1lcz86IEFycmF5PHN0cmluZz5cbiAgLGZyb21TdGF0aW9uOiBzdHJpbmdcbiAgLHRvU3RhdGlvbjogc3RyaW5nXG4gICxwYXNzU3RhdGlvbj86IHN0cmluZ1xuICAsc2VhdENsYXNzZXM6IEFycmF5PHN0cmluZz5cbiAgLHRyYWlucz86IEFycmF5PEFycmF5PHN0cmluZz4+XG5cbn1cblxuZXhwb3J0IGNsYXNzIEFjY291bnQge1xuICBwdWJsaWMgdXNlck5hbWUgOiBzdHJpbmc7XG4gIHB1YmxpYyB1c2VyUGFzc3dvcmQgOiBzdHJpbmc7XG4gIHByaXZhdGUgY2hlY2tVc2VyVGltZXIgPSBSeC5PYnNlcnZhYmxlLnRpbWVyKDEwMDAqNjAqMTAsIDEwMDAqNjAqMTApOyAvLyDljYHliIbpkp/kuYvlkI7lvIDlp4vvvIzmr4/ljYHliIbpkp/mo4Dmn6XkuIDmrKFcbiAgcHJpdmF0ZSBzY3B0Q2hlY2tVc2VyVGltZXI/OiBSeC5TdWJzY3JpcHRpb247XG5cbiAgcHJpdmF0ZSBzdGF0aW9uczogU3RhdGlvbiA9IG5ldyBTdGF0aW9uKCk7XG4gIHByaXZhdGUgcGFzc2VuZ2Vycz86IG9iamVjdDtcblxuICBwcml2YXRlIFNZU1RFTV9CVVNTWSA9IFwiU3lzdGVtIGlzIGJ1c3N5XCI7XG4gIHByaXZhdGUgU1lTVEVNX01PVkVEID0gXCJNb3ZlZCBUZW1wb3JhcmlseVwiO1xuXG4gIHByaXZhdGUgcmVxdWVzdD86IHJlcXVlc3QuUmVxdWVzdEFQSTxhbnksIGFueSwgYW55PjtcbiAgcHJpdmF0ZSBjb29raWVqYXI6IGFueTtcbiAgcHVibGljIGhlYWRlcnM6IG9iamVjdCA9IHtcbiAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOFwiXG4gICAgLFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDYuMTsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4xNyAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8yNC4wLjEzMTIuNjAgU2FmYXJpLzUzNy4xN1wiXG4gICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxuICAgICxcIk9yaWdpblwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jblwiXG4gICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxuICB9O1xuXG4gIHByaXZhdGUgVElDS0VUX1RJVExFID0gWycnLCAnJywgJycsICfovabmrKEnLCAn6LW35aeLJywgJ+e7iOeCuScsICflh7rlj5Hnq5knLCAn5Yiw6L6+56uZJywgJ+WHuuWPkeaXticsICfliLDovr7ml7YnLCAn5Y6G5pe2JywgJycsICcnLFxuICAgICAgICAgICAgICAgJ+aXpeacnycsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAn6auY57qn6L2v5Y2nJywgJycsICfova/ljacnLCAn6L2v5bqnJywgJ+eJueetieW6pycsICfml6DluqcnLFxuICAgICAgICAgICAgICAgJycsICfnoazljacnLCAn56Gs5bqnJywgJ+S6jOetieW6pycsICfkuIDnrYnluqcnLCAn5ZWG5Yqh5bqnJ107XG5cbiAgcHJpdmF0ZSBxdWVyeSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgb3JkZXJzOiBBcnJheTxPcmRlcj4gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHVzZXJQYXNzd29yZDogc3RyaW5nKSB7XG4gICAgdGhpcy51c2VyTmFtZSA9IG5hbWU7XG4gICAgdGhpcy51c2VyUGFzc3dvcmQgPSB1c2VyUGFzc3dvcmQ7XG5cbiAgICB0aGlzLnNldFJlcXVlc3QoKTtcbiAgICB0aGlzLmJ1aWxkKCk7XG4gIH1cblxuICAvKipcbiAgICog5qOA5p+l572R57uc5byC5bi4XG4gICAqL1xuICBwcml2YXRlIGlzU3lzdGVtQnVzc3koYm9keTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGJvZHkuaW5kZXhPZihcIue9kee7nOWPr+iDveWtmOWcqOmXrumimO+8jOivt+aCqOmHjeivleS4gOS4i1wiKSA+IDA7XG4gIH1cblxuICBwdWJsaWMgc2V0UmVxdWVzdCgpIHtcbiAgICBsZXQgY29va2llRmlsZU5hbWU6IHN0cmluZyA9IFwiLi9jb29raWVzL1wiK3RoaXMudXNlck5hbWUrXCIuanNvblwiO1xuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKGNvb2tpZUZpbGVOYW1lLCB7ZW5jcnlwdDogZmFsc2V9KTtcbiAgICBmaWxlU3RvcmUub3B0aW9uID0ge2VuY3J5cHQ6IGZhbHNlfTtcblxuICAgIHRoaXMuY29va2llamFyID0gcmVxdWVzdC5qYXIoZmlsZVN0b3JlKTtcblxuICAgIHRoaXMucmVxdWVzdCA9IHJlcXVlc3QuZGVmYXVsdHMoe2phcjogdGhpcy5jb29raWVqYXJ9KTtcbiAgfVxuXG4gIHByaXZhdGUgbmV4dE9yZGVyTnVtOiBudW1iZXIgPSAwO1xuICBwcml2YXRlIG5leHRPcmRlcigpIHtcbiAgICB0aGlzLm5leHRPcmRlck51bSA9ICh0aGlzLm5leHRPcmRlck51bSArIDEpJXRoaXMub3JkZXJzLmxlbmd0aDtcbiAgICByZXR1cm4gdGhpcy5vcmRlcnNbdGhpcy5uZXh0T3JkZXJOdW1dO1xuICB9XG5cbiAgcHJpdmF0ZSBjdXJyZW50T3JkZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMub3JkZXJzW3RoaXMubmV4dE9yZGVyTnVtXTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVPcmRlcih0cmFpbkRhdGVzOiBBcnJheTxzdHJpbmc+LCBiYWNrVHJhaW5EYXRlOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICBbZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgcGxhblRyYWluczogQXJyYXk8c3RyaW5nPiwgcGxhblBlcG9sZXM6IEFycmF5PHN0cmluZz4sIHNlYXRDbGFzc2VzOiBBcnJheTxzdHJpbmc+KTogdGhpcyB7XG4gICAgdHJhaW5EYXRlcy5mb3JFYWNoKHRyYWluRGF0ZT0+IHtcbiAgICAgIGlmKCFuZXcgRGF0ZSh0cmFpbkRhdGUpLnRvSlNPTigpKSB7XG4gICAgICAgIHRocm93IGNoYWxrYHtyZWQg5LmY6L2m5pel5pyfJHt0cmFpbkRhdGV95qC85byP5LiN5q2j56Gu77yM5qC85byP5bqU6K+l5piveXl5eS1NTS1kZH1gO1xuICAgICAgfVxuICAgICAgaWYobmV3IERhdGUodHJhaW5EYXRlKS50b0pTT04oKS5zbGljZSgwLDEwKSA8IG5ldyBEYXRlKCkudG9KU09OKCkuc2xpY2UoMCwxMCkpIHtcbiAgICAgICAgdGhyb3cgY2hhbGtge3JlZCDkuZjovabml6XmnJ/lupTor6XkuLrku4rlpKnmiJbku6XlkI59YDtcbiAgICAgIH1cbiAgICAgIHRoaXMub3JkZXJzLnB1c2goe1xuICAgICAgICB0cmFpbkRhdGU6IHRyYWluRGF0ZVxuICAgICAgICAsYmFja1RyYWluRGF0ZTogYmFja1RyYWluRGF0ZVxuICAgICAgICAsZnJvbVN0YXRpb25OYW1lOiBmcm9tU3RhdGlvbk5hbWVcbiAgICAgICAgLHRvU3RhdGlvbk5hbWU6IHRvU3RhdGlvbk5hbWVcbiAgICAgICAgLHBhc3NTdGF0aW9uTmFtZTogcGFzc1N0YXRpb25OYW1lXG4gICAgICAgICxwbGFuVHJhaW5zOiBwbGFuVHJhaW5zXG4gICAgICAgICxwbGFuUGVwb2xlczogcGxhblBlcG9sZXNcbiAgICAgICAgLGZyb21TdGF0aW9uOiB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKGZyb21TdGF0aW9uTmFtZSlcbiAgICAgICAgLHRvU3RhdGlvbjogdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZSh0b1N0YXRpb25OYW1lKVxuICAgICAgICAscGFzc1N0YXRpb246IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUocGFzc1N0YXRpb25OYW1lKVxuICAgICAgICAsc2VhdENsYXNzZXM6IHNlYXRDbGFzc2VzXG4gICAgICB9KVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgb3JkZXJXYWl0VGltZSgpIHtcbiAgICBsZXQgc2pPcmRlcldhaXRUaW1lID0gbmV3IFJ4LlN1YmplY3QoKTtcbiAgICB0aGlzLmJ1aWxkTG9naW5GbG93KHNqT3JkZXJXYWl0VGltZSlcbiAgICAgIC5zdWJzY3JpYmUoKCk9PnRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dCgpKTtcbiAgICBzak9yZGVyV2FpdFRpbWUubmV4dCgpO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE9yZGVyUXVldWUoKSB7XG4gICAgdGhpcy5jYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpXG4gICAgICAudGhlbih4PT4ge1xuICAgICAgICBpZih4LnN0YXR1cyAmJiB4LmRhdGEuZXhpc3RFcnJvciA9PSAnTicpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDmjpLpmJ/orqLljZXlt7Llj5bmtoh9YCk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKHgpO1xuICAgICAgICB9XG4gICAgICB9LCBlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcbiAgfVxuXG4gIHB1YmxpYyBzdWJtaXQoKTogdm9pZCB7XG4gICAgbGV0IHNqTCA9IG5ldyBSeC5TdWJqZWN0KCk7XG4gICAgbGV0IHNqQ2hlY2tVc2VyID0gbmV3IFJ4LlN1YmplY3QoKTtcbiAgICB0aGlzLmJ1aWxkTG9naW5GbG93KHNqTClcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcbiAgICAgICAgdGhpcy5idWlsZE9yZGVyRmxvdygpLm5leHQoKTtcbiAgICAgICAgdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXIgPVxuICAgICAgICAgIHRoaXMuY2hlY2tVc2VyVGltZXIuc3Vic2NyaWJlKChpKT0+IHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGkpO1xuICAgICAgICAgICAgc2pDaGVja1VzZXIubmV4dCgpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgICAvL1xuICAgIHRoaXMuYnVpbGRDaGVja1VzZXJGbG93KHNqQ2hlY2tVc2VyKVxuICAgICAgLnN1YnNjcmliZSgoKT0+d2luc3Rvbi5kZWJ1ZyhcIkNoZWNrIHVzZXIgZG9uZVwiKSk7XG5cbiAgICBzakwubmV4dCgpO1xuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXImJnRoaXMuc2NwdENoZWNrVXNlclRpbWVyLnVuc3Vic2NyaWJlKCk7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkKCkge1xuXG4gICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VFxuICAgICAgICAubWVyZ2VNYXAoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+XG4gICAgICAgICAgdGhpcy5xdWVyeU9yZGVyV2FpdFRpbWUob3JkZXJSZXF1ZXN0JiYob3JkZXJSZXF1ZXN0LnRva2VufHxcIlwiKSlcbiAgICAgICAgICAgIC50aGVuKG9yZGVyUXVldWU9PiB7XG4gICAgICAgICAgICAgIGlmKG9yZGVyUXVldWUuc3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAwIHx8IG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgIC8vIDAuNeenkuWTjeS4gOasoe+8jOWTjemTgzMw5YiG6ZKfXG4gICAgICAgICAgICAgICAgICBiZWVwZXIoNjAqMzAqMik7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2coY2hhbGtgWW91ciB0aWNrZXQgb3JkZXIgbnVtYmVyIGlzIHtyZWQuYm9sZCAke29yZGVyUXVldWUuZGF0YS5vcmRlcklkfX1gKTtcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0yKXtcbiAgICAgICAgICAgICAgICAgIGlmKG9yZGVyUXVldWUuZGF0YS5tc2cpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke29yZGVyUXVldWUuZGF0YS5tc2d9fWApO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKG9yZGVyUXVldWUpO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTMpe1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKFwiWW91ciB0aWNrZXQgcmVxdWVzdCBoYXMgYmVlbiBjYW5jZWxlZCFcIik7XG4gICAgICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtNCl7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIllvdXIgdGlja2V0IHJlcXVlc3QgaXMgYmVpbmcgcHJvY2Vzc2VkLCBwbGVhc2Ugd2FpdCBhIG1vbWVudCFcIik7XG4gICAgICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOaOkumYn+S6uuaVsO+8miR7b3JkZXJRdWV1ZS5kYXRhLndhaXRDb3VudH19IOmihOiuoeetieW+heaXtumXtO+8miR7cGFyc2VJbnQob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lIC8gMS41KX0g5YiG6ZKfYCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XG4gICAgICAgICAgICB9LGVycj0+IHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgICAgIH0pXG4gICAgICApXG4gICAgICAvLyAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG4gICAgICAucmV0cnlXaGVuKChlcnJvcnMpPT5lcnJvcnMuZGVsYXkoNDAwMCkpXG4gICAgICAuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg57uT5p2ffWApO1xuICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIH0sZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YCkpO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZEF1dGhGbG93KHN1YmplY3Q6IFJ4LlN1YmplY3QsXG4gICAgICAgICAgICAgICAgICAgICAgICBzak5ld0FwcFRva2VuOiBSeC5SZXBsYXlTdWJqZWN0ID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHNqQXBwVG9rZW46IFJ4LlJlcGxheVN1YmplY3QgPSBuZXcgUnguUmVwbGF5U3ViamVjdCgpKSB7XG4gICAgbGV0IHNqQ2FwdGNoYSA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0KCk7XG4gICAgbGV0IHNqTG9naW4gPSBuZXcgUnguUmVwbGF5U3ViamVjdCgpO1xuICAgIGxldCBzak15UGFnZSA9IG5ldyBSeC5TdWJqZWN0KCk7XG5cbiAgICBzdWJqZWN0LnN1YnNjcmliZShzakNhcHRjaGEpO1xuXG4gICAgc2pDYXB0Y2hhLm1lcmdlTWFwKCgpPT50aGlzLmdldENhcHRjaGEoKSlcbiAgICAgICAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5jaGVja0NhcHRjaGEoKS50aGVuKCgpPT57XG4gICAgICAgICAgICAgIC8vIOagoemqjOeggeaIkOWKn+WQjui/m+ihjOaOiOadg+iupOivgVxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDpqozor4HnoIHmoKHpqozmiJDlip99YCk7XG4gICAgICAgICAgICB9LGVycj0+IHtcbiAgICAgICAgICAgICAgLy8g5qCh6aqM5aSx6LSl77yM6YeN5paw5qCh6aqMXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDmoKHpqozlpLHotKXvvIzph43mlrDmoKHpqox9YCk7XG4gICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG4gICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT5zakxvZ2luLm5leHQoMSksIGVycj0+Y29uc29sZS5lcnJvcihlcnIpKTtcblxuICAgIC8qKlxuICAgICAqIOWmguS9leWcqCBtZXJnZU1hcCArIHJldHJ5IOaooeW8j+S4reWMuuWIhumcgOimgemHjeivleeahOmUmeivr+WSjOato+W4uOS4jemcgOimgemHjeivleeahOmUmeivr++8jFxuICAgICAqIOWmguaenOaKiuS4jemcgOimgemHjeivleeahOmUmeivr+WSjOato+ehrue7k+aenOmDvemAmui/h3Jlc29sdmXov5Tlm57liJnpnIDopoHku4DkuYjmoLfnmoTmlrnlvI/ov5vooYzljLrliKtcbiAgICAgKi9cbiAgICBzakxvZ2luXG4gICAgICAubWVyZ2VNYXAoKCk9PlxuICAgICAgICB0aGlzLnVzZXJBdXRoZW50aWNhdGUoKVxuICAgICAgICAgICAgLnRoZW4oKCk9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOeZu+W9leaIkOWKn31gKTtcbiAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuICAgICAgICAgICAgfSxlcnI9PiB7XG4gICAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLlr4bnoIHovpPlhaXplJnor6/jgILlpoLmnpzovpPplJnmrKHmlbDotoXov4c05qyh77yM55So5oi35bCG6KKr6ZSB5a6a44CCXCIsXCJyZXN1bHRfY29kZVwiOjF9XG4gICAgICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLpqozor4HnoIHmoKHpqozlpLHotKVcIixcInJlc3VsdF9jb2RlXCI6XCI1XCJ9XG4gICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgIGlmKHR5cGVvZiBlcnIucmVzdWx0X2NvZGUgPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyLnJlc3VsdF9tZXNzYWdlfX1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXJyO1xuICAgICAgICAgICAgICAgIC8vIGlmKGVycm9yLnJlc3VsdF9jb2RlID09PSAxKSB7XG4gICAgICAgICAgICAgICAgLy8gICB0aHJvdyBlcnJvci5yZXN1bHRfbWVzc2FnZTtcbiAgICAgICAgICAgICAgICAvLyB9ZWxzZSBpZihlcnJvci5yZXN1bHRfY29kZSA9PT0gNSkge1xuICAgICAgICAgICAgICAgIC8vICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xuICAgICAgICAgICAgICAgIC8vIH1lbHNlIHtcbiAgICAgICAgICAgICAgICAvLyAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcbiAgICAgICAgICAgICAgICAvLyB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICApXG4gICAgICAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG4gICAgICAuc3Vic2NyaWJlKGVycj0+IHtcbiAgICAgICAgLy8g55m75b2V5aSx6LSl5bCG6YeN5paw5LuO5qCh6aqM56CB5byA5aeLXG4gICAgICAgIGlmKGVycikge1xuICAgICAgICAgIHNqQ2FwdGNoYS5uZXh0KDEpO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgc2pOZXdBcHBUb2tlbi5uZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgc2pOZXdBcHBUb2tlblxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmdldE5ld0FwcFRva2VuKCkpXG4gICAgICAuc3Vic2NyaWJlKChuZXdhcHB0azogc3RyaW5nKT0+IHtcbiAgICAgICAgc2pBcHBUb2tlbi5uZXh0KG5ld2FwcHRrKVxuICAgICAgfSwoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgc2pDYXB0Y2hhLm5leHQoMSk7XG4gICAgICB9KTtcblxuICAgIHNqQXBwVG9rZW5cbiAgICAgIC5tZXJnZU1hcCgobmV3YXBwdGs6IHN0cmluZyk9PnRoaXMuZ2V0QXBwVG9rZW4obmV3YXBwdGspXG4gICAgICAgIC50aGVuKCh4OiBzdHJpbmcpID0+ICcnLCAoZXJyOiBhbnkpPT4ge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDojrflj5ZUb2tlbuWksei0pX1gKTtcbiAgICAgICAgICB3aW5zdG9uLmRlYnVnKGVycik7XG4gICAgICAgICAgaWYoZXJyLnJlc3VsdF9jb2RlICYmIGVyci5yZXN1bHRfY29kZSA9PT0gMikge1xuICAgICAgICAgICAgcmV0dXJuIGVycjtcbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKVxuICAgICAgLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxuICAgICAgLnN1YnNjcmliZSgoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgaWYoZXJyKSB7XG4gICAgICAgICAgc2pDYXB0Y2hhLm5leHQoMSk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICBzak15UGFnZS5uZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH0sIChlcnJvcjogYW55KT0+IHtcbiAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgfSk7XG5cbiAgICByZXR1cm4gc2pNeVBhZ2U7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkTG9naW5GbG93KG9ic2VydmFibGU6IFJ4Lk9ic2VydmFibGU8YW55Pik6IFJ4Lk9ic2VydmFibGU8YW55PiB7XG4gICAgbGV0IHNqTG9naW5Jbml0ID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKTtcbiAgICBsZXQgc2pDYXB0Y2hhID0gbmV3IFJ4LlN1YmplY3QoKTtcbiAgICBsZXQgc2pOZXdBcHBUb2tlbiA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0PGFueT4oKTtcbiAgICBsZXQgc2pBcHBUb2tlbiA9IG5ldyBSeC5SZXBsYXlTdWJqZWN0PHN0cmluZz4oKTtcblxuICAgIG9ic2VydmFibGUuc3Vic2NyaWJlKHNqTG9naW5Jbml0KTtcblxuICAgIC8vIOeZu+W9leWIneWni+WMllxuICAgIHNqTG9naW5Jbml0XG4gICAgICAubWVyZ2VNYXAob3JkZXI9PnRoaXMubG9naW5Jbml0KCkpXG4gICAgICAucmV0cnkoMTAwMClcbiAgICAgIC5tYXAob3JkZXIgPT4gdGhpcy5jaGVja0F1dGhlbnRpY2F0aW9uKHRoaXMuY29va2llamFyLl9qYXIudG9KU09OKCkuY29va2llcykpXG4gICAgICAuc3Vic2NyaWJlKHRva2Vucz0+IHtcbiAgICAgICAgaWYodG9rZW5zLnRrKSB7XG4gICAgICAgICAgcmV0dXJuIHNqQXBwVG9rZW4ubmV4dCh0b2tlbnMudGspO1xuICAgICAgICB9ZWxzZSBpZih0b2tlbnMudWFtdGspIHtcbiAgICAgICAgICByZXR1cm4gc2pOZXdBcHBUb2tlbi5uZXh0KCcnKTtcbiAgICAgICAgfVxuICAgICAgICBzakNhcHRjaGEubmV4dCgxKTtcbiAgICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuYnVpbGRBdXRoRmxvdyhzakNhcHRjaGEsIHNqTmV3QXBwVG9rZW4sIHNqQXBwVG9rZW4pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaVsOe7hOWkmuWFs+mUruWtl+auteaOkuW6j+eul+azle+8jOWtl+autem7mOiupOS4uumAkuWHj+aOkuW6j++8jOWmguaenOWtl+auteWJjemdouW4puaciSvnrKblj7fliJnkuLrpgJLlop7mjpLluo9cbiAgICovXG4gIHByaXZhdGUgZmllbGRTb3J0ZXIoZmllbGRzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgcmV0dXJuIChhOmFueSwgYjphbnkpID0+IGZpZWxkcy5tYXAoKG86c3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGxldCBkaXIgPSAtMTtcbiAgICAgICAgICAgICAgaWYgKG9bMF0gPT09ICcrJykge1xuICAgICAgICAgICAgICAgIGRpciA9IDE7XG4gICAgICAgICAgICAgICAgbyA9IG8uc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICB9ZWxzZSBpZihvWzBdID09PSAnLScpIHtcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGFbb10gPiBiW29dID8gZGlyIDogYVtvXSA8IGJbb10gPyAtKGRpcikgOiAwO1xuICAgICAgICAgIH0pLnJlZHVjZSgocCwgbikgPT4gcCA/IHAgOiBuLCAwKTtcbiAgfVxuXG4gIHByaXZhdGUgc2pMZlRpY2tldEluaXQgICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XG4gIHByaXZhdGUgc2pRdWVyeUxmVGlja2V0ICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XG4gIHByaXZhdGUgc2pTbU9SZXFDaGVja1VzZXIgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcbiAgcHJpdmF0ZSBzalNtT3JkZXJSZXEgICAgICAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xuICBwcml2YXRlIHNqQ1Bhc0luaXREYyAgICAgICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XG4gIHByaXZhdGUgc2pHZXRQYXNzZW5nZXJzICAgICA9IG5ldyBSeC5TdWJqZWN0PG9iamVjdD4oKTtcbiAgcHJpdmF0ZSBzakNoZWNrT3JkZXJJbmZvICAgID0gbmV3IFJ4LlJlcGxheVN1YmplY3Q8b2JqZWN0PigpO1xuICBwcml2YXRlIHNqR2V0UXVldWVDb3VudCAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xuICBwcml2YXRlIHNqR2V0UGFzc0NvZGVOZXcgICAgPSBuZXcgUnguU3ViamVjdCgpO1xuICBwcml2YXRlIHNqQ29uZmlybVNpbmdsZTRRICAgPSBuZXcgUnguU3ViamVjdCgpO1xuICBwcml2YXRlIHNqUXVlcnlPcmRlcldhaXRUICAgPSBuZXcgUnguUmVwbGF5U3ViamVjdCgpO1xuXG4gIHByaXZhdGUgYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9ic2VydmFibGU6IFJ4Lk9ic2VydmFibGU8T3JkZXI+KTogUnguT2JzZXJ2YWJsZTx7fT4ge1xuICAgIGxldCBzalF1ZXJ5TGZUaWNrZXQgPSBuZXcgUnguUmVwbGF5U3ViamVjdDxPcmRlcj4oKTtcblxuICAgIG9ic2VydmFibGUuc3Vic2NyaWJlKHNqUXVlcnlMZlRpY2tldCk7XG5cbiAgICByZXR1cm4gc2pRdWVyeUxmVGlja2V0XG4gICAgICAvLyDojrflj5bkvZnnpajkv6Hmga9cbiAgICAgIC5tZXJnZU1hcCgob3JkZXI6IE9yZGVyKTpSeC5PYnNlcnZhYmxlSW5wdXQ8T3JkZXI+ID0+XG4gICAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyhvcmRlci50cmFpbkRhdGUsIG9yZGVyLmZyb21TdGF0aW9uLCBvcmRlci50b1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXG4gICAgICAgICAgLnRoZW4oKHRyYWlucyk9PiB7XG4gICAgICAgICAgICBvcmRlci50cmFpbnMgPSB0cmFpbnM7XG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgfSxlcnI9PmNvbnNvbGUuZXJyb3IoZXJyKSlcbiAgICAgIClcbiAgICAgIC8vIOiOt+WPlumAlOe7j+ermei9puasoeS/oeaBr1xuICAgICAgLm1lcmdlTWFwKChvcmRlcjogT3JkZXIpOlJ4Lk9ic2VydmFibGVJbnB1dDxPcmRlcj4gPT4ge1xuICAgICAgICBpZihvcmRlci5wYXNzU3RhdGlvbikge1xuICAgICAgICAgIGlmKCFvcmRlci5mcm9tVG9QYXNzVHJhaW5zKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5xdWVyeUxlZnRUaWNrZXRzKG9yZGVyLnRyYWluRGF0ZSwgb3JkZXIuZnJvbVN0YXRpb24sIG9yZGVyLnBhc3NTdGF0aW9uLCBvcmRlci5wbGFuVHJhaW5zKVxuICAgICAgICAgICAgICAudGhlbihwYXNzVHJhaW5zPT4ge1xuICAgICAgICAgICAgICAgIG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMgPSBwYXNzVHJhaW5zLm1hcCh0cmFpbiA9PiB0cmFpblszXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG9yZGVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG9yZGVyKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIOaMiemAlOe7j+ermei9puasoei/h+a7pFxuICAgICAgLm1hcCgob3JkZXI6IE9yZGVyKTpSeC5PYnNlcnZhYmxlSW5wdXQ8T3JkZXI+ID0+IHtcbiAgICAgICAgaWYob3JkZXIuZnJvbVRvUGFzc1RyYWlucykge1xuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IG9yZGVyLnRyYWlucy5maWx0ZXIodHJhaW4gPT4gb3JkZXIuZnJvbVRvUGFzc1RyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDmjInml7bpl7TojIPlm7Tov4fmu6RcbiAgICAgIC5tYXAoKG9yZGVyOiBPcmRlcikgPT4ge1xuICAgICAgICBpZihvcmRlci5wbGFuVGltZXMpIHtcbiAgICAgICAgICBsZXQgdHJhaW5zID0gb3JkZXIudHJhaW5zfHxbXTtcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSB0cmFpbnMuZmlsdGVyKHRyYWluPT4ge1xuICAgICAgICAgICAgcmV0dXJuIChvcmRlci5wbGFuVGltZXNbMF0/b3JkZXIucGxhblRpbWVzWzBdPD10cmFpbls4XTp0cnVlKSYmKG9yZGVyLnBsYW5UaW1lc1sxXT9vcmRlci5wbGFuVGltZXNbMV0+PXRyYWluWzhdOnRydWUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgfSlcbiAgICAgIC8vIOagueaNruWtl+auteaOkuW6j1xuICAgICAgLm1hcCgob3JkZXI6IE9yZGVyKT0+IHtcbiAgICAgICAgaWYob3JkZXIucGxhbk9yZGVyQnkpIHtcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSBvcmRlci50cmFpbnMuc29ydCh0aGlzLmZpZWxkU29ydGVyKG9yZGVyLnBsYW5PcmRlckJ5KSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgfSlcbiAgICAgIC8vIOiuoeeul+WPr+i0reS5sOi9puasoeS/oeaBr1xuICAgICAgLm1hcCgob3JkZXI6IE9yZGVyKTpSeC5PYnNlcnZhYmxlSW5wdXQ8T3JkZXI+ID0+IHtcbiAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG5cbiAgICAgICAgbGV0IHBsYW5UcmFpbnM6IEFycmF5PHN0cmluZz4gPSBbXSwgdGhhdCA9IHRoaXM7XG4gICAgICAgIHRyYWlucy5zb21lKHRyYWluID0+IHtcbiAgICAgICAgICByZXR1cm4gb3JkZXIuc2VhdENsYXNzZXMuc29tZShzZWF0ID0+IHtcbiAgICAgICAgICAgIHZhciBzZWF0TnVtID0gdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihzZWF0KTtcbiAgICAgICAgICAgIGlmKHRyYWluW3NlYXROdW1dID09IFwi5pyJXCIgfHwgdHJhaW5bc2VhdE51bV0gPiAwKSB7XG4gICAgICAgICAgICAgIHdpbnN0b24uZGVidWcob3JkZXIudHJhaW5EYXRlK1wiL1wiK3RyYWluWzNdK1wiL1wiK3NlYXQrXCIvXCIrdHJhaW5bc2VhdE51bV0pO1xuICAgICAgICAgICAgICBpZihvcmRlci5wbGFuVHJhaW5zLmluY2x1ZGVzKHRyYWluWzNdKSkge1xuICAgICAgICAgICAgICAgIHBsYW5UcmFpbnMucHVzaCh0cmFpbik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb3JkZXIuYXZhaWxhYmxlVHJhaW5zID0gcGxhblRyYWlucztcbiAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkT3JkZXJGbG93KCk6IFJ4Lk9ic2VydmFibGUge1xuXG4gICAgbGV0IHNqUXVlcnlMZlRpY2tldCA9IG5ldyBSeC5TdWJqZWN0KCk7XG4gICAgbGV0IHNqU21PUmVxQ2hlY2tVc2VyID0gbmV3IFJ4LlN1YmplY3QoKTtcblxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxuICAgIHRoaXMuc2pMZlRpY2tldEluaXQuc3Vic2NyaWJlKCgpPT4ge1xuICAgICAgdGhpcy5sZWZ0VGlja2V0SW5pdCgpXG4gICAgICAgIC50aGVuKCgpPT5zalF1ZXJ5TGZUaWNrZXQubmV4dCh0aGlzLm5leHRPcmRlcigpKSwgKGVycm9yOiBhbnkpPT4ge1xuICAgICAgICAgIHdpbnN0b24uZXJyb3IoZXJyb3IpO1xuICAgICAgICB9KTtcbiAgICB9KTtcblxuICAgIHRoaXMuYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KHNqUXVlcnlMZlRpY2tldClcbiAgICAgIC5kbygoKT0+IHtcbiAgICAgICAgaWYodGhpcy5xdWVyeSkge1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnN1YnNjcmliZShvcmRlcj0+IHtcbiAgICAgICAgaWYob3JkZXIuYXZhaWxhYmxlVHJhaW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gZmFsc2U7XG4gICAgICAgICAgLy8gcHJvY2Vzcy5zdGRvdXQud3JpdGUoY2hhbGtge3llbGxvdyDmnInlj6/otK3kubDkvZnnpaggJHtwbGFuVHJhaW4udG9TdHJpbmcoKX19YCk7XG4gICAgICAgICAgb3JkZXIudHJhaW5TZWNyZXRTdHIgPSBvcmRlci5hdmFpbGFibGVUcmFpbnNbMF1bMF07XG4gICAgICAgICAgc2pTbU9SZXFDaGVja1VzZXIubmV4dChvcmRlcik7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShjaGFsa2DmsqHmnInlj6/otK3kubDkvZnnpagge3llbGxvdyAke29yZGVyLmZyb21TdGF0aW9uTmFtZX19IOWIsCB7eWVsbG93ICR7b3JkZXIudG9TdGF0aW9uTmFtZX19ICR7b3JkZXIucGFzc1N0YXRpb25OYW1lPyfliLAnK29yZGVyLnBhc3NTdGF0aW9uTmFtZSsnICc6Jyd9e3llbGxvdyAke29yZGVyLnRyYWluRGF0ZX19YCk7XG4gICAgICAgICAgLy8gcHJvY2Vzcy5zdGRvdXQud3JpdGUoXCIuLi4uLi4uXCIpO1xuXG4gICAgICAgICAgc2V0VGltZW91dCgoKT0+IHtcbiAgICAgICAgICAgIHNqUXVlcnlMZlRpY2tldC5uZXh0KHRoaXMubmV4dE9yZGVyKCkpO1xuICAgICAgICAgIH0sIDE1MDApO1xuICAgICAgICAgIHRoaXMucXVlcnkgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9LGVycj0+IHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgICAgfSk7XG5cbiAgICB0aGlzLmJ1aWxkQ2hlY2tVc2VyRmxvdyhzalNtT1JlcUNoZWNrVXNlcilcbiAgICAgIC5zdWJzY3JpYmUob3JkZXI9PnRoaXMuc2pTbU9yZGVyUmVxLm5leHQodGhpcy5jdXJyZW50T3JkZXIoKSkpO1xuXG4gICAgLy8gU3RlcCAxMSDpooTmj5DkuqTorqLljZXvvIxQb3N0XG4gICAgdGhpcy5zalNtT3JkZXJSZXEuc3Vic2NyaWJlKG9yZGVyPT4ge1xuICAgICAgd2luc3Rvbi5kZWJ1ZyhcInN1Ym1pdCBvcmRlciByZXF1ZXN0XCIpO1xuICAgICAgdGhpcy5zdWJtaXRPcmRlclJlcXVlc3Qob3JkZXIpXG4gICAgICAgIC50aGVuKChib2R5KT0+IHtcbiAgICAgICAgICBpZihib2R5LnN0YXR1cykge1xuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhjaGFsa2B7eWVsbG93IFN1Ym1pdCBPcmRlciBSZXF1ZXN0IHN1Y2Nlc3MhfWApO1xuICAgICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dChvcmRlcik7XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgLy8g5oKo6L+Y5pyJ5pyq5aSE55CG55qE6K6i5Y2VXG4gICAgICAgICAgICAvLyDor6XovabmrKHmmoLkuI3lip7nkIbkuJrliqFcbiAgICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YCk7XG4gICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0sIGVycm9yPT4ge1xuICAgICAgICAgIHdpbnN0b24uZXJyb3IoXCJTdWJtaXRPcmRlclJlcXVlc3QgZXJyb3IgXCIgKyBlcnJvcik7XG4gICAgICAgICAgdGhpcy5zalNtT3JkZXJSZXEubmV4dChvcmRlcik7XG4gICAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8gU3RlcCAxMiDmqKHmi5/ot7PovazpobXpnaJJbml0RGPvvIxQb3N0XG4gICAgdGhpcy5zakNQYXNJbml0RGMuc3Vic2NyaWJlKG9yZGVyPT4ge1xuICAgICAgdGhpcy5jb25maXJtUGFzc2VuZ2VySW5pdERjKCkudGhlbigob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xuICAgICAgICB3aW5zdG9uLmRlYnVnKFwiY29uZmlybVBhc3NlbmdlciBJbml0IERjIHN1Y2Nlc3MhIFwiK29yZGVyUmVxdWVzdC50b2tlbik7XG4gICAgICAgIG9yZGVyLnJlcXVlc3QgPSBvcmRlclJlcXVlc3Q7XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKG9yZGVyUmVxdWVzdC50aWNrZXRJbmZvKTtcbiAgICAgICAgaWYodGhpcy5wYXNzZW5nZXJzKSB7XG4gICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzID0gdGhpcy5wYXNzZW5nZXJzO1xuICAgICAgICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5uZXh0KG9yZGVyKTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLm5leHQob3JkZXIpO1xuICAgICAgICB9XG4gICAgICB9LCBlcnJvcj0+IHtcbiAgICAgICAgaWYoZXJyb3IgPT0gdGhpcy5TWVNURU1fQlVTU1kpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XG4gICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dChvcmRlcik7XG4gICAgICAgIH1lbHNlIGlmKGVycm9yID09IHRoaXMuU1lTVEVNX01PVkVEKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xuICAgICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQob3JkZXIpO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgIH1cbiAgICAgIH0pLmNhdGNoKGVycm9yPT4gY29uc29sZS5lcnJvcihlcnJvcikpO1xuICAgIH0pO1xuXG4gICAgLy8gU3RlcCAxMyDluLjnlKjogZTns7vkurrnoa7lrprvvIxQb3N0XG4gICAgdGhpcy5zakdldFBhc3NlbmdlcnMuc3Vic2NyaWJlKChvcmRlcjogb2JqZWN0KT0+IHtcbiAgICAgIHRoaXMuZ2V0UGFzc2VuZ2VycyhvcmRlci5yZXF1ZXN0LnRva2VuKS50aGVuKHBhc3NlbmdlcnM9PiB7XG4gICAgICAgIHRoaXMucGFzc2VuZ2VycyA9IHBhc3NlbmdlcnM7XG4gICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2VycyA9IHBhc3NlbmdlcnM7XG4gICAgICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5uZXh0KG9yZGVyKTtcbiAgICAgIH0sIGVycm9yPT4ge1xuICAgICAgICB3aW5zdG9uLmVycm9yKGVycm9yICsgXCIgUmV0cnkgZ2V0IHBhc3NlbmdlcnNcIik7XG4gICAgICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLm5leHQob3JkZXIpO1xuICAgICAgfSlcbiAgICAgIC5jYXRjaChlcnJvcj0+IHdpbnN0b24uZXJyb3IoZXJyb3IpKTtcbiAgICB9KTtcblxuICAgIHRoaXMuc2pDaGVja09yZGVySW5mb1xuICAgICAgLm1lcmdlTWFwKChvcmRlcjogb2JqZWN0KT0+XG4gICAgICAgIC8vIFN0ZXAgMTQg6LSt56Wo5Lq656Gu5a6a77yMUG9zdFxuICAgICAgICB0aGlzLmNoZWNrT3JkZXJJbmZvKG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAgIC50aGVuKG9yZGVySW5mbyA9PiB7XG4gICAgICAgICAgICAgICAgLy8gY29uc29sZS5sb2cob3JkZXJJbmZvKTtcbiAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0Lm9yZGVySW5mbyA9IG9yZGVySW5mbztcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgICAgIH0sIGVyciA9PiB7XG4gICAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBlcnI7XG4gICAgICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9KSlcbiAgICAgIC5yZXRyeSgxMDAwKVxuICAgICAgLm1lcmdlTWFwKChvcmRlcik9PiB7XG4gICAgICAgIGlmKHR5cGVvZiBvcmRlciA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG9yZGVyKTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUob3JkZXIpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XG4gICAgICAubWVyZ2VNYXAob3JkZXIgPT5cbiAgICAgICAgdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnJlcXVlc3Qub3JkZXJSZXF1ZXN0LCBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8pXG4gICAgICAgICAgLnRoZW4oKHJlc3BvbnNlKT0+e1xuICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5xdWV1ZUluZm8gPSByZXNwb25zZTtcbiAgICAgICAgICAgIHJldHVybiBvcmRlclxuICAgICAgICAgIH0sIGVycj0+UHJvbWlzZS5yZWplY3QoZXJyKSlcbiAgICAgIClcbiAgICAgIC5zdWJzY3JpYmUob3JkZXIgPT4ge1xuICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlci5xdWV1ZUluZm8pO1xuICAgICAgICAvLyDoi6UgU3RlcCAxNCDkuK3nmoQgXCJpZlNob3dQYXNzQ29kZVwiID0gXCJZXCLvvIzpgqPkuYjlpJrkuobovpPlhaXpqozor4HnoIHov5nkuIDmraXvvIxQb3N0XG4gICAgICAgIGlmKG9yZGVyLnJlcXVlc3Qub3JkZXJJbmZvLmRhdGEuaWZTaG93UGFzc0NvZGUgPT0gXCJZXCIpIHtcbiAgICAgICAgICB0aGlzLnNqR2V0UGFzc0NvZGVOZXcubmV4dChvcmRlcik7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAvLyBTdGVwIDE3IOehruiupOi0reS5sO+8jFBvc3RcbiAgICAgICAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLm5leHQob3JkZXIpO1xuICAgICAgICB9XG4gICAgICB9LGVycj0+e1xuICAgICAgICB3aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApO1xuICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIH0pO1xuXG4gICAgdGhpcy5zakdldFBhc3NDb2RlTmV3LnN1YnNjcmliZSgob3JkZXI6IG9iamVjdCk9PiB7XG4gICAgICAvLyBTdGVwIDE2IOS5mOWuouS5sOelqOmqjOivgeegge+8jEdldCBQT1NUXG4gICAgICB0aGlzLmdldFBhc3NDb2RlTmV3KCkudGhlbigoKT0+IHRoaXMuY2hlY2tSYW5kQ29kZUFuc3luKCkpXG4gICAgICAgIC50aGVuKHg9PiB7XG4gICAgICAgICAgY29uc29sZS5sb2coeCk7XG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyKTtcbiAgICAgICAgfSxlcnJvcj0+Y29uc29sZS5lcnJvcihlcnJvcikpO1xuICAgIH0pO1xuXG4gICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5zdWJzY3JpYmUoKG9yZGVyOiBvYmplY3QpPT4ge1xuICAgICAgdGhpcy5jb25maXJtU2luZ2xlRm9yUXVldWUob3JkZXIucmVxdWVzdC50b2tlbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucGxhblBlcG9sZXMpXG4gICAgICAgIC50aGVuKHg9PiB7XG4gICAgICAgICAgaWYoeC5zdGF0dXMgJiYgeC5kYXRhLnN1Ym1pdFN0YXR1cykge1xuICAgICAgICAgICAgLy8gU3RlcCAxOCDmn6Xor6LmjpLpmJ/nrYnlvoXml7bpl7TvvIFcbiAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlcik7XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgICBkYXRhOiB7IGVyck1zZzogJ+S9meelqOS4jei2s++8gScsIHN1Ym1pdFN0YXR1czogZmFsc2UgfSxcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XG4gICAgICAgICAgICAqL1xuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7eC5kYXRhLmVyck1zZ319YCk7XG4gICAgICAgICAgICAvLyDph43mlrDlvIDlp4vmn6Xor6JcbiAgICAgICAgICAgIHNqUXVlcnlMZlRpY2tldC5uZXh0KHRoaXMubmV4dE9yZGVyKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZXJyb3I9PiB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMuc2pMZlRpY2tldEluaXQ7XG4gIH1cblxuICBwcml2YXRlIGJ1aWxkQ2hlY2tVc2VyRmxvdyhvYnNlcnZhYmxlOiBSeC5PYnNlcnZhYmxlKTogUnguT2JzZXJ2YWJsZSB7XG4gICAgbGV0IHNqQ2hlY2tVc2VyID0gbmV3IFJ4LlJlcGxheVN1YmplY3QoKTtcbiAgICBsZXQgc2pMb2dpbiA9IG5ldyBSeC5TdWJqZWN0KCk7XG4gICAgbGV0IHNqQXV0aGVkID0gbmV3IFJ4LlN1YmplY3QoKTtcbiAgICBvYnNlcnZhYmxlLnN1YnNjcmliZShzakNoZWNrVXNlcik7XG5cbiAgICAvLyBTdGVwIDEwIOmqjOivgeeZu+W9le+8jFBvc3RcbiAgICBzakNoZWNrVXNlclxuICAgICAgLm1lcmdlTWFwKCgpID0+IHRoaXMuY2hlY2tVc2VyKCkpXG4gICAgICAucmV0cnkoMTAwMClcbiAgICAgIC5zdWJzY3JpYmUoKGJvZHkpID0+IHtcbiAgICAgICAgICBpZihib2R5LmRhdGEuZmxhZykge1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coJ2xvZ2luIHN1Y2Nlc3MnKTtcbiAgICAgICAgICAgIHNqQXV0aGVkLm5leHQoKTtcbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICBzakxvZ2luLm5leHQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIC8vIGNvbnNvbGUubG9nKFwic3VibWl0IG9yZGVyIHJlcXVlc3QgY2hlY2sgdXNlclwiKTtcbiAgICAgICAgfSwgZXJyPT57XG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIkNoZWNrIHVzZXIgZXJyb3IgXCIpO1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgICAgICAvKiBUT0RPIGFkZCByZWxvZ2luIGxvZ2ljXG4gICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgZGF0YTogeyBmbGFnOiBmYWxzZSB9LFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICovXG4gICAgICAgICAgc2pMb2dpbi5uZXh0KCk7XG4gICAgICAgIH0pO1xuXG4gICAgdGhpcy5idWlsZEF1dGhGbG93KHNqTG9naW4pXG4gICAgICAuc3Vic2NyaWJlKCgpPT5zakF1dGhlZC5uZXh0KCksZXJyPT5jb25zb2xlLmVycm9yKGVycikpO1xuICAgIHJldHVybiBzakF1dGhlZDtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xuICAgKlxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXG4gICAqXG4gICAqIEByZXR1cm4gUHJvbWlzZVxuICAgKi9cbiAgcHVibGljIHF1ZXJ5TGVmdFRpY2tldHModHJhaW5EYXRlOiBzdHJpbmcsIGZyb21TdGF0aW9uOiBzdHJpbmcsIHRvU3RhdGlvbjogc3RyaW5nLCB0cmFpbk5hbWVzOiBBcnJheTxzdHJpbmc+fG51bGwpOiBQcm9taXNlPEFycmF5PGFueT4+IHtcbiAgICBpZighdHJhaW5EYXRlKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeS5mOi9puaXpeacn31gKTtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xuICAgIH1cbiAgICAvLyB0aGlzLkJBQ0tfVFJBSU5fREFURSA9IHRyYWluRGF0ZTtcblxuICAgIGlmKCFmcm9tU3RhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXlh7rlj5Hnq5l9YCk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QoKTtcbiAgICB9XG4gICAgLy8gdGhpcy5GUk9NX1NUQVRJT05fTkFNRSA9IGZyb21TdGF0aW9uTmFtZTtcblxuICAgIGlmKCF0b1N0YXRpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5Yiw6L6+56uZfWApO1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XG4gICAgfVxuICAgIC8vIHRoaXMuVE9fU1RBVElPTl9OQU1FID0gdG9TdGF0aW9uTmFtZTtcblxuICAgIHJldHVybiBSeC5PYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMucXVlcnlMZWZ0VGlja2V0KHt0cmFpbkRhdGU6IHRyYWluRGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb21TdGF0aW9uOiBmcm9tU3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvU3RhdGlvbjogdG9TdGF0aW9ufSlcbiAgICAgICAgICAgICAgICAgICAgICAudGhlbigodHJhaW5zRGF0YSk9PnRyYWluc0RhdGEsIGVycj0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKFwiLlwiKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgICAgICAgIH0pKVxuICAgICAgLy8gLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxuICAgICAgLnJldHJ5V2hlbigoZXJyb3JzKT0+ZXJyb3JzLmRlbGF5KDE1MDApKVxuICAgICAgLm1hcCh0cmFpbnNEYXRhID0+IHRyYWluc0RhdGEucmVzdWx0KVxuICAgICAgLm1hcChyZXN1bHQgPT4ge1xuICAgICAgICBsZXQgdHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+PiA9IFtdO1xuXG4gICAgICAgIHJlc3VsdC5mb3JFYWNoKChlbGVtZW50OiBzdHJpbmcpPT4ge1xuICAgICAgICAgIGxldCB0cmFpbjogQXJyYXk8c3RyaW5nPiA9IGVsZW1lbnQuc3BsaXQoXCJ8XCIpO1xuICAgICAgICAgIHRyYWluWzRdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls0XSk7XG4gICAgICAgICAgdHJhaW5bNV0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzVdKTtcbiAgICAgICAgICB0cmFpbls2XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNl0pO1xuICAgICAgICAgIHRyYWluWzddID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls3XSk7XG4gICAgICAgICAgdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiSVNfVElNRV9OT1RfQlVZXCIgPyBcIuWIl+i9puWBnOi/kFwiOnRyYWluWzExXTtcbiAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJOXCIgPyBcIuaXoOelqFwiOnRyYWluWzExXTtcbiAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJZXCIgPyBcIuacieelqFwiOnRyYWluWzExXTtcbiAgICAgICAgICAvLyDljLnphY3ovpPlhaXnmoTliJfovablkI3np7DnmoTmraPliJnooajovr7lvI/mnaHku7ZcbiAgICAgICAgICBpZighdHJhaW5OYW1lcyB8fCB0cmFpbk5hbWVzLmZpbHRlcih0bj0+dHJhaW5bM10ubWF0Y2gobmV3IFJlZ0V4cCh0bikpICE9IG51bGwpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRyYWlucy5wdXNoKHRyYWluKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJhaW5zO1xuICAgICAgfSlcbiAgICAgIC50b1Byb21pc2UoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cbiAgICpcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXG4gICAqIEBwYXJhbSBwYXNzU3RhdGlvbk5hbWUg6YCU57uP56uZXG4gICAqIEBwYXJhbSB0cmFpbk5hbWVzIOWIl+i9plxuICAgKiBAcGFyYW0gZiDovabmrKHov4fmu6TmnaHku7ZcbiAgICogQHBhcmFtIHQg5pe26Ze06L+H5ruk5p2h5Lu2XG4gICAqXG4gICAqIEByZXR1cm4gdm9pZFxuICAgKi9cbiAgcHVibGljIGxlZnRUaWNrZXRzKFt0cmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGFzc1N0YXRpb25OYW1lXSwge2ZpbHRlcixmLHRpbWUsdCxvcmRlcmJ5LG99KSB7XG4gICAgbGV0IGZyb21TdGF0aW9uOiBzdHJpbmcgPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKGZyb21TdGF0aW9uTmFtZSk7XG4gICAgbGV0IHRvU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZSh0b1N0YXRpb25OYW1lKTtcbiAgICBsZXQgcGFzc1N0YXRpb246IHN0cmluZyA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUocGFzc1N0YXRpb25OYW1lKTtcblxuICAgIGxldCBwbGFuVHJhaW5zOiBBcnJheTxzdHJpbmc+fG51bGwgPVxuICAgICAgdHlwZW9mIGYgPT0gXCJzdHJpbmdcIiA/IGYuc3BsaXQoJywnKToodHlwZW9mIGZpbHRlciA9PSBcInN0cmluZ1wiID8gZmlsdGVyLnNwbGl0KCcsJyk6bnVsbCk7XG4gICAgbGV0IHBsYW5UaW1lczogQXJyYXk8c3RyaW5nPnxudWxsID1cbiAgICAgIHR5cGVvZiB0ID09IFwic3RyaW5nXCIgPyB0LnNwbGl0KCcsJyk6KHR5cGVvZiB0aW1lID09IFwic3RyaW5nXCIgPyB0aW1lLnNwbGl0KCcsJyk6bnVsbCk7XG4gICAgbGV0IHBsYW5PcmRlckJ5OiBBcnJheTxzdHJpbmc+fG51bGwgPVxuICAgICAgdHlwZW9mIG8gPT0gXCJzdHJpbmdcIiA/IG8uc3BsaXQoJywnKToodHlwZW9mIG9yZGVyYnkgPT0gXCJzdHJpbmdcIiA/IG9yZGVyYnkuc3BsaXQoJywnKTpudWxsKTtcblxuICAgIGlmKHBsYW5PcmRlckJ5KSB7XG4gICAgICBwbGFuT3JkZXJCeSA9IHBsYW5PcmRlckJ5Lm1hcCgoZmllbGROYW1lOnN0cmluZykgPT4ge1xuICAgICAgICBpZihmaWVsZE5hbWVbMF0gPT09ICctJyB8fCBmaWVsZE5hbWVbMF0gPT09ICcrJykge1xuICAgICAgICAgIHJldHVybiBmaWVsZE5hbWVbMF0rdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihmaWVsZE5hbWUuc3Vic3RyaW5nKDEpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihmaWVsZE5hbWUpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3Qgc2pRdWVyeUxlZnRUaWNrZXRzID0gbmV3IFJ4LlN1YmplY3Q8T3JkZXI+KCk7XG5cbiAgICB0aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0RmxvdyhzalF1ZXJ5TGVmdFRpY2tldHMpXG4gICAgICAuc3Vic2NyaWJlKChvcmRlcjogT3JkZXIpID0+IHtcbiAgICAgICAgbGV0IHRyYWlucyA9IHRoaXMucmVuZGVyVHJhaW5MaXN0VGl0bGUob3JkZXIudHJhaW5zKTtcbiAgICAgICAgaWYodHJhaW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOayoeacieespuWQiOadoeS7tueahOi9puasoX1gKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVuZGVyTGVmdFRpY2tldHModHJhaW5zKTtcbiAgICAgIH0pO1xuXG4gICAgc2pRdWVyeUxlZnRUaWNrZXRzLm5leHQoe1xuICAgICAgdHJhaW5EYXRlOiB0cmFpbkRhdGVcbiAgICAgICxmcm9tU3RhdGlvbjogZnJvbVN0YXRpb25cbiAgICAgICx0b1N0YXRpb246IHRvU3RhdGlvblxuICAgICAgLHBhc3NTdGF0aW9uOiBwYXNzU3RhdGlvblxuICAgICAgLHBsYW5UcmFpbnM6IHBsYW5UcmFpbnNcbiAgICAgICxwbGFuVGltZXM6IHBsYW5UaW1lc1xuICAgICAgLHBsYW5PcmRlckJ5OiBwbGFuT3JkZXJCeVxuICAgICAgLHNlYXRDbGFzc2VzOiBbXVxuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJUcmFpbkxpc3RUaXRsZSh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KTogQXJyYXk8QXJyYXk8c3RyaW5nPj4ge1xuICAgIHZhciB0aXRsZSA9IHRoaXMuVElDS0VUX1RJVExFLm1hcCh0PT5jaGFsa2B7Ymx1ZSAke3R9fWApO1xuXG4gICAgdHJhaW5zLmZvckVhY2goKHRyYWluLCBpbmRleCk9PiB7XG4gICAgICBpZihpbmRleCAlIDMwID09PSAwKSB7XG4gICAgICAgIHRyYWlucy5zcGxpY2UoaW5kZXgsIDAsIHRpdGxlKTtcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiB0cmFpbnM7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckxlZnRUaWNrZXRzKHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4pIHtcbiAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0cmFpbnMsIHtcbiAgICAgIGNvbHVtblNwbGl0dGVyOiAnfCcsXG4gICAgICBjb2x1bW5zOiBbXCIzXCIsIFwiNFwiLCBcIjVcIiwgXCI2XCIsIFwiN1wiLCBcIjhcIiwgXCI5XCIsIFwiMTBcIiwgXCIxMVwiLCBcIjIwXCIsIFwiMjFcIiwgXCIyMlwiLCBcIjIzXCIsIFwiMjRcIiwgXCIyNVwiLFxuICAgICAgICAgICAgICAgIFwiMjZcIiwgXCIyN1wiLCBcIjI4XCIsIFwiMjlcIiwgXCIzMFwiLCBcIjMxXCIsIFwiMzJcIl1cbiAgICB9KVxuXG4gICAgY29uc29sZS5sb2coY29sdW1ucyk7XG4gIH1cblxuICBwdWJsaWMgbXlPcmRlck5vQ29tcGxldGVSZXBvcnQoKSB7XG4gICAgdmFyIHN1YmplY3RPcmRlck5vQ29tcGxldGUgPSBuZXcgUnguU3ViamVjdCgpO1xuXG4gICAgc3ViamVjdE9yZGVyTm9Db21wbGV0ZS5zdWJzY3JpYmUoKCk9PiB7XG4gICAgICB0aGlzLmluaXROb0NvbXBsZXRlKCkudGhlbigoKT0+IHtcbiAgICAgICAgdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkudGhlbih4PT4ge1xuICAgICAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkoeCwge1xuICAgICAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJyB8ICdcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcbiAgICAgICAgICB9LCBlcnJvcj0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgc2V0VGltZW91dCgoKT0+IHN1YmplY3RPcmRlck5vQ29tcGxldGUubmV4dCgpLCAxMDAwKVxuICAgICAgICAgIH0pO1xuICAgICAgfSwgZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XG4gICAgfSk7XG5cbiAgICBzdWJqZWN0T3JkZXJOb0NvbXBsZXRlLm5leHQoKTtcbiAgfVxuXG4gIHB1YmxpYyBsb2dpbkluaXQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sb2dpbi9pbml0XCI7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgIGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmU6IG9iamVjdCwgcmVqZWN0OiBvYmplY3QpPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiByZWplY3QoZXJyb3IudG9TdHJpbmcoKSk7XG5cbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q2FwdGNoYSgpOiBQcm9taXNlIHtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcbiAgICAgICAgICBcIm1vZHVsZVwiOiBcImxvZ2luXCIsXG4gICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCIsXG4gICAgICAgICAgXCIwLjE3MjMxODcyNzAzMzg5MDYyXCI6XCJcIlxuICAgICAgfTtcblxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShkYXRhLCBudWxsLCBudWxsKVxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtaW1hZ2U/XCIrcGFyYW07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVzdGlvbkNhcHRjaGEoKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZTogRnVuY3Rpb24sIHJlamVjdDogRnVuY3Rpb24pPT4ge1xuICAgICAgcmwucXVlc3Rpb24oY2hhbGtge3JlZC5ib2xkIOivt+i+k+WFpemqjOivgeeggX06YCwgKHBvc2l0aW9uU3RyKSA9PiB7XG4gICAgICAgIHJsLmNsb3NlKCk7XG5cbiAgICAgICAgaWYodHlwZW9mIHBvc2l0aW9uU3RyID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICBsZXQgcG9zaXRpb25zOiBBcnJheTxzdHJpbmc+ID0gW107XG4gICAgICAgICAgcG9zaXRpb25TdHIuc3BsaXQoJywnKS5mb3JFYWNoKGVsPT5wb3NpdGlvbnM9cG9zaXRpb25zLmNvbmNhdChlbC5zcGxpdCgnICcpKSk7XG4gICAgICAgICAgcmVzb2x2ZShwb3NpdGlvbnMubWFwKChwb3NpdGlvbjogc3RyaW5nKT0+IHtcbiAgICAgICAgICAgIHN3aXRjaChwb3NpdGlvbikge1xuICAgICAgICAgICAgICBjYXNlIFwiMVwiOlxuICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDQ1XCI7XG4gICAgICAgICAgICAgIGNhc2UgXCIyXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMTEwLDQ1XCI7XG4gICAgICAgICAgICAgIGNhc2UgXCIzXCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMTgwLDQ1XCI7XG4gICAgICAgICAgICAgIGNhc2UgXCI0XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDQ1XCI7XG4gICAgICAgICAgICAgIGNhc2UgXCI1XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiNDAsMTEwXCI7XG4gICAgICAgICAgICAgIGNhc2UgXCI2XCI6XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMTEwLDExMFwiO1xuICAgICAgICAgICAgICBjYXNlIFwiN1wiOlxuICAgICAgICAgICAgICAgIHJldHVybiBcIjE4MCwxMTBcIjtcbiAgICAgICAgICAgICAgY2FzZSBcIjhcIjpcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIyNTAsMTEwXCI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSkuam9pbignLCcpKTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJlamVjdChcIui+k+WFpeagvOW8j+mUmeivr1wiKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrQ2FwdGNoYSgpOiBQcm9taXNlIHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWNoZWNrXCI7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKSA9PiB7XG4gICAgICB0aGlzLnF1ZXN0aW9uQ2FwdGNoYSgpLnRoZW4ocG9zaXRpb25zPT4ge1xuICAgICAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICAgIFwiYW5zd2VyXCI6IHBvc2l0aW9ucyxcbiAgICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcbiAgICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiXG4gICAgICAgICAgfTtcblxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICB1cmw6IHVybFxuICAgICAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAsZm9ybTogZGF0YVxuICAgICAgICB9O1xuXG4gICAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KSA9PiB7XG4gICAgICAgICAgaWYoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcbiAgICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gNCkge1xuICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKCdlcnJvcjogJysgcmVzcG9uc2Uuc3RhdHVzQ29kZSk7XG4gICAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSwgZXJyb3I9PntcbiAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvcik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgdXNlckF1dGhlbnRpY2F0ZSgpOiBQcm9taXNlIHtcbiAgICAvLyDlj5HpgIHnmbvlvZXkv6Hmga9cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcbiAgICAgICAgICAsXCJ1c2VybmFtZVwiOiB0aGlzLnVzZXJOYW1lXG4gICAgICAgICAgLFwicGFzc3dvcmRcIjogdGhpcy51c2VyUGFzc3dvcmRcbiAgICAgICAgfTtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvbG9naW5cIjtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgICBpZihlcnJvcikgcmV0dXJuIHJlamVjdChlcnJvcik7XG5cbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keS5yZXN1bHRfbWVzc2FnZSk7XG4gICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAyKSB7XG4gICAgICAgICAgICB0aHJvdyBib2R5LnJlc3VsdF9tZXNzYWdlO1xuICAgICAgICAgIH1lbHNlIGlmKGJvZHkucmVzdWx0X2NvZGUgIT0gMCkge1xuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xuICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgIHJlc29sdmUoYm9keS51YW10ayk7XG4gICAgICAgICAgfVxuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldE5ld0FwcFRva2VuKCk6IFByb21pc2Uge1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxuICAgICAgfTtcblxuICAgIHZhciBvcHRpb25zID17XG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9hdXRoL3VhbXRrXCJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XG5cbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5KTtcbiAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcbiAgICAgICAgICAgIHJlc29sdmUoYm9keS5uZXdhcHB0ayk7XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJlamVjdChyZXNwb25zZSlcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldE15MTIzMDYoKTogUHJvbWlzZSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KHtcbiAgICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vaW5kZXgvaW5pdE15MTIzMDZcIlxuICAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICAsbWV0aG9kOiBcIkdFVFwifSxcbiAgICAgICAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coXCJHb3QgbXkgMTIzMDZcIik7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgICAgICAgfVxuICAgICAgICByZWplY3QoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja0F1dGhlbnRpY2F0aW9uKGNvb2tpZXM6IG9iamVjdCkge1xuICAgIHZhciB1YW10ayA9IFwiXCIsIHRrID0gXCJcIjtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoY29va2llc1tpXS5rZXkgPT0gXCJ1YW10a1wiKSB7XG4gICAgICAgIHVhbXRrID0gY29va2llc1tpXS52YWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYoY29va2llc1tpXS5rZXkgPT0gXCJ0a1wiKSB7XG4gICAgICAgIHRrID0gY29va2llc1tpXS52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHVhbXRrOiB1YW10ayxcbiAgICAgIHRrOiB0a1xuICAgIH07XG4gIH1cblxuICAvKipcbiAgICpcbiAgICovXG4gIHByaXZhdGUgZ2V0QXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZykge1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwidGtcIjogbmV3YXBwdGtcbiAgICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi91YW1hdXRoY2xpZW50XCJcbiAgICAgICxoZWFkZXJzOiB7XG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDYuMTsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4xNyAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8yNC4wLjEzMTIuNjAgU2FmYXJpLzUzNy4xN1wiXG4gICAgICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxuICAgICAgICAsJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG4gICAgICB9XG4gICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgIHdpbnN0b24uZGVidWcoYm9keS5yZXN1bHRfbWVzc2FnZSk7XG4gICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XG4gICAgICAgICAgICByZXNvbHZlKGJvZHkuYXBwdGspO1xuICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgIHJlamVjdChib2R5KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSlcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGxlZnRUaWNrZXRJbml0KCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCI7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gICAgICB0aGlzLnJlcXVlc3QodXJsLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c1RleHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHF1ZXJ5TGVmdFRpY2tldCh7dHJhaW5EYXRlLCBmcm9tU3RhdGlvbiwgdG9TdGF0aW9ufSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHZhciBxdWVyeSA9IHtcbiAgICAgIFwibGVmdFRpY2tldERUTy50cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxuICAgICAgLFwibGVmdFRpY2tldERUTy5mcm9tX3N0YXRpb25cIjogZnJvbVN0YXRpb25cbiAgICAgICxcImxlZnRUaWNrZXREVE8udG9fc3RhdGlvblwiOiB0b1N0YXRpb25cbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXG4gICAgfVxuXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9xdWVyeVo/XCIrcGFyYW07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gICAgICB0aGlzLnJlcXVlc3QodXJsLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHtcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGVycm9yLnRvU3RyaW5nKCkpO1xuICAgICAgICB9XG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgICAgIGlmKCFib2R5KSB7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihib2R5LmluZGV4T2YoXCLor7fmgqjph43or5XkuIDkuItcIikgPiAwKSB7XG4gICAgICAgICAgICByZWplY3QoXCLns7vnu5/nuYHlv5khXCIpO1xuICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShib2R5KS5kYXRhO1xuICAgICAgICAgICAgfWNhdGNoKGVycikge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhib2R5KTtcbiAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvbHZlKGRhdGEpO1xuICAgICAgICAgIH1cbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xuICAgICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrVXNlcigpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2NoZWNrVXNlclwiO1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICAgIGlmKGVycm9yKSByZXR1cm4gcmVqZWN0KGVycm9yKTtcblxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KVxuICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xuICAgICAgICB9XG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBzdWJtaXRPcmRlclJlcXVlc3Qoe3RyYWluU2VjcmV0U3RyLCB0cmFpbkRhdGUsIGJhY2tUcmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZX0pOiBQcm9taXNlPG9iamVjdD4gIHtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9zdWJtaXRPcmRlclJlcXVlc3RcIjtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJzZWNyZXRTdHJcIjogcXVlcnlzdHJpbmcudW5lc2NhcGUodHJhaW5TZWNyZXRTdHIpXG4gICAgICAsXCJ0cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxuICAgICAgLFwiYmFja190cmFpbl9kYXRlXCI6IGJhY2tUcmFpbkRhdGVcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXG4gICAgICAsXCJxdWVyeV9mcm9tX3N0YXRpb25fbmFtZVwiOiBmcm9tU3RhdGlvbk5hbWVcbiAgICAgICxcInF1ZXJ5X3RvX3N0YXRpb25fbmFtZVwiOiB0b1N0YXRpb25OYW1lXG4gICAgICAsXCJ1bmRlZmluZWRcIjpcIlwiXG4gICAgfTtcblxuICAgIC8vIHVybCA9IHVybCArIFwic2VjcmV0U3RyPVwiK3NlY3JldFN0citcIiZ0cmFpbl9kYXRlPTIwMTgtMDEtMzEmYmFja190cmFpbl9kYXRlPTIwMTgtMDEtMzAmdG91cl9mbGFnPWRjJnB1cnBvc2VfY29kZXM9QURVTFQmcXVlcnlfZnJvbV9zdGF0aW9uX25hbWU95LiK5rW3JnF1ZXJ5X3RvX3N0YXRpb25fbmFtZT3lvpDlt57kuJwmdW5kZWZpbmVkXCI7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcbiAgICAgICAgfVxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlybVBhc3NlbmdlckluaXREYygpOiBQcm9taXNlIHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXG4gICAgICAgICxcIlVwZ3JhZGUtSW5zZWN1cmUtUmVxdWVzdHNcIjoxXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XG5cbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHRoaXMuU1lTVEVNX0JVU1NZKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYoYm9keSkge1xuICAgICAgICAgICAgLy8gR2V0IFJlcGVhdCBTdWJtaXQgVG9rZW5cbiAgICAgICAgICAgIHZhciB0b2tlbiA9IGJvZHkubWF0Y2goL3ZhciBnbG9iYWxSZXBlYXRTdWJtaXRUb2tlbiA9ICcoLio/KSc7Lyk7XG4gICAgICAgICAgICB2YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0gPSBib2R5Lm1hdGNoKC92YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm09KC4qPyk7Lyk7XG4gICAgICAgICAgICB2YXIgb3JkZXJSZXF1ZXN0RFRPID0gYm9keS5tYXRjaCgvdmFyIG9yZGVyUmVxdWVzdERUTz0oLio/KTsvKTtcbiAgICAgICAgICAgIGlmKHRva2VuKSB7XG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHtcbiAgICAgICAgICAgICAgICB0b2tlbjogdG9rZW5bMV1cbiAgICAgICAgICAgICAgICAsdGlja2V0SW5mbzogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0mJkpTT04ucGFyc2UodGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm1bMV0ucmVwbGFjZSgvJy9nLCBcIlxcXCJcIikpXG4gICAgICAgICAgICAgICAgLG9yZGVyUmVxdWVzdDogb3JkZXJSZXF1ZXN0RFRPJiZKU09OLnBhcnNlKG9yZGVyUmVxdWVzdERUT1sxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xuICAgICAgICB9XG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJzKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlPG9iamVjdD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPG9iamVjdD4oKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKT0+IHtcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gIH1cblxuICAvKiBzZWF0IHR5cGVcbiAg4oCY6L2v5Y2n4oCZID0+IOKAmDTigJksXG4gIOKAmOS6jOetieW6p+KAmSA9PiDigJhP4oCZLFxuICDigJjkuIDnrYnluqfigJkgPT4g4oCYTeKAmSxcbiAg4oCY56Gs5bqn4oCZID0+IOKAmDHigJksXG4gICAqL1xuICBwcml2YXRlIGdldFBhc3NlbmdlclRpY2tldHMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy/luqfkvY3nsbvlnossMCznpajnsbvlnoso5oiQ5Lq6L+WEv+erpSksbmFtZSzouqvku73nsbvlnoso6Lqr5Lu96K+BL+WGm+WumOivgS4uLi4pLOi6q+S7veivgSznlLXor53lj7fnoIEs5L+d5a2Y54q25oCBXG4gICAgICAgIHZhciB0aWNrZXQgPSAvKnBhc3Nlbmdlci5zZWF0X3R5cGUqLyBcIk9cIiArXG4gICAgICAgICAgICAgICAgXCIsMCxcIiArXG4gICAgICAgICAgICAgICAgLypsaW1pdF90aWNrZXRzW2FBXS50aWNrZXRfdHlwZSovXCIxXCIgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgKHBhc3Nlbmdlci5waG9uZV9ubyB8fCBcIlwiICkgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCJOXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIik7XG4gIH1cblxuICBwcml2YXRlIGdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy9uYW1lLOi6q+S7veexu+Weiyzouqvku73or4EsMV9cbiAgICAgICAgdmFyIHRpY2tldCA9XG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCIxXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcykge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jaGVja09yZGVySW5mb1wiO1xuXG4gICAgdmFyIHBhc3NlbmdlclRpY2tldFN0ciA9IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiY2FuY2VsX2ZsYWdcIjogMlxuICAgICAgLFwiYmVkX2xldmVsX29yZGVyX251bVwiOiBcIjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMFwiXG4gICAgICAsXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogcGFzc2VuZ2VyVGlja2V0U3RyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxuICAgICAgLFwidG91cl9mbGFnXCI6IFwiZGNcIlxuICAgICAgLFwicmFuZENvZGVcIjogXCJcIlxuICAgICAgLFwid2hhdHNTZWxlY3RcIjoxXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiBzdWJtaXRUb2tlblxuICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKT0+IHtcbiAgICAgIGlmKCFwYXNzZW5nZXJUaWNrZXRTdHIpIHtcbiAgICAgICAgdGhyb3cgXCLmsqHmnInnm7jlhbPogZTns7vkurpcIjtcbiAgICAgIH1cbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgICAgIHVybDogJy9sZWZ0VGlja2V0L2luaXQnLFxuICAgICAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXG4gICAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbICfns7vnu5/lv5nvvIzor7fnqI3lkI7ph43or5UnIF0sXG4gICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZihyZXN1bHQuc3RhdHVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiByZWplY3QocmVzdWx0Lm1lc3NhZ2VzWzBdKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gIH1cblxuICBwcml2YXRlIGdldFF1ZXVlQ291bnQodG9rZW4sIG9yZGVyUmVxdWVzdERUTywgdGlja2V0SW5mbykge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRRdWV1ZUNvdW50XCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcInRyYWluX2RhdGVcIjogbmV3IERhdGUob3JkZXJSZXF1ZXN0RFRPLnRyYWluX2RhdGUudGltZSkudG9TdHJpbmcoKVxuICAgICAgLFwidHJhaW5fbm9cIjogb3JkZXJSZXF1ZXN0RFRPLnRyYWluX25vXG4gICAgICAsXCJzdGF0aW9uVHJhaW5Db2RlXCI6IG9yZGVyUmVxdWVzdERUTy5zdGF0aW9uX3RyYWluX2NvZGVcbiAgICAgICxcInNlYXRUeXBlXCI6MVxuICAgICAgLFwiZnJvbVN0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8uZnJvbV9zdGF0aW9uX3RlbGVjb2RlXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxuICAgICAgLFwibGVmdFRpY2tldFwiOiB0aWNrZXRJbmZvLnF1ZXJ5TGVmdFRpY2tldFJlcXVlc3REVE8ueXBJbmZvRGV0YWlsXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiMDBcIlxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XG5cbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xuICAgICAgICAgICAgLypcbiAgICAgICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXG4gICAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbICfns7vnu5/nuYHlv5nvvIzor7fnqI3lkI7ph43or5XvvIEnIF0sXG4gICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gSlNPTi5wYXJzZShib2R5KTtcbiAgICAgICAgICAgIGlmKHJlc3VsdC5zdGF0dXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChyZXN1bHQubWVzc2FnZXNbMF0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pXG4gICAgfSlcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UGFzc0NvZGVOZXcoKSB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9nZXRQYXNzQ29kZU5ldz9tb2R1bGU9cGFzc2VuZ2VyJnJhbmQ9cmFuZHAmXCIrTWF0aC5yYW5kb20oMCwxKTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUhPT0yMDApIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tSYW5kQ29kZUFuc3luKCkge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvY2hlY2tSYW5kQ29kZUFuc3luXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICByYW5kQ29kZTogXCJcIixcbiAgICAgIHJhbmQ6IFwicmFuZHBcIlxuICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXG4gICAgICBvdXRwdXQ6IHByb2Nlc3Muc3Rkb3V0XG4gICAgfSk7XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gICAgICBybC5xdWVzdGlvbignUGxlYXNlIGlucHV0IHJhbmRjb2RlOicsIChwb3NpdGlvbnMpID0+IHtcbiAgICAgICAgcmwuY2xvc2UoKTtcblxuICAgICAgICBvcHRpb25zLmZvcm0ucmFuZENvZGUgPSBwb3NpdGlvbnM7XG4gICAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XG5cbiAgICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoSlNPTi5wYXJzZShib2R5KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xuICAgICAgICB9KVxuICAgICAgfSk7XG4gICAgfSlcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlybVNpbmdsZUZvclF1ZXVlKHRva2VuLCBwYXNzZW5nZXJzLCB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSwgcGxhblBlcG9sZXMpIHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvY29uZmlybVNpbmdsZUZvclF1ZXVlXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcInBhc3NlbmdlclRpY2tldFN0clwiOiB0aGlzLmdldFBhc3NlbmdlclRpY2tldHMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxuICAgICAgLFwicmFuZENvZGVcIjpcIlwiXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnB1cnBvc2VfY29kZXNcbiAgICAgICxcImtleV9jaGVja19pc0NoYW5nZVwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5rZXlfY2hlY2tfaXNDaGFuZ2VcbiAgICAgICxcImxlZnRUaWNrZXRTdHJcIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0ubGVmdFRpY2tldFN0clxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0udHJhaW5fbG9jYXRpb25cbiAgICAgICxcImNob29zZV9zZWF0c1wiOiBcIlwiXG4gICAgICAsXCJzZWF0RGV0YWlsVHlwZVwiOiBcIjAwMFwiXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOiAxXG4gICAgICAsXCJyb29tVHlwZVwiOiBcIjAwXCJcbiAgICAgICxcImR3QWxsXCI6IFwiTlwiXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxuICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcblxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XG4gICAgICB9KVxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbikge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9xdWVyeU9yZGVyV2FpdFRpbWVcIjtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybToge1xuICAgICAgICBcInJhbmRvbVwiOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxuICAgICAgICAsXCJ0b3VyRmxhZ1wiOiBcImRjXCJcbiAgICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxuICAgICAgfVxuICAgICAgLGpzb246IHRydWVcbiAgICB9O1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlOiBGdW5jdGlvbiwgcmVqZWN0OiBGdW5jdGlvbik9PiB7XG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICAgIGlmKGVycm9yKSByZWplY3QoZXJyb3IpO1xuXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xuICAgICAgICB9XG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpIHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvY2FuY2VsUXVldWVOb0NvbXBsZXRlTXlPcmRlclwiO1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgdG91ckZsYWc6IFwiZGNcIlxuICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICAgICxqc29uOiB0cnVlXG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHRoaXMuU1lTVEVNX0JVU1NZKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5KTtcbiAgICAgICAgfVxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaW5pdE5vQ29tcGxldGUoKSB7XG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCI7XG4gICAgbGV0IG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybToge1xuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KVxuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBteU9yZGVyTm9Db21wbGV0ZSgpIHtcbiAgICBsZXQgc2pPcmRlck5vQ29tcGxldGUgPSBuZXcgUnguU3ViamVjdCgpO1xuICAgIHNqT3JkZXJOb0NvbXBsZXRlLm1lcmdlTWFwKCgpPT4gdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXG4gICAgICAuc3Vic2NyaWJlKCh4KT0+e1xuICAgICAgICAvKlxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIGRhdGE6IHsgb3JkZXJEQkxpc3Q6IFsgW09iamVjdF0gXSwgdG9fcGFnZTogJ2RiJyB9LFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgKi9cbiAgICAgICAgIGlmKCF4LmRhdGEpIHtcbiAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7eWVsbG93IOayoeacieacquWujOaIkOiuouWNlX1gKVxuICAgICAgICAgICByZXR1cm47XG4gICAgICAgICB9XG4gICAgICAgIGxldCB0aWNrZXRzID0gW107XG4gICAgICAgIGlmKHguZGF0YS5vcmRlckNhY2hlRFRPKSB7XG4gICAgICAgICAgbGV0IG9yZGVyQ2FjaGUgPSB4LmRhdGEub3JkZXJDYWNoZURUTztcbiAgICAgICAgICBvcmRlckNhY2hlLnRpY2tldHMuZm9yRWFjaCh0aWNrZXQ9PiB7XG4gICAgICAgICAgICB0aWNrZXRzLnB1c2goe1xuICAgICAgICAgICAgICBcIuaOkumYn+WPt1wiOiBvcmRlckNhY2hlLnF1ZXVlTmFtZSxcbiAgICAgICAgICAgICAgXCLnrYnlvoXml7bpl7RcIjogb3JkZXJDYWNoZS53YWl0VGltZSxcbiAgICAgICAgICAgICAgXCLnrYnlvoXkurrmlbBcIjogb3JkZXJDYWNoZS53YWl0Q291bnQsXG4gICAgICAgICAgICAgIFwi5L2Z56Wo5pWwXCI6IG9yZGVyQ2FjaGUudGlja2V0Q291bnQsXG4gICAgICAgICAgICAgIFwi5LmY6L2m5pel5pyfXCI6IG9yZGVyQ2FjaGUudHJhaW5EYXRlLnNsaWNlKDAsMTApLFxuICAgICAgICAgICAgICBcIui9puasoVwiOiBvcmRlckNhY2hlLnN0YXRpb25UcmFpbkNvZGUsXG4gICAgICAgICAgICAgIFwi5Ye65Y+R56uZXCI6IG9yZGVyQ2FjaGUuZnJvbVN0YXRpb25OYW1lLFxuICAgICAgICAgICAgICBcIuWIsOi+vuermVwiOiBvcmRlckNhY2hlLnRvU3RhdGlvbk5hbWUsXG4gICAgICAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0VHlwZU5hbWUsXG4gICAgICAgICAgICAgIFwi5LmY6L2m5Lq6XCI6IHRpY2tldC5wYXNzZW5nZXJOYW1lXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcblxuICAgICAgICB9ZWxzZSBpZih4LmRhdGEub3JkZXJEQkxpc3Qpe1xuXG4gICAgICAgICAgeC5kYXRhLm9yZGVyREJMaXN0LmZvckVhY2gob3JkZXI9PiB7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhjaGFsa2DorqLljZXlj7cge3llbGxvdy5ib2xkICR7b3JkZXIuc2VxdWVuY2Vfbm99fWApXG4gICAgICAgICAgICBvcmRlci50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xuICAgICAgICAgICAgICB0aWNrZXRzLnB1c2goe1xuICAgICAgICAgICAgICAgIFwi6K6i5Y2V5Y+3XCI6IHRpY2tldC5zZXF1ZW5jZV9ubyxcbiAgICAgICAgICAgICAgICAvLyBcIuiuouelqOWPt1wiOiB0aWNrZXQudGlja2V0X25vLFxuICAgICAgICAgICAgICAgIFwi5LmY6L2m5pel5pyfXCI6IGNoYWxrYHt5ZWxsb3cuYm9sZCAke3RpY2tldC50cmFpbl9kYXRlLnNsaWNlKDAsMTApfX1gLFxuICAgICAgICAgICAgICAgIC8vIFwi5LiL5Y2V5pe26Ze0XCI6IHRpY2tldC5yZXNlcnZlX3RpbWUsXG4gICAgICAgICAgICAgICAgXCLku5jmrL7miKroh7Pml7bpl7RcIjogY2hhbGtge3JlZC5ib2xkICR7dGlja2V0LnBheV9saW1pdF90aW1lfX1gLFxuICAgICAgICAgICAgICAgIFwi6YeR6aKdXCI6IGNoYWxrYHt5ZWxsb3cuYm9sZCAke3RpY2tldC50aWNrZXRfcHJpY2UvMTAwfX1gLFxuICAgICAgICAgICAgICAgIFwi54q25oCBXCI6IGNoYWxrYHt5ZWxsb3cuYm9sZCAke3RpY2tldC50aWNrZXRfc3RhdHVzX25hbWV9fWAsXG4gICAgICAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3NlbmdlckRUTy5wYXNzZW5nZXJfbmFtZSxcbiAgICAgICAgICAgICAgICBcIui9puasoVwiOiB0aWNrZXQuc3RhdGlvblRyYWluRFRPLnN0YXRpb25fdHJhaW5fY29kZSxcbiAgICAgICAgICAgICAgICBcIuWHuuWPkeermVwiOiB0aWNrZXQuc3RhdGlvblRyYWluRFRPLmZyb21fc3RhdGlvbl9uYW1lLFxuICAgICAgICAgICAgICAgIFwi5Yiw6L6+56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8udG9fc3RhdGlvbl9uYW1lLFxuICAgICAgICAgICAgICAgIFwi5bqn5L2NXCI6IHRpY2tldC5zZWF0X25hbWUsXG4gICAgICAgICAgICAgICAgXCLluqfkvY3nrYnnuqdcIjogdGlja2V0LnNlYXRfdHlwZV9uYW1lLFxuICAgICAgICAgICAgICAgIFwi5LmY6L2m5Lq657G75Z6LXCI6IHRpY2tldC50aWNrZXRfdHlwZV9uYW1lXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0aWNrZXRzLCB7XG4gICAgICAgICAgY29sdW1uU3BsaXR0ZXI6ICd8J1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcbiAgICAgIH0sIGVycj0+Y29uc29sZS5lcnJvcign5rKh5pyJ5pyq5a6M5oiQ6K6i5Y2VJykpO1xuXG4gICAgbGV0IHNqTCA9IG5ldyBSeC5TdWJqZWN0KCk7XG4gICAgdGhpcy5idWlsZExvZ2luRmxvdyhzakwpXG4gICAgICAuc3Vic2NyaWJlKCgpPT5zak9yZGVyTm9Db21wbGV0ZS5uZXh0KCkpXG5cbiAgICBzakwubmV4dCgpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkge1xuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9xdWVyeU15T3JkZXJOb0NvbXBsZXRlXCI7XG4gICAgbGV0IG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybToge1xuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpXG4gICAgICAgICAgfVxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keS5tZXNzYWdlcyk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gIDxkaXYgY2xhc3M9XCJ0LWJ0blwiPlxue3tpZiBwYXlfZmxhZz09J1knfX1cbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgaWQ9XCJjb250aW51ZVBheU5vTXlDb21wbGV0ZVwiIG9uY2xpY2s9XCJjb250aXVlUGF5Tm9Db21wbGV0ZU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywncGF5JylcIiAgY2xhc3M9XCJidG45MnNcIj7nu6fnu63mlK/ku5g8L2E+PC9kaXY+XG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIG9uY2xpY2s9XCJjYW5jZWxNeU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywnY2FuY2VsX29yZGVyJylcIiBpZD1cImNhbmNlbF9idXR0b25fcGF5XCIgY2xhc3M9XCJidG45MlwiPuWPlua2iOiuouWNlTwvYT48L2Rpdj5cbnt7L2lmfX1cbnt7aWYgcGF5X3Jlc2lnbl9mbGFnPT0nWSd9fVxuICAgICAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBpZD1cImNvbnRpbnVlUGF5Tm9NeUNvbXBsZXRlXCIgb25jbGljaz1cImNvbnRpdWVQYXlOb0NvbXBsZXRlT3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdyZXNpZ24nKTtcIiAgY2xhc3M9XCJidG45MnNcIj7nu6fnu63mlK/ku5g8L2E+PC9kaXY+XG5cdCAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBvbmNsaWNrPVwiY2FuY2VsTXlPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ2NhbmNlbF9yZXNpZ24nKVwiIGNsYXNzPVwiYnRuOTJcIj7lj5bmtojorqLljZU8L2E+PC9kaXY+XG57ey9pZn19XG5cbiAgICAgICAgPC9kaXY+XG4gICovXG4gIHByaXZhdGUgY2FuY2VsTm9Db21wbGV0ZU15T3JkZXIoc2VxdWVuY2VObzogc3RyaW5nLCBjYW5jZWxJZDogc3RyaW5nID0gJ2NhbmNlbF9vcmRlcicpIHtcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvY2FuY2VsTm9Db21wbGV0ZU15T3JkZXJcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwic2VxdWVuY2Vfbm9cIjogc2VxdWVuY2VObyxcbiAgXHRcdFx0XCJjYW5jZWxfZmxhZ1wiOiBjYW5jZWxJZCxcbiAgICAgICAgXCJfanNvbl9hdHRcIjpcIlwiXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE5vQ29tcGxldGVPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJykge1xuICAgIGxldCBzakNhbmNlbE9yZGVyID0gbmV3IFJ4LlN1YmplY3QoKTtcbiAgICB0aGlzLmJ1aWxkTG9naW5GbG93KHNqQ2FuY2VsT3JkZXIpXG4gICAgICAuc3Vic2NyaWJlKCgpPT57XG4gICAgICAgIHRoaXMuY2FuY2VsTm9Db21wbGV0ZU15T3JkZXIoc2VxdWVuY2VObywgY2FuY2VsSWQpXG4gICAgICAgICAgLnRoZW4oYm9keT0+IHtcbiAgICAgICAgICAgIC8vIHtcInZhbGlkYXRlTWVzc2FnZXNTaG93SWRcIjpcIl92YWxpZGF0b3JNZXNzYWdlXCIsXCJzdGF0dXNcIjp0cnVlLFwiaHR0cHN0YXR1c1wiOjIwMCxcImRhdGFcIjp7fSxcIm1lc3NhZ2VzXCI6W10sXCJ2YWxpZGF0ZU1lc3NhZ2VzXCI6e319XG4gICAgICAgICAgICBpZiAoYm9keS5kYXRhLmV4aXN0RXJyb3IgPT0gXCJZXCIpIHtcbiAgXHRcdFx0XHRcdFx0d2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7Ym9keS5kYXRhLmVycm9yTXNnfX1gKTtcbiAgXHRcdFx0XHRcdH0gZWxzZSB7XG4gIFx0XHRcdFx0XHRcdHdpbnN0b24ud2FybihjaGFsa2B7eWVsbG93IOiuouWNlSAke3NlcXVlbmNlTm99IOW3suWPlua2iH1gKTtcbiAgXHRcdFx0XHRcdH1cbiAgICAgICAgICB9LGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7SlNPTi5zdHJpbmdpZnkoZXJyKX19YCkpO1xuICAgICAgfSk7XG5cbiAgICBzakNhbmNlbE9yZGVyLm5leHQoKTtcbiAgfVxufVxuIl19
