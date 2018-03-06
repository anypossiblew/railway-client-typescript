"use strict";
// https://www.lanindex.com/12306%E8%B4%AD%E7%A5%A8%E6%B5%81%E7%A8%8B%E5%85%A8%E8%A7%A3%E6%9E%90/
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
var winston = require("winston");
var FileCookieStore_1 = require("./FileCookieStore");
var Station_1 = require("./Station");
var request = require("request");
var querystring = require("querystring");
var fs = require("fs");
var readline = require("readline");
var process = require("process");
var Rx_1 = __importDefault(require("rxjs/Rx"));
var Observable_1 = require("rxjs/Observable");
require("rxjs/add/observable/bindCallback");
var chalk = require("chalk");
var columnify = require("columnify");
var beeper = require("beeper");
var child_process = require("child_process");
var Order_1 = require("./Order");
var Account = /** @class */ (function () {
    function Account(name, userPassword) {
        this.checkUserTimer = Rx_1.default.Observable.timer(1000 * 60 * 10, 1000 * 60 * 10); // 十分钟之后开始，每十分钟检查一次
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
        this.userName = name;
        this.userPassword = userPassword;
        this.setRequest();
        this.rawRequest = request.defaults({ jar: this.cookiejar });
        this.request = Observable_1.Observable.bindCallback(this.rawRequest, function (error, response, body) {
            if (error)
                throw error;
            if (response.statusCode !== 200)
                throw ['http error', response.statusCode, response.statusMessage].join(' ');
            return body;
        });
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
        // this.request = request.defaults({jar: this.cookiejar});
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
            _this.orders.push(new Order_1.Order(trainDate, backTrainDate, fromStationName, toStationName, passStationName, planTrains, planPepoles, seatClasses));
        });
        return this;
    };
    Account.prototype.submit = function () {
        var _this = this;
        this.observableLoginInit()
            .subscribe(function () {
            _this.buildOrderFlow();
            _this.scptCheckUserTimer =
                _this.checkUserTimer.subscribe(function (i) {
                    _this.observableCheckUser()
                        .subscribe(function () { return winston.debug("Check user done"); });
                });
        });
    };
    Account.prototype.orderWaitTime = function () {
        var _this = this;
        this.observableLoginInit()
            .subscribe(function () {
            _this.obsQueryOrderWaitT(new Order_1.Order())
                .subscribe(function (orderRequest) {
                console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
                _this.destroy();
            }, function (err) { return console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); }, function () {
                _this.destroy();
            });
        }, function (err) { return console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); }, function () {
            _this.destroy();
        });
    };
    Account.prototype.cancelOrderQueue = function () {
        this.cancelQueueNoCompleteOrder()
            .then(function (x) {
            if (x.status && x.data.existError == 'N') {
                console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"], ["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"]))));
            }
            else {
                console.error(x);
            }
        }, function (error) { return console.error(error); });
    };
    Account.prototype.destroy = function () {
        this.scptCheckUserTimer && this.scptCheckUserTimer.unsubscribe();
    };
    Account.prototype.observableCheckCaptcha = function () {
        var _this = this;
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.getCaptcha(); })
            .mergeMap(function () { return _this.checkCaptcha()
            .do(function () {
            // 校验码成功后进行授权认证
            return console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
        }); })
            .retryWhen(function (error$) {
            return error$.do(function () { return console.log(chalk(templateObject_8 || (templateObject_8 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"])))); });
        });
    };
    Account.prototype.observableLogin = function () {
        var _this = this;
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.observableCheckCaptcha(); })
            .mergeMap(function () {
            return _this.userAuthenticate()
                .do(function () { return console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"])))); });
        })
            .retryWhen(function (error$) {
            return error$.mergeMap(function (err) {
                /*
                {"result_message":"密码输入错误。如果输错次数超过4次，用户将被锁定。","result_code":1}
                {"result_message":"验证码校验失败","result_code":"5"}
                */
                if (typeof err.result_code == "undefined") {
                    return Observable_1.Observable.timer(1000);
                }
                return Observable_1.Observable.throw(err);
            });
        })
            .catch(function (err) {
            console.log(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err.result_message));
            return Observable_1.Observable.throw(err);
        });
    };
    Account.prototype.observableNewAppToken = function () {
        var _this = this;
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.getNewAppToken(); })
            .retryWhen(function (error$) {
            return error$.do(function (err) { return winston.error(err); })
                .mergeMap(function (err) {
                return _this.observableLogin();
            });
        });
    };
    Account.prototype.observableAppToken = function (newapptk) {
        var _this = this;
        var newAppToken = newapptk;
        return Observable_1.Observable.create(function (observer) {
            observer.next(newAppToken);
            observer.complete();
        })
            .mergeMap(function (newapptk) { return _this.getAppToken(newapptk); })
            .retryWhen(function (error$) {
            return error$.do(function (err) { return winston.error(err); })
                .mergeMap(function (err) {
                console.log(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"]))));
                winston.debug(err);
                if (err.result_code && err.result_code === 2) {
                    return _this.observableNewAppToken().do(function (newapptk) { return newAppToken = newapptk; });
                }
                else {
                    return Observable_1.Observable.timer(500);
                }
            });
        });
    };
    Account.prototype.observableLoginInit = function () {
        var _this = this;
        // 登录初始化
        return Observable_1.Observable.of(1)
            .mergeMap(function (order) { return _this.loginInit(); })
            .retry(1000)
            .map(function (order) { return _this.checkAuthentication(_this.cookiejar._jar.toJSON().cookies); })
            .mergeMap(function (tokens) {
            if (tokens.tk) {
                return _this.observableAppToken(tokens.tk);
            }
            else if (tokens.uamtk) {
                return _this.observableNewAppToken()
                    .mergeMap(function (newapptk) { return _this.observableAppToken(newapptk); });
            }
            return _this.observableLogin()
                .mergeMap(function () { return _this.observableNewAppToken(); })
                .mergeMap(function (newapptk) { return _this.observableAppToken(newapptk); });
        });
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
    Account.prototype.buildQueryLeftTicketFlow = function (order) {
        var _this = this;
        return Observable_1.Observable.of(order)
            .mergeMap(function (order) {
            return _this.queryLeftTickets(order.trainDate, order.fromStation, order.toStation, order.planTrains)
                .map(function (trains) {
                order.trains = trains;
                return order;
            });
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
    Account.prototype.recursiveQueryLeftTicket = function () {
        var _this = this;
        return Observable_1.Observable.create(function (observer) {
            observer.next(_this.nextOrder());
        })
            .mergeMap(function (order) { return _this.buildQueryLeftTicketFlow(order); })
            .do(function () {
            if (_this.query) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
            }
        })
            .map(function (order) {
            if (order.availableTrains.length > 0) {
                _this.query = false;
                // process.stdout.write(chalk`{yellow 有可购买余票 ${planTrain.toString()}}`);
                order.trainSecretStr = order.availableTrains[0][0];
                return order;
            }
            else {
                _this.query = true;
                throw chalk(templateObject_12 || (templateObject_12 = __makeTemplateObject(["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"], ["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"])), order.fromStationName, order.toStationName, order.passStationName ? '到' + order.passStationName + ' ' : '', order.trainDate);
            }
        })
            .retryWhen(function (error$) { return error$.do(function (err) { return process.stdout.write(err); }).delay(1500); })
            .mergeMap(function (order) { return _this.observableCheckUser().map(function () { return order; }); })
            .switchMap(function (order) {
            return Observable_1.Observable.of(1)
                .mergeMap(function () { return _this.submitOrderRequest(order); })
                .retryWhen(function (error$) {
                return error$.do(function (err) { return winston.error("SubmitOrderRequest error " + err)
                    .delay(500); });
            })
                .map(function (body) { return [order, body]; });
        })
            .map(function (_a) {
            var order = _a[0], body = _a[1];
            if (body.status) {
                winston.debug(chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["{blue Submit Order Request success!}"], ["{blue Submit Order Request success!}"]))));
                return order;
            }
            else {
                // 您还有未处理的订单
                // 该车次暂不办理业务
                winston.error(chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.messages[0]));
                // this.destroy();
                throw chalk(templateObject_15 || (templateObject_15 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.messages[0]);
            }
        })
            .mergeMap(function (order) {
            return _this.confirmPassengerInitDc()
                .retryWhen(function (error$) {
                return error$.mergeMap(function (err) {
                    if (err == _this.SYSTEM_BUSSY) {
                        console.log(err);
                        return Observable_1.Observable.timer(500);
                    }
                    else if (err == _this.SYSTEM_MOVED) {
                        console.log(err);
                        return Observable_1.Observable.timer(500);
                    }
                    return Observable_1.Observable.throw(err);
                });
            })
                .map(function (orderSubmitRequest) { return [order, orderSubmitRequest]; });
        })
            .switchMap(function (_a) {
            var order = _a[0], orderRequest = _a[1];
            winston.debug("confirmPassenger Init Dc success! " + orderRequest.token);
            order.request = orderRequest;
            if (_this.passengers) {
                order.request.passengers = _this.passengers;
                return Observable_1.Observable.of(order);
            }
            else {
                return _this.getPassengers(order.request.token)
                    .retryWhen(function (error$) {
                    return error$.do(function (err) { return winston.error(chalk(templateObject_16 || (templateObject_16 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err)); })
                        .delay(500);
                })
                    .map(function (passengers) {
                    _this.passengers = passengers;
                    order.request.passengers = passengers;
                    return order;
                });
            }
        })
            .switchMap(function (order) {
            return _this.checkOrderInfo(order.request.token, order.request.passengers.data.normal_passengers, order.planPepoles)
                .retryWhen(function (error$) {
                return error$.do(function (err) { return winston.error(err); }).mergeMap(function (err) {
                    if (err == "没有相关联系人") {
                        return Observable_1.Observable.throw(err);
                    }
                    else {
                        return Observable_1.Observable.timer(500);
                    }
                });
            })
                .map(function (body) {
                order.request.orderInfo = body;
                return order;
            });
        })
            .switchMap(function (order) {
            return _this.getQueueCount(order.request.token, order.request.orderRequest, order.request.ticketInfo)
                .map(function (body) {
                winston.debug(body);
                order.request.queueInfo = body;
                return order;
            });
        })
            .switchMap(function (order) {
            // 若 Step 14 中的 "ifShowPassCode" = "Y"，那么多了输入验证码这一步，Post
            if (order.request.orderInfo.data.ifShowPassCode == "Y") {
                return _this.observableGetPassCodeNew(order);
            }
            else {
                return Observable_1.Observable.of(order);
            }
        })
            .switchMap(function (order) {
            return _this.confirmSingleForQueue(order.request.token, order.request.passengers.data.normal_passengers, order.request.ticketInfo, order.planPepoles)
                .retryWhen(function (error$) { return error$.delay(500); })
                .map(function (body) {
                if (body.status && body.data.submitStatus) {
                    console.log(chalk(templateObject_17 || (templateObject_17 = __makeTemplateObject(["{blue.bold ", "}"], ["{blue.bold ", "}"])), JSON.stringify(body.data)));
                    return order;
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
                    console.error(chalk(templateObject_18 || (templateObject_18 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.data.errMsg));
                    throw 'retry';
                }
            });
        })
            .retryWhen(function (error$) { return error$.do(function (err) { return winston.error(chalk(templateObject_19 || (templateObject_19 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err)); })
            .mergeMap(function (err) {
            if (err == 'retry') {
                return Observable_1.Observable.timer(500);
            }
            else {
                return Observable_1.Observable.throw(err);
            }
        }); });
    };
    Account.prototype.observableGetPassengers = function (order) {
        var _this = this;
        return Observable_1.Observable.of(1)
            .mergeMap(function () {
            return _this.getPassengers(order.request.token)
                .retryWhen(function (error$) {
                return error$.do(function (err) { return winston.error(chalk(templateObject_20 || (templateObject_20 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err)); })
                    .delay(500);
            });
        });
    };
    Account.prototype.observableGetPassCodeNew = function (order) {
        var _this = this;
        return Observable_1.Observable.of(1)
            .switchMap(function () { return _this.getPassCodeNew(); })
            .switchMap(function () { return _this.checkRandCodeAnsyn(); });
    };
    Account.prototype.buildOrderFlow = function () {
        var _this = this;
        // 初始化查询火车余票页面
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.leftTicketInit(); })
            .switchMap(function () { return _this.recursiveQueryLeftTicket(); })
            .subscribe(function (order) {
            _this.obsQueryOrderWaitT(order)
                .subscribe(function (orderRequest) {
                console.log(chalk(templateObject_21 || (templateObject_21 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
                _this.destroy();
            }, function (err) { return winston.error(chalk(templateObject_22 || (templateObject_22 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); });
        }, function (err) {
            winston.error(chalk(templateObject_23 || (templateObject_23 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), JSON.stringify(err)));
            _this.destroy();
        });
    };
    Account.prototype.observableCheckUser = function () {
        var _this = this;
        // Step 10 验证登录，Post
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.checkUser(); })
            .retryWhen(function (error$) { return error$.do(function (err) { return console.error("Check user error " + err); }); })
            .mergeMap(function (body) {
            if (body.data.flag) {
                return Observable_1.Observable.of(body);
            }
            else {
                return _this.observableLoginInit();
            }
        });
    };
    Account.prototype.obsQueryOrderWaitT = function (order) {
        var _this = this;
        return Observable_1.Observable.of(order)
            .mergeMap(function (order) { return _this.queryOrderWaitTime(""); })
            .map(function (orderQueue) {
            winston.debug(JSON.stringify(orderQueue));
            if (orderQueue.status) {
                if (orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
                    // 0.5秒响一次，响铃30分钟
                    beeper(60 * 30 * 2);
                    return console.log(chalk(templateObject_24 || (templateObject_24 = __makeTemplateObject(["Your ticket order number is {red.bold ", "}"], ["Your ticket order number is {red.bold ", "}"])), orderQueue.data.orderId));
                }
                else if (orderQueue.data.waitTime === -2) {
                    if (orderQueue.data.msg) {
                        return console.log(chalk(templateObject_25 || (templateObject_25 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), orderQueue.data.msg));
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
                    console.log(chalk(templateObject_26 || (templateObject_26 = __makeTemplateObject(["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"], ["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
                }
            }
            else {
                console.log(orderQueue);
            }
            throw 'retry';
        })
            .retryWhen(function (errors) { return errors.do(function (err) {
            if (err != 'retry') {
                winston.error(err);
            }
        }).delay(4000); });
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
            console.log(chalk(templateObject_27 || (templateObject_27 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"], ["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"]))));
            return Observable_1.Observable.throw();
        }
        // this.BACK_TRAIN_DATE = trainDate;
        if (!fromStation) {
            console.log(chalk(templateObject_28 || (templateObject_28 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"]))));
            return Observable_1.Observable.throw();
        }
        // this.FROM_STATION_NAME = fromStationName;
        if (!toStation) {
            console.log(chalk(templateObject_29 || (templateObject_29 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"]))));
            return Observable_1.Observable.throw();
        }
        // this.TO_STATION_NAME = toStationName;
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.queryLeftTicket({ trainDate: trainDate,
            fromStation: fromStation,
            toStation: toStation }); })
            .retryWhen(function (errors$) { return errors$.do(function () { return process.stdout.write("."); }).delay(1500); })
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
        });
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
        this.buildQueryLeftTicketFlow({
            trainDate: trainDate,
            fromStation: fromStation,
            toStation: toStation,
            passStation: passStation,
            planTrains: planTrains,
            planTimes: planTimes,
            planOrderBy: planOrderBy,
            seatClasses: []
        })
            .subscribe(function (order) {
            var trains = _this.renderTrainListTitle(order.trains);
            if (trains.length === 0) {
                return console.log(chalk(templateObject_30 || (templateObject_30 = __makeTemplateObject(["{yellow \u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8F66\u6B21}"], ["{yellow \u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8F66\u6B21}"]))));
            }
            _this.renderLeftTickets(trains);
        });
    };
    Account.prototype.renderTrainListTitle = function (trains) {
        var title = this.TICKET_TITLE.map(function (t) { return chalk(templateObject_31 || (templateObject_31 = __makeTemplateObject(["{blue ", "}"], ["{blue ", "}"])), t); });
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
        this.initNoComplete()
            .mergeMap(function () {
            return _this.queryMyOrderNoComplete()
                .retryWhen(function (error$) { return error$.delay(500); });
        })
            .subscribe(function (x) {
            var columns = columnify(x, {
                columnSplitter: ' | '
            });
            console.log(columns);
        }, function (error) {
            winston.error(error);
        });
    };
    Account.prototype.loginInit = function () {
        var url = "https://kyfw.12306.cn/otn/login/init";
        var options = {
            url: url,
            method: "GET",
            headers: this.headers
        };
        return this.request(options);
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
        return Observable_1.Observable.create(function (observer) {
            _this.rawRequest(options, function (error, response, body) {
                if (error)
                    return observer.error(error);
            }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function () {
                observer.next();
            });
        });
    };
    Account.prototype.questionCaptcha = function () {
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return Observable_1.Observable.create(function (observer) {
            var child = child_process.exec('captcha.BMP', function () { });
            rl.question(chalk(templateObject_32 || (templateObject_32 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positionStr) {
                rl.close();
                if (typeof positionStr == "string") {
                    var positions_1 = [];
                    positionStr.split(',').forEach(function (el) { return positions_1 = positions_1.concat(el.split(' ')); });
                    observer.next(positions_1.map(function (position) {
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
                    observer.complete();
                }
                else {
                    observer.error("输入格式错误");
                }
            });
        });
    };
    Account.prototype.checkCaptcha = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/passport/captcha/captcha-check";
        return this.questionCaptcha()
            .mergeMap(function (positions) {
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
            return _this.request(options)
                .map(function (body) { return JSON.parse(body); })
                .map(function (body) {
                if (body.result_code == 4) {
                    return body;
                }
                throw body.result_message;
            });
        });
    };
    Account.prototype.userAuthenticate = function () {
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); })
            .map(function (body) {
            if (body.result_code == 2) {
                throw body.result_message;
            }
            else if (body.result_code != 0) {
                throw body;
            }
            else {
                return body.uamtk;
            }
        });
    };
    Account.prototype.getNewAppToken = function () {
        var data = {
            "appid": "otn"
        };
        var options = {
            url: "https://kyfw.12306.cn/passport/web/auth/uamtk",
            headers: this.headers,
            method: 'POST',
            form: data
        };
        return this.request(options)
            .map(function (body) { return JSON.parse(body); })
            .map(function (body) {
            winston.debug(body);
            if (body.result_code == 0) {
                return body.newapptk;
            }
            else {
                throw body;
            }
        });
    };
    Account.prototype.getAppToken = function (newapptk) {
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); })
            .map(function (body) {
            winston.debug(body.result_message);
            if (body.result_code == 0) {
                return body.apptk;
            }
            else {
                throw body;
            }
        });
    };
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
    Account.prototype.leftTicketInit = function () {
        var url = "https://kyfw.12306.cn/otn/leftTicket/init";
        return this.request(url);
    };
    Account.prototype.queryLeftTicket = function (_a) {
        var trainDate = _a.trainDate, fromStation = _a.fromStation, toStation = _a.toStation;
        var query = {
            "leftTicketDTO.train_date": trainDate,
            "leftTicketDTO.from_station": fromStation,
            "leftTicketDTO.to_station": toStation,
            "purpose_codes": "ADULT"
        };
        var param = querystring.stringify(query);
        var url = "https://kyfw.12306.cn/otn/leftTicket/queryZ?" + param;
        return this.request(url)
            .map(function (body) {
            if (!body) {
                throw "系统返回无数据";
            }
            if (body.indexOf("请您重试一下") > 0) {
                throw "系统繁忙!";
            }
            else {
                try {
                    var data = JSON.parse(body).data;
                }
                catch (err) {
                    throw err;
                }
                // Resolved
                return data;
            }
        });
    };
    Account.prototype.checkUser = function () {
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); });
    };
    Account.prototype.submitOrderRequest = function (_a) {
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); });
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
        return this.request(options)
            .map(function (body) {
            if (_this.isSystemBussy(body)) {
                throw _this.SYSTEM_BUSSY;
            }
            if (body) {
                // Get Repeat Submit Token
                var token = body.match(/var globalRepeatSubmitToken = '(.*?)';/);
                var ticketInfoForPassengerForm = body.match(/var ticketInfoForPassengerForm=(.*?);/);
                var orderRequestDTO = body.match(/var orderRequestDTO=(.*?);/);
                if (token) {
                    return {
                        token: token[1],
                        ticketInfo: ticketInfoForPassengerForm && JSON.parse(ticketInfoForPassengerForm[1].replace(/'/g, "\"")),
                        orderRequest: orderRequestDTO && JSON.parse(orderRequestDTO[1].replace(/'/g, "\""))
                    };
                }
            }
            throw _this.SYSTEM_BUSSY;
        });
    };
    Account.prototype.getPassengers = function (token) {
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); });
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
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo";
        var passengerTicketStr = this.getPassengerTickets(passengers, planPepoles);
        if (!passengerTicketStr) {
            return Observable_1.Observable.throw("没有相关联系人");
        }
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); })
            .map(function (body) {
            /*
              { validateMessagesShowId: '_validatorMessage',
                url: '/leftTicket/init',
                status: false,
                httpstatus: 200,
                messages: [ '系统忙，请稍后重试' ],
                validateMessages: {} }
             */
            if (body.status) {
                return body;
            }
            else {
                throw body.messages[0];
            }
        });
    };
    Account.prototype.getQueueCount = function (token, orderRequestDTO, ticketInfo) {
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); })
            .map(function (body) {
            /*
              { validateMessagesShowId: '_validatorMessage',
                status: false,
                httpstatus: 200,
                messages: [ '系统繁忙，请稍后重试！' ],
                validateMessages: {} }
             */
            if (body.status) {
                return body;
            }
            else {
                throw body.messages[0];
            }
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
        return Observable_1.Observable.create(function (observer) {
            _this.rawRequest(options, function (error, response, body) {
                if (error)
                    return observer.error(error);
                if (response.statusCode !== 200)
                    observer.error(response.statusMessage);
            }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function () {
                observer.next();
                observer.complete();
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
        return this.questionCaptcha()
            .mergeMap(function (positions) {
            options.form.randCode = positions;
            return _this.request(options);
        })
            .map(function (body) { return JSON.parse(body); });
    };
    Account.prototype.confirmSingleForQueue = function (token, passengers, ticketInfoForPassengerForm, planPepoles) {
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
        return this.request(options)
            .map(function (body) { return JSON.parse(body); });
    };
    Account.prototype.queryOrderWaitTime = function (token) {
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
        return this.request(options);
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
        return this.request(options)
            .map(function (body) {
            if (_this.isSystemBussy(body)) {
                throw _this.SYSTEM_BUSSY;
            }
            return body;
        });
    };
    Account.prototype.initNoComplete = function () {
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
        return this.request(options);
    };
    Account.prototype.myOrderNoComplete = function () {
        var _this = this;
        this.observableLoginInit()
            .mergeMap(function () { return _this.queryMyOrderNoComplete(); })
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
                console.error(chalk(templateObject_33 || (templateObject_33 = __makeTemplateObject(["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"], ["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"]))));
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
                            "乘车日期": chalk(templateObject_34 || (templateObject_34 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.train_date.slice(0, 10)),
                            // "下单时间": ticket.reserve_time,
                            "付款截至时间": chalk(templateObject_35 || (templateObject_35 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), ticket.pay_limit_time),
                            "金额": chalk(templateObject_36 || (templateObject_36 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_price / 100),
                            "状态": chalk(templateObject_37 || (templateObject_37 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_status_name),
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
        }, function (err) { return console.error(err); });
    };
    Account.prototype.queryMyOrderNoComplete = function () {
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
        return this.request(options)
            .map(function (body) {
            if (body.status) {
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
        return this.request(options);
    };
    Account.prototype.cancelNoCompleteOrder = function (sequenceNo, cancelId) {
        var _this = this;
        if (cancelId === void 0) { cancelId = 'cancel_order'; }
        this.observableLoginInit()
            .mergeMap(function () { return _this.cancelNoCompleteMyOrder(sequenceNo, cancelId); })
            .subscribe(function (body) {
            // {"validateMessagesShowId":"_validatorMessage","status":true,"httpstatus":200,"data":{},"messages":[],"validateMessages":{}}
            if (body.data.existError == "Y") {
                winston.error(chalk(templateObject_38 || (templateObject_38 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), body.data.errorMsg));
            }
            else {
                console.warn(chalk(templateObject_39 || (templateObject_39 = __makeTemplateObject(["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"], ["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"])), sequenceNo));
            }
        }, function (err) { return winston.error(chalk(templateObject_40 || (templateObject_40 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), JSON.stringify(err))); });
    };
    return Account;
}());
exports.Account = Account;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29, templateObject_30, templateObject_31, templateObject_32, templateObject_33, templateObject_34, templateObject_35, templateObject_36, templateObject_37, templateObject_38, templateObject_39, templateObject_40;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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NzlDQSxBQTY5Q0MsSUFBQTtBQTc5Q1ksMEJBQU8iLCJmaWxlIjoic3JjL0FjY291bnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgLy8gaHR0cHM6Ly93d3cubGFuaW5kZXguY29tLzEyMzA2JUU4JUI0JUFEJUU3JUE1JUE4JUU2JUI1JTgxJUU3JUE4JThCJUU1JTg1JUE4JUU4JUE3JUEzJUU2JTlFJTkwL1xuXG5pbXBvcnQgd2luc3RvbiA9IHJlcXVpcmUoJ3dpbnN0b24nKTtcbmltcG9ydCB7RmlsZUNvb2tpZVN0b3JlfSBmcm9tICcuL0ZpbGVDb29raWVTdG9yZSc7XG5pbXBvcnQge1N0YXRpb259IGZyb20gJy4vU3RhdGlvbic7XG5pbXBvcnQgcmVxdWVzdCA9IHJlcXVpcmUoJ3JlcXVlc3QnKTtcbmltcG9ydCBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5pbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xuaW1wb3J0IHJlYWRsaW5lID0gcmVxdWlyZSgncmVhZGxpbmUnKTtcbmltcG9ydCBwcm9jZXNzID0gcmVxdWlyZSgncHJvY2VzcycpO1xuaW1wb3J0IFJ4IGZyb20gJ3J4anMvUngnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSB9IGZyb20gJ3J4anMvT2JzZXJ2YWJsZSc7XG5pbXBvcnQgeyBPYnNlcnZlciB9IGZyb20gJ3J4anMvT2JzZXJ2ZXInO1xuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2JpbmRDYWxsYmFjayc7XG5pbXBvcnQgY2hhbGsgPSByZXF1aXJlKCdjaGFsaycpO1xuaW1wb3J0IGNvbHVtbmlmeSA9IHJlcXVpcmUoJ2NvbHVtbmlmeScpO1xuaW1wb3J0IGJlZXBlciA9IHJlcXVpcmUoJ2JlZXBlcicpO1xuaW1wb3J0IGNoaWxkX3Byb2Nlc3MgPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7XG5cbmltcG9ydCB7T3JkZXJTdWJtaXRSZXF1ZXN0LCBJT3JkZXIsIE9yZGVyfSBmcm9tICcuL09yZGVyJztcblxuaW50ZXJmYWNlIE9yZGVyU3VibWl0UmVxdWVzdCB7XG4gIHRva2VuOiBzdHJpbmc7XG4gIHRpY2tldEluZm86IG9iamVjdDtcbiAgb3JkZXJSZXF1ZXN0OiBvYmplY3Q7XG59XG5cbmV4cG9ydCBjbGFzcyBBY2NvdW50IHtcbiAgcHVibGljIHVzZXJOYW1lIDogc3RyaW5nO1xuICBwdWJsaWMgdXNlclBhc3N3b3JkIDogc3RyaW5nO1xuICBwcml2YXRlIGNoZWNrVXNlclRpbWVyID0gUnguT2JzZXJ2YWJsZS50aW1lcigxMDAwKjYwKjEwLCAxMDAwKjYwKjEwKTsgLy8g5Y2B5YiG6ZKf5LmL5ZCO5byA5aeL77yM5q+P5Y2B5YiG6ZKf5qOA5p+l5LiA5qyhXG4gIHByaXZhdGUgc2NwdENoZWNrVXNlclRpbWVyPzogUnguU3Vic2NyaXB0aW9uO1xuXG4gIHByaXZhdGUgc3RhdGlvbnM6IFN0YXRpb24gPSBuZXcgU3RhdGlvbigpO1xuICBwcml2YXRlIHBhc3NlbmdlcnM/OiBvYmplY3Q7XG5cbiAgcHJpdmF0ZSBTWVNURU1fQlVTU1kgPSBcIlN5c3RlbSBpcyBidXNzeVwiO1xuICBwcml2YXRlIFNZU1RFTV9NT1ZFRCA9IFwiTW92ZWQgVGVtcG9yYXJpbHlcIjtcblxuICBwcml2YXRlIHJhd1JlcXVlc3Q6IChvcHRpb25zOmFueXx1bmRlZmluZWR8bnVsbCwgY2I6YW55KT0+YW55O1xuICBwcml2YXRlIHJlcXVlc3Q6IChvcHRpb25zPzphbnl8dW5kZWZpbmVkfG51bGwpPT5PYnNlcnZhYmxlPGFueT47XG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XG4gIHB1YmxpYyBoZWFkZXJzOiBvYmplY3QgPSB7XG4gICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIlxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxuICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcbiAgICAsXCJPcmlnaW5cIjogXCJodHRwczovL2t5ZncuMTIzMDYuY25cIlxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcbiAgfTtcblxuICBwcml2YXRlIFRJQ0tFVF9USVRMRSA9IFsnJywgJycsICcnLCAn6L2m5qyhJywgJ+i1t+WniycsICfnu4jngrknLCAn5Ye65Y+R56uZJywgJ+WIsOi+vuermScsICflh7rlj5Hml7YnLCAn5Yiw6L6+5pe2JywgJ+WOhuaXticsICcnLCAnJyxcbiAgICAgICAgICAgICAgICfml6XmnJ8nLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ+mrmOe6p+i9r+WNpycsICcnLCAn6L2v5Y2nJywgJ+i9r+W6pycsICfnibnnrYnluqcnLCAn5peg5bqnJyxcbiAgICAgICAgICAgICAgICcnLCAn56Gs5Y2nJywgJ+ehrOW6pycsICfkuoznrYnluqcnLCAn5LiA562J5bqnJywgJ+WVhuWKoeW6pyddO1xuXG4gIHByaXZhdGUgcXVlcnkgPSBmYWxzZTtcblxuICBwcml2YXRlIG9yZGVyczogQXJyYXk8T3JkZXI+ID0gW107XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB1c2VyUGFzc3dvcmQ6IHN0cmluZykge1xuICAgIHRoaXMudXNlck5hbWUgPSBuYW1lO1xuICAgIHRoaXMudXNlclBhc3N3b3JkID0gdXNlclBhc3N3b3JkO1xuXG4gICAgdGhpcy5zZXRSZXF1ZXN0KCk7XG4gICAgdGhpcy5yYXdSZXF1ZXN0ID0gcmVxdWVzdC5kZWZhdWx0cyh7amFyOiB0aGlzLmNvb2tpZWphcn0pO1xuICAgIHRoaXMucmVxdWVzdCA9IE9ic2VydmFibGUuYmluZENhbGxiYWNrPEFycmF5PGFueT4+KHRoaXMucmF3UmVxdWVzdCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlICE9PSAyMDApIHRocm93IFsnaHR0cCBlcnJvcicsIHJlc3BvbnNlLnN0YXR1c0NvZGUsIHJlc3BvbnNlLnN0YXR1c01lc3NhZ2VdLmpvaW4oJyAnKTtcbiAgICAgIHJldHVybiBib2R5O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOajgOafpee9kee7nOW8guW4uFxuICAgKi9cbiAgcHJpdmF0ZSBpc1N5c3RlbUJ1c3N5KGJvZHk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBib2R5LmluZGV4T2YoXCLnvZHnu5zlj6/og73lrZjlnKjpl67popjvvIzor7fmgqjph43or5XkuIDkuItcIikgPiAwO1xuICB9XG5cbiAgcHVibGljIHNldFJlcXVlc3QoKSB7XG4gICAgbGV0IGNvb2tpZUZpbGVOYW1lOiBzdHJpbmcgPSBcIi4vY29va2llcy9cIit0aGlzLnVzZXJOYW1lK1wiLmpzb25cIjtcbiAgICB2YXIgZmlsZVN0b3JlID0gbmV3IEZpbGVDb29raWVTdG9yZShjb29raWVGaWxlTmFtZSwge2VuY3J5cHQ6IGZhbHNlfSk7XG4gICAgZmlsZVN0b3JlLm9wdGlvbiA9IHtlbmNyeXB0OiBmYWxzZX07XG5cbiAgICB0aGlzLmNvb2tpZWphciA9IHJlcXVlc3QuamFyKGZpbGVTdG9yZSk7XG5cbiAgICAvLyB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XG5cbiAgfVxuXG4gIHByaXZhdGUgbmV4dE9yZGVyTnVtOiBudW1iZXIgPSAwO1xuICBwcml2YXRlIG5leHRPcmRlcigpIHtcbiAgICB0aGlzLm5leHRPcmRlck51bSA9ICh0aGlzLm5leHRPcmRlck51bSArIDEpJXRoaXMub3JkZXJzLmxlbmd0aDtcbiAgICByZXR1cm4gdGhpcy5vcmRlcnNbdGhpcy5uZXh0T3JkZXJOdW1dO1xuICB9XG5cbiAgcHJpdmF0ZSBjdXJyZW50T3JkZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMub3JkZXJzW3RoaXMubmV4dE9yZGVyTnVtXTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVPcmRlcih0cmFpbkRhdGVzOiBBcnJheTxzdHJpbmc+LCBiYWNrVHJhaW5EYXRlOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICBbZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgcGxhblRyYWluczogQXJyYXk8c3RyaW5nPiwgcGxhblBlcG9sZXM6IEFycmF5PHN0cmluZz4sIHNlYXRDbGFzc2VzOiBBcnJheTxzdHJpbmc+KTogdGhpcyB7XG4gICAgdHJhaW5EYXRlcy5mb3JFYWNoKHRyYWluRGF0ZT0+IHtcbiAgICAgIGlmKCFuZXcgRGF0ZSh0cmFpbkRhdGUpLnRvSlNPTigpKSB7XG4gICAgICAgIHRocm93IGNoYWxrYHtyZWQg5LmY6L2m5pel5pyfJHt0cmFpbkRhdGV95qC85byP5LiN5q2j56Gu77yM5qC85byP5bqU6K+l5piveXl5eS1NTS1kZH1gO1xuICAgICAgfVxuICAgICAgaWYobmV3IERhdGUodHJhaW5EYXRlKS50b0pTT04oKS5zbGljZSgwLDEwKSA8IG5ldyBEYXRlKCkudG9KU09OKCkuc2xpY2UoMCwxMCkpIHtcbiAgICAgICAgdGhyb3cgY2hhbGtge3JlZCDkuZjovabml6XmnJ/lupTor6XkuLrku4rlpKnmiJbku6XlkI59YDtcbiAgICAgIH1cblxuICAgICAgdGhpcy5vcmRlcnMucHVzaChcbiAgICAgICAgbmV3IE9yZGVyKHRyYWluRGF0ZSwgYmFja1RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWUsIHBsYW5UcmFpbnMsIHBsYW5QZXBvbGVzLCBzZWF0Q2xhc3NlcylcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBzdWJtaXQoKTogdm9pZCB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcbiAgICAgICAgdGhpcy5idWlsZE9yZGVyRmxvdygpO1xuXG4gICAgICAgIHRoaXMuc2NwdENoZWNrVXNlclRpbWVyID1cbiAgICAgICAgICB0aGlzLmNoZWNrVXNlclRpbWVyLnN1YnNjcmliZSgoaSk9PiB7XG4gICAgICAgICAgICB0aGlzLm9ic2VydmFibGVDaGVja1VzZXIoKVxuICAgICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT53aW5zdG9uLmRlYnVnKFwiQ2hlY2sgdXNlciBkb25lXCIpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG9yZGVyV2FpdFRpbWUoKSB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcbiAgICAgICAgdGhpcy5vYnNRdWVyeU9yZGVyV2FpdFQobmV3IE9yZGVyKCkpXG4gICAgICAgICAgLnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOe7k+adn31gKTtcbiAgICAgICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YClcbiAgICAgICAgICAgICwoKT0+e1xuICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgfVxuICAgICAgLGVycj0+Y29uc29sZS5sb2coY2hhbGtge3llbGxvdyDplJnor6/nu5PmnZ8gJHtlcnJ9fWApXG4gICAgICAsKCk9PntcbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjYW5jZWxPcmRlclF1ZXVlKCkge1xuICAgIHRoaXMuY2FuY2VsUXVldWVOb0NvbXBsZXRlT3JkZXIoKVxuICAgICAgLnRoZW4oeD0+IHtcbiAgICAgICAgaWYoeC5zdGF0dXMgJiYgeC5kYXRhLmV4aXN0RXJyb3IgPT0gJ04nKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg5o6S6Zif6K6i5Y2V5bey5Y+W5raIfWApO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcih4KTtcbiAgICAgICAgfVxuICAgICAgfSwgZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSgpIHtcbiAgICB0aGlzLnNjcHRDaGVja1VzZXJUaW1lciYmdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXIudW5zdWJzY3JpYmUoKTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUNoZWNrQ2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmdldENhcHRjaGEoKSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5jaGVja0NhcHRjaGEoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRvKCgpPT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5qCh6aqM56CB5oiQ5Yqf5ZCO6L+b6KGM5o6I5p2D6K6k6K+BXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOmqjOivgeeggeagoemqjOaIkOWKn31gKVxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQuZG8oKCk9PmNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDmoKHpqozlpLHotKXvvIzph43mlrDmoKHpqox9YCkpXG4gICAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlTG9naW4oKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5vYnNlcnZhYmxlQ2hlY2tDYXB0Y2hhKCkpXG4gICAgICAubWVyZ2VNYXAoKCk9PlxuICAgICAgICB0aGlzLnVzZXJBdXRoZW50aWNhdGUoKVxuICAgICAgICAgIC5kbygoKT0+Y29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg55m75b2V5oiQ5YqffWApKVxuICAgICAgKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgIC8qXG4gICAgICAgICAge1wicmVzdWx0X21lc3NhZ2VcIjpcIuWvhueggei+k+WFpemUmeivr+OAguWmguaenOi+k+mUmeasoeaVsOi2hei/hzTmrKHvvIznlKjmiLflsIbooqvplIHlrprjgIJcIixcInJlc3VsdF9jb2RlXCI6MX1cbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi6aqM6K+B56CB5qCh6aqM5aSx6LSlXCIsXCJyZXN1bHRfY29kZVwiOlwiNVwifVxuICAgICAgICAgICovXG4gICAgICAgICAgaWYodHlwZW9mIGVyci5yZXN1bHRfY29kZSA9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcigxMDAwKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC5jYXRjaChlcnI9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke2Vyci5yZXN1bHRfbWVzc2FnZX19YCk7XG4gICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZU5ld0FwcFRva2VuKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5nZXROZXdBcHBUb2tlbigpKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGVycikpXG4gICAgICAgICAgLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbigpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlQXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgbGV0IG5ld0FwcFRva2VuID0gbmV3YXBwdGs7XG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8c3RyaW5nPik9PiB7XG4gICAgICAgIG9ic2VydmVyLm5leHQobmV3QXBwVG9rZW4pO1xuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xuICAgICAgfSlcbiAgICAgIC5tZXJnZU1hcChuZXdhcHB0az0+dGhpcy5nZXRBcHBUb2tlbihuZXdhcHB0aykpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoZXJyKSlcbiAgICAgICAgICAubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOiOt+WPllRva2Vu5aSx6LSlfWApO1xuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhlcnIpO1xuICAgICAgICAgICAgaWYoZXJyLnJlc3VsdF9jb2RlICYmIGVyci5yZXN1bHRfY29kZSA9PT0gMikge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTmV3QXBwVG9rZW4oKS5kbygobmV3YXBwdGspPT5uZXdBcHBUb2tlbiA9IG5ld2FwcHRrKTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUxvZ2luSW5pdCgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuXG4gICAgLy8g55m75b2V5Yid5aeL5YyWXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcChvcmRlcj0+dGhpcy5sb2dpbkluaXQoKSlcbiAgICAgIC5yZXRyeSgxMDAwKVxuICAgICAgLm1hcChvcmRlciA9PiB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24odGhpcy5jb29raWVqYXIuX2phci50b0pTT04oKS5jb29raWVzKSlcbiAgICAgIC5tZXJnZU1hcCh0b2tlbnM9PiB7XG4gICAgICAgIGlmKHRva2Vucy50aykge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVBcHBUb2tlbih0b2tlbnMudGspO1xuICAgICAgICB9ZWxzZSBpZih0b2tlbnMudWFtdGspIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTmV3QXBwVG9rZW4oKVxuICAgICAgICAgICAgLm1lcmdlTWFwKG5ld2FwcHRrPT50aGlzLm9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0aykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbigpXG4gICAgICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpKVxuICAgICAgICAgIC5tZXJnZU1hcChuZXdhcHB0az0+dGhpcy5vYnNlcnZhYmxlQXBwVG9rZW4obmV3YXBwdGspKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaVsOe7hOWkmuWFs+mUruWtl+auteaOkuW6j+eul+azle+8jOWtl+autem7mOiupOS4uumAkuWHj+aOkuW6j++8jOWmguaenOWtl+auteWJjemdouW4puaciSvnrKblj7fliJnkuLrpgJLlop7mjpLluo9cbiAgICovXG4gIHByaXZhdGUgZmllbGRTb3J0ZXIoZmllbGRzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgcmV0dXJuIChhOmFueSwgYjphbnkpID0+IGZpZWxkcy5tYXAoKG86c3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGxldCBkaXIgPSAtMTtcbiAgICAgICAgICAgICAgaWYgKG9bMF0gPT09ICcrJykge1xuICAgICAgICAgICAgICAgIGRpciA9IDE7XG4gICAgICAgICAgICAgICAgbyA9IG8uc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICB9ZWxzZSBpZihvWzBdID09PSAnLScpIHtcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGFbb10gPiBiW29dID8gZGlyIDogYVtvXSA8IGJbb10gPyAtKGRpcikgOiAwO1xuICAgICAgICAgIH0pLnJlZHVjZSgocCwgbikgPT4gcCA/IHAgOiBuLCAwKTtcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyOiBPcmRlcik6IE9ic2VydmFibGU8T3JkZXI+IHtcblxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKG9yZGVyKVxuICAgICAgLy8g6I635Y+W5L2Z56Wo5L+h5oGvXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBPcmRlcik9PlxuICAgICAgICB0aGlzLnF1ZXJ5TGVmdFRpY2tldHMob3JkZXIudHJhaW5EYXRlLCBvcmRlci5mcm9tU3RhdGlvbiwgb3JkZXIudG9TdGF0aW9uLCBvcmRlci5wbGFuVHJhaW5zKVxuICAgICAgICAgIC5tYXAoKHRyYWlucyk9PiB7XG4gICAgICAgICAgICBvcmRlci50cmFpbnMgPSB0cmFpbnM7XG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC8vIOiOt+WPlumAlOe7j+ermei9puasoeS/oeaBr1xuICAgICAgLm1lcmdlTWFwKChvcmRlcjogT3JkZXIpPT4ge1xuICAgICAgICBpZihvcmRlci5wYXNzU3RhdGlvbikge1xuICAgICAgICAgIGlmKCFvcmRlci5mcm9tVG9QYXNzVHJhaW5zKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5xdWVyeUxlZnRUaWNrZXRzKG9yZGVyLnRyYWluRGF0ZSwgb3JkZXIuZnJvbVN0YXRpb24sIG9yZGVyLnBhc3NTdGF0aW9uLCBvcmRlci5wbGFuVHJhaW5zKVxuICAgICAgICAgICAgICAudGhlbihwYXNzVHJhaW5zPT4ge1xuICAgICAgICAgICAgICAgIG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMgPSBwYXNzVHJhaW5zLm1hcCh0cmFpbiA9PiB0cmFpblszXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG9yZGVyKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG9yZGVyKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIOaMiemAlOe7j+ermei9puasoei/h+a7pFxuICAgICAgLm1hcCgob3JkZXI6IE9yZGVyKSA9PiB7XG4gICAgICAgIGlmKG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSBvcmRlci50cmFpbnMuZmlsdGVyKHRyYWluID0+IG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMuaW5jbHVkZXModHJhaW5bM10pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICB9KVxuICAgICAgLy8g5oyJ5pe26Ze06IyD5Zu06L+H5rukXG4gICAgICAubWFwKChvcmRlcjogT3JkZXIpID0+IHtcbiAgICAgICAgaWYob3JkZXIucGxhblRpbWVzKSB7XG4gICAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG4gICAgICAgICAgb3JkZXIudHJhaW5zID0gdHJhaW5zLmZpbHRlcih0cmFpbj0+IHtcbiAgICAgICAgICAgIHJldHVybiAob3JkZXIucGxhblRpbWVzWzBdP29yZGVyLnBsYW5UaW1lc1swXTw9dHJhaW5bOF06dHJ1ZSkmJihvcmRlci5wbGFuVGltZXNbMV0/b3JkZXIucGxhblRpbWVzWzFdPj10cmFpbls4XTp0cnVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDmoLnmja7lrZfmrrXmjpLluo9cbiAgICAgIC5tYXAoKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgIGlmKG9yZGVyLnBsYW5PcmRlckJ5KSB7XG4gICAgICAgICAgb3JkZXIudHJhaW5zID0gb3JkZXIudHJhaW5zLnNvcnQodGhpcy5maWVsZFNvcnRlcihvcmRlci5wbGFuT3JkZXJCeSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDorqHnrpflj6/otK3kubDovabmrKHkv6Hmga9cbiAgICAgIC5tYXAoKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgIGxldCB0cmFpbnMgPSBvcmRlci50cmFpbnN8fFtdO1xuXG4gICAgICAgIGxldCBwbGFuVHJhaW5zOiBBcnJheTxzdHJpbmc+ID0gW10sIHRoYXQgPSB0aGlzO1xuICAgICAgICB0cmFpbnMuc29tZSh0cmFpbiA9PiB7XG4gICAgICAgICAgcmV0dXJuIG9yZGVyLnNlYXRDbGFzc2VzLnNvbWUoc2VhdCA9PiB7XG4gICAgICAgICAgICB2YXIgc2VhdE51bSA9IHRoaXMuVElDS0VUX1RJVExFLmluZGV4T2Yoc2VhdCk7XG4gICAgICAgICAgICBpZih0cmFpbltzZWF0TnVtXSA9PSBcIuaciVwiIHx8IHRyYWluW3NlYXROdW1dID4gMCkge1xuICAgICAgICAgICAgICB3aW5zdG9uLmRlYnVnKG9yZGVyLnRyYWluRGF0ZStcIi9cIit0cmFpblszXStcIi9cIitzZWF0K1wiL1wiK3RyYWluW3NlYXROdW1dKTtcbiAgICAgICAgICAgICAgaWYob3JkZXIucGxhblRyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpIHtcbiAgICAgICAgICAgICAgICBwbGFuVHJhaW5zLnB1c2godHJhaW4pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG9yZGVyLmF2YWlsYWJsZVRyYWlucyA9IHBsYW5UcmFpbnM7XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZWN1cnNpdmVRdWVyeUxlZnRUaWNrZXQoKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjxzdHJpbmc+KT0+IHtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCh0aGlzLm5leHRPcmRlcigpKTtcbiAgICAgIH0pXG4gICAgICAubWVyZ2VNYXAob3JkZXI9PnRoaXMuYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyKSlcbiAgICAgIC5kbygoKT0+IHtcbiAgICAgICAgaWYodGhpcy5xdWVyeSkge1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLm1hcChvcmRlcj0+IHtcbiAgICAgICAgaWYob3JkZXIuYXZhaWxhYmxlVHJhaW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gZmFsc2U7XG4gICAgICAgICAgLy8gcHJvY2Vzcy5zdGRvdXQud3JpdGUoY2hhbGtge3llbGxvdyDmnInlj6/otK3kubDkvZnnpaggJHtwbGFuVHJhaW4udG9TdHJpbmcoKX19YCk7XG4gICAgICAgICAgb3JkZXIudHJhaW5TZWNyZXRTdHIgPSBvcmRlci5hdmFpbGFibGVUcmFpbnNbMF1bMF07XG4gICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRydWU7XG4gICAgICAgICAgdGhyb3cgY2hhbGtg5rKh5pyJ5Y+v6LSt5Lmw5L2Z56WoIHt5ZWxsb3cgJHtvcmRlci5mcm9tU3RhdGlvbk5hbWV9fSDliLAge3llbGxvdyAke29yZGVyLnRvU3RhdGlvbk5hbWV9fSAke29yZGVyLnBhc3NTdGF0aW9uTmFtZT8n5YiwJytvcmRlci5wYXNzU3RhdGlvbk5hbWUrJyAnOicnfXt5ZWxsb3cgJHtvcmRlci50cmFpbkRhdGV9fWA7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRvKGVycj0+cHJvY2Vzcy5zdGRvdXQud3JpdGUoZXJyKSkuZGVsYXkoMTUwMCkpXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBPcmRlcik9PnRoaXMub2JzZXJ2YWJsZUNoZWNrVXNlcigpLm1hcCgoKT0+b3JkZXIpKVxuICAgICAgLy8gU3RlcCAxMSDpooTmj5DkuqTorqLljZXvvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT5cbiAgICAgICAgT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5zdWJtaXRPcmRlclJlcXVlc3Qob3JkZXIpKVxuICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5lcnJvcihcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycilcbiAgICAgICAgICAgICAgICAuZGVsYXkoNTAwKSlcbiAgICAgICAgICApXG4gICAgICAgICAgLm1hcChib2R5PT5bb3JkZXIsIGJvZHldKVxuICAgICAgKVxuICAgICAgLm1hcCgoW29yZGVyLCBib2R5XSk9PntcbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICB3aW5zdG9uLmRlYnVnKGNoYWxrYHtibHVlIFN1Ym1pdCBPcmRlciBSZXF1ZXN0IHN1Y2Nlc3MhfWApO1xuICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIC8vIOaCqOi/mOacieacquWkhOeQhueahOiuouWNlVxuICAgICAgICAgIC8vIOivpei9puasoeaaguS4jeWKnueQhuS4muWKoVxuICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YCk7XG4gICAgICAgICAgLy8gdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgdGhyb3cgY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YDtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIFN0ZXAgMTIg5qih5ouf6Lez6L2s6aG16Z2iSW5pdERj77yMUG9zdFxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT5cbiAgICAgICAgdGhpcy5jb25maXJtUGFzc2VuZ2VySW5pdERjKClcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICBlcnJvciQubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICAgICAgaWYoZXJyID09IHRoaXMuU1lTVEVNX0JVU1NZKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihlcnIgPT0gdGhpcy5TWVNURU1fTU9WRUQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICAgICAubWFwKG9yZGVyU3VibWl0UmVxdWVzdD0+W29yZGVyLCBvcmRlclN1Ym1pdFJlcXVlc3RdKVxuICAgICAgKVxuICAgICAgLy8gU3RlcCAxMyDluLjnlKjogZTns7vkurrnoa7lrprvvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChbb3JkZXIsIG9yZGVyUmVxdWVzdF0pPT4ge1xuICAgICAgICB3aW5zdG9uLmRlYnVnKFwiY29uZmlybVBhc3NlbmdlciBJbml0IERjIHN1Y2Nlc3MhIFwiK29yZGVyUmVxdWVzdC50b2tlbik7XG4gICAgICAgIG9yZGVyLnJlcXVlc3QgPSBvcmRlclJlcXVlc3Q7XG4gICAgICAgIGlmKHRoaXMucGFzc2VuZ2Vycykge1xuICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2VycyA9IHRoaXMucGFzc2VuZ2VycztcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXNzZW5nZXJzKG9yZGVyLnJlcXVlc3QudG9rZW4pXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICAgICAgZXJyb3IkLmRvKChlcnIpPT53aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke2Vycn19YCkpXG4gICAgICAgICAgICAgICAgLmRlbGF5KDUwMClcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5tYXAocGFzc2VuZ2Vycz0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcbiAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcbiAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAvLyBTdGVwIDE0IOi0reelqOS6uuehruWumu+8jFBvc3RcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PlxuICAgICAgICB0aGlzLmNoZWNrT3JkZXJJbmZvKG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICBlcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGVycikpLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICAgICAubWFwKGJvZHk9PntcbiAgICAgICAgICAgIG9yZGVyLnJlcXVlc3Qub3JkZXJJbmZvID0gYm9keTtcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT5cbiAgICAgICAgdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnJlcXVlc3Qub3JkZXJSZXF1ZXN0LCBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8pXG4gICAgICAgICAgLm1hcChib2R5PT57XG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKGJvZHkpO1xuICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5xdWV1ZUluZm8gPSBib2R5O1xuICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgIH0pXG4gICAgICApXG4gICAgICAuc3dpdGNoTWFwKG9yZGVyPT4ge1xuICAgICAgICAvLyDoi6UgU3RlcCAxNCDkuK3nmoQgXCJpZlNob3dQYXNzQ29kZVwiID0gXCJZXCLvvIzpgqPkuYjlpJrkuobovpPlhaXpqozor4HnoIHov5nkuIDmraXvvIxQb3N0XG4gICAgICAgIGlmKG9yZGVyLnJlcXVlc3Qub3JkZXJJbmZvLmRhdGEuaWZTaG93UGFzc0NvZGUgPT0gXCJZXCIpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlR2V0UGFzc0NvZGVOZXcob3JkZXIpO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnN3aXRjaE1hcChvcmRlcj0+XG4gICAgICAgIHRoaXMuY29uZmlybVNpbmdsZUZvclF1ZXVlKG9yZGVyLnJlcXVlc3QudG9rZW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnBsYW5QZXBvbGVzKVxuICAgICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kZWxheSg1MDApKVxuICAgICAgICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICAgICAgICBpZihib2R5LnN0YXR1cyAmJiBib2R5LmRhdGEuc3VibWl0U3RhdHVzKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2JsdWUuYm9sZCAke0pTT04uc3RyaW5naWZ5KGJvZHkuZGF0YSl9fWApO1xuICAgICAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgICAgIGRhdGE6IHsgZXJyTXNnOiAn5L2Z56Wo5LiN6Laz77yBJywgc3VibWl0U3RhdHVzOiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5LmRhdGEuZXJyTXNnfX1gKVxuICAgICAgICAgICAgICAgIHRocm93ICdyZXRyeSc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICApXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7eWVsbG93LmJvbGQgJHtlcnJ9fWApKVxuICAgICAgICAgIC5tZXJnZU1hcCgoZXJyKT0+IHtcbiAgICAgICAgICAgIGlmKGVyciA9PSAncmV0cnknKSB7XG4gICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDUwMCk7XG4gICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVHZXRQYXNzZW5nZXJzKG9yZGVyOiBPcmRlcik6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+XG4gICAgICAgIHRoaXMuZ2V0UGFzc2VuZ2VycyhvcmRlci5yZXF1ZXN0LnRva2VuKVxuICAgICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICAgICAgICAgIGVycm9yJC5kbygoZXJyKT0+d2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtlcnJ9fWApKVxuICAgICAgICAgICAgICAgIC5kZWxheSg1MDApXG4gICAgICAgICAgICApXG4gICAgICApXG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVHZXRQYXNzQ29kZU5ldyhvcmRlcjogT3JkZXIpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAuc3dpdGNoTWFwKCgpPT4gdGhpcy5nZXRQYXNzQ29kZU5ldygpKVxuICAgICAgLnN3aXRjaE1hcCgoKT0+IHRoaXMuY2hlY2tSYW5kQ29kZUFuc3luKCkpXG4gIH1cblxuICBwcml2YXRlIGJ1aWxkT3JkZXJGbG93KCkge1xuXG4gICAgLy8g5Yid5aeL5YyW5p+l6K+i54Gr6L2m5L2Z56Wo6aG16Z2iXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5sZWZ0VGlja2V0SW5pdCgpKVxuICAgICAgLnN3aXRjaE1hcCgoKT0+dGhpcy5yZWN1cnNpdmVRdWVyeUxlZnRUaWNrZXQoKSlcbiAgICAgIC8vIFN0ZXAgMTgg5p+l6K+i5o6S6Zif562J5b6F5pe26Ze077yBXG4gICAgICAuc3Vic2NyaWJlKFxuICAgICAgICAob3JkZXI6IE9yZGVyKT0+IHtcbiAgICAgICAgICB0aGlzLm9ic1F1ZXJ5T3JkZXJXYWl0VChvcmRlcilcbiAgICAgICAgICAgIC5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOe7k+adn31gKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgICAgfSxlcnI9PndpbnN0b24uZXJyb3IoY2hhbGtge3llbGxvdyDplJnor6/nu5PmnZ8gJHtlcnJ9fWApKTtcbiAgICAgICAgfSxcbiAgICAgICAgZXJyPT57XG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtKU09OLnN0cmluZ2lmeShlcnIpfX1gKTtcbiAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVDaGVja1VzZXIoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG5cbiAgICAvLyBTdGVwIDEwIOmqjOivgeeZu+W9le+8jFBvc3RcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpID0+IHRoaXMuY2hlY2tVc2VyKCkpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRvKChlcnIpPT5jb25zb2xlLmVycm9yKFwiQ2hlY2sgdXNlciBlcnJvciBcIitlcnIpKSlcbiAgICAgIC5tZXJnZU1hcChib2R5PT4ge1xuICAgICAgICBpZihib2R5LmRhdGEuZmxhZykge1xuICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKGJvZHkpO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzUXVlcnlPcmRlcldhaXRUKG9yZGVyOiBPcmRlcik6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKG9yZGVyKVxuICAgICAgICAubWVyZ2VNYXAoKG9yZGVyOiBPcmRlcik9PiB0aGlzLnF1ZXJ5T3JkZXJXYWl0VGltZShcIlwiKSlcbiAgICAgICAgLm1hcChvcmRlclF1ZXVlPT4ge1xuICAgICAgICAgIHdpbnN0b24uZGVidWcoSlNPTi5zdHJpbmdpZnkob3JkZXJRdWV1ZSkpO1xuICAgICAgICAgIGlmKG9yZGVyUXVldWUuc3RhdHVzKSB7XG4gICAgICAgICAgICBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IDAgfHwgb3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMSkge1xuICAgICAgICAgICAgICAvLyAwLjXnp5Llk43kuIDmrKHvvIzlk43pk4MzMOWIhumSn1xuICAgICAgICAgICAgICBiZWVwZXIoNjAqMzAqMik7XG4gICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhjaGFsa2BZb3VyIHRpY2tldCBvcmRlciBudW1iZXIgaXMge3JlZC5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLm9yZGVySWR9fWApO1xuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMil7XG4gICAgICAgICAgICAgIGlmKG9yZGVyUXVldWUuZGF0YS5tc2cpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLm1zZ319YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKG9yZGVyUXVldWUpO1xuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMyl7XG4gICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhcIllvdXIgdGlja2V0IHJlcXVlc3QgaGFzIGJlZW4gY2FuY2VsZWQhXCIpO1xuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtNCl7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiWW91ciB0aWNrZXQgcmVxdWVzdCBpcyBiZWluZyBwcm9jZXNzZWQsIHBsZWFzZSB3YWl0IGEgbW9tZW50IVwiKTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOaOkumYn+S6uuaVsO+8miR7b3JkZXJRdWV1ZS5kYXRhLndhaXRDb3VudH19IOmihOiuoeetieW+heaXtumXtO+8miR7cGFyc2VJbnQob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lIC8gMS41KX0g5YiG6ZKfYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93ICdyZXRyeSc7XG4gICAgICAgIH0pXG4gICAgICAgIC5yZXRyeVdoZW4oKGVycm9ycyk9PmVycm9ycy5kbygoZXJyKT0+e1xuICAgICAgICAgIGlmKGVyciE9J3JldHJ5Jykge1xuICAgICAgICAgICAgd2luc3Rvbi5lcnJvcihlcnIpXG4gICAgICAgICAgfVxuICAgICAgICB9KS5kZWxheSg0MDAwKSlcbiAgICAgICAgO1xuICB9XG5cbiAgLyoqXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xuICAgKlxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXG4gICAqXG4gICAqIEByZXR1cm4gUHJvbWlzZVxuICAgKi9cbiAgcHVibGljIHF1ZXJ5TGVmdFRpY2tldHModHJhaW5EYXRlOiBzdHJpbmcsIGZyb21TdGF0aW9uOiBzdHJpbmcsIHRvU3RhdGlvbjogc3RyaW5nLCB0cmFpbk5hbWVzOiBBcnJheTxzdHJpbmc+fG51bGwpOiBPYnNlcnZhYmxlPEFycmF5PGFueT4+IHtcbiAgICBpZighdHJhaW5EYXRlKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeS5mOi9puaXpeacn31gKTtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCk7XG4gICAgfVxuICAgIC8vIHRoaXMuQkFDS19UUkFJTl9EQVRFID0gdHJhaW5EYXRlO1xuXG4gICAgaWYoIWZyb21TdGF0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWHuuWPkeermX1gKTtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCk7XG4gICAgfVxuICAgIC8vIHRoaXMuRlJPTV9TVEFUSU9OX05BTUUgPSBmcm9tU3RhdGlvbk5hbWU7XG5cbiAgICBpZighdG9TdGF0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWIsOi+vuermX1gKTtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCk7XG4gICAgfVxuICAgIC8vIHRoaXMuVE9fU1RBVElPTl9OQU1FID0gdG9TdGF0aW9uTmFtZTtcblxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMucXVlcnlMZWZ0VGlja2V0KHt0cmFpbkRhdGU6IHRyYWluRGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb21TdGF0aW9uOiBmcm9tU3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvU3RhdGlvbjogdG9TdGF0aW9ufSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAvLyAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG4gICAgICAucmV0cnlXaGVuKChlcnJvcnMkKT0+ZXJyb3JzJC5kbygoKT0+cHJvY2Vzcy5zdGRvdXQud3JpdGUoXCIuXCIpKS5kZWxheSgxNTAwKSlcbiAgICAgIC5tYXAodHJhaW5zRGF0YSA9PiB0cmFpbnNEYXRhLnJlc3VsdClcbiAgICAgIC5tYXAocmVzdWx0ID0+IHtcbiAgICAgICAgbGV0IHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4gPSBbXTtcblxuICAgICAgICByZXN1bHQuZm9yRWFjaCgoZWxlbWVudDogc3RyaW5nKT0+IHtcbiAgICAgICAgICBsZXQgdHJhaW46IEFycmF5PHN0cmluZz4gPSBlbGVtZW50LnNwbGl0KFwifFwiKTtcbiAgICAgICAgICB0cmFpbls0XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNF0pO1xuICAgICAgICAgIHRyYWluWzVdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls1XSk7XG4gICAgICAgICAgdHJhaW5bNl0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzZdKTtcbiAgICAgICAgICB0cmFpbls3XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bN10pO1xuICAgICAgICAgIHRyYWluWzExXSA9IHRyYWluWzExXSA9PSBcIklTX1RJTUVfTk9UX0JVWVwiID8gXCLliJfovablgZzov5BcIjp0cmFpblsxMV07XG4gICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiTlwiID8gXCLml6DnpahcIjp0cmFpblsxMV07XG4gICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiWVwiID8gXCLmnInnpahcIjp0cmFpblsxMV07XG4gICAgICAgICAgLy8g5Yy56YWN6L6T5YWl55qE5YiX6L2m5ZCN56ew55qE5q2j5YiZ6KGo6L6+5byP5p2h5Lu2XG4gICAgICAgICAgaWYoIXRyYWluTmFtZXMgfHwgdHJhaW5OYW1lcy5maWx0ZXIodG49PnRyYWluWzNdLm1hdGNoKG5ldyBSZWdFeHAodG4pKSAhPSBudWxsKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0cmFpbnMucHVzaCh0cmFpbik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRyYWlucztcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xuICAgKlxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcbiAgICogQHBhcmFtIHBhc3NTdGF0aW9uTmFtZSDpgJTnu4/nq5lcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXG4gICAqIEBwYXJhbSBmIOi9puasoei/h+a7pOadoeS7tlxuICAgKiBAcGFyYW0gdCDml7bpl7Tov4fmu6TmnaHku7ZcbiAgICpcbiAgICogQHJldHVybiB2b2lkXG4gICAqL1xuICBwdWJsaWMgbGVmdFRpY2tldHMoW3RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLCB7ZmlsdGVyLGYsdGltZSx0LG9yZGVyYnksb30pIHtcbiAgICBsZXQgZnJvbVN0YXRpb246IHN0cmluZyA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUoZnJvbVN0YXRpb25OYW1lKTtcbiAgICBsZXQgdG9TdGF0aW9uOiBzdHJpbmcgPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKHRvU3RhdGlvbk5hbWUpO1xuICAgIGxldCBwYXNzU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShwYXNzU3RhdGlvbk5hbWUpO1xuXG4gICAgbGV0IHBsYW5UcmFpbnM6IEFycmF5PHN0cmluZz58bnVsbCA9XG4gICAgICB0eXBlb2YgZiA9PSBcInN0cmluZ1wiID8gZi5zcGxpdCgnLCcpOih0eXBlb2YgZmlsdGVyID09IFwic3RyaW5nXCIgPyBmaWx0ZXIuc3BsaXQoJywnKTpudWxsKTtcbiAgICBsZXQgcGxhblRpbWVzOiBBcnJheTxzdHJpbmc+fG51bGwgPVxuICAgICAgdHlwZW9mIHQgPT0gXCJzdHJpbmdcIiA/IHQuc3BsaXQoJywnKToodHlwZW9mIHRpbWUgPT0gXCJzdHJpbmdcIiA/IHRpbWUuc3BsaXQoJywnKTpudWxsKTtcbiAgICBsZXQgcGxhbk9yZGVyQnk6IEFycmF5PHN0cmluZz58bnVsbCA9XG4gICAgICB0eXBlb2YgbyA9PSBcInN0cmluZ1wiID8gby5zcGxpdCgnLCcpOih0eXBlb2Ygb3JkZXJieSA9PSBcInN0cmluZ1wiID8gb3JkZXJieS5zcGxpdCgnLCcpOm51bGwpO1xuXG4gICAgaWYocGxhbk9yZGVyQnkpIHtcbiAgICAgIHBsYW5PcmRlckJ5ID0gcGxhbk9yZGVyQnkubWFwKChmaWVsZE5hbWU6c3RyaW5nKSA9PiB7XG4gICAgICAgIGlmKGZpZWxkTmFtZVswXSA9PT0gJy0nIHx8IGZpZWxkTmFtZVswXSA9PT0gJysnKSB7XG4gICAgICAgICAgcmV0dXJuIGZpZWxkTmFtZVswXSt0aGlzLlRJQ0tFVF9USVRMRS5pbmRleE9mKGZpZWxkTmFtZS5zdWJzdHJpbmcoMSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLlRJQ0tFVF9USVRMRS5pbmRleE9mKGZpZWxkTmFtZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0Rmxvdyh7XG4gICAgICAgIHRyYWluRGF0ZTogdHJhaW5EYXRlXG4gICAgICAgICxmcm9tU3RhdGlvbjogZnJvbVN0YXRpb25cbiAgICAgICAgLHRvU3RhdGlvbjogdG9TdGF0aW9uXG4gICAgICAgICxwYXNzU3RhdGlvbjogcGFzc1N0YXRpb25cbiAgICAgICAgLHBsYW5UcmFpbnM6IHBsYW5UcmFpbnNcbiAgICAgICAgLHBsYW5UaW1lczogcGxhblRpbWVzXG4gICAgICAgICxwbGFuT3JkZXJCeTogcGxhbk9yZGVyQnlcbiAgICAgICAgLHNlYXRDbGFzc2VzOiBbXVxuICAgICAgfSlcbiAgICAgIC5zdWJzY3JpYmUoKG9yZGVyOiBPcmRlcikgPT4ge1xuICAgICAgICBsZXQgdHJhaW5zID0gdGhpcy5yZW5kZXJUcmFpbkxpc3RUaXRsZShvcmRlci50cmFpbnMpO1xuICAgICAgICBpZih0cmFpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg5rKh5pyJ56ym5ZCI5p2h5Lu255qE6L2m5qyhfWApXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZW5kZXJMZWZ0VGlja2V0cyh0cmFpbnMpO1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRyYWluTGlzdFRpdGxlKHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4pOiBBcnJheTxBcnJheTxzdHJpbmc+PiB7XG4gICAgdmFyIHRpdGxlID0gdGhpcy5USUNLRVRfVElUTEUubWFwKHQ9PmNoYWxrYHtibHVlICR7dH19YCk7XG5cbiAgICB0cmFpbnMuZm9yRWFjaCgodHJhaW4sIGluZGV4KT0+IHtcbiAgICAgIGlmKGluZGV4ICUgMzAgPT09IDApIHtcbiAgICAgICAgdHJhaW5zLnNwbGljZShpbmRleCwgMCwgdGl0bGUpO1xuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIHRyYWlucztcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyTGVmdFRpY2tldHModHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+Pikge1xuICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHRyYWlucywge1xuICAgICAgY29sdW1uU3BsaXR0ZXI6ICd8JyxcbiAgICAgIGNvbHVtbnM6IFtcIjNcIiwgXCI0XCIsIFwiNVwiLCBcIjZcIiwgXCI3XCIsIFwiOFwiLCBcIjlcIiwgXCIxMFwiLCBcIjExXCIsIFwiMjBcIiwgXCIyMVwiLCBcIjIyXCIsIFwiMjNcIiwgXCIyNFwiLCBcIjI1XCIsXG4gICAgICAgICAgICAgICAgXCIyNlwiLCBcIjI3XCIsIFwiMjhcIiwgXCIyOVwiLCBcIjMwXCIsIFwiMzFcIiwgXCIzMlwiXVxuICAgIH0pXG5cbiAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcbiAgfVxuXG4gIHB1YmxpYyBteU9yZGVyTm9Db21wbGV0ZVJlcG9ydCgpIHtcbiAgICB0aGlzLmluaXROb0NvbXBsZXRlKClcbiAgICAgIC5tZXJnZU1hcCgoKT0+XG4gICAgICAgIHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpXG4gICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kZWxheSg1MDApKVxuICAgICAgKVxuICAgICAgLnN1YnNjcmliZSh4PT4ge1xuICAgICAgICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHgsIHtcbiAgICAgICAgICAgIGNvbHVtblNwbGl0dGVyOiAnIHwgJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc29sZS5sb2coY29sdW1ucyk7XG4gICAgICAgIH0sIGVycm9yPT4ge1xuICAgICAgICAgIHdpbnN0b24uZXJyb3IoZXJyb3IpO1xuICAgICAgICB9KVxuICB9XG5cbiAgcHVibGljIGxvZ2luSW5pdCgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2luaXRcIjtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gIH1cblxuICBwcml2YXRlIGdldENhcHRjaGEoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXG4gICAgICAgICAgXCJtb2R1bGVcIjogXCJsb2dpblwiLFxuICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiLFxuICAgICAgICAgIFwiMC4xNzIzMTg3MjcwMzM4OTA2MlwiOlwiXCJcbiAgICAgIH07XG5cbiAgICB2YXIgcGFyYW0gPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgbnVsbClcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWltYWdlP1wiK3BhcmFtO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICB9O1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8dm9pZD4pPT4ge1xuICAgICAgdGhpcy5yYXdSZXF1ZXN0KG9wdGlvbnMsIChlcnJvcjogYW55LCByZXNwb25zZTogYW55LCBib2R5OiBzdHJpbmcpID0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiBvYnNlcnZlci5lcnJvcihlcnJvcik7XG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVzdGlvbkNhcHRjaGEoKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcbiAgICB9KTtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjxzdHJpbmc+KT0+IHtcbiAgICAgIGxldCBjaGlsZCA9IGNoaWxkX3Byb2Nlc3MuZXhlYygnY2FwdGNoYS5CTVAnLCgpPT57fSk7XG5cbiAgICAgIHJsLnF1ZXN0aW9uKGNoYWxrYHtyZWQuYm9sZCDor7fovpPlhaXpqozor4HnoIF9OmAsIChwb3NpdGlvblN0cikgPT4ge1xuICAgICAgICBybC5jbG9zZSgpO1xuXG4gICAgICAgIGlmKHR5cGVvZiBwb3NpdGlvblN0ciA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgbGV0IHBvc2l0aW9uczogQXJyYXk8c3RyaW5nPiA9IFtdO1xuICAgICAgICAgIHBvc2l0aW9uU3RyLnNwbGl0KCcsJykuZm9yRWFjaChlbD0+cG9zaXRpb25zPXBvc2l0aW9ucy5jb25jYXQoZWwuc3BsaXQoJyAnKSkpO1xuICAgICAgICAgIG9ic2VydmVyLm5leHQocG9zaXRpb25zLm1hcCgocG9zaXRpb246IHN0cmluZyk9PiB7XG4gICAgICAgICAgICAgIHN3aXRjaChwb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIGNhc2UgXCIxXCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCI0MCw0NVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCIyXCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxMTAsNDVcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiM1wiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTgwLDQ1XCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjRcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjI1MCw0NVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI1XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCI0MCwxMTBcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiNlwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTEwLDExMFwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI3XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxODAsMTEwXCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjhcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjI1MCwxMTBcIjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuam9pbignLCcpKTtcbiAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgb2JzZXJ2ZXIuZXJyb3IoXCLovpPlhaXmoLzlvI/plJnor69cIik7XG4gICAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrQ2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWNoZWNrXCI7XG5cbiAgICByZXR1cm4gdGhpcy5xdWVzdGlvbkNhcHRjaGEoKVxuICAgICAgLm1lcmdlTWFwKHBvc2l0aW9ucz0+e1xuICAgICAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICAgIFwiYW5zd2VyXCI6IHBvc2l0aW9ucyxcbiAgICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcbiAgICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiXG4gICAgICAgICAgfTtcblxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICB1cmw6IHVybFxuICAgICAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAsZm9ybTogZGF0YVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxuICAgICAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gNCkge1xuICAgICAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IGJvZHkucmVzdWx0X21lc3NhZ2U7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgdXNlckF1dGhlbnRpY2F0ZSgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIC8vIOWPkemAgeeZu+W9leS/oeaBr1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxuICAgICAgICAgICxcInVzZXJuYW1lXCI6IHRoaXMudXNlck5hbWVcbiAgICAgICAgICAsXCJwYXNzd29yZFwiOiB0aGlzLnVzZXJQYXNzd29yZFxuICAgICAgICB9O1xuXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9sb2dpblwiO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgICAgLG1ldGhvZDogJ1BPU1QnXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMikge1xuICAgICAgICAgIHRocm93IGJvZHkucmVzdWx0X21lc3NhZ2U7XG4gICAgICAgIH1lbHNlIGlmKGJvZHkucmVzdWx0X2NvZGUgIT0gMCkge1xuICAgICAgICAgIHRocm93IGJvZHk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gYm9keS51YW10aztcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldE5ld0FwcFRva2VuKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXG4gICAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPXtcbiAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2F1dGgvdWFtdGtcIlxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgICAgLG1ldGhvZDogJ1BPU1QnXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIHdpbnN0b24uZGVidWcoYm9keSk7XG4gICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xuICAgICAgICAgIHJldHVybiBib2R5Lm5ld2FwcHRrO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdGhyb3cgYm9keTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldEFwcFRva2VuKG5ld2FwcHRrOiBzdHJpbmcpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwidGtcIjogbmV3YXBwdGtcbiAgICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi91YW1hdXRoY2xpZW50XCJcbiAgICAgICxoZWFkZXJzOiB7XG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDYuMTsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4xNyAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8yNC4wLjEzMTIuNjAgU2FmYXJpLzUzNy4xN1wiXG4gICAgICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxuICAgICAgICAsJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG4gICAgICB9XG4gICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcbiAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHkuYXBwdGs7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0aHJvdyBib2R5O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIHByaXZhdGUgZ2V0TXkxMjMwNigpOiBQcm9taXNlIHtcbiAgLy8gICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gIC8vICAgICB0aGlzLnJlcXVlc3Qoe1xuICAvLyAgICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9pbmRleC9pbml0TXkxMjMwNlwiXG4gIC8vICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAvLyAgICAgICxtZXRob2Q6IFwiR0VUXCJ9LFxuICAvLyAgICAgIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAvLyAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgLy8gICAgICAgICBjb25zb2xlLmxvZyhcIkdvdCBteSAxMjMwNlwiKTtcbiAgLy8gICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAvLyAgICAgICB9XG4gIC8vICAgICAgIHJlamVjdCgpO1xuICAvLyAgICAgfSk7XG4gIC8vICAgfSk7XG4gIC8vIH1cblxuICBwcml2YXRlIGNoZWNrQXV0aGVudGljYXRpb24oY29va2llczogb2JqZWN0KSB7XG4gICAgdmFyIHVhbXRrID0gXCJcIiwgdGsgPSBcIlwiO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb29raWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInVhbXRrXCIpIHtcbiAgICAgICAgdWFtdGsgPSBjb29raWVzW2ldLnZhbHVlO1xuICAgICAgfVxuXG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInRrXCIpIHtcbiAgICAgICAgdGsgPSBjb29raWVzW2ldLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgdWFtdGs6IHVhbXRrLFxuICAgICAgdGs6IHRrXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgbGVmdFRpY2tldEluaXQoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIjtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXJsKTtcbiAgfVxuXG4gIHByaXZhdGUgcXVlcnlMZWZ0VGlja2V0KHt0cmFpbkRhdGUsIGZyb21TdGF0aW9uLCB0b1N0YXRpb259KTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgcXVlcnkgPSB7XG4gICAgICBcImxlZnRUaWNrZXREVE8udHJhaW5fZGF0ZVwiOiB0cmFpbkRhdGVcbiAgICAgICxcImxlZnRUaWNrZXREVE8uZnJvbV9zdGF0aW9uXCI6IGZyb21TdGF0aW9uXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLnRvX3N0YXRpb25cIjogdG9TdGF0aW9uXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiQURVTFRcIlxuICAgIH1cblxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShxdWVyeSk7XG5cbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvcXVlcnlaP1wiK3BhcmFtO1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1cmwpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKCFib2R5KSB7XG4gICAgICAgICAgdGhyb3cgXCLns7vnu5/ov5Tlm57ml6DmlbDmja5cIjtcbiAgICAgICAgfVxuICAgICAgICBpZihib2R5LmluZGV4T2YoXCLor7fmgqjph43or5XkuIDkuItcIikgPiAwKSB7XG4gICAgICAgICAgdGhyb3cgXCLns7vnu5/nuYHlv5khXCI7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGJvZHkpLmRhdGE7XG4gICAgICAgICAgfWNhdGNoKGVycikge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBSZXNvbHZlZFxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tVc2VyKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vY2hlY2tVc2VyXCI7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIHN1Ym1pdE9yZGVyUmVxdWVzdCh7dHJhaW5TZWNyZXRTdHIsIHRyYWluRGF0ZSwgYmFja1RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lfSk6IE9ic2VydmFibGU8b2JqZWN0PiAge1xuXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L3N1Ym1pdE9yZGVyUmVxdWVzdFwiO1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcInNlY3JldFN0clwiOiBxdWVyeXN0cmluZy51bmVzY2FwZSh0cmFpblNlY3JldFN0cilcbiAgICAgICxcInRyYWluX2RhdGVcIjogdHJhaW5EYXRlXG4gICAgICAsXCJiYWNrX3RyYWluX2RhdGVcIjogYmFja1RyYWluRGF0ZVxuICAgICAgLFwidG91cl9mbGFnXCI6IFwiZGNcIlxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIkFEVUxUXCJcbiAgICAgICxcInF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lXCI6IGZyb21TdGF0aW9uTmFtZVxuICAgICAgLFwicXVlcnlfdG9fc3RhdGlvbl9uYW1lXCI6IHRvU3RhdGlvbk5hbWVcbiAgICAgICxcInVuZGVmaW5lZFwiOlwiXCJcbiAgICB9O1xuXG4gICAgLy8gdXJsID0gdXJsICsgXCJzZWNyZXRTdHI9XCIrc2VjcmV0U3RyK1wiJnRyYWluX2RhdGU9MjAxOC0wMS0zMSZiYWNrX3RyYWluX2RhdGU9MjAxOC0wMS0zMCZ0b3VyX2ZsYWc9ZGMmcHVycG9zZV9jb2Rlcz1BRFVMVCZxdWVyeV9mcm9tX3N0YXRpb25fbmFtZT3kuIrmtbcmcXVlcnlfdG9fc3RhdGlvbl9uYW1lPeW+kOW3nuS4nCZ1bmRlZmluZWRcIjtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlybVBhc3NlbmdlckluaXREYygpOiBPYnNlcnZhYmxlPE9yZGVyU3VibWl0UmVxdWVzdD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICB9O1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcbiAgICAgICAgLFwiVXBncmFkZS1JbnNlY3VyZS1SZXF1ZXN0c1wiOjFcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKHRoaXMuaXNTeXN0ZW1CdXNzeShib2R5KSkge1xuICAgICAgICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xuICAgICAgICB9XG4gICAgICAgIGlmKGJvZHkpIHtcbiAgICAgICAgICAvLyBHZXQgUmVwZWF0IFN1Ym1pdCBUb2tlblxuICAgICAgICAgIHZhciB0b2tlbiA9IGJvZHkubWF0Y2goL3ZhciBnbG9iYWxSZXBlYXRTdWJtaXRUb2tlbiA9ICcoLio/KSc7Lyk7XG4gICAgICAgICAgdmFyIHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtID0gYm9keS5tYXRjaCgvdmFyIHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtPSguKj8pOy8pO1xuICAgICAgICAgIHZhciBvcmRlclJlcXVlc3REVE8gPSBib2R5Lm1hdGNoKC92YXIgb3JkZXJSZXF1ZXN0RFRPPSguKj8pOy8pO1xuICAgICAgICAgIGlmKHRva2VuKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICB0b2tlbjogdG9rZW5bMV1cbiAgICAgICAgICAgICAgLHRpY2tldEluZm86IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtJiZKU09OLnBhcnNlKHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxuICAgICAgICAgICAgICAsb3JkZXJSZXF1ZXN0OiBvcmRlclJlcXVlc3REVE8mJkpTT04ucGFyc2Uob3JkZXJSZXF1ZXN0RFRPWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgdGhpcy5TWVNURU1fQlVTU1k7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2Vycyh0b2tlbjogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UGFzc2VuZ2VyRFRPc1wiO1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgLyogc2VhdCB0eXBlXG4gIOKAmOi9r+WNp+KAmSA9PiDigJg04oCZLFxuICDigJjkuoznrYnluqfigJkgPT4g4oCYT+KAmSxcbiAg4oCY5LiA562J5bqn4oCZID0+IOKAmE3igJksXG4gIOKAmOehrOW6p+KAmSA9PiDigJgx4oCZLFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKTogc3RyaW5nIHtcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xuICAgIHBhc3NlbmdlcnMuZm9yRWFjaChwYXNzZW5nZXI9PiB7XG4gICAgICBpZihwbGFuUGVwb2xlcy5pbmNsdWRlcyhwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUpKSB7XG4gICAgICAgIC8v5bqn5L2N57G75Z6LLDAs56Wo57G75Z6LKOaIkOS6ui/lhL/nq6UpLG5hbWUs6Lqr5Lu957G75Z6LKOi6q+S7veivgS/lhpvlrpjor4EuLi4uKSzouqvku73or4Es55S16K+d5Y+356CBLOS/neWtmOeKtuaAgVxuICAgICAgICB2YXIgdGlja2V0ID0gLypwYXNzZW5nZXIuc2VhdF90eXBlKi8gXCJPXCIgK1xuICAgICAgICAgICAgICAgIFwiLDAsXCIgK1xuICAgICAgICAgICAgICAgIC8qbGltaXRfdGlja2V0c1thQV0udGlja2V0X3R5cGUqL1wiMVwiICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSArIFwiLFwiICtcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIChwYXNzZW5nZXIucGhvbmVfbm8gfHwgXCJcIiApICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIFwiTlwiO1xuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB0aWNrZXRzLmpvaW4oXCJfXCIpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKTogc3RyaW5nIHtcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xuICAgIHBhc3NlbmdlcnMuZm9yRWFjaChwYXNzZW5nZXI9PiB7XG4gICAgICBpZihwbGFuUGVwb2xlcy5pbmNsdWRlcyhwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUpKSB7XG4gICAgICAgIC8vbmFtZSzouqvku73nsbvlnoss6Lqr5Lu96K+BLDFfXG4gICAgICAgIHZhciB0aWNrZXQgPVxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSArIFwiLFwiICtcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIFwiMVwiO1xuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB0aWNrZXRzLmpvaW4oXCJfXCIpK1wiX1wiO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja09yZGVySW5mbyhzdWJtaXRUb2tlbiwgcGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jaGVja09yZGVySW5mb1wiO1xuXG4gICAgdmFyIHBhc3NlbmdlclRpY2tldFN0ciA9IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk7XG4gICAgaWYoIXBhc3NlbmdlclRpY2tldFN0cikge1xuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coXCLmsqHmnInnm7jlhbPogZTns7vkurpcIik7XG4gICAgfVxuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcImNhbmNlbF9mbGFnXCI6IDJcbiAgICAgICxcImJlZF9sZXZlbF9vcmRlcl9udW1cIjogXCIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBcIlxuICAgICAgLFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHBhc3NlbmdlclRpY2tldFN0clxuICAgICAgLFwib2xkUGFzc2VuZ2VyU3RyXCI6IHRoaXMuZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcylcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcbiAgICAgICxcInJhbmRDb2RlXCI6IFwiXCJcbiAgICAgICxcIndoYXRzU2VsZWN0XCI6MVxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogc3VibWl0VG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgLypcbiAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICB1cmw6ICcvbGVmdFRpY2tldC9pbml0JyxcbiAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf5b+Z77yM6K+356iN5ZCO6YeN6K+VJyBdLFxuICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgKi9cbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRocm93IGJvZHkubWVzc2FnZXNbMF07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRRdWV1ZUNvdW50KHRva2VuLCBvcmRlclJlcXVlc3REVE8sIHRpY2tldEluZm8pOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRRdWV1ZUNvdW50XCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcInRyYWluX2RhdGVcIjogbmV3IERhdGUob3JkZXJSZXF1ZXN0RFRPLnRyYWluX2RhdGUudGltZSkudG9TdHJpbmcoKVxuICAgICAgLFwidHJhaW5fbm9cIjogb3JkZXJSZXF1ZXN0RFRPLnRyYWluX25vXG4gICAgICAsXCJzdGF0aW9uVHJhaW5Db2RlXCI6IG9yZGVyUmVxdWVzdERUTy5zdGF0aW9uX3RyYWluX2NvZGVcbiAgICAgICxcInNlYXRUeXBlXCI6MVxuICAgICAgLFwiZnJvbVN0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8uZnJvbV9zdGF0aW9uX3RlbGVjb2RlXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxuICAgICAgLFwibGVmdFRpY2tldFwiOiB0aWNrZXRJbmZvLnF1ZXJ5TGVmdFRpY2tldFJlcXVlc3REVE8ueXBJbmZvRGV0YWlsXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiMDBcIlxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgLypcbiAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICBzdGF0dXM6IGZhbHNlLFxuICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFsgJ+ezu+e7n+e5geW/me+8jOivt+eojeWQjumHjeivle+8gScgXSxcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICovXG4gICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0aHJvdyBib2R5Lm1lc3NhZ2VzWzBdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UGFzc0NvZGVOZXcoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9nZXRQYXNzQ29kZU5ldz9tb2R1bGU9cGFzc2VuZ2VyJnJhbmQ9cmFuZHAmXCIrTWF0aC5yYW5kb20oMCwxKTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICB9O1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8dm9pZD4pPT4ge1xuICAgICAgdGhpcy5yYXdSZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgICBpZihlcnJvcikgcmV0dXJuIG9ic2VydmVyLmVycm9yKGVycm9yKTtcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSE9PTIwMClcbiAgICAgICAgICBvYnNlcnZlci5lcnJvcihyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tSYW5kQ29kZUFuc3luKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9jaGVja1JhbmRDb2RlQW5zeW5cIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIHJhbmRDb2RlOiBcIlwiLFxuICAgICAgcmFuZDogXCJyYW5kcFwiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLnF1ZXN0aW9uQ2FwdGNoYSgpXG4gICAgICAubWVyZ2VNYXAocG9zaXRpb25zPT57XG4gICAgICAgIG9wdGlvbnMuZm9ybS5yYW5kQ29kZSA9IHBvc2l0aW9ucztcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcbiAgICAgIH0pXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlybVNpbmdsZUZvclF1ZXVlKHRva2VuLCBwYXNzZW5nZXJzLCB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSwgcGxhblBlcG9sZXMpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jb25maXJtU2luZ2xlRm9yUXVldWVcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcylcbiAgICAgICxcIm9sZFBhc3NlbmdlclN0clwiOiB0aGlzLmdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpXG4gICAgICAsXCJyYW5kQ29kZVwiOlwiXCJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0ucHVycG9zZV9jb2Rlc1xuICAgICAgLFwia2V5X2NoZWNrX2lzQ2hhbmdlXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmtleV9jaGVja19pc0NoYW5nZVxuICAgICAgLFwibGVmdFRpY2tldFN0clwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5sZWZ0VGlja2V0U3RyXG4gICAgICAsXCJ0cmFpbl9sb2NhdGlvblwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS50cmFpbl9sb2NhdGlvblxuICAgICAgLFwiY2hvb3NlX3NlYXRzXCI6IFwiXCJcbiAgICAgICxcInNlYXREZXRhaWxUeXBlXCI6IFwiMDAwXCJcbiAgICAgICxcIndoYXRzU2VsZWN0XCI6IDFcbiAgICAgICxcInJvb21UeXBlXCI6IFwiMDBcIlxuICAgICAgLFwiZHdBbGxcIjogXCJOXCJcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeU9yZGVyV2FpdFRpbWUodG9rZW46IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwicmFuZG9tXCI6IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxuICAgICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxRdWV1ZU5vQ29tcGxldGVNeU9yZGVyXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICB0b3VyRmxhZzogXCJkY1wiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgICAgLGpzb246IHRydWVcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcbiAgICAgICAgICB0aHJvdyB0aGlzLlNZU1RFTV9CVVNTWTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpbml0Tm9Db21wbGV0ZSgpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiO1xuICAgIGxldCBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXG4gICAgICB9KVxuICAgICAgLGZvcm06IHtcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIG15T3JkZXJOb0NvbXBsZXRlKCkge1xuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXG4gICAgICAubWVyZ2VNYXAoKCk9PiB0aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKSlcbiAgICAgIC5zdWJzY3JpYmUoKHgpPT57XG4gICAgICAgIC8qXG4gICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgZGF0YTogeyBvcmRlckRCTGlzdDogWyBbT2JqZWN0XSBdLCB0b19wYWdlOiAnZGInIH0sXG4gICAgICAgICAgICBtZXNzYWdlczogW10sXG4gICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XG4gICAgICAgICAqL1xuICAgICAgICAgaWYoIXguZGF0YSkge1xuICAgICAgICAgICBjb25zb2xlLmVycm9yKGNoYWxrYHt5ZWxsb3cg5rKh5pyJ5pyq5a6M5oiQ6K6i5Y2VfWApXG4gICAgICAgICAgIHJldHVybjtcbiAgICAgICAgIH1cbiAgICAgICAgbGV0IHRpY2tldHMgPSBbXTtcbiAgICAgICAgaWYoeC5kYXRhLm9yZGVyQ2FjaGVEVE8pIHtcbiAgICAgICAgICBsZXQgb3JkZXJDYWNoZSA9IHguZGF0YS5vcmRlckNhY2hlRFRPO1xuICAgICAgICAgIG9yZGVyQ2FjaGUudGlja2V0cy5mb3JFYWNoKHRpY2tldD0+IHtcbiAgICAgICAgICAgIHRpY2tldHMucHVzaCh7XG4gICAgICAgICAgICAgIFwi5o6S6Zif5Y+3XCI6IG9yZGVyQ2FjaGUucXVldWVOYW1lLFxuICAgICAgICAgICAgICBcIuetieW+heaXtumXtFwiOiBvcmRlckNhY2hlLndhaXRUaW1lLFxuICAgICAgICAgICAgICBcIuetieW+heS6uuaVsFwiOiBvcmRlckNhY2hlLndhaXRDb3VudCxcbiAgICAgICAgICAgICAgXCLkvZnnpajmlbBcIjogb3JkZXJDYWNoZS50aWNrZXRDb3VudCxcbiAgICAgICAgICAgICAgXCLkuZjovabml6XmnJ9cIjogb3JkZXJDYWNoZS50cmFpbkRhdGUuc2xpY2UoMCwxMCksXG4gICAgICAgICAgICAgIFwi6L2m5qyhXCI6IG9yZGVyQ2FjaGUuc3RhdGlvblRyYWluQ29kZSxcbiAgICAgICAgICAgICAgXCLlh7rlj5Hnq5lcIjogb3JkZXJDYWNoZS5mcm9tU3RhdGlvbk5hbWUsXG4gICAgICAgICAgICAgIFwi5Yiw6L6+56uZXCI6IG9yZGVyQ2FjaGUudG9TdGF0aW9uTmFtZSxcbiAgICAgICAgICAgICAgXCLluqfkvY3nrYnnuqdcIjogdGlja2V0LnNlYXRUeXBlTmFtZSxcbiAgICAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3Nlbmdlck5hbWVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgIH1lbHNlIGlmKHguZGF0YS5vcmRlckRCTGlzdCl7XG5cbiAgICAgICAgICB4LmRhdGEub3JkZXJEQkxpc3QuZm9yRWFjaChvcmRlcj0+IHtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGNoYWxrYOiuouWNleWPtyB7eWVsbG93LmJvbGQgJHtvcmRlci5zZXF1ZW5jZV9ub319YClcbiAgICAgICAgICAgIG9yZGVyLnRpY2tldHMuZm9yRWFjaCh0aWNrZXQ9PiB7XG4gICAgICAgICAgICAgIHRpY2tldHMucHVzaCh7XG4gICAgICAgICAgICAgICAgXCLorqLljZXlj7dcIjogdGlja2V0LnNlcXVlbmNlX25vLFxuICAgICAgICAgICAgICAgIC8vIFwi6K6i56Wo5Y+3XCI6IHRpY2tldC50aWNrZXRfbm8sXG4gICAgICAgICAgICAgICAgXCLkuZjovabml6XmnJ9cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRyYWluX2RhdGUuc2xpY2UoMCwxMCl9fWAsXG4gICAgICAgICAgICAgICAgLy8gXCLkuIvljZXml7bpl7RcIjogdGlja2V0LnJlc2VydmVfdGltZSxcbiAgICAgICAgICAgICAgICBcIuS7mOasvuaIquiHs+aXtumXtFwiOiBjaGFsa2B7cmVkLmJvbGQgJHt0aWNrZXQucGF5X2xpbWl0X3RpbWV9fWAsXG4gICAgICAgICAgICAgICAgXCLph5Hpop1cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRpY2tldF9wcmljZS8xMDB9fWAsXG4gICAgICAgICAgICAgICAgXCLnirbmgIFcIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRpY2tldF9zdGF0dXNfbmFtZX19YCxcbiAgICAgICAgICAgICAgICBcIuS5mOi9puS6ulwiOiB0aWNrZXQucGFzc2VuZ2VyRFRPLnBhc3Nlbmdlcl9uYW1lLFxuICAgICAgICAgICAgICAgIFwi6L2m5qyhXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8uc3RhdGlvbl90cmFpbl9jb2RlLFxuICAgICAgICAgICAgICAgIFwi5Ye65Y+R56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8uZnJvbV9zdGF0aW9uX25hbWUsXG4gICAgICAgICAgICAgICAgXCLliLDovr7nq5lcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy50b19zdGF0aW9uX25hbWUsXG4gICAgICAgICAgICAgICAgXCLluqfkvY1cIjogdGlja2V0LnNlYXRfbmFtZSxcbiAgICAgICAgICAgICAgICBcIuW6p+S9jeetiee6p1wiOiB0aWNrZXQuc2VhdF90eXBlX25hbWUsXG4gICAgICAgICAgICAgICAgXCLkuZjovabkurrnsbvlnotcIjogdGlja2V0LnRpY2tldF90eXBlX25hbWVcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHRpY2tldHMsIHtcbiAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJ3wnXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xuICAgICAgfSwgZXJyPT5jb25zb2xlLmVycm9yKGVycikpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeU15T3JkZXJOb0NvbXBsZXRlKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL3F1ZXJ5TXlPcmRlck5vQ29tcGxldGVcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgIH1cbiAgICAgICxqc29uOiB0cnVlXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5KTtcbiAgICAgICAgICAvKipcbiAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAqL1xuICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGJvZHkubWVzc2FnZXM7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICA8ZGl2IGNsYXNzPVwidC1idG5cIj5cbnt7aWYgcGF5X2ZsYWc9PSdZJ319XG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIGlkPVwiY29udGludWVQYXlOb015Q29tcGxldGVcIiBvbmNsaWNrPVwiY29udGl1ZVBheU5vQ29tcGxldGVPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ3BheScpXCIgIGNsYXNzPVwiYnRuOTJzXCI+57un57ut5pSv5LuYPC9hPjwvZGl2PlxuICAgICAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBvbmNsaWNrPVwiY2FuY2VsTXlPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ2NhbmNlbF9vcmRlcicpXCIgaWQ9XCJjYW5jZWxfYnV0dG9uX3BheVwiIGNsYXNzPVwiYnRuOTJcIj7lj5bmtojorqLljZU8L2E+PC9kaXY+XG57ey9pZn19XG57e2lmIHBheV9yZXNpZ25fZmxhZz09J1knfX1cbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgaWQ9XCJjb250aW51ZVBheU5vTXlDb21wbGV0ZVwiIG9uY2xpY2s9XCJjb250aXVlUGF5Tm9Db21wbGV0ZU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywncmVzaWduJyk7XCIgIGNsYXNzPVwiYnRuOTJzXCI+57un57ut5pSv5LuYPC9hPjwvZGl2PlxuXHQgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfcmVzaWduJylcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2Plxue3svaWZ9fVxuXG4gICAgICAgIDwvZGl2PlxuICAqL1xuICBwcml2YXRlIGNhbmNlbE5vQ29tcGxldGVNeU9yZGVyKHNlcXVlbmNlTm86IHN0cmluZywgY2FuY2VsSWQ6IHN0cmluZyA9ICdjYW5jZWxfb3JkZXInKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvY2FuY2VsTm9Db21wbGV0ZU15T3JkZXJcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwic2VxdWVuY2Vfbm9cIjogc2VxdWVuY2VObyxcbiAgXHRcdFx0XCJjYW5jZWxfZmxhZ1wiOiBjYW5jZWxJZCxcbiAgICAgICAgXCJfanNvbl9hdHRcIjpcIlwiXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE5vQ29tcGxldGVPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJykge1xuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuY2FuY2VsTm9Db21wbGV0ZU15T3JkZXIoc2VxdWVuY2VObywgY2FuY2VsSWQpKVxuICAgICAgLnN1YnNjcmliZSgoYm9keSk9PntcbiAgICAgICAgICAvLyB7XCJ2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkXCI6XCJfdmFsaWRhdG9yTWVzc2FnZVwiLFwic3RhdHVzXCI6dHJ1ZSxcImh0dHBzdGF0dXNcIjoyMDAsXCJkYXRhXCI6e30sXCJtZXNzYWdlc1wiOltdLFwidmFsaWRhdGVNZXNzYWdlc1wiOnt9fVxuICAgICAgICAgIGlmIChib2R5LmRhdGEuZXhpc3RFcnJvciA9PSBcIllcIikge1xuICAgICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7Ym9keS5kYXRhLmVycm9yTXNnfX1gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGNoYWxrYHt5ZWxsb3cg6K6i5Y2VICR7c2VxdWVuY2VOb30g5bey5Y+W5raIfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgLGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7SlNPTi5zdHJpbmdpZnkoZXJyKX19YClcbiAgICAgICk7XG4gIH1cbn1cbiJdfQ==
