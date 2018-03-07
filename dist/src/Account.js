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
            .mergeMap(function () { return _this.queryMyOrderNoComplete(); })
            .do(function (body) {
            if (body.data) {
                _this.printMyOrderNoComplete(body);
                if (body.data.orderCacheDTO) {
                    throw '您还有排队订单';
                }
                else if (body.data.orderDBList) {
                    throw '您还有未完成订单';
                }
            }
        })
            .subscribe(function () {
            _this.buildOrderFlow();
            _this.scptCheckUserTimer =
                _this.checkUserTimer.subscribe(function (i) {
                    _this.observableCheckUser()
                        .subscribe(function () { return winston.debug("Check user done"); });
                });
        }, function (err) {
            console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err));
        });
    };
    Account.prototype.orderWaitTime = function () {
        var _this = this;
        this.observableLoginInit()
            .subscribe(function () {
            _this.obsQueryOrderWaitT(new Order_1.Order())
                .subscribe(function (orderRequest) {
                console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
                _this.destroy();
            }, function (err) { return console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); }, function () {
                _this.destroy();
            });
        }, function (err) { return console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); }, function () {
            _this.destroy();
        });
    };
    Account.prototype.cancelOrderQueue = function () {
        this.cancelQueueNoCompleteOrder()
            .then(function (x) {
            if (x.status && x.data.existError == 'N') {
                console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"], ["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"]))));
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
            return console.log(chalk(templateObject_8 || (templateObject_8 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
        }); })
            .retryWhen(function (error$) {
            return error$.do(function () { return console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"])))); });
        });
    };
    Account.prototype.observableLogin = function () {
        var _this = this;
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.observableCheckCaptcha(); })
            .mergeMap(function () {
            return _this.userAuthenticate()
                .do(function () { return console.log(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"])))); });
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
            console.log(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err.result_message));
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
                console.log(chalk(templateObject_12 || (templateObject_12 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"]))));
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
                        .map(function (passTrains) {
                        order.fromToPassTrains = passTrains.map(function (train) { return train[3]; });
                        return order;
                    });
                }
            }
            return Observable_1.Observable.of(order);
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
                throw chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"], ["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"])), order.fromStationName, order.toStationName, order.passStationName ? '到' + order.passStationName + ' ' : '', order.trainDate);
            }
        })
            .retryWhen(function (error$) { return error$.do(function (err) { return process.stdout.write(err); }).delay(500); })
            .switchMap(function (order) {
            console.log(chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\u9884\u63D0\u4EA4\u8BA2\u5355 {yellow ", "} \u5230 {yellow ", "} \u65E5\u671F {yellow ", "}"], ["\u9884\u63D0\u4EA4\u8BA2\u5355 {yellow ", "} \u5230 {yellow ", "} \u65E5\u671F {yellow ", "}"])), order.fromStationName, order.toStationName, order.trainDate));
            return Observable_1.Observable.of(1)
                .mergeMap(function () { return _this.submitOrderRequest(order); })
                .retryWhen(function (error$) {
                return error$.do(function (err) { return winston.debug("SubmitOrderRequest error " + err)
                    .delay(500); });
            })
                .map(function (body) { return [order, body]; });
        })
            .map(function (_a) {
            var order = _a[0], body = _a[1];
            if (body.status) {
                winston.debug(chalk(templateObject_15 || (templateObject_15 = __makeTemplateObject(["{blue Submit Order Request success!}"], ["{blue Submit Order Request success!}"]))));
                return order;
            }
            else {
                // 您还有未处理的订单
                // 该车次暂不办理业务
                winston.error(chalk(templateObject_16 || (templateObject_16 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.messages[0]));
                // this.destroy();
                throw chalk(templateObject_17 || (templateObject_17 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.messages[0]);
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
                    return error$.do(function (err) { return winston.error(chalk(templateObject_18 || (templateObject_18 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err)); })
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
            console.log(chalk(templateObject_19 || (templateObject_19 = __makeTemplateObject(["\u51C6\u5907\u8FDB\u5165\u6392\u961F"], ["\u51C6\u5907\u8FDB\u5165\u6392\u961F"]))));
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
            console.log(chalk(templateObject_20 || (templateObject_20 = __makeTemplateObject(["\u63D0\u4EA4\u6392\u961F\u8BA2\u5355"], ["\u63D0\u4EA4\u6392\u961F\u8BA2\u5355"]))));
            return _this.confirmSingleForQueue(order.request.token, order.request.passengers.data.normal_passengers, order.request.ticketInfo, order.planPepoles)
                .retryWhen(function (error$) { return error$.delay(100); })
                .map(function (body) {
                if (body.status && body.data.submitStatus) {
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
                    console.error(chalk(templateObject_21 || (templateObject_21 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.data.errMsg));
                    throw 'retry';
                }
            });
        })
            .retryWhen(function (error$) { return error$.do(function (err) { return winston.error(chalk(templateObject_22 || (templateObject_22 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err)); })
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
                return error$.do(function (err) { return winston.error(chalk(templateObject_23 || (templateObject_23 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err)); })
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
                .subscribe(function () {
                console.log(chalk(templateObject_24 || (templateObject_24 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
                _this.destroy();
            }, function (err) { return winston.error(chalk(templateObject_25 || (templateObject_25 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); });
        }, function (err) {
            winston.error(chalk(templateObject_26 || (templateObject_26 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), JSON.stringify(err)));
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
            if (orderQueue.status) {
                if (orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
                    // 0.5秒响一次，响铃30分钟
                    beeper(60 * 30 * 2);
                    return console.log(chalk(templateObject_27 || (templateObject_27 = __makeTemplateObject(["\u60A8\u7684\u8F66\u7968\u8BA2\u5355\u53F7\u662F {red.bold ", "}"], ["\u60A8\u7684\u8F66\u7968\u8BA2\u5355\u53F7\u662F {red.bold ", "}"])), orderQueue.data.orderId));
                }
                else if (orderQueue.data.waitTime === -2) {
                    if (orderQueue.data.msg) {
                        return console.log(chalk(templateObject_28 || (templateObject_28 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), orderQueue.data.msg));
                    }
                    return console.log(orderQueue);
                }
                else if (orderQueue.data.waitTime === -3) {
                    return console.log("您的车票订单已经取消!");
                }
                else if (orderQueue.data.waitTime === -4) {
                    console.log("您的车票订单正在处理, 请稍等...");
                }
                else {
                    console.log(chalk(templateObject_29 || (templateObject_29 = __makeTemplateObject(["\u6392\u961F\u4EBA\u6570\uFF1A{yellow.bold ", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A{yellow.bold ", "} \u5206\u949F"], ["\u6392\u961F\u4EBA\u6570\uFF1A{yellow.bold ", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A{yellow.bold ", "} \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
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
            console.log(chalk(templateObject_30 || (templateObject_30 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"], ["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"]))));
            return Observable_1.Observable.throw('请输入乘车日期');
        }
        // this.BACK_TRAIN_DATE = trainDate;
        if (!fromStation) {
            console.log(chalk(templateObject_31 || (templateObject_31 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"]))));
            return Observable_1.Observable.throw('请输入出发站');
        }
        // this.FROM_STATION_NAME = fromStationName;
        if (!toStation) {
            console.log(chalk(templateObject_32 || (templateObject_32 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"]))));
            return Observable_1.Observable.throw('请输入到达站');
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
        var planTrains = typeof f == "string" ? f.split(',') : (typeof filter == "string" ? filter.split(',') : undefined);
        var planTimes = typeof t == "string" ? t.split(',') : (typeof time == "string" ? time.split(',') : undefined);
        var planOrderBy = typeof o == "string" ? o.split(',') : (typeof orderby == "string" ? orderby.split(',') : undefined);
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
            backTrainDate: trainDate,
            fromStationName: fromStationName,
            toStationName: toStationName,
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
                return console.log(chalk(templateObject_33 || (templateObject_33 = __makeTemplateObject(["{yellow \u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8F66\u6B21}"], ["{yellow \u6CA1\u6709\u7B26\u5408\u6761\u4EF6\u7684\u8F66\u6B21}"]))));
            }
            _this.renderLeftTickets(trains);
        });
    };
    Account.prototype.renderTrainListTitle = function (trains) {
        var title = this.TICKET_TITLE.map(function (t) { return chalk(templateObject_34 || (templateObject_34 = __makeTemplateObject(["{blue ", "}"], ["{blue ", "}"])), t); });
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
            rl.question(chalk(templateObject_35 || (templateObject_35 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positionStr) {
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
            _this.printMyOrderNoComplete(x);
        }, function (err) { return console.error(err); });
    };
    Account.prototype.printMyOrderNoComplete = function (x) {
        if (!x.data) {
            console.error(chalk(templateObject_36 || (templateObject_36 = __makeTemplateObject(["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"], ["{yellow \u6CA1\u6709\u672A\u5B8C\u6210\u8BA2\u5355}"]))));
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
                        "乘车日期": chalk(templateObject_37 || (templateObject_37 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.train_date.slice(0, 10)),
                        // "下单时间": ticket.reserve_time,
                        "付款截至时间": chalk(templateObject_38 || (templateObject_38 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), ticket.pay_limit_time),
                        "金额": chalk(templateObject_39 || (templateObject_39 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_price / 100),
                        "状态": chalk(templateObject_40 || (templateObject_40 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), ticket.ticket_status_name),
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
                winston.error(chalk(templateObject_41 || (templateObject_41 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), body.data.errorMsg));
            }
            else {
                console.warn(chalk(templateObject_42 || (templateObject_42 = __makeTemplateObject(["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"], ["{yellow \u8BA2\u5355 ", " \u5DF2\u53D6\u6D88}"])), sequenceNo));
            }
        }, function (err) { return winston.error(chalk(templateObject_43 || (templateObject_43 = __makeTemplateObject(["{red ", "}"], ["{red ", "}"])), JSON.stringify(err))); });
    };
    return Account;
}());
exports.Account = Account;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18, templateObject_19, templateObject_20, templateObject_21, templateObject_22, templateObject_23, templateObject_24, templateObject_25, templateObject_26, templateObject_27, templateObject_28, templateObject_29, templateObject_30, templateObject_31, templateObject_32, templateObject_33, templateObject_34, templateObject_35, templateObject_36, templateObject_37, templateObject_38, templateObject_39, templateObject_40, templateObject_41, templateObject_42, templateObject_43;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QztRQWJnRCx5QkFBQSxFQUFBLHlCQUFpQztRQUNoRixJQUFJLENBQUMsbUJBQW1CLEVBQUU7YUFDdkIsUUFBUSxDQUFDLGNBQUksT0FBQSxLQUFJLENBQUMsdUJBQXVCLENBQUMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxFQUFsRCxDQUFrRCxDQUFDO2FBQ2hFLFNBQVMsQ0FBQyxVQUFDLElBQUk7WUFDWiw4SEFBOEg7WUFDOUgsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDaEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLGlGQUFBLE9BQVEsRUFBa0IsR0FBRyxLQUFyQixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBSSxDQUFDO1lBQ3BELENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssb0hBQUEsdUJBQWMsRUFBVSxzQkFBTyxLQUFqQixVQUFVLEVBQVEsQ0FBQztZQUNyRCxDQUFDO1FBQ0gsQ0FBQyxFQUNGLFVBQUEsR0FBRyxJQUFFLE9BQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLGlGQUFBLE9BQVEsRUFBbUIsR0FBRyxLQUF0QixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFJLEVBQWxELENBQWtELENBQ3ZELENBQUM7SUFDTixDQUFDO0lBQ0gsY0FBQztBQUFELENBdGdEQSxBQXNnREMsSUFBQTtBQXRnRFksMEJBQU8iLCJmaWxlIjoic3JjL0FjY291bnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgLy8gaHR0cHM6Ly93d3cubGFuaW5kZXguY29tLzEyMzA2JUU4JUI0JUFEJUU3JUE1JUE4JUU2JUI1JTgxJUU3JUE4JThCJUU1JTg1JUE4JUU4JUE3JUEzJUU2JTlFJTkwL1xuXG5pbXBvcnQgd2luc3RvbiA9IHJlcXVpcmUoJ3dpbnN0b24nKTtcbmltcG9ydCB7RmlsZUNvb2tpZVN0b3JlfSBmcm9tICcuL0ZpbGVDb29raWVTdG9yZSc7XG5pbXBvcnQge1N0YXRpb259IGZyb20gJy4vU3RhdGlvbic7XG5pbXBvcnQgcmVxdWVzdCA9IHJlcXVpcmUoJ3JlcXVlc3QnKTtcbmltcG9ydCBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5pbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xuaW1wb3J0IHJlYWRsaW5lID0gcmVxdWlyZSgncmVhZGxpbmUnKTtcbmltcG9ydCBwcm9jZXNzID0gcmVxdWlyZSgncHJvY2VzcycpO1xuaW1wb3J0IFJ4IGZyb20gJ3J4anMvUngnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgT2JzZXJ2YWJsZUlucHV0IH0gZnJvbSAncnhqcy9PYnNlcnZhYmxlJztcbmltcG9ydCB7IE9ic2VydmVyIH0gZnJvbSAncnhqcy9PYnNlcnZlcic7XG5pbXBvcnQgJ3J4anMvYWRkL29ic2VydmFibGUvYmluZENhbGxiYWNrJztcbmltcG9ydCBjaGFsayA9IHJlcXVpcmUoJ2NoYWxrJyk7XG5pbXBvcnQgY29sdW1uaWZ5ID0gcmVxdWlyZSgnY29sdW1uaWZ5Jyk7XG5pbXBvcnQgYmVlcGVyID0gcmVxdWlyZSgnYmVlcGVyJyk7XG5pbXBvcnQgY2hpbGRfcHJvY2VzcyA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcblxuaW1wb3J0IHtPcmRlclN1Ym1pdFJlcXVlc3QsIElPcmRlciwgT3JkZXJ9IGZyb20gJy4vT3JkZXInO1xuXG5pbnRlcmZhY2UgT3JkZXJTdWJtaXRSZXF1ZXN0IHtcbiAgdG9rZW46IHN0cmluZztcbiAgdGlja2V0SW5mbzogb2JqZWN0O1xuICBvcmRlclJlcXVlc3Q6IG9iamVjdDtcbn1cblxuZXhwb3J0IGNsYXNzIEFjY291bnQge1xuICBwdWJsaWMgdXNlck5hbWUgOiBzdHJpbmc7XG4gIHB1YmxpYyB1c2VyUGFzc3dvcmQgOiBzdHJpbmc7XG4gIHByaXZhdGUgY2hlY2tVc2VyVGltZXIgPSBSeC5PYnNlcnZhYmxlLnRpbWVyKDEwMDAqNjAqMTAsIDEwMDAqNjAqMTApOyAvLyDljYHliIbpkp/kuYvlkI7lvIDlp4vvvIzmr4/ljYHliIbpkp/mo4Dmn6XkuIDmrKFcbiAgcHJpdmF0ZSBzY3B0Q2hlY2tVc2VyVGltZXI/OiBSeC5TdWJzY3JpcHRpb247XG5cbiAgcHJpdmF0ZSBzdGF0aW9uczogU3RhdGlvbiA9IG5ldyBTdGF0aW9uKCk7XG4gIHByaXZhdGUgcGFzc2VuZ2Vycz86IG9iamVjdDtcblxuICBwcml2YXRlIFNZU1RFTV9CVVNTWSA9IFwiU3lzdGVtIGlzIGJ1c3N5XCI7XG4gIHByaXZhdGUgU1lTVEVNX01PVkVEID0gXCJNb3ZlZCBUZW1wb3JhcmlseVwiO1xuXG4gIHByaXZhdGUgcmF3UmVxdWVzdDogKG9wdGlvbnM6YW55fHVuZGVmaW5lZHxudWxsLCBjYjphbnkpPT5hbnk7XG4gIHByaXZhdGUgcmVxdWVzdDogKG9wdGlvbnM/OmFueXx1bmRlZmluZWR8bnVsbCk9Pk9ic2VydmFibGU8YW55PjtcbiAgcHJpdmF0ZSBjb29raWVqYXI6IGFueTtcbiAgcHVibGljIGhlYWRlcnM6IG9iamVjdCA9IHtcbiAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOFwiXG4gICAgLFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDYuMTsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4xNyAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8yNC4wLjEzMTIuNjAgU2FmYXJpLzUzNy4xN1wiXG4gICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxuICAgICxcIk9yaWdpblwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jblwiXG4gICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxuICB9O1xuXG4gIHByaXZhdGUgVElDS0VUX1RJVExFID0gWycnLCAnJywgJycsICfovabmrKEnLCAn6LW35aeLJywgJ+e7iOeCuScsICflh7rlj5Hnq5knLCAn5Yiw6L6+56uZJywgJ+WHuuWPkeaXticsICfliLDovr7ml7YnLCAn5Y6G5pe2JywgJycsICcnLFxuICAgICAgICAgICAgICAgJ+aXpeacnycsICcnLCAnJywgJycsICcnLCAnJywgJycsICcnLCAn6auY57qn6L2v5Y2nJywgJycsICfova/ljacnLCAn6L2v5bqnJywgJ+eJueetieW6pycsICfml6DluqcnLFxuICAgICAgICAgICAgICAgJycsICfnoazljacnLCAn56Gs5bqnJywgJ+S6jOetieW6pycsICfkuIDnrYnluqcnLCAn5ZWG5Yqh5bqnJ107XG5cbiAgcHJpdmF0ZSBxdWVyeSA9IGZhbHNlO1xuXG4gIHByaXZhdGUgb3JkZXJzOiBBcnJheTxPcmRlcj4gPSBbXTtcblxuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHVzZXJQYXNzd29yZDogc3RyaW5nKSB7XG4gICAgdGhpcy51c2VyTmFtZSA9IG5hbWU7XG4gICAgdGhpcy51c2VyUGFzc3dvcmQgPSB1c2VyUGFzc3dvcmQ7XG5cbiAgICB0aGlzLnNldFJlcXVlc3QoKTtcbiAgICB0aGlzLnJhd1JlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XG4gICAgdGhpcy5yZXF1ZXN0ID0gT2JzZXJ2YWJsZS5iaW5kQ2FsbGJhY2s8QXJyYXk8YW55Pj4odGhpcy5yYXdSZXF1ZXN0LCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgIT09IDIwMCkgdGhyb3cgWydodHRwIGVycm9yJywgcmVzcG9uc2Uuc3RhdHVzQ29kZSwgcmVzcG9uc2Uuc3RhdHVzTWVzc2FnZV0uam9pbignICcpO1xuICAgICAgcmV0dXJuIGJvZHk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5qOA5p+l572R57uc5byC5bi4XG4gICAqL1xuICBwcml2YXRlIGlzU3lzdGVtQnVzc3koYm9keTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGJvZHkuaW5kZXhPZihcIue9kee7nOWPr+iDveWtmOWcqOmXrumimO+8jOivt+aCqOmHjeivleS4gOS4i1wiKSA+IDA7XG4gIH1cblxuICBwdWJsaWMgc2V0UmVxdWVzdCgpIHtcbiAgICBsZXQgY29va2llRmlsZU5hbWU6IHN0cmluZyA9IFwiLi9jb29raWVzL1wiK3RoaXMudXNlck5hbWUrXCIuanNvblwiO1xuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKGNvb2tpZUZpbGVOYW1lLCB7ZW5jcnlwdDogZmFsc2V9KTtcbiAgICBmaWxlU3RvcmUub3B0aW9uID0ge2VuY3J5cHQ6IGZhbHNlfTtcblxuICAgIHRoaXMuY29va2llamFyID0gcmVxdWVzdC5qYXIoZmlsZVN0b3JlKTtcblxuICAgIC8vIHRoaXMucmVxdWVzdCA9IHJlcXVlc3QuZGVmYXVsdHMoe2phcjogdGhpcy5jb29raWVqYXJ9KTtcblxuICB9XG5cbiAgcHJpdmF0ZSBuZXh0T3JkZXJOdW06IG51bWJlciA9IDA7XG4gIHByaXZhdGUgbmV4dE9yZGVyKCkge1xuICAgIHRoaXMubmV4dE9yZGVyTnVtID0gKHRoaXMubmV4dE9yZGVyTnVtICsgMSkldGhpcy5vcmRlcnMubGVuZ3RoO1xuICAgIHJldHVybiB0aGlzLm9yZGVyc1t0aGlzLm5leHRPcmRlck51bV07XG4gIH1cblxuICBwcml2YXRlIGN1cnJlbnRPcmRlcigpIHtcbiAgICByZXR1cm4gdGhpcy5vcmRlcnNbdGhpcy5uZXh0T3JkZXJOdW1dO1xuICB9XG5cbiAgcHVibGljIGNyZWF0ZU9yZGVyKHRyYWluRGF0ZXM6IEFycmF5PHN0cmluZz4sIGJhY2tUcmFpbkRhdGU6IHN0cmluZyxcbiAgICAgICAgICAgICAgICAgICAgIFtmcm9tU3RhdGlvbk5hbWUsIHRvU3RhdGlvbk5hbWUsIHBhc3NTdGF0aW9uTmFtZV0sXG4gICAgICAgICAgICAgICAgICAgICBwbGFuVHJhaW5zOiBBcnJheTxzdHJpbmc+LCBwbGFuUGVwb2xlczogQXJyYXk8c3RyaW5nPiwgc2VhdENsYXNzZXM6IEFycmF5PHN0cmluZz4pOiB0aGlzIHtcbiAgICB0cmFpbkRhdGVzLmZvckVhY2godHJhaW5EYXRlPT4ge1xuICAgICAgaWYoIW5ldyBEYXRlKHRyYWluRGF0ZSkudG9KU09OKCkpIHtcbiAgICAgICAgdGhyb3cgY2hhbGtge3JlZCDkuZjovabml6XmnJ8ke3RyYWluRGF0ZX3moLzlvI/kuI3mraPnoa7vvIzmoLzlvI/lupTor6XmmK95eXl5LU1NLWRkfWA7XG4gICAgICB9XG4gICAgICBpZihuZXcgRGF0ZSh0cmFpbkRhdGUpLnRvSlNPTigpLnNsaWNlKDAsMTApIDwgbmV3IERhdGUoKS50b0pTT04oKS5zbGljZSgwLDEwKSkge1xuICAgICAgICB0aHJvdyBjaGFsa2B7cmVkIOS5mOi9puaXpeacn+W6lOivpeS4uuS7iuWkqeaIluS7peWQjn1gO1xuICAgICAgfVxuXG4gICAgICB0aGlzLm9yZGVycy5wdXNoKFxuICAgICAgICBuZXcgT3JkZXIodHJhaW5EYXRlLCBiYWNrVHJhaW5EYXRlLCBmcm9tU3RhdGlvbk5hbWUsIHRvU3RhdGlvbk5hbWUsIHBhc3NTdGF0aW9uTmFtZSwgcGxhblRyYWlucywgcGxhblBlcG9sZXMsIHNlYXRDbGFzc2VzKVxuICAgICAgKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgcHVibGljIHN1Ym1pdCgpOiB2b2lkIHtcbiAgICB0aGlzLm9ic2VydmFibGVMb2dpbkluaXQoKVxuICAgICAgLy8g5qOA5p+l5pyq5a6M5oiQ6K6i5Y2VXG4gICAgICAubWVyZ2VNYXAoKCk9PiB0aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKSlcbiAgICAgIC5kbyhib2R5PT4ge1xuICAgICAgICBpZihib2R5LmRhdGEpIHtcbiAgICAgICAgICB0aGlzLnByaW50TXlPcmRlck5vQ29tcGxldGUoYm9keSk7XG4gICAgICAgICAgaWYoYm9keS5kYXRhLm9yZGVyQ2FjaGVEVE8pIHtcbiAgICAgICAgICAgIHRocm93ICfmgqjov5jmnInmjpLpmJ/orqLljZUnO1xuICAgICAgICAgIH1lbHNlIGlmKGJvZHkuZGF0YS5vcmRlckRCTGlzdCl7XG4gICAgICAgICAgICB0aHJvdyAn5oKo6L+Y5pyJ5pyq5a6M5oiQ6K6i5Y2VJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAvLyDlh4blpIflpb3lkI7ov5vooYzorqLnpajmtYHnqItcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcbiAgICAgICAgdGhpcy5idWlsZE9yZGVyRmxvdygpO1xuXG4gICAgICAgIHRoaXMuc2NwdENoZWNrVXNlclRpbWVyID1cbiAgICAgICAgICB0aGlzLmNoZWNrVXNlclRpbWVyLnN1YnNjcmliZSgoaSk9PiB7XG4gICAgICAgICAgICB0aGlzLm9ic2VydmFibGVDaGVja1VzZXIoKVxuICAgICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT53aW5zdG9uLmRlYnVnKFwiQ2hlY2sgdXNlciBkb25lXCIpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0sZXJyPT4ge1xuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7cmVkLmJvbGQgJHtlcnJ9fWApO1xuICAgICAgfSk7XG4gIH1cblxuICBwdWJsaWMgb3JkZXJXYWl0VGltZSgpIHtcbiAgICB0aGlzLm9ic2VydmFibGVMb2dpbkluaXQoKVxuICAgICAgLnN1YnNjcmliZSgoKT0+e1xuICAgICAgICB0aGlzLm9ic1F1ZXJ5T3JkZXJXYWl0VChuZXcgT3JkZXIoKSlcbiAgICAgICAgICAuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg57uT5p2ffWApO1xuICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICxlcnI9PmNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6ZSZ6K+v57uT5p2fICR7ZXJyfX1gKVxuICAgICAgICAgICAgLCgpPT57XG4gICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICB9XG4gICAgICAsZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YClcbiAgICAgICwoKT0+e1xuICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE9yZGVyUXVldWUoKSB7XG4gICAgdGhpcy5jYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpXG4gICAgICAudGhlbih4PT4ge1xuICAgICAgICBpZih4LnN0YXR1cyAmJiB4LmRhdGEuZXhpc3RFcnJvciA9PSAnTicpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDmjpLpmJ/orqLljZXlt7Llj5bmtoh9YCk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKHgpO1xuICAgICAgICB9XG4gICAgICB9LCBlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95KCkge1xuICAgIHRoaXMuc2NwdENoZWNrVXNlclRpbWVyJiZ0aGlzLnNjcHRDaGVja1VzZXJUaW1lci51bnN1YnNjcmliZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlQ2hlY2tDYXB0Y2hhKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuZ2V0Q2FwdGNoYSgpKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmNoZWNrQ2FwdGNoYSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZG8oKCk9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDmoKHpqoznoIHmiJDlip/lkI7ov5vooYzmjojmnYPorqTor4FcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg6aqM6K+B56CB5qCh6aqM5oiQ5YqffWApXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICApXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbygoKT0+Y29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjH1gKSlcbiAgICAgICk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVMb2dpbigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVDaGVja0NhcHRjaGEoKSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+XG4gICAgICAgIHRoaXMudXNlckF1dGhlbnRpY2F0ZSgpXG4gICAgICAgICAgLmRvKCgpPT5jb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDnmbvlvZXmiJDlip99YCkpXG4gICAgICApXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5tZXJnZU1hcChlcnI9PiB7XG4gICAgICAgICAgLypcbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi5a+G56CB6L6T5YWl6ZSZ6K+v44CC5aaC5p6c6L6T6ZSZ5qyh5pWw6LaF6L+HNOasoe+8jOeUqOaIt+Wwhuiiq+mUgeWumuOAglwiLFwicmVzdWx0X2NvZGVcIjoxfVxuICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLpqozor4HnoIHmoKHpqozlpLHotKVcIixcInJlc3VsdF9jb2RlXCI6XCI1XCJ9XG4gICAgICAgICAgKi9cbiAgICAgICAgICBpZih0eXBlb2YgZXJyLnJlc3VsdF9jb2RlID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDEwMDApO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLmNhdGNoKGVycj0+IHtcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyLnJlc3VsdF9tZXNzYWdlfX1gKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlTmV3QXBwVG9rZW4oKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmdldE5ld0FwcFRva2VuKCkpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoZXJyKSlcbiAgICAgICAgICAubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUxvZ2luKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0azogc3RyaW5nKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICBsZXQgbmV3QXBwVG9rZW4gPSBuZXdhcHB0aztcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjxzdHJpbmc+KT0+IHtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChuZXdBcHBUb2tlbik7XG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XG4gICAgICB9KVxuICAgICAgLm1lcmdlTWFwKChuZXdhcHB0azogc3RyaW5nKT0+dGhpcy5nZXRBcHBUb2tlbihuZXdhcHB0aykpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoZXJyKSlcbiAgICAgICAgICAubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOiOt+WPllRva2Vu5aSx6LSlfWApO1xuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhlcnIpO1xuICAgICAgICAgICAgaWYoZXJyLnJlc3VsdF9jb2RlICYmIGVyci5yZXN1bHRfY29kZSA9PT0gMikge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTmV3QXBwVG9rZW4oKS5kbygobmV3YXBwdGspPT5uZXdBcHBUb2tlbiA9IG5ld2FwcHRrKTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUxvZ2luSW5pdCgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuXG4gICAgLy8g55m75b2V5Yid5aeL5YyWXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcChvcmRlcj0+dGhpcy5sb2dpbkluaXQoKSlcbiAgICAgIC5yZXRyeSgxMDAwKVxuICAgICAgLm1hcChvcmRlciA9PiB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24odGhpcy5jb29raWVqYXIuX2phci50b0pTT04oKS5jb29raWVzKSlcbiAgICAgIC5tZXJnZU1hcCh0b2tlbnM9PiB7XG4gICAgICAgIGlmKHRva2Vucy50aykge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVBcHBUb2tlbih0b2tlbnMudGspO1xuICAgICAgICB9ZWxzZSBpZih0b2tlbnMudWFtdGspIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTmV3QXBwVG9rZW4oKVxuICAgICAgICAgICAgLm1lcmdlTWFwKG5ld2FwcHRrPT50aGlzLm9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0aykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbigpXG4gICAgICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpKVxuICAgICAgICAgIC5tZXJnZU1hcChuZXdhcHB0az0+dGhpcy5vYnNlcnZhYmxlQXBwVG9rZW4obmV3YXBwdGspKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaVsOe7hOWkmuWFs+mUruWtl+auteaOkuW6j+eul+azle+8jOWtl+autem7mOiupOS4uumAkuWHj+aOkuW6j++8jOWmguaenOWtl+auteWJjemdouW4puaciSvnrKblj7fliJnkuLrpgJLlop7mjpLluo9cbiAgICovXG4gIHByaXZhdGUgZmllbGRTb3J0ZXIoZmllbGRzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgcmV0dXJuIChhOmFueSwgYjphbnkpID0+IGZpZWxkcy5tYXAoKG86c3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGxldCBkaXIgPSAtMTtcbiAgICAgICAgICAgICAgaWYgKG9bMF0gPT09ICcrJykge1xuICAgICAgICAgICAgICAgIGRpciA9IDE7XG4gICAgICAgICAgICAgICAgbyA9IG8uc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICB9ZWxzZSBpZihvWzBdID09PSAnLScpIHtcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGFbb10gPiBiW29dID8gZGlyIDogYVtvXSA8IGJbb10gPyAtKGRpcikgOiAwO1xuICAgICAgICAgIH0pLnJlZHVjZSgocCwgbikgPT4gcCA/IHAgOiBuLCAwKTtcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlPElPcmRlcj4ge1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpXG4gICAgICAvLyDojrflj5bkvZnnpajkv6Hmga9cbiAgICAgIC5tZXJnZU1hcCgob3JkZXI6IElPcmRlcik6IE9ic2VydmFibGVJbnB1dDxJT3JkZXI+ID0+XG4gICAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyhvcmRlci50cmFpbkRhdGUsIG9yZGVyLmZyb21TdGF0aW9uLCBvcmRlci50b1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXG4gICAgICAgICAgLm1hcCgodHJhaW5zKT0+IHtcbiAgICAgICAgICAgIG9yZGVyLnRyYWlucyA9IHRyYWlucztcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLy8g6I635Y+W6YCU57uP56uZ6L2m5qyh5L+h5oGvXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlSW5wdXQ8SU9yZGVyPiA9PiB7XG4gICAgICAgIGlmKG9yZGVyLnBhc3NTdGF0aW9uKSB7XG4gICAgICAgICAgaWYoIW9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnF1ZXJ5TGVmdFRpY2tldHMob3JkZXIudHJhaW5EYXRlLCBvcmRlci5mcm9tU3RhdGlvbiwgb3JkZXIucGFzc1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXG4gICAgICAgICAgICAgIC5tYXAocGFzc1RyYWlucz0+IHtcbiAgICAgICAgICAgICAgICBvcmRlci5mcm9tVG9QYXNzVHJhaW5zID0gcGFzc1RyYWlucy5tYXAodHJhaW49PiB0cmFpblszXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpO1xuICAgICAgfSlcbiAgICAgIC8vIOaMiemAlOe7j+ermei9puasoei/h+a7pFxuICAgICAgLm1hcCgob3JkZXI6IElPcmRlcik6IElPcmRlciA9PiB7XG4gICAgICAgIGlmKG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSBvcmRlci50cmFpbnMuZmlsdGVyKHRyYWluID0+IG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMuaW5jbHVkZXModHJhaW5bM10pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICB9KVxuICAgICAgLy8g5oyJ5pe26Ze06IyD5Zu06L+H5rukXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcbiAgICAgICAgaWYob3JkZXIucGxhblRpbWVzKSB7XG4gICAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG4gICAgICAgICAgb3JkZXIudHJhaW5zID0gdHJhaW5zLmZpbHRlcih0cmFpbj0+IHtcbiAgICAgICAgICAgIHJldHVybiAob3JkZXIucGxhblRpbWVzWzBdP29yZGVyLnBsYW5UaW1lc1swXTw9dHJhaW5bOF06dHJ1ZSkmJihvcmRlci5wbGFuVGltZXNbMV0/b3JkZXIucGxhblRpbWVzWzFdPj10cmFpbls4XTp0cnVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDmoLnmja7lrZfmrrXmjpLluo9cbiAgICAgIC5tYXAoKG9yZGVyOiBJT3JkZXIpOiBJT3JkZXIgPT4ge1xuICAgICAgICBpZihvcmRlci5wbGFuT3JkZXJCeSkge1xuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IG9yZGVyLnRyYWlucy5zb3J0KHRoaXMuZmllbGRTb3J0ZXIob3JkZXIucGxhbk9yZGVyQnkpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICB9KVxuICAgICAgLy8g6K6h566X5Y+v6LSt5Lmw6L2m5qyh5L+h5oGvXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcbiAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG5cbiAgICAgICAgbGV0IHBsYW5UcmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW10sIHRoYXQgPSB0aGlzO1xuICAgICAgICB0cmFpbnMuc29tZSh0cmFpbiA9PiB7XG4gICAgICAgICAgcmV0dXJuIG9yZGVyLnNlYXRDbGFzc2VzLnNvbWUoc2VhdCA9PiB7XG4gICAgICAgICAgICB2YXIgc2VhdE51bSA9IHRoaXMuVElDS0VUX1RJVExFLmluZGV4T2Yoc2VhdCk7XG4gICAgICAgICAgICBpZih0cmFpbltzZWF0TnVtXSA9PSBcIuaciVwiIHx8IHRyYWluW3NlYXROdW1dID4gMCkge1xuICAgICAgICAgICAgICB3aW5zdG9uLmRlYnVnKG9yZGVyLnRyYWluRGF0ZStcIi9cIit0cmFpblszXStcIi9cIitzZWF0K1wiL1wiK3RyYWluW3NlYXROdW1dKTtcbiAgICAgICAgICAgICAgaWYob3JkZXIucGxhblRyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpIHtcbiAgICAgICAgICAgICAgICBwbGFuVHJhaW5zLnB1c2godHJhaW4pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG9yZGVyLmF2YWlsYWJsZVRyYWlucyA9IHBsYW5UcmFpbnM7XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZWN1cnNpdmVRdWVyeUxlZnRUaWNrZXQoKTogT2JzZXJ2YWJsZTxPcmRlcj4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPE9yZGVyPik9PiB7XG4gICAgICAgIG9ic2VydmVyLm5leHQodGhpcy5uZXh0T3JkZXIoKSk7XG4gICAgICB9KVxuICAgICAgLm1lcmdlTWFwKChvcmRlcjogT3JkZXIpPT50aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0RmxvdyhvcmRlcikpXG4gICAgICAuZG8oKCk9PiB7XG4gICAgICAgIGlmKHRoaXMucXVlcnkpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5tYXAob3JkZXI9PiB7XG4gICAgICAgIGlmKG9yZGVyLmF2YWlsYWJsZVRyYWlucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IGZhbHNlO1xuICAgICAgICAgIC8vIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYHt5ZWxsb3cg5pyJ5Y+v6LSt5Lmw5L2Z56WoICR7cGxhblRyYWluLnRvU3RyaW5nKCl9fWApO1xuICAgICAgICAgIG9yZGVyLnRyYWluU2VjcmV0U3RyID0gb3JkZXIuYXZhaWxhYmxlVHJhaW5zWzBdWzBdO1xuICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRoaXMucXVlcnkgPSB0cnVlO1xuICAgICAgICAgIHRocm93IGNoYWxrYOayoeacieWPr+i0reS5sOS9meelqCB7eWVsbG93ICR7b3JkZXIuZnJvbVN0YXRpb25OYW1lfX0g5YiwIHt5ZWxsb3cgJHtvcmRlci50b1N0YXRpb25OYW1lfX0gJHtvcmRlci5wYXNzU3RhdGlvbk5hbWU/J+WIsCcrb3JkZXIucGFzc1N0YXRpb25OYW1lKycgJzonJ317eWVsbG93ICR7b3JkZXIudHJhaW5EYXRlfX1gO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbyhlcnI9PnByb2Nlc3Muc3Rkb3V0LndyaXRlKGVycikpLmRlbGF5KDUwMCkpXG4gICAgICAvLyDmo4Dmn6XnlKjmiLfnmbvlvZXnirbmgIFcbiAgICAgIC8vIC5tZXJnZU1hcCgob3JkZXI6IE9yZGVyKT0+dGhpcy5vYnNlcnZhYmxlQ2hlY2tVc2VyKCkubWFwKCgpPT5vcmRlcikpXG5cbiAgICAgIC8vIFN0ZXAgMTEg6aKE5o+Q5Lqk6K6i5Y2V77yMUG9zdFxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+e1xuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2DpooTmj5DkuqTorqLljZUge3llbGxvdyAke29yZGVyLmZyb21TdGF0aW9uTmFtZX19IOWIsCB7eWVsbG93ICR7b3JkZXIudG9TdGF0aW9uTmFtZX19IOaXpeacnyB7eWVsbG93ICR7b3JkZXIudHJhaW5EYXRlfX1gKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuc3VibWl0T3JkZXJSZXF1ZXN0KG9yZGVyKSlcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZGVidWcoXCJTdWJtaXRPcmRlclJlcXVlc3QgZXJyb3IgXCIgKyBlcnIpXG4gICAgICAgICAgICAgICAgLmRlbGF5KDUwMCkpXG4gICAgICAgICAgKVxuICAgICAgICAgIC5tYXAoYm9keT0+W29yZGVyLCBib2R5XSk7XG4gICAgICB9KVxuICAgICAgLm1hcCgoW29yZGVyLCBib2R5XSk9PntcbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICB3aW5zdG9uLmRlYnVnKGNoYWxrYHtibHVlIFN1Ym1pdCBPcmRlciBSZXF1ZXN0IHN1Y2Nlc3MhfWApO1xuICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIC8vIOaCqOi/mOacieacquWkhOeQhueahOiuouWNlVxuICAgICAgICAgIC8vIOivpei9puasoeaaguS4jeWKnueQhuS4muWKoVxuICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YCk7XG4gICAgICAgICAgLy8gdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgdGhyb3cgY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YDtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIFN0ZXAgMTIg5qih5ouf6Lez6L2s6aG16Z2iSW5pdERj77yMUG9zdFxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT5cbiAgICAgICAgdGhpcy5jb25maXJtUGFzc2VuZ2VySW5pdERjKClcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICBlcnJvciQubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICAgICAgaWYoZXJyID09IHRoaXMuU1lTVEVNX0JVU1NZKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihlcnIgPT0gdGhpcy5TWVNURU1fTU9WRUQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICAgICAubWFwKG9yZGVyU3VibWl0UmVxdWVzdD0+W29yZGVyLCBvcmRlclN1Ym1pdFJlcXVlc3RdKVxuICAgICAgKVxuICAgICAgLy8gU3RlcCAxMyDluLjnlKjogZTns7vkurrnoa7lrprvvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChbb3JkZXIsIG9yZGVyUmVxdWVzdF0pPT4ge1xuICAgICAgICB3aW5zdG9uLmRlYnVnKFwiY29uZmlybVBhc3NlbmdlciBJbml0IERjIHN1Y2Nlc3MhIFwiK29yZGVyUmVxdWVzdC50b2tlbik7XG4gICAgICAgIG9yZGVyLnJlcXVlc3QgPSBvcmRlclJlcXVlc3Q7XG4gICAgICAgIGlmKHRoaXMucGFzc2VuZ2Vycykge1xuICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2VycyA9IHRoaXMucGFzc2VuZ2VycztcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXNzZW5nZXJzKG9yZGVyLnJlcXVlc3QudG9rZW4pXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICAgICAgZXJyb3IkLmRvKChlcnIpPT53aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke2Vycn19YCkpXG4gICAgICAgICAgICAgICAgLmRlbGF5KDUwMClcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5tYXAocGFzc2VuZ2Vycz0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcbiAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcbiAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAvLyBTdGVwIDE0IOi0reelqOS6uuehruWumu+8jFBvc3RcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PlxuICAgICAgICB0aGlzLmNoZWNrT3JkZXJJbmZvKG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICBlcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGVycikpLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICAgICAubWFwKGJvZHk9PntcbiAgICAgICAgICAgIG9yZGVyLnJlcXVlc3Qub3JkZXJJbmZvID0gYm9keTtcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT57XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYOWHhuWkh+i/m+WFpeaOkumYn2ApO1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnJlcXVlc3Qub3JkZXJSZXF1ZXN0LCBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8pXG4gICAgICAgICAgLm1hcChib2R5PT57XG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKGJvZHkpO1xuICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5xdWV1ZUluZm8gPSBib2R5O1xuICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgIH0pXG4gICAgICB9KVxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+IHtcbiAgICAgICAgLy8g6IulIFN0ZXAgMTQg5Lit55qEIFwiaWZTaG93UGFzc0NvZGVcIiA9IFwiWVwi77yM6YKj5LmI5aSa5LqG6L6T5YWl6aqM6K+B56CB6L+Z5LiA5q2l77yMUG9zdFxuICAgICAgICBpZihvcmRlci5yZXF1ZXN0Lm9yZGVySW5mby5kYXRhLmlmU2hvd1Bhc3NDb2RlID09IFwiWVwiKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUdldFBhc3NDb2RlTmV3KG9yZGVyKTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKG9yZGVyKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PntcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtg5o+Q5Lqk5o6S6Zif6K6i5Y2VYCk7XG4gICAgICAgIHJldHVybiB0aGlzLmNvbmZpcm1TaW5nbGVGb3JRdWV1ZShvcmRlci5yZXF1ZXN0LnRva2VuLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzLmRhdGEubm9ybWFsX3Bhc3NlbmdlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZGVsYXkoMTAwKSlcbiAgICAgICAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgICAgICAgaWYoYm9keS5zdGF0dXMgJiYgYm9keS5kYXRhLnN1Ym1pdFN0YXR1cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgICAgIGRhdGE6IHsgZXJyTXNnOiAn5L2Z56Wo5LiN6Laz77yBJywgc3VibWl0U3RhdHVzOiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5LmRhdGEuZXJyTXNnfX1gKVxuICAgICAgICAgICAgICAgIHRocm93ICdyZXRyeSc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICB9KVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICBpZihlcnIgPT0gJ3JldHJ5Jykge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlR2V0UGFzc2VuZ2VycyhvcmRlcjogT3JkZXIpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PlxuICAgICAgICB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXIucmVxdWVzdC50b2tlbilcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgICBlcnJvciQuZG8oKGVycik9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAgICAgICAuZGVsYXkoNTAwKVxuICAgICAgICAgICAgKVxuICAgICAgKVxuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlR2V0UGFzc0NvZGVOZXcob3JkZXI6IE9yZGVyKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLnN3aXRjaE1hcCgoKT0+IHRoaXMuZ2V0UGFzc0NvZGVOZXcoKSlcbiAgICAgIC5zd2l0Y2hNYXAoKCk9PiB0aGlzLmNoZWNrUmFuZENvZGVBbnN5bigpKVxuICB9XG5cbiAgcHJpdmF0ZSBidWlsZE9yZGVyRmxvdygpIHtcblxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMubGVmdFRpY2tldEluaXQoKSlcbiAgICAgIC5zd2l0Y2hNYXAoKCk9PnRoaXMucmVjdXJzaXZlUXVlcnlMZWZ0VGlja2V0KCkpXG4gICAgICAvLyBTdGVwIDE4IOafpeivouaOkumYn+etieW+heaXtumXtO+8gVxuICAgICAgLnN1YnNjcmliZShcbiAgICAgICAgKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgICAgdGhpcy5vYnNRdWVyeU9yZGVyV2FpdFQob3JkZXIpXG4gICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg57uT5p2ffWApO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgICB9LGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YCkpO1xuICAgICAgICB9LFxuICAgICAgICBlcnI9PntcbiAgICAgICAgICB3aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUNoZWNrVXNlcigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcblxuICAgIC8vIFN0ZXAgMTAg6aqM6K+B55m75b2V77yMUG9zdFxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCkgPT4gdGhpcy5jaGVja1VzZXIoKSlcbiAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZG8oKGVycik9PmNvbnNvbGUuZXJyb3IoXCJDaGVjayB1c2VyIGVycm9yIFwiK2VycikpKVxuICAgICAgLm1lcmdlTWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKGJvZHkuZGF0YS5mbGFnKSB7XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoYm9keSk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNRdWVyeU9yZGVyV2FpdFQob3JkZXI6IE9yZGVyKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpXG4gICAgICAgIC5tZXJnZU1hcCgob3JkZXI6IE9yZGVyKT0+IHRoaXMucXVlcnlPcmRlcldhaXRUaW1lKFwiXCIpKVxuICAgICAgICAubWFwKG9yZGVyUXVldWU9PiB7XG4gICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhKU09OLnN0cmluZ2lmeShvcmRlclF1ZXVlKSk7XG4gICAgICAgICAgLyoqXG4gICAgICAgICAge1xuICAgICAgICAgICAgXCJ2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkXCI6IFwiX3ZhbGlkYXRvck1lc3NhZ2VcIixcbiAgICAgICAgICAgIFwic3RhdHVzXCI6IHRydWUsXG4gICAgICAgICAgICBcImh0dHBzdGF0dXNcIjogMjAwLFxuICAgICAgICAgICAgXCJkYXRhXCI6IHtcbiAgICAgICAgICAgICAgXCJxdWVyeU9yZGVyV2FpdFRpbWVTdGF0dXNcIjogdHJ1ZSxcbiAgICAgICAgICAgICAgXCJjb3VudFwiOiAwLFxuICAgICAgICAgICAgICBcIndhaXRUaW1lXCI6IDI0NDQsXG4gICAgICAgICAgICAgIFwicmVxdWVzdElkXCI6IDYzNzY3MjcyODU2MzQ3OTcwMDAsXG4gICAgICAgICAgICAgIFwid2FpdENvdW50XCI6IDIwMDAsXG4gICAgICAgICAgICAgIFwidG91ckZsYWdcIjogXCJkY1wiLFxuICAgICAgICAgICAgICBcIm9yZGVySWRcIjogbnVsbFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIFwibWVzc2FnZXNcIjogW10sXG4gICAgICAgICAgICBcInZhbGlkYXRlTWVzc2FnZXNcIjoge31cbiAgICAgICAgICB9XG4gICAgICAgICAgKi9cbiAgICAgICAgICBpZihvcmRlclF1ZXVlLnN0YXR1cykge1xuICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAwIHx8IG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgLy8gMC4156eS5ZON5LiA5qyh77yM5ZON6ZODMzDliIbpkp9cbiAgICAgICAgICAgICAgYmVlcGVyKDYwKjMwKjIpO1xuICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2coY2hhbGtg5oKo55qE6L2m56Wo6K6i5Y2V5Y+35pivIHtyZWQuYm9sZCAke29yZGVyUXVldWUuZGF0YS5vcmRlcklkfX1gKTtcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTIpe1xuICAgICAgICAgICAgICBpZihvcmRlclF1ZXVlLmRhdGEubXNnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke29yZGVyUXVldWUuZGF0YS5tc2d9fWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTMpe1xuICAgICAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2coXCLmgqjnmoTovabnpajorqLljZXlt7Lnu4/lj5bmtoghXCIpO1xuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtNCl7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwi5oKo55qE6L2m56Wo6K6i5Y2V5q2j5Zyo5aSE55CGLCDor7fnqI3nrYkuLi5cIik7XG4gICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYOaOkumYn+S6uuaVsO+8mnt5ZWxsb3cuYm9sZCAke29yZGVyUXVldWUuZGF0YS53YWl0Q291bnR9fSDpooTorqHnrYnlvoXml7bpl7TvvJp7eWVsbG93LmJvbGQgJHtwYXJzZUludChvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgLyAxLjUpfX0g5YiG6ZKfYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93ICdyZXRyeSc7XG4gICAgICAgIH0pXG4gICAgICAgIC5yZXRyeVdoZW4oKGVycm9ycyk9PmVycm9ycy5kbygoZXJyKT0+e1xuICAgICAgICAgIGlmKGVyciE9J3JldHJ5Jykge1xuICAgICAgICAgICAgd2luc3Rvbi5lcnJvcihlcnIpXG4gICAgICAgICAgfVxuICAgICAgICB9KS5kZWxheSg0MDAwKSlcbiAgICAgICAgO1xuICB9XG5cbiAgLyoqXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xuICAgKlxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXG4gICAqXG4gICAqIEByZXR1cm4gUHJvbWlzZVxuICAgKi9cbiAgcHVibGljIHF1ZXJ5TGVmdFRpY2tldHModHJhaW5EYXRlOiBzdHJpbmcsIGZyb21TdGF0aW9uOiBzdHJpbmcsIHRvU3RhdGlvbjogc3RyaW5nLCB0cmFpbk5hbWVzPzogUmVhZG9ubHlBcnJheTxzdHJpbmc+KTogT2JzZXJ2YWJsZTxBcnJheTxhbnk+PiB7XG4gICAgaWYoIXRyYWluRGF0ZSkge1xuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXkuZjovabml6XmnJ99YCk7XG4gICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdygn6K+36L6T5YWl5LmY6L2m5pel5pyfJyk7XG4gICAgfVxuICAgIC8vIHRoaXMuQkFDS19UUkFJTl9EQVRFID0gdHJhaW5EYXRlO1xuXG4gICAgaWYoIWZyb21TdGF0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWHuuWPkeermX1gKTtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCfor7fovpPlhaXlh7rlj5Hnq5knKTtcbiAgICB9XG4gICAgLy8gdGhpcy5GUk9NX1NUQVRJT05fTkFNRSA9IGZyb21TdGF0aW9uTmFtZTtcblxuICAgIGlmKCF0b1N0YXRpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5Yiw6L6+56uZfWApO1xuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coJ+ivt+i+k+WFpeWIsOi+vuermScpO1xuICAgIH1cbiAgICAvLyB0aGlzLlRPX1NUQVRJT05fTkFNRSA9IHRvU3RhdGlvbk5hbWU7XG5cbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLnF1ZXJ5TGVmdFRpY2tldCh7dHJhaW5EYXRlOiB0cmFpbkRhdGUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tU3RhdGlvbjogZnJvbVN0YXRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b1N0YXRpb246IHRvU3RhdGlvbn0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgLy8gLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxuICAgICAgLnJldHJ5V2hlbigoZXJyb3JzJCk9PmVycm9ycyQuZG8oKCk9PnByb2Nlc3Muc3Rkb3V0LndyaXRlKFwiLlwiKSkuZGVsYXkoMTUwMCkpXG4gICAgICAubWFwKHRyYWluc0RhdGEgPT4gdHJhaW5zRGF0YS5yZXN1bHQpXG4gICAgICAubWFwKHJlc3VsdCA9PiB7XG4gICAgICAgIGxldCB0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW107XG5cbiAgICAgICAgcmVzdWx0LmZvckVhY2goKGVsZW1lbnQ6IHN0cmluZyk9PiB7XG4gICAgICAgICAgbGV0IHRyYWluOiBBcnJheTxzdHJpbmc+ID0gZWxlbWVudC5zcGxpdChcInxcIik7XG4gICAgICAgICAgdHJhaW5bNF0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzRdKTtcbiAgICAgICAgICB0cmFpbls1XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNV0pO1xuICAgICAgICAgIHRyYWluWzZdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls2XSk7XG4gICAgICAgICAgdHJhaW5bN10gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzddKTtcbiAgICAgICAgICB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJJU19USU1FX05PVF9CVVlcIiA/IFwi5YiX6L2m5YGc6L+QXCI6dHJhaW5bMTFdO1xuICAgICAgICAgIC8vIHRyYWluWzExXSA9IHRyYWluWzExXSA9PSBcIk5cIiA/IFwi5peg56WoXCI6dHJhaW5bMTFdO1xuICAgICAgICAgIC8vIHRyYWluWzExXSA9IHRyYWluWzExXSA9PSBcIllcIiA/IFwi5pyJ56WoXCI6dHJhaW5bMTFdO1xuICAgICAgICAgIC8vIOWMuemFjei+k+WFpeeahOWIl+i9puWQjeensOeahOato+WImeihqOi+vuW8j+adoeS7tlxuICAgICAgICAgIGlmKCF0cmFpbk5hbWVzIHx8IHRyYWluTmFtZXMuZmlsdGVyKHRuPT50cmFpblszXS5tYXRjaChuZXcgUmVnRXhwKHRuKSkgIT0gbnVsbCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdHJhaW5zLnB1c2godHJhaW4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cmFpbnM7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cbiAgICpcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXG4gICAqIEBwYXJhbSBwYXNzU3RhdGlvbk5hbWUg6YCU57uP56uZXG4gICAqIEBwYXJhbSB0cmFpbk5hbWVzIOWIl+i9plxuICAgKiBAcGFyYW0gZiDovabmrKHov4fmu6TmnaHku7ZcbiAgICogQHBhcmFtIHQg5pe26Ze06L+H5ruk5p2h5Lu2XG4gICAqXG4gICAqIEByZXR1cm4gdm9pZFxuICAgKi9cbiAgcHVibGljIGxlZnRUaWNrZXRzKFt0cmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGFzc1N0YXRpb25OYW1lXSwge2ZpbHRlcixmLHRpbWUsdCxvcmRlcmJ5LG99KSB7XG4gICAgbGV0IGZyb21TdGF0aW9uOiBzdHJpbmcgPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKGZyb21TdGF0aW9uTmFtZSk7XG4gICAgbGV0IHRvU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZSh0b1N0YXRpb25OYW1lKTtcbiAgICBsZXQgcGFzc1N0YXRpb246IHN0cmluZyA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUocGFzc1N0YXRpb25OYW1lKTtcblxuICAgIGxldCBwbGFuVHJhaW5zOiBSZWFkb25seUFycmF5PHN0cmluZz58dW5kZWZpbmVkID1cbiAgICAgIHR5cGVvZiBmID09IFwic3RyaW5nXCIgPyBmLnNwbGl0KCcsJyk6KHR5cGVvZiBmaWx0ZXIgPT0gXCJzdHJpbmdcIiA/IGZpbHRlci5zcGxpdCgnLCcpOnVuZGVmaW5lZCk7XG4gICAgbGV0IHBsYW5UaW1lczogUmVhZG9ubHlBcnJheTxzdHJpbmc+fHVuZGVmaW5lZCA9XG4gICAgICB0eXBlb2YgdCA9PSBcInN0cmluZ1wiID8gdC5zcGxpdCgnLCcpOih0eXBlb2YgdGltZSA9PSBcInN0cmluZ1wiID8gdGltZS5zcGxpdCgnLCcpOnVuZGVmaW5lZCk7XG4gICAgbGV0IHBsYW5PcmRlckJ5OiBBcnJheTxzdHJpbmd8bnVtYmVyPnx1bmRlZmluZWQgPVxuICAgICAgdHlwZW9mIG8gPT0gXCJzdHJpbmdcIiA/IG8uc3BsaXQoJywnKToodHlwZW9mIG9yZGVyYnkgPT0gXCJzdHJpbmdcIiA/IG9yZGVyYnkuc3BsaXQoJywnKTp1bmRlZmluZWQpO1xuXG4gICAgaWYocGxhbk9yZGVyQnkpIHtcbiAgICAgIHBsYW5PcmRlckJ5ID0gcGxhbk9yZGVyQnkubWFwKChmaWVsZE5hbWU6c3RyaW5nfG51bWJlcikgPT4ge1xuICAgICAgICBpZihmaWVsZE5hbWVbMF0gPT09ICctJyB8fCBmaWVsZE5hbWVbMF0gPT09ICcrJykge1xuICAgICAgICAgIHJldHVybiBmaWVsZE5hbWVbMF0rdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihmaWVsZE5hbWUuc3Vic3RyaW5nKDEpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihmaWVsZE5hbWUpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5idWlsZFF1ZXJ5TGVmdFRpY2tldEZsb3coe1xuICAgICAgICB0cmFpbkRhdGU6IHRyYWluRGF0ZVxuICAgICAgICAsYmFja1RyYWluRGF0ZTogdHJhaW5EYXRlXG4gICAgICAgICxmcm9tU3RhdGlvbk5hbWU6IGZyb21TdGF0aW9uTmFtZVxuICAgICAgICAsdG9TdGF0aW9uTmFtZTogdG9TdGF0aW9uTmFtZVxuICAgICAgICAsZnJvbVN0YXRpb246IGZyb21TdGF0aW9uXG4gICAgICAgICx0b1N0YXRpb246IHRvU3RhdGlvblxuICAgICAgICAscGFzc1N0YXRpb246IHBhc3NTdGF0aW9uXG4gICAgICAgICxwbGFuVHJhaW5zOiBwbGFuVHJhaW5zXG4gICAgICAgICxwbGFuVGltZXM6IHBsYW5UaW1lc1xuICAgICAgICAscGxhbk9yZGVyQnk6IHBsYW5PcmRlckJ5XG4gICAgICAgICxzZWF0Q2xhc3NlczogW11cbiAgICAgIH0pXG4gICAgICAuc3Vic2NyaWJlKChvcmRlcjogSU9yZGVyKSA9PiB7XG4gICAgICAgIGxldCB0cmFpbnMgPSB0aGlzLnJlbmRlclRyYWluTGlzdFRpdGxlKG9yZGVyLnRyYWlucyk7XG4gICAgICAgIGlmKHRyYWlucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDmsqHmnInnrKblkIjmnaHku7bnmoTovabmrKF9YClcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlckxlZnRUaWNrZXRzKHRyYWlucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVHJhaW5MaXN0VGl0bGUodHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+Pik6IEFycmF5PEFycmF5PHN0cmluZz4+IHtcbiAgICB2YXIgdGl0bGUgPSB0aGlzLlRJQ0tFVF9USVRMRS5tYXAodD0+Y2hhbGtge2JsdWUgJHt0fX1gKTtcblxuICAgIHRyYWlucy5mb3JFYWNoKCh0cmFpbiwgaW5kZXgpPT4ge1xuICAgICAgaWYoaW5kZXggJSAzMCA9PT0gMCkge1xuICAgICAgICB0cmFpbnMuc3BsaWNlKGluZGV4LCAwLCB0aXRsZSk7XG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gdHJhaW5zO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJMZWZ0VGlja2V0cyh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KSB7XG4gICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkodHJhaW5zLCB7XG4gICAgICBjb2x1bW5TcGxpdHRlcjogJ3wnLFxuICAgICAgY29sdW1uczogW1wiM1wiLCBcIjRcIiwgXCI1XCIsIFwiNlwiLCBcIjdcIiwgXCI4XCIsIFwiOVwiLCBcIjEwXCIsIFwiMTFcIiwgXCIyMFwiLCBcIjIxXCIsIFwiMjJcIiwgXCIyM1wiLCBcIjI0XCIsIFwiMjVcIixcbiAgICAgICAgICAgICAgICBcIjI2XCIsIFwiMjdcIiwgXCIyOFwiLCBcIjI5XCIsIFwiMzBcIiwgXCIzMVwiLCBcIjMyXCJdXG4gICAgfSlcblxuICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xuICB9XG5cbiAgcHVibGljIG15T3JkZXJOb0NvbXBsZXRlUmVwb3J0KCkge1xuICAgIHRoaXMuaW5pdE5vQ29tcGxldGUoKVxuICAgICAgLm1lcmdlTWFwKCgpPT5cbiAgICAgICAgdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKClcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRlbGF5KDUwMCkpXG4gICAgICApXG4gICAgICAuc3Vic2NyaWJlKHg9PiB7XG4gICAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkoeCwge1xuICAgICAgICAgICAgY29sdW1uU3BsaXR0ZXI6ICcgfCAnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcbiAgICAgICAgfSwgZXJyb3I9PiB7XG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvcik7XG4gICAgICAgIH0pXG4gIH1cblxuICBwdWJsaWMgbG9naW5Jbml0KCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vaW5pdFwiO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmwsXG4gICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcbiAgICAgICAgICBcIm1vZHVsZVwiOiBcImxvZ2luXCIsXG4gICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCIsXG4gICAgICAgICAgXCIwLjE3MjMxODcyNzAzMzg5MDYyXCI6XCJcIlxuICAgICAgfTtcblxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShkYXRhLCBudWxsLCBudWxsKVxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtaW1hZ2U/XCIrcGFyYW07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgIH07XG5cbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjx2b2lkPik9PiB7XG4gICAgICB0aGlzLnJhd1JlcXVlc3Qob3B0aW9ucywgKGVycm9yOiBhbnksIHJlc3BvbnNlOiBhbnksIGJvZHk6IHN0cmluZykgPT4ge1xuICAgICAgICBpZihlcnJvcikgcmV0dXJuIG9ic2VydmVyLmVycm9yKGVycm9yKTtcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHF1ZXN0aW9uQ2FwdGNoYSgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcbiAgICAgIGlucHV0OiBwcm9jZXNzLnN0ZGluLFxuICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dFxuICAgIH0pO1xuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPHN0cmluZz4pPT4ge1xuICAgICAgbGV0IGNoaWxkID0gY2hpbGRfcHJvY2Vzcy5leGVjKCdjYXB0Y2hhLkJNUCcsKCk9Pnt9KTtcblxuICAgICAgcmwucXVlc3Rpb24oY2hhbGtge3JlZC5ib2xkIOivt+i+k+WFpemqjOivgeeggX06YCwgKHBvc2l0aW9uU3RyKSA9PiB7XG4gICAgICAgIHJsLmNsb3NlKCk7XG5cbiAgICAgICAgaWYodHlwZW9mIHBvc2l0aW9uU3RyID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICBsZXQgcG9zaXRpb25zOiBBcnJheTxzdHJpbmc+ID0gW107XG4gICAgICAgICAgcG9zaXRpb25TdHIuc3BsaXQoJywnKS5mb3JFYWNoKGVsPT5wb3NpdGlvbnM9cG9zaXRpb25zLmNvbmNhdChlbC5zcGxpdCgnICcpKSk7XG4gICAgICAgICAgb2JzZXJ2ZXIubmV4dChwb3NpdGlvbnMubWFwKChwb3NpdGlvbjogc3RyaW5nKT0+IHtcbiAgICAgICAgICAgICAgc3dpdGNoKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjFcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDQ1XCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjJcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjExMCw0NVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCIzXCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxODAsNDVcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiNFwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDQ1XCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjVcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDExMFwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI2XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxMTAsMTEwXCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjdcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjE4MCwxMTBcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiOFwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDExMFwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5qb2luKCcsJykpO1xuICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICBvYnNlcnZlci5lcnJvcihcIui+k+WFpeagvOW8j+mUmeivr1wiKTtcbiAgICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tDYXB0Y2hhKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtY2hlY2tcIjtcblxuICAgIHJldHVybiB0aGlzLnF1ZXN0aW9uQ2FwdGNoYSgpXG4gICAgICAubWVyZ2VNYXAocG9zaXRpb25zPT57XG4gICAgICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgICAgXCJhbnN3ZXJcIjogcG9zaXRpb25zLFxuICAgICAgICAgICAgXCJsb2dpbl9zaXRlXCI6IFwiRVwiLFxuICAgICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCJcbiAgICAgICAgICB9O1xuXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgIHVybDogdXJsXG4gICAgICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgICAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICxmb3JtOiBkYXRhXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpXG4gICAgICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSA0KSB7XG4gICAgICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgYm9keS5yZXN1bHRfbWVzc2FnZTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1c2VyQXV0aGVudGljYXRlKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgLy8g5Y+R6YCB55m75b2V5L+h5oGvXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXG4gICAgICAgICAgLFwidXNlcm5hbWVcIjogdGhpcy51c2VyTmFtZVxuICAgICAgICAgICxcInBhc3N3b3JkXCI6IHRoaXMudXNlclBhc3N3b3JkXG4gICAgICAgIH07XG5cbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2xvZ2luXCI7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAyKSB7XG4gICAgICAgICAgdGhyb3cgYm9keS5yZXN1bHRfbWVzc2FnZTtcbiAgICAgICAgfWVsc2UgaWYoYm9keS5yZXN1bHRfY29kZSAhPSAwKSB7XG4gICAgICAgICAgdGhyb3cgYm9keTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiBib2R5LnVhbXRrO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TmV3QXBwVG9rZW4oKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcbiAgICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9e1xuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvYXV0aC91YW10a1wiXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5KTtcbiAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHkubmV3YXBwdGs7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0aHJvdyBib2R5O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgXCJ0a1wiOiBuZXdhcHB0a1xuICAgICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3VhbWF1dGhjbGllbnRcIlxuICAgICAgLGhlYWRlcnM6IHtcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgNi4xOyBXT1c2NCkgQXBwbGVXZWJLaXQvNTM3LjE3IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzI0LjAuMTMxMi42MCBTYWZhcmkvNTM3LjE3XCJcbiAgICAgICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzcG9ydD9yZWRpcmVjdD0vb3RuL1wiXG4gICAgICAgICwnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcbiAgICAgIH1cbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICB3aW5zdG9uLmRlYnVnKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xuICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcbiAgICAgICAgICByZXR1cm4gYm9keS5hcHB0aztcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRocm93IGJvZHk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gcHJpdmF0ZSBnZXRNeTEyMzA2KCk6IFByb21pc2Uge1xuICAvLyAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcbiAgLy8gICAgIHRoaXMucmVxdWVzdCh7XG4gIC8vICAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2luZGV4L2luaXRNeTEyMzA2XCJcbiAgLy8gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gIC8vICAgICAgLG1ldGhvZDogXCJHRVRcIn0sXG4gIC8vICAgICAgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gIC8vICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAvLyAgICAgICAgIGNvbnNvbGUubG9nKFwiR290IG15IDEyMzA2XCIpO1xuICAvLyAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gIC8vICAgICAgIH1cbiAgLy8gICAgICAgcmVqZWN0KCk7XG4gIC8vICAgICB9KTtcbiAgLy8gICB9KTtcbiAgLy8gfVxuXG4gIHByaXZhdGUgY2hlY2tBdXRoZW50aWNhdGlvbihjb29raWVzOiBvYmplY3QpIHtcbiAgICB2YXIgdWFtdGsgPSBcIlwiLCB0ayA9IFwiXCI7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGNvb2tpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidWFtdGtcIikge1xuICAgICAgICB1YW10ayA9IGNvb2tpZXNbaV0udmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidGtcIikge1xuICAgICAgICB0ayA9IGNvb2tpZXNbaV0udmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB1YW10azogdWFtdGssXG4gICAgICB0azogdGtcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBsZWZ0VGlja2V0SW5pdCgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiO1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1cmwpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeUxlZnRUaWNrZXQoe3RyYWluRGF0ZSwgZnJvbVN0YXRpb24sIHRvU3RhdGlvbn0pOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciBxdWVyeSA9IHtcbiAgICAgIFwibGVmdFRpY2tldERUTy50cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxuICAgICAgLFwibGVmdFRpY2tldERUTy5mcm9tX3N0YXRpb25cIjogZnJvbVN0YXRpb25cbiAgICAgICxcImxlZnRUaWNrZXREVE8udG9fc3RhdGlvblwiOiB0b1N0YXRpb25cbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXG4gICAgfVxuXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9xdWVyeVo/XCIrcGFyYW07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHVybClcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgaWYoIWJvZHkpIHtcbiAgICAgICAgICB0aHJvdyBcIuezu+e7n+i/lOWbnuaXoOaVsOaNrlwiO1xuICAgICAgICB9XG4gICAgICAgIGlmKGJvZHkuaW5kZXhPZihcIuivt+aCqOmHjeivleS4gOS4i1wiKSA+IDApIHtcbiAgICAgICAgICB0aHJvdyBcIuezu+e7n+e5geW/mSFcIjtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoYm9keSkuZGF0YTtcbiAgICAgICAgICB9Y2F0Y2goZXJyKSB7XG4gICAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIFJlc29sdmVkXG4gICAgICAgICAgcmV0dXJuIGRhdGE7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja1VzZXIoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sb2dpbi9jaGVja1VzZXJcIjtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxuICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKTtcbiAgfVxuXG4gIHByaXZhdGUgc3VibWl0T3JkZXJSZXF1ZXN0KHt0cmFpblNlY3JldFN0ciwgdHJhaW5EYXRlLCBiYWNrVHJhaW5EYXRlLCBmcm9tU3RhdGlvbk5hbWUsIHRvU3RhdGlvbk5hbWV9KTogT2JzZXJ2YWJsZTxvYmplY3Q+ICB7XG5cbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvc3VibWl0T3JkZXJSZXF1ZXN0XCI7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwic2VjcmV0U3RyXCI6IHF1ZXJ5c3RyaW5nLnVuZXNjYXBlKHRyYWluU2VjcmV0U3RyKVxuICAgICAgLFwidHJhaW5fZGF0ZVwiOiB0cmFpbkRhdGVcbiAgICAgICxcImJhY2tfdHJhaW5fZGF0ZVwiOiBiYWNrVHJhaW5EYXRlXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiQURVTFRcIlxuICAgICAgLFwicXVlcnlfZnJvbV9zdGF0aW9uX25hbWVcIjogZnJvbVN0YXRpb25OYW1lXG4gICAgICAsXCJxdWVyeV90b19zdGF0aW9uX25hbWVcIjogdG9TdGF0aW9uTmFtZVxuICAgICAgLFwidW5kZWZpbmVkXCI6XCJcIlxuICAgIH07XG5cbiAgICAvLyB1cmwgPSB1cmwgKyBcInNlY3JldFN0cj1cIitzZWNyZXRTdHIrXCImdHJhaW5fZGF0ZT0yMDE4LTAxLTMxJmJhY2tfdHJhaW5fZGF0ZT0yMDE4LTAxLTMwJnRvdXJfZmxhZz1kYyZwdXJwb3NlX2NvZGVzPUFEVUxUJnF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lPeS4iua1tyZxdWVyeV90b19zdGF0aW9uX25hbWU95b6Q5bee5LicJnVuZGVmaW5lZFwiO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25maXJtUGFzc2VuZ2VySW5pdERjKCk6IE9ic2VydmFibGU8T3JkZXJTdWJtaXRSZXF1ZXN0PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiO1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxuICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxuICAgICAgICAsXCJVcGdyYWRlLUluc2VjdXJlLVJlcXVlc3RzXCI6MVxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XG4gICAgICAgICAgdGhyb3cgdGhpcy5TWVNURU1fQlVTU1k7XG4gICAgICAgIH1cbiAgICAgICAgaWYoYm9keSkge1xuICAgICAgICAgIC8vIEdldCBSZXBlYXQgU3VibWl0IFRva2VuXG4gICAgICAgICAgdmFyIHRva2VuID0gYm9keS5tYXRjaCgvdmFyIGdsb2JhbFJlcGVhdFN1Ym1pdFRva2VuID0gJyguKj8pJzsvKTtcbiAgICAgICAgICB2YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0gPSBib2R5Lm1hdGNoKC92YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm09KC4qPyk7Lyk7XG4gICAgICAgICAgdmFyIG9yZGVyUmVxdWVzdERUTyA9IGJvZHkubWF0Y2goL3ZhciBvcmRlclJlcXVlc3REVE89KC4qPyk7Lyk7XG4gICAgICAgICAgaWYodG9rZW4pIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHRva2VuOiB0b2tlblsxXVxuICAgICAgICAgICAgICAsdGlja2V0SW5mbzogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0mJkpTT04ucGFyc2UodGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm1bMV0ucmVwbGFjZSgvJy9nLCBcIlxcXCJcIikpXG4gICAgICAgICAgICAgICxvcmRlclJlcXVlc3Q6IG9yZGVyUmVxdWVzdERUTyYmSlNPTi5wYXJzZShvcmRlclJlcXVlc3REVE9bMV0ucmVwbGFjZSgvJy9nLCBcIlxcXCJcIikpXG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aHJvdyB0aGlzLlNZU1RFTV9CVVNTWTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJzKHRva2VuOiBzdHJpbmcpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICAvKiBzZWF0IHR5cGVcbiAg4oCY6L2v5Y2n4oCZID0+IOKAmDTigJksXG4gIOKAmOS6jOetieW6p+KAmSA9PiDigJhP4oCZLFxuICDigJjkuIDnrYnluqfigJkgPT4g4oCYTeKAmSxcbiAg4oCY56Gs5bqn4oCZID0+IOKAmDHigJksXG4gICAqL1xuICBwcml2YXRlIGdldFBhc3NlbmdlclRpY2tldHMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy/luqfkvY3nsbvlnossMCznpajnsbvlnoso5oiQ5Lq6L+WEv+erpSksbmFtZSzouqvku73nsbvlnoso6Lqr5Lu96K+BL+WGm+WumOivgS4uLi4pLOi6q+S7veivgSznlLXor53lj7fnoIEs5L+d5a2Y54q25oCBXG4gICAgICAgIHZhciB0aWNrZXQgPSAvKnBhc3Nlbmdlci5zZWF0X3R5cGUqLyBcIk9cIiArXG4gICAgICAgICAgICAgICAgXCIsMCxcIiArXG4gICAgICAgICAgICAgICAgLypsaW1pdF90aWNrZXRzW2FBXS50aWNrZXRfdHlwZSovXCIxXCIgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgKHBhc3Nlbmdlci5waG9uZV9ubyB8fCBcIlwiICkgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCJOXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIik7XG4gIH1cblxuICBwcml2YXRlIGdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy9uYW1lLOi6q+S7veexu+Weiyzouqvku73or4EsMV9cbiAgICAgICAgdmFyIHRpY2tldCA9XG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCIxXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NoZWNrT3JkZXJJbmZvXCI7XG5cbiAgICB2YXIgcGFzc2VuZ2VyVGlja2V0U3RyID0gdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKTtcbiAgICBpZighcGFzc2VuZ2VyVGlja2V0U3RyKSB7XG4gICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhcIuayoeacieebuOWFs+iBlOezu+S6ulwiKTtcbiAgICB9XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiY2FuY2VsX2ZsYWdcIjogMlxuICAgICAgLFwiYmVkX2xldmVsX29yZGVyX251bVwiOiBcIjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMFwiXG4gICAgICAsXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogcGFzc2VuZ2VyVGlja2V0U3RyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxuICAgICAgLFwidG91cl9mbGFnXCI6IFwiZGNcIlxuICAgICAgLFwicmFuZENvZGVcIjogXCJcIlxuICAgICAgLFwid2hhdHNTZWxlY3RcIjoxXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiBzdWJtaXRUb2tlblxuICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICAvKlxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgIHVybDogJy9sZWZ0VGlja2V0L2luaXQnLFxuICAgICAgICAgICAgc3RhdHVzOiBmYWxzZSxcbiAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbICfns7vnu5/lv5nvvIzor7fnqI3lkI7ph43or5UnIF0sXG4gICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XG4gICAgICAgICAqL1xuICAgICAgICBpZihib2R5LnN0YXR1cykge1xuICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdGhyb3cgYm9keS5tZXNzYWdlc1swXTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldFF1ZXVlQ291bnQodG9rZW4sIG9yZGVyUmVxdWVzdERUTywgdGlja2V0SW5mbyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2dldFF1ZXVlQ291bnRcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwidHJhaW5fZGF0ZVwiOiBuZXcgRGF0ZShvcmRlclJlcXVlc3REVE8udHJhaW5fZGF0ZS50aW1lKS50b1N0cmluZygpXG4gICAgICAsXCJ0cmFpbl9ub1wiOiBvcmRlclJlcXVlc3REVE8udHJhaW5fbm9cbiAgICAgICxcInN0YXRpb25UcmFpbkNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLnN0YXRpb25fdHJhaW5fY29kZVxuICAgICAgLFwic2VhdFR5cGVcIjoxXG4gICAgICAsXCJmcm9tU3RhdGlvblRlbGVjb2RlXCI6IG9yZGVyUmVxdWVzdERUTy5mcm9tX3N0YXRpb25fdGVsZWNvZGVcbiAgICAgICxcInRvU3RhdGlvblRlbGVjb2RlXCI6IG9yZGVyUmVxdWVzdERUTy50b19zdGF0aW9uX3RlbGVjb2RlXG4gICAgICAsXCJsZWZ0VGlja2V0XCI6IHRpY2tldEluZm8ucXVlcnlMZWZ0VGlja2V0UmVxdWVzdERUTy55cEluZm9EZXRhaWxcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCIwMFwiXG4gICAgICAsXCJ0cmFpbl9sb2NhdGlvblwiOiB0aWNrZXRJbmZvLnRyYWluX2xvY2F0aW9uXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxuICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICAvKlxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf57mB5b+Z77yM6K+356iN5ZCO6YeN6K+V77yBJyBdLFxuICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgKi9cbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRocm93IGJvZHkubWVzc2FnZXNbMF07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRQYXNzQ29kZU5ldygpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2dldFBhc3NDb2RlTmV3P21vZHVsZT1wYXNzZW5nZXImcmFuZD1yYW5kcCZcIitNYXRoLnJhbmRvbSgwLDEpO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgIH07XG5cbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjx2b2lkPik9PiB7XG4gICAgICB0aGlzLnJhd1JlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICAgIGlmKGVycm9yKSByZXR1cm4gb2JzZXJ2ZXIuZXJyb3IoZXJyb3IpO1xuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlIT09MjAwKVxuICAgICAgICAgIG9ic2VydmVyLmVycm9yKHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xuICAgICAgfSkucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShcImNhcHRjaGEuQk1QXCIpKS5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICB9XG5cbiAgcHJpdmF0ZSBjaGVja1JhbmRDb2RlQW5zeW4oKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2NoZWNrUmFuZENvZGVBbnN5blwiO1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgcmFuZENvZGU6IFwiXCIsXG4gICAgICByYW5kOiBcInJhbmRwXCJcbiAgICB9O1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcbiAgICAgIGlucHV0OiBwcm9jZXNzLnN0ZGluLFxuICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dFxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXMucXVlc3Rpb25DYXB0Y2hhKClcbiAgICAgIC5tZXJnZU1hcChwb3NpdGlvbnM9PntcbiAgICAgICAgb3B0aW9ucy5mb3JtLnJhbmRDb2RlID0gcG9zaXRpb25zO1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICAgICAgfSlcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBjb25maXJtU2luZ2xlRm9yUXVldWUodG9rZW4sIHBhc3NlbmdlcnMsIHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLCBwbGFuUGVwb2xlcyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NvbmZpcm1TaW5nbGVGb3JRdWV1ZVwiO1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxuICAgICAgLFwib2xkUGFzc2VuZ2VyU3RyXCI6IHRoaXMuZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcylcbiAgICAgICxcInJhbmRDb2RlXCI6XCJcIlxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5wdXJwb3NlX2NvZGVzXG4gICAgICAsXCJrZXlfY2hlY2tfaXNDaGFuZ2VcIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0ua2V5X2NoZWNrX2lzQ2hhbmdlXG4gICAgICAsXCJsZWZ0VGlja2V0U3RyXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmxlZnRUaWNrZXRTdHJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnRyYWluX2xvY2F0aW9uXG4gICAgICAsXCJjaG9vc2Vfc2VhdHNcIjogXCJcIlxuICAgICAgLFwic2VhdERldGFpbFR5cGVcIjogXCIwMDBcIlxuICAgICAgLFwid2hhdHNTZWxlY3RcIjogMVxuICAgICAgLFwicm9vbVR5cGVcIjogXCIwMFwiXG4gICAgICAsXCJkd0FsbFwiOiBcIk5cIlxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbjogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvcXVlcnlPcmRlcldhaXRUaW1lXCI7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IHtcbiAgICAgICAgXCJyYW5kb21cIjogbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgICAgLFwidG91ckZsYWdcIjogXCJkY1wiXG4gICAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICAgIH1cbiAgICAgICxqc29uOiB0cnVlXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gIH1cblxuICBwcml2YXRlIGNhbmNlbFF1ZXVlTm9Db21wbGV0ZU9yZGVyKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2NhbmNlbFF1ZXVlTm9Db21wbGV0ZU15T3JkZXJcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIHRvdXJGbGFnOiBcImRjXCJcbiAgICB9O1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKHRoaXMuaXNTeXN0ZW1CdXNzeShib2R5KSkge1xuICAgICAgICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBib2R5O1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGluaXROb0NvbXBsZXRlKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCI7XG4gICAgbGV0IG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybToge1xuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gIH1cblxuICBwdWJsaWMgbXlPcmRlck5vQ29tcGxldGUoKSB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC5tZXJnZU1hcCgoKT0+IHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpKVxuICAgICAgLnN1YnNjcmliZSgoeCk9PntcbiAgICAgICAgLypcbiAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICBkYXRhOiB7IG9yZGVyREJMaXN0OiBbIFtPYmplY3RdIF0sIHRvX3BhZ2U6ICdkYicgfSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICovXG4gICAgICAgICB0aGlzLnByaW50TXlPcmRlck5vQ29tcGxldGUoeCk7XG4gICAgICB9LCBlcnI9PmNvbnNvbGUuZXJyb3IoZXJyKSk7XG4gIH1cblxuICBwcml2YXRlIHByaW50TXlPcmRlck5vQ29tcGxldGUoeCkge1xuICAgIGlmKCF4LmRhdGEpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGtge3llbGxvdyDmsqHmnInmnKrlrozmiJDorqLljZV9YClcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICBsZXQgdGlja2V0cyA9IFtdO1xuICAgaWYoeC5kYXRhLm9yZGVyQ2FjaGVEVE8pIHtcbiAgICAgbGV0IG9yZGVyQ2FjaGUgPSB4LmRhdGEub3JkZXJDYWNoZURUTztcbiAgICAgb3JkZXJDYWNoZS50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xuICAgICAgIHRpY2tldHMucHVzaCh7XG4gICAgICAgICBcIuaOkumYn+WPt1wiOiBvcmRlckNhY2hlLnF1ZXVlTmFtZSxcbiAgICAgICAgIFwi562J5b6F5pe26Ze0XCI6IG9yZGVyQ2FjaGUud2FpdFRpbWUsXG4gICAgICAgICBcIuetieW+heS6uuaVsFwiOiBvcmRlckNhY2hlLndhaXRDb3VudCxcbiAgICAgICAgIFwi5L2Z56Wo5pWwXCI6IG9yZGVyQ2FjaGUudGlja2V0Q291bnQsXG4gICAgICAgICBcIuS5mOi9puaXpeacn1wiOiBvcmRlckNhY2hlLnRyYWluRGF0ZS5zbGljZSgwLDEwKSxcbiAgICAgICAgIFwi6L2m5qyhXCI6IG9yZGVyQ2FjaGUuc3RhdGlvblRyYWluQ29kZSxcbiAgICAgICAgIFwi5Ye65Y+R56uZXCI6IG9yZGVyQ2FjaGUuZnJvbVN0YXRpb25OYW1lLFxuICAgICAgICAgXCLliLDovr7nq5lcIjogb3JkZXJDYWNoZS50b1N0YXRpb25OYW1lLFxuICAgICAgICAgXCLluqfkvY3nrYnnuqdcIjogdGlja2V0LnNlYXRUeXBlTmFtZSxcbiAgICAgICAgIFwi5LmY6L2m5Lq6XCI6IHRpY2tldC5wYXNzZW5nZXJOYW1lXG4gICAgICAgfSk7XG4gICAgIH0pO1xuXG4gICB9ZWxzZSBpZih4LmRhdGEub3JkZXJEQkxpc3Qpe1xuXG4gICAgIHguZGF0YS5vcmRlckRCTGlzdC5mb3JFYWNoKG9yZGVyPT4ge1xuICAgICAgIC8vIGNvbnNvbGUubG9nKGNoYWxrYOiuouWNleWPtyB7eWVsbG93LmJvbGQgJHtvcmRlci5zZXF1ZW5jZV9ub319YClcbiAgICAgICBvcmRlci50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xuICAgICAgICAgdGlja2V0cy5wdXNoKHtcbiAgICAgICAgICAgXCLorqLljZXlj7dcIjogdGlja2V0LnNlcXVlbmNlX25vLFxuICAgICAgICAgICAvLyBcIuiuouelqOWPt1wiOiB0aWNrZXQudGlja2V0X25vLFxuICAgICAgICAgICBcIuS5mOi9puaXpeacn1wiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudHJhaW5fZGF0ZS5zbGljZSgwLDEwKX19YCxcbiAgICAgICAgICAgLy8gXCLkuIvljZXml7bpl7RcIjogdGlja2V0LnJlc2VydmVfdGltZSxcbiAgICAgICAgICAgXCLku5jmrL7miKroh7Pml7bpl7RcIjogY2hhbGtge3JlZC5ib2xkICR7dGlja2V0LnBheV9saW1pdF90aW1lfX1gLFxuICAgICAgICAgICBcIumHkeminVwiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudGlja2V0X3ByaWNlLzEwMH19YCxcbiAgICAgICAgICAgXCLnirbmgIFcIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRpY2tldF9zdGF0dXNfbmFtZX19YCxcbiAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3NlbmdlckRUTy5wYXNzZW5nZXJfbmFtZSxcbiAgICAgICAgICAgXCLovabmrKFcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy5zdGF0aW9uX3RyYWluX2NvZGUsXG4gICAgICAgICAgIFwi5Ye65Y+R56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8uZnJvbV9zdGF0aW9uX25hbWUsXG4gICAgICAgICAgIFwi5Yiw6L6+56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8udG9fc3RhdGlvbl9uYW1lLFxuICAgICAgICAgICBcIuW6p+S9jVwiOiB0aWNrZXQuc2VhdF9uYW1lLFxuICAgICAgICAgICBcIuW6p+S9jeetiee6p1wiOiB0aWNrZXQuc2VhdF90eXBlX25hbWUsXG4gICAgICAgICAgIFwi5LmY6L2m5Lq657G75Z6LXCI6IHRpY2tldC50aWNrZXRfdHlwZV9uYW1lXG4gICAgICAgICB9KTtcbiAgICAgICB9KTtcbiAgICAgfSk7XG4gICB9XG5cbiAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHRpY2tldHMsIHtcbiAgICAgY29sdW1uU3BsaXR0ZXI6ICd8J1xuICAgfSk7XG5cbiAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeU15T3JkZXJOb0NvbXBsZXRlKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL3F1ZXJ5TXlPcmRlck5vQ29tcGxldGVcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgIH1cbiAgICAgICxqc29uOiB0cnVlXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5KTtcbiAgICAgICAgICAvKipcbiAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAqL1xuICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGJvZHkubWVzc2FnZXM7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICA8ZGl2IGNsYXNzPVwidC1idG5cIj5cbnt7aWYgcGF5X2ZsYWc9PSdZJ319XG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIGlkPVwiY29udGludWVQYXlOb015Q29tcGxldGVcIiBvbmNsaWNrPVwiY29udGl1ZVBheU5vQ29tcGxldGVPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ3BheScpXCIgIGNsYXNzPVwiYnRuOTJzXCI+57un57ut5pSv5LuYPC9hPjwvZGl2PlxuICAgICAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBvbmNsaWNrPVwiY2FuY2VsTXlPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ2NhbmNlbF9vcmRlcicpXCIgaWQ9XCJjYW5jZWxfYnV0dG9uX3BheVwiIGNsYXNzPVwiYnRuOTJcIj7lj5bmtojorqLljZU8L2E+PC9kaXY+XG57ey9pZn19XG57e2lmIHBheV9yZXNpZ25fZmxhZz09J1knfX1cbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgaWQ9XCJjb250aW51ZVBheU5vTXlDb21wbGV0ZVwiIG9uY2xpY2s9XCJjb250aXVlUGF5Tm9Db21wbGV0ZU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywncmVzaWduJyk7XCIgIGNsYXNzPVwiYnRuOTJzXCI+57un57ut5pSv5LuYPC9hPjwvZGl2PlxuXHQgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfcmVzaWduJylcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2Plxue3svaWZ9fVxuXG4gICAgICAgIDwvZGl2PlxuICAqL1xuICBwcml2YXRlIGNhbmNlbE5vQ29tcGxldGVNeU9yZGVyKHNlcXVlbmNlTm86IHN0cmluZywgY2FuY2VsSWQ6IHN0cmluZyA9ICdjYW5jZWxfb3JkZXInKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvY2FuY2VsTm9Db21wbGV0ZU15T3JkZXJcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwic2VxdWVuY2Vfbm9cIjogc2VxdWVuY2VObyxcbiAgXHRcdFx0XCJjYW5jZWxfZmxhZ1wiOiBjYW5jZWxJZCxcbiAgICAgICAgXCJfanNvbl9hdHRcIjpcIlwiXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE5vQ29tcGxldGVPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJykge1xuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuY2FuY2VsTm9Db21wbGV0ZU15T3JkZXIoc2VxdWVuY2VObywgY2FuY2VsSWQpKVxuICAgICAgLnN1YnNjcmliZSgoYm9keSk9PntcbiAgICAgICAgICAvLyB7XCJ2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkXCI6XCJfdmFsaWRhdG9yTWVzc2FnZVwiLFwic3RhdHVzXCI6dHJ1ZSxcImh0dHBzdGF0dXNcIjoyMDAsXCJkYXRhXCI6e30sXCJtZXNzYWdlc1wiOltdLFwidmFsaWRhdGVNZXNzYWdlc1wiOnt9fVxuICAgICAgICAgIGlmIChib2R5LmRhdGEuZXhpc3RFcnJvciA9PSBcIllcIikge1xuICAgICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7Ym9keS5kYXRhLmVycm9yTXNnfX1gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGNoYWxrYHt5ZWxsb3cg6K6i5Y2VICR7c2VxdWVuY2VOb30g5bey5Y+W5raIfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgLGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7SlNPTi5zdHJpbmdpZnkoZXJyKX19YClcbiAgICAgICk7XG4gIH1cbn1cbiJdfQ==
