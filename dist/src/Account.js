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
    function Account(name, userPassword, manager, options) {
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
        this.manager = manager;
        this.userName = name;
        this.userPassword = userPassword;
        this.options = options || // default options
            {
                performance: {
                    query_interval: 1000
                }
            };
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
        // this.observableLoginInit()
        Observable_1.Observable.of(1)
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
            beeper(60 * 30 * 2);
            console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err));
        });
    };
    Account.prototype.orderWaitTime = function () {
        var _this = this;
        this.observableLoginInit()
            .subscribe(function () {
            _this.obsQueryOrderWaitT(new Order_1.Order())
                .mergeMap(function (orderId) { return _this.queryMyOrderNoComplete(); })
                .do(function (body) {
                if (body.data) {
                    _this.printMyOrderNoComplete(body);
                }
            })
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
            .subscribe(function (x) {
            if (x.status && x.data.existError == 'N') {
                console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"], ["{green.bold \u6392\u961F\u8BA2\u5355\u5DF2\u53D6\u6D88}"]))));
            }
            else {
                console.error(x);
            }
        }, function (error) { return console.error(error); });
    };
    Account.prototype.destroy = function () {
        // this.scptCheckUserTimer&&this.scptCheckUserTimer.unsubscribe();
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
                return _this.observableNewAppToken().do(function (newapptk) { return newAppToken = newapptk; });
                // if(err.result_code && err.result_code === 2) {
                //
                // }else {
                //   return Observable.timer(500);
                // }
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
                            if (train[seatNum] == "有" || train[seatNum] > order.planPepoles.length) {
                                planTrains.push(train);
                                return true;
                            }
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
                order.train = order.availableTrains[0];
                return order;
            }
            else {
                _this.query = true;
                throw chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"], ["\u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 {yellow ", "} \u5230 {yellow ", "} ", "{yellow ", "}"])), order.fromStationName, order.toStationName, order.passStationName ? '到' + order.passStationName + ' ' : '', order.trainDate);
            }
        })
            .retryWhen(function (error$) {
            return error$.do(function (err) { return process.stdout.write(err); })
                .delay(_this.options.performance.query_interval || 1000);
        })
            .switchMap(function (order) {
            console.log(chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["\u9884\u63D0\u4EA4\u8BA2\u5355 {yellow ", "} {yellow ", "} \u5230 {yellow ", "} \u65E5\u671F {yellow ", "}"], ["\u9884\u63D0\u4EA4\u8BA2\u5355 {yellow ", "} {yellow ", "} \u5230 {yellow ", "} \u65E5\u671F {yellow ", "}"])), order.train[3], order.fromStationName, order.toStationName, order.trainDate));
            return Observable_1.Observable.of(1)
                .mergeMap(function () { return _this.submitOrderRequest(order); })
                .retryWhen(function (error$) {
                return error$.do(function (err) { return winston.debug("SubmitOrderRequest error " + err); })
                    .delay(100);
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
                .do(function (orderSubmitRequest) {
                winston.debug("confirmPassenger Init Dc success! " + orderSubmitRequest.token);
                console.log(chalk(templateObject_18 || (templateObject_18 = __makeTemplateObject(["{yellow ", "}"], ["{yellow ", "}"])), orderSubmitRequest.ticketInfo.leftDetails.join("\t")));
            })
                .map(function (orderSubmitRequest) {
                order.request = orderSubmitRequest;
                var hasSeat = order.seatClasses.some(function (seatType) {
                    return orderSubmitRequest.ticketInfo.limitBuySeatTicketDTO.ticket_seat_codeMap["1"].some(function (ticketSeatCode) {
                        if (ticketSeatCode.value == seatType) {
                            order.seatType = ticketSeatCode.id;
                            return true;
                        }
                        return false;
                    });
                });
                if (!hasSeat) {
                    winston.debug("confirmPassenger Init 没有可购买余票，重新查询");
                    throw 'retry';
                }
                return order;
            });
        })
            .switchMap(function (order) {
            if (_this.passengers) {
                order.request.passengers = _this.passengers;
                return Observable_1.Observable.of(order);
            }
            else {
                return _this.getPassengers(order.request.token)
                    .retryWhen(function (error$) {
                    return error$.do(function (err) { return winston.error(chalk(templateObject_19 || (templateObject_19 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err)); })
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
            return _this.checkOrderInfo(order.request.token, order.seatType, order.request.passengers.data.normal_passengers, order.planPepoles)
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
            process.stdout.write(chalk(templateObject_20 || (templateObject_20 = __makeTemplateObject(["\u51C6\u5907\u8FDB\u5165\u6392\u961F"], ["\u51C6\u5907\u8FDB\u5165\u6392\u961F"]))));
            return _this.getQueueCount(order.request.token, order.seatType, order.request.orderRequest, order.request.ticketInfo)
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
            })
                .retryWhen(function (error$) { return error$.mergeMap(function (err) {
                if (err == '系统繁忙，请稍后重试！') {
                    process.stdout.write('.');
                    return Observable_1.Observable.timer(1000);
                }
                return Observable_1.Observable.throw(err);
            }); })
                .map(function (body) {
                winston.debug(body);
                order.request.queueInfo = body;
                return order;
            })
                .do(function () { return console.log(); });
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
            console.log(chalk(templateObject_21 || (templateObject_21 = __makeTemplateObject(["\u63D0\u4EA4\u6392\u961F\u8BA2\u5355"], ["\u63D0\u4EA4\u6392\u961F\u8BA2\u5355"]))));
            return _this.confirmSingleForQueue(order.request.token, order.seatType, order.request.passengers.data.normal_passengers, order.request.ticketInfo, order.planPepoles)
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
                    console.error(chalk(templateObject_22 || (templateObject_22 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), body.data.errMsg));
                    throw 'retry';
                }
            });
        })
            .retryWhen(function (error$) { return error$.do(function (err) { return winston.error(chalk(templateObject_23 || (templateObject_23 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), err)); })
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
                return error$.do(function (err) { return winston.error(chalk(templateObject_24 || (templateObject_24 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), err)); })
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
                .mergeMap(function (orderId) { return _this.queryMyOrderNoComplete(); })
                .do(function (body) {
                if (body.data) {
                    _this.printMyOrderNoComplete(body);
                    // 0.5秒响一次，响铃30分钟
                    beeper(60 * 30 * 2);
                }
            })
                .subscribe(function () {
                console.log(chalk(templateObject_25 || (templateObject_25 = __makeTemplateObject(["{yellow \u7ED3\u675F}"], ["{yellow \u7ED3\u675F}"]))));
                _this.destroy();
            }, function (err) { return winston.error(chalk(templateObject_26 || (templateObject_26 = __makeTemplateObject(["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"], ["{yellow \u9519\u8BEF\u7ED3\u675F ", "}"])), err)); });
        }, function (err) {
            winston.error(chalk(templateObject_27 || (templateObject_27 = __makeTemplateObject(["{red.bold ", "}"], ["{red.bold ", "}"])), JSON.stringify(err)));
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
        return Observable_1.Observable.of(1)
            .mergeMap(function () { return _this.queryOrderWaitTime(""); })
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
                    //return console.log(chalk`您的车票订单号是 {red.bold ${orderQueue.data.orderId}}`);
                    return orderQueue.data.orderId;
                }
                else if (orderQueue.data.waitTime === -2) {
                    if (orderQueue.data.msg) {
                        return console.log(chalk(templateObject_28 || (templateObject_28 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), orderQueue.data.msg));
                    }
                    throw orderQueue.data.msg;
                }
                else if (orderQueue.data.waitTime === -3) {
                    throw "您的车票订单已经取消!";
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
            .retryWhen(function (errors$) { return errors$.mergeMap(function (err) {
            if (err == 'retry') {
                return Observable_1.Observable.timer(4000);
            }
            return Observable_1.Observable.throw(err);
        }); });
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
            .retryWhen(function (errors$) {
            return errors$.do(function () { return process.stdout.write("."); })
                .delay(_this.options.performance.query_interval || 1000);
        })
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
                observer.complete();
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
        var url = "https://kyfw.12306.cn/otn/leftTicket/query?" + param;
        var options = {
            url: url,
            method: "GET",
            headers: Object.assign(Object.assign({}, this.headers), {
                "If-Modified-Since": "0",
                "Cache-Control": "no-cache",
                "Referer": "https://kyfw.12306.cn/otn/leftTicket/init"
            })
        };
        return this.request(options)
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
    Account.prototype.getPassengerTickets = function (seatType, passengers, planPepoles) {
        var tickets = [];
        passengers.forEach(function (passenger) {
            if (planPepoles.includes(passenger.passenger_name)) {
                //座位类型,0,票类型(成人/儿童),name,身份类型(身份证/军官证....),身份证,电话号码,保存状态
                var ticket = seatType +
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
    Account.prototype.checkOrderInfo = function (submitToken, seatType, passengers, planPepoles) {
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo";
        var passengerTicketStr = this.getPassengerTickets(seatType, passengers, planPepoles);
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
    Account.prototype.getQueueCount = function (token, seatType, orderRequestDTO, ticketInfo) {
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/getQueueCount";
        var data = {
            "train_date": new Date(orderRequestDTO.train_date.time).toString(),
            "train_no": orderRequestDTO.train_no,
            "stationTrainCode": orderRequestDTO.station_train_code,
            "seatType": seatType,
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
            .map(function (body) { return JSON.parse(body); });
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
    Account.prototype.confirmSingleForQueue = function (token, seatType, passengers, ticketInfoForPassengerForm, planPepoles) {
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/confirmSingleForQueue";
        var data = {
            "passengerTicketStr": this.getPassengerTickets(seatType, passengers, planPepoles),
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
        return this.request(options);
        // .map(body=> {
        //   if(this.isSystemBussy(body)) {
        //     throw this.SYSTEM_BUSSY;
        //   }
        //   return body;
        // });
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUM7QUFBRCxDQWhsREEsQUFnbERDLElBQUE7QUFobERZLDBCQUFPIiwiZmlsZSI6InNyYy9BY2NvdW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiIC8vIGh0dHBzOi8vd3d3LmxhbmluZGV4LmNvbS8xMjMwNiVFOCVCNCVBRCVFNyVBNSVBOCVFNiVCNSU4MSVFNyVBOCU4QiVFNSU4NSVBOCVFOCVBNyVBMyVFNiU5RSU5MC9cblxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XG5pbXBvcnQge0ZpbGVDb29raWVTdG9yZX0gZnJvbSAnLi9GaWxlQ29va2llU3RvcmUnO1xuaW1wb3J0IHtTdGF0aW9ufSBmcm9tICcuL1N0YXRpb24nO1xuaW1wb3J0IHJlcXVlc3QgPSByZXF1aXJlKCdyZXF1ZXN0Jyk7XG5pbXBvcnQgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xuaW1wb3J0IGZzID0gcmVxdWlyZSgnZnMnKTtcbmltcG9ydCByZWFkbGluZSA9IHJlcXVpcmUoJ3JlYWRsaW5lJyk7XG5pbXBvcnQgcHJvY2VzcyA9IHJlcXVpcmUoJ3Byb2Nlc3MnKTtcbmltcG9ydCBSeCBmcm9tICdyeGpzL1J4JztcbmltcG9ydCB7IE9ic2VydmFibGUsIE9ic2VydmFibGVJbnB1dCB9IGZyb20gJ3J4anMvT2JzZXJ2YWJsZSc7XG5pbXBvcnQgeyBPYnNlcnZlciB9IGZyb20gJ3J4anMvT2JzZXJ2ZXInO1xuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2JpbmRDYWxsYmFjayc7XG5pbXBvcnQgY2hhbGsgPSByZXF1aXJlKCdjaGFsaycpO1xuaW1wb3J0IGNvbHVtbmlmeSA9IHJlcXVpcmUoJ2NvbHVtbmlmeScpO1xuaW1wb3J0IGJlZXBlciA9IHJlcXVpcmUoJ2JlZXBlcicpO1xuaW1wb3J0IGNoaWxkX3Byb2Nlc3MgPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7XG5cbmltcG9ydCB7T3JkZXJTdWJtaXRSZXF1ZXN0LCBJT3JkZXIsIE9yZGVyfSBmcm9tICcuL09yZGVyJztcbmltcG9ydCB7IE1hbmFnZXIgfSBmcm9tICcuL01hbmFnZXInO1xuXG5leHBvcnQgaW50ZXJmYWNlIE9wdGlvbnMge1xuICBwZXJmb3JtYW5jZT86IGFueTtcbn1cblxuZXhwb3J0IGNsYXNzIEFjY291bnQge1xuICBwcml2YXRlIG1hbmFnZXI6IE1hbmFnZXI7XG4gIHB1YmxpYyB1c2VyTmFtZSA6IHN0cmluZztcbiAgcHJpdmF0ZSB1c2VyUGFzc3dvcmQgOiBzdHJpbmc7XG4gIHB1YmxpYyBvcHRpb25zOiBPcHRpb25zO1xuICBwcml2YXRlIGNoZWNrVXNlclRpbWVyID0gUnguT2JzZXJ2YWJsZS50aW1lcigxMDAwKjYwKjEwLCAxMDAwKjYwKjEwKTsgLy8g5Y2B5YiG6ZKf5LmL5ZCO5byA5aeL77yM5q+P5Y2B5YiG6ZKf5qOA5p+l5LiA5qyhXG4gIHByaXZhdGUgc2NwdENoZWNrVXNlclRpbWVyPzogUnguU3Vic2NyaXB0aW9uO1xuXG4gIHByaXZhdGUgc3RhdGlvbnM6IFN0YXRpb24gPSBuZXcgU3RhdGlvbigpO1xuICBwcml2YXRlIHBhc3NlbmdlcnM/OiBvYmplY3Q7XG5cbiAgcHJpdmF0ZSBTWVNURU1fQlVTU1kgPSBcIlN5c3RlbSBpcyBidXNzeVwiO1xuICBwcml2YXRlIFNZU1RFTV9NT1ZFRCA9IFwiTW92ZWQgVGVtcG9yYXJpbHlcIjtcblxuICBwcml2YXRlIHJhd1JlcXVlc3Q6IChvcHRpb25zOmFueXx1bmRlZmluZWR8bnVsbCwgY2I6YW55KT0+YW55O1xuICBwcml2YXRlIHJlcXVlc3Q6IChvcHRpb25zPzphbnl8dW5kZWZpbmVkfG51bGwpPT5PYnNlcnZhYmxlPGFueT47XG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XG4gIHB1YmxpYyBoZWFkZXJzOiBvYmplY3QgPSB7XG4gICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIlxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxuICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcbiAgICAsXCJPcmlnaW5cIjogXCJodHRwczovL2t5ZncuMTIzMDYuY25cIlxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcbiAgfTtcblxuICBwcml2YXRlIFRJQ0tFVF9USVRMRSA9IFsnJywgJycsICcnLCAn6L2m5qyhJywgJ+i1t+WniycsICfnu4jngrknLCAn5Ye65Y+R56uZJywgJ+WIsOi+vuermScsICflh7rlj5Hml7YnLCAn5Yiw6L6+5pe2JywgJ+WOhuaXticsICcnLCAnJyxcbiAgICAgICAgICAgICAgICfml6XmnJ8nLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ+mrmOe6p+i9r+WNpycsICcnLCAn6L2v5Y2nJywgJ+i9r+W6pycsICfnibnnrYnluqcnLCAn5peg5bqnJyxcbiAgICAgICAgICAgICAgICcnLCAn56Gs5Y2nJywgJ+ehrOW6pycsICfkuoznrYnluqcnLCAn5LiA562J5bqnJywgJ+WVhuWKoeW6pyddO1xuXG4gIHByaXZhdGUgcXVlcnkgPSBmYWxzZTtcblxuICBwcml2YXRlIG9yZGVyczogQXJyYXk8T3JkZXI+ID0gW107XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB1c2VyUGFzc3dvcmQ6IHN0cmluZywgbWFuYWdlcjogTWFuYWdlciwgb3B0aW9ucz86IE9wdGlvbnMpIHtcbiAgICB0aGlzLm1hbmFnZXIgPSBtYW5hZ2VyO1xuICAgIHRoaXMudXNlck5hbWUgPSBuYW1lO1xuICAgIHRoaXMudXNlclBhc3N3b3JkID0gdXNlclBhc3N3b3JkO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwgLy8gZGVmYXVsdCBvcHRpb25zXG4gICAgICB7XG4gICAgICAgIHBlcmZvcm1hbmNlOiB7XG4gICAgICAgICAgcXVlcnlfaW50ZXJ2YWw6IDEwMDBcbiAgICAgICAgfVxuICAgICAgfTtcblxuICAgIHRoaXMuc2V0UmVxdWVzdCgpO1xuICAgIHRoaXMucmF3UmVxdWVzdCA9IHJlcXVlc3QuZGVmYXVsdHMoe2phcjogdGhpcy5jb29raWVqYXJ9KTtcbiAgICB0aGlzLnJlcXVlc3QgPSBPYnNlcnZhYmxlLmJpbmRDYWxsYmFjazxBcnJheTxhbnk+Pih0aGlzLnJhd1JlcXVlc3QsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xuICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSAhPT0gMjAwKSB0aHJvdyBbJ2h0dHAgZXJyb3InLCByZXNwb25zZS5zdGF0dXNDb2RlLCByZXNwb25zZS5zdGF0dXNNZXNzYWdlXS5qb2luKCcgJyk7XG4gICAgICByZXR1cm4gYm9keTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmo4Dmn6XnvZHnu5zlvILluLhcbiAgICovXG4gIHByaXZhdGUgaXNTeXN0ZW1CdXNzeShib2R5OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICByZXR1cm4gYm9keS5pbmRleE9mKFwi572R57uc5Y+v6IO95a2Y5Zyo6Zeu6aKY77yM6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMDtcbiAgfVxuXG4gIHB1YmxpYyBzZXRSZXF1ZXN0KCkge1xuICAgIGxldCBjb29raWVGaWxlTmFtZTogc3RyaW5nID0gXCIuL2Nvb2tpZXMvXCIrdGhpcy51c2VyTmFtZStcIi5qc29uXCI7XG4gICAgdmFyIGZpbGVTdG9yZSA9IG5ldyBGaWxlQ29va2llU3RvcmUoY29va2llRmlsZU5hbWUsIHtlbmNyeXB0OiBmYWxzZX0pO1xuICAgIGZpbGVTdG9yZS5vcHRpb24gPSB7ZW5jcnlwdDogZmFsc2V9O1xuICAgIHRoaXMuY29va2llamFyID0gcmVxdWVzdC5qYXIoZmlsZVN0b3JlKTtcbiAgfVxuXG4gIHByaXZhdGUgbmV4dE9yZGVyTnVtOiBudW1iZXIgPSAwO1xuICBwcml2YXRlIG5leHRPcmRlcigpIHtcbiAgICB0aGlzLm5leHRPcmRlck51bSA9ICh0aGlzLm5leHRPcmRlck51bSArIDEpJXRoaXMub3JkZXJzLmxlbmd0aDtcbiAgICByZXR1cm4gdGhpcy5vcmRlcnNbdGhpcy5uZXh0T3JkZXJOdW1dO1xuICB9XG5cbiAgcHJpdmF0ZSBjdXJyZW50T3JkZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMub3JkZXJzW3RoaXMubmV4dE9yZGVyTnVtXTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVPcmRlcih0cmFpbkRhdGVzOiBBcnJheTxzdHJpbmc+LCBiYWNrVHJhaW5EYXRlOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICBbZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgcGxhblRyYWluczogQXJyYXk8c3RyaW5nPiwgcGxhblBlcG9sZXM6IEFycmF5PHN0cmluZz4sIHNlYXRDbGFzc2VzOiBBcnJheTxzdHJpbmc+KTogdGhpcyB7XG4gICAgdHJhaW5EYXRlcy5mb3JFYWNoKHRyYWluRGF0ZT0+IHtcbiAgICAgIGlmKCFuZXcgRGF0ZSh0cmFpbkRhdGUpLnRvSlNPTigpKSB7XG4gICAgICAgIHRocm93IGNoYWxrYHtyZWQg5LmY6L2m5pel5pyfJHt0cmFpbkRhdGV95qC85byP5LiN5q2j56Gu77yM5qC85byP5bqU6K+l5piveXl5eS1NTS1kZH1gO1xuICAgICAgfVxuICAgICAgaWYobmV3IERhdGUodHJhaW5EYXRlKS50b0pTT04oKS5zbGljZSgwLDEwKSA8IG5ldyBEYXRlKCkudG9KU09OKCkuc2xpY2UoMCwxMCkpIHtcbiAgICAgICAgdGhyb3cgY2hhbGtge3JlZCDkuZjovabml6XmnJ/lupTor6XkuLrku4rlpKnmiJbku6XlkI59YDtcbiAgICAgIH1cblxuICAgICAgdGhpcy5vcmRlcnMucHVzaChcbiAgICAgICAgbmV3IE9yZGVyKHRyYWluRGF0ZSwgYmFja1RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWUsIHBsYW5UcmFpbnMsIHBsYW5QZXBvbGVzLCBzZWF0Q2xhc3NlcylcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBzdWJtaXQoKTogdm9pZCB7XG4gICAgLy8gdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAvLyDmo4Dmn6XmnKrlrozmiJDorqLljZVcbiAgICAgIC5tZXJnZU1hcCgoKT0+IHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpKVxuICAgICAgLmRvKGJvZHk9PiB7XG4gICAgICAgIGlmKGJvZHkuZGF0YSkge1xuICAgICAgICAgIHRoaXMucHJpbnRNeU9yZGVyTm9Db21wbGV0ZShib2R5KTtcbiAgICAgICAgICBpZihib2R5LmRhdGEub3JkZXJDYWNoZURUTykge1xuICAgICAgICAgICAgdGhyb3cgJ+aCqOi/mOacieaOkumYn+iuouWNlSc7XG4gICAgICAgICAgfWVsc2UgaWYoYm9keS5kYXRhLm9yZGVyREJMaXN0KXtcbiAgICAgICAgICAgIHRocm93ICfmgqjov5jmnInmnKrlrozmiJDorqLljZUnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIOWHhuWkh+WlveWQjui/m+ihjOiuouelqOa1geeoi1xuICAgICAgLnN1YnNjcmliZSgoKT0+e1xuICAgICAgICB0aGlzLmJ1aWxkT3JkZXJGbG93KCk7XG5cbiAgICAgICAgdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXIgPVxuICAgICAgICAgIHRoaXMuY2hlY2tVc2VyVGltZXIuc3Vic2NyaWJlKChpKT0+IHtcbiAgICAgICAgICAgIHRoaXMub2JzZXJ2YWJsZUNoZWNrVXNlcigpXG4gICAgICAgICAgICAgIC5zdWJzY3JpYmUoKCk9PndpbnN0b24uZGVidWcoXCJDaGVjayB1c2VyIGRvbmVcIikpO1xuICAgICAgICAgIH0pO1xuICAgICAgfSxlcnI9PiB7XG4gICAgICAgIGJlZXBlcig2MCozMCoyKTtcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG9yZGVyV2FpdFRpbWUoKSB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcbiAgICAgICAgdGhpcy5vYnNRdWVyeU9yZGVyV2FpdFQobmV3IE9yZGVyKCkpXG4gICAgICAgICAgLm1lcmdlTWFwKChvcmRlcklkKT0+dGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXG4gICAgICAgICAgLmRvKChib2R5KT0+IHtcbiAgICAgICAgICAgIGlmKGJvZHkuZGF0YSkge1xuICAgICAgICAgICAgICB0aGlzLnByaW50TXlPcmRlck5vQ29tcGxldGUoYm9keSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg57uT5p2ffWApO1xuICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICxlcnI9PmNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6ZSZ6K+v57uT5p2fICR7ZXJyfX1gKVxuICAgICAgICAgICAgLCgpPT57XG4gICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICB9XG4gICAgICAsZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YClcbiAgICAgICwoKT0+e1xuICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE9yZGVyUXVldWUoKSB7XG4gICAgdGhpcy5jYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpXG4gICAgICAuc3Vic2NyaWJlKHg9PiB7XG4gICAgICAgIGlmKHguc3RhdHVzICYmIHguZGF0YS5leGlzdEVycm9yID09ICdOJykge1xuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOaOkumYn+iuouWNleW3suWPlua2iH1gKTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoeCk7XG4gICAgICAgIH1cbiAgICAgIH0sIGVycm9yPT4gY29uc29sZS5lcnJvcihlcnJvcikpO1xuICB9XG5cbiAgcHVibGljIGRlc3Ryb3koKSB7XG4gICAgLy8gdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXImJnRoaXMuc2NwdENoZWNrVXNlclRpbWVyLnVuc3Vic2NyaWJlKCk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVDaGVja0NhcHRjaGEoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5nZXRDYXB0Y2hhKCkpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuY2hlY2tDYXB0Y2hhKClcbiAgICAgICAgICAgICAgICAgICAgICAgIC5kbygoKT0+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIC8vIOagoemqjOeggeaIkOWKn+WQjui/m+ihjOaOiOadg+iupOivgVxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDpqozor4HnoIHmoKHpqozmiJDlip99YClcbiAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgIClcbiAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgZXJyb3IkLmRvKCgpPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg5qCh6aqM5aSx6LSl77yM6YeN5paw5qCh6aqMfWApKVxuICAgICAgKVxuICAgICAgO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlTG9naW4oKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5vYnNlcnZhYmxlQ2hlY2tDYXB0Y2hhKCkpXG4gICAgICAubWVyZ2VNYXAoKCk9PlxuICAgICAgICB0aGlzLnVzZXJBdXRoZW50aWNhdGUoKVxuICAgICAgICAgIC5kbygoKT0+Y29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg55m75b2V5oiQ5YqffWApKVxuICAgICAgKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgIC8qXG4gICAgICAgICAge1wicmVzdWx0X21lc3NhZ2VcIjpcIuWvhueggei+k+WFpemUmeivr+OAguWmguaenOi+k+mUmeasoeaVsOi2hei/hzTmrKHvvIznlKjmiLflsIbooqvplIHlrprjgIJcIixcInJlc3VsdF9jb2RlXCI6MX1cbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi6aqM6K+B56CB5qCh6aqM5aSx6LSlXCIsXCJyZXN1bHRfY29kZVwiOlwiNVwifVxuICAgICAgICAgICovXG4gICAgICAgICAgaWYodHlwZW9mIGVyci5yZXN1bHRfY29kZSA9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcigxMDAwKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC5jYXRjaChlcnI9PiB7XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke2Vyci5yZXN1bHRfbWVzc2FnZX19YCk7XG4gICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZU5ld0FwcFRva2VuKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5nZXROZXdBcHBUb2tlbigpKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGVycikpXG4gICAgICAgICAgLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbigpO1xuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlQXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgbGV0IG5ld0FwcFRva2VuID0gbmV3YXBwdGs7XG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8c3RyaW5nPik9PiB7XG4gICAgICAgIG9ic2VydmVyLm5leHQobmV3QXBwVG9rZW4pO1xuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xuICAgICAgfSlcbiAgICAgIC5tZXJnZU1hcCgobmV3YXBwdGs6IHN0cmluZyk9PnRoaXMuZ2V0QXBwVG9rZW4obmV3YXBwdGspKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGVycikpXG4gICAgICAgICAgLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDojrflj5ZUb2tlbuWksei0pX1gKTtcbiAgICAgICAgICAgIHdpbnN0b24uZGVidWcoZXJyKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpLmRvKChuZXdhcHB0ayk9Pm5ld0FwcFRva2VuID0gbmV3YXBwdGspO1xuICAgICAgICAgICAgLy8gaWYoZXJyLnJlc3VsdF9jb2RlICYmIGVyci5yZXN1bHRfY29kZSA9PT0gMikge1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIH1lbHNlIHtcbiAgICAgICAgICAgIC8vICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgIC8vIH1cbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxuXG4gIHB1YmxpYyBvYnNlcnZhYmxlTG9naW5Jbml0KCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgLy8g55m75b2V5Yid5aeL5YyWXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcChvcmRlcj0+dGhpcy5sb2dpbkluaXQoKSlcbiAgICAgIC5yZXRyeSgxMDAwKVxuICAgICAgLm1hcChvcmRlciA9PiB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24odGhpcy5jb29raWVqYXIuX2phci50b0pTT04oKS5jb29raWVzKSlcbiAgICAgIC5tZXJnZU1hcCh0b2tlbnM9PiB7XG4gICAgICAgIGlmKHRva2Vucy50aykge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVBcHBUb2tlbih0b2tlbnMudGspO1xuICAgICAgICB9ZWxzZSBpZih0b2tlbnMudWFtdGspIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTmV3QXBwVG9rZW4oKVxuICAgICAgICAgICAgLm1lcmdlTWFwKG5ld2FwcHRrPT50aGlzLm9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0aykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbigpXG4gICAgICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpKVxuICAgICAgICAgIC5tZXJnZU1hcChuZXdhcHB0az0+dGhpcy5vYnNlcnZhYmxlQXBwVG9rZW4obmV3YXBwdGspKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaVsOe7hOWkmuWFs+mUruWtl+auteaOkuW6j+eul+azle+8jOWtl+autem7mOiupOS4uumAkuWHj+aOkuW6j++8jOWmguaenOWtl+auteWJjemdouW4puaciSvnrKblj7fliJnkuLrpgJLlop7mjpLluo9cbiAgICovXG4gIHByaXZhdGUgZmllbGRTb3J0ZXIoZmllbGRzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgcmV0dXJuIChhOmFueSwgYjphbnkpID0+IGZpZWxkcy5tYXAoKG86c3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGxldCBkaXIgPSAtMTtcbiAgICAgICAgICAgICAgaWYgKG9bMF0gPT09ICcrJykge1xuICAgICAgICAgICAgICAgIGRpciA9IDE7XG4gICAgICAgICAgICAgICAgbyA9IG8uc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICB9ZWxzZSBpZihvWzBdID09PSAnLScpIHtcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGFbb10gPiBiW29dID8gZGlyIDogYVtvXSA8IGJbb10gPyAtKGRpcikgOiAwO1xuICAgICAgICAgIH0pLnJlZHVjZSgocCwgbikgPT4gcCA/IHAgOiBuLCAwKTtcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlPElPcmRlcj4ge1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpXG4gICAgICAvLyDojrflj5bkvZnnpajkv6Hmga9cbiAgICAgIC5tZXJnZU1hcCgob3JkZXI6IElPcmRlcik6IE9ic2VydmFibGVJbnB1dDxJT3JkZXI+ID0+XG4gICAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyhvcmRlci50cmFpbkRhdGUsIG9yZGVyLmZyb21TdGF0aW9uLCBvcmRlci50b1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXG4gICAgICAgICAgLm1hcCgodHJhaW5zKT0+IHtcbiAgICAgICAgICAgIG9yZGVyLnRyYWlucyA9IHRyYWlucztcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLy8g6I635Y+W6YCU57uP56uZ6L2m5qyh5L+h5oGvXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlSW5wdXQ8SU9yZGVyPiA9PiB7XG4gICAgICAgIGlmKG9yZGVyLnBhc3NTdGF0aW9uKSB7XG4gICAgICAgICAgaWYoIW9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnF1ZXJ5TGVmdFRpY2tldHMob3JkZXIudHJhaW5EYXRlLCBvcmRlci5mcm9tU3RhdGlvbiwgb3JkZXIucGFzc1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXG4gICAgICAgICAgICAgIC5tYXAocGFzc1RyYWlucz0+IHtcbiAgICAgICAgICAgICAgICBvcmRlci5mcm9tVG9QYXNzVHJhaW5zID0gcGFzc1RyYWlucy5tYXAodHJhaW49PiB0cmFpblszXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpO1xuICAgICAgfSlcbiAgICAgIC8vIOaMiemAlOe7j+ermei9puasoei/h+a7pFxuICAgICAgLm1hcCgob3JkZXI6IElPcmRlcik6IElPcmRlciA9PiB7XG4gICAgICAgIGlmKG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSBvcmRlci50cmFpbnMuZmlsdGVyKHRyYWluID0+IG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMuaW5jbHVkZXModHJhaW5bM10pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICB9KVxuICAgICAgLy8g5oyJ5pe26Ze06IyD5Zu06L+H5rukXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcbiAgICAgICAgaWYob3JkZXIucGxhblRpbWVzKSB7XG4gICAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG4gICAgICAgICAgb3JkZXIudHJhaW5zID0gdHJhaW5zLmZpbHRlcih0cmFpbj0+IHtcbiAgICAgICAgICAgIHJldHVybiAob3JkZXIucGxhblRpbWVzWzBdP29yZGVyLnBsYW5UaW1lc1swXTw9dHJhaW5bOF06dHJ1ZSkmJihvcmRlci5wbGFuVGltZXNbMV0/b3JkZXIucGxhblRpbWVzWzFdPj10cmFpbls4XTp0cnVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDmoLnmja7lrZfmrrXmjpLluo9cbiAgICAgIC5tYXAoKG9yZGVyOiBJT3JkZXIpOiBJT3JkZXIgPT4ge1xuICAgICAgICBpZihvcmRlci5wbGFuT3JkZXJCeSkge1xuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IG9yZGVyLnRyYWlucy5zb3J0KHRoaXMuZmllbGRTb3J0ZXIob3JkZXIucGxhbk9yZGVyQnkpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICB9KVxuICAgICAgLy8g6K6h566X5Y+v6LSt5Lmw6L2m5qyh5L+h5oGvXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcbiAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG5cbiAgICAgICAgbGV0IHBsYW5UcmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW10sIHRoYXQgPSB0aGlzO1xuICAgICAgICB0cmFpbnMuc29tZSh0cmFpbiA9PiB7XG4gICAgICAgICAgcmV0dXJuIG9yZGVyLnNlYXRDbGFzc2VzLnNvbWUoc2VhdCA9PiB7XG4gICAgICAgICAgICB2YXIgc2VhdE51bSA9IHRoaXMuVElDS0VUX1RJVExFLmluZGV4T2Yoc2VhdCk7XG4gICAgICAgICAgICBpZih0cmFpbltzZWF0TnVtXSA9PSBcIuaciVwiIHx8IHRyYWluW3NlYXROdW1dID4gMCkge1xuICAgICAgICAgICAgICB3aW5zdG9uLmRlYnVnKG9yZGVyLnRyYWluRGF0ZStcIi9cIit0cmFpblszXStcIi9cIitzZWF0K1wiL1wiK3RyYWluW3NlYXROdW1dKTtcbiAgICAgICAgICAgICAgaWYob3JkZXIucGxhblRyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpIHtcbiAgICAgICAgICAgICAgICBpZih0cmFpbltzZWF0TnVtXSA9PSBcIuaciVwiIHx8IHRyYWluW3NlYXROdW1dID4gb3JkZXIucGxhblBlcG9sZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICBwbGFuVHJhaW5zLnB1c2godHJhaW4pO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG9yZGVyLmF2YWlsYWJsZVRyYWlucyA9IHBsYW5UcmFpbnM7XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZWN1cnNpdmVRdWVyeUxlZnRUaWNrZXQoKTogT2JzZXJ2YWJsZTxPcmRlcj4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPE9yZGVyPik9PiB7XG4gICAgICAgIG9ic2VydmVyLm5leHQodGhpcy5uZXh0T3JkZXIoKSk7XG4gICAgICB9KVxuICAgICAgLm1lcmdlTWFwKChvcmRlcjogT3JkZXIpPT50aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0RmxvdyhvcmRlcikpXG4gICAgICAuZG8oKCk9PiB7XG4gICAgICAgIGlmKHRoaXMucXVlcnkpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5tYXAob3JkZXI9PiB7XG4gICAgICAgIGlmKG9yZGVyLmF2YWlsYWJsZVRyYWlucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IGZhbHNlO1xuICAgICAgICAgIC8vIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYHt5ZWxsb3cg5pyJ5Y+v6LSt5Lmw5L2Z56WoICR7cGxhblRyYWluLnRvU3RyaW5nKCl9fWApO1xuICAgICAgICAgIG9yZGVyLnRyYWluU2VjcmV0U3RyID0gb3JkZXIuYXZhaWxhYmxlVHJhaW5zWzBdWzBdO1xuICAgICAgICAgIG9yZGVyLnRyYWluID0gb3JkZXIuYXZhaWxhYmxlVHJhaW5zWzBdO1xuICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRoaXMucXVlcnkgPSB0cnVlO1xuICAgICAgICAgIHRocm93IGNoYWxrYOayoeacieWPr+i0reS5sOS9meelqCB7eWVsbG93ICR7b3JkZXIuZnJvbVN0YXRpb25OYW1lfX0g5YiwIHt5ZWxsb3cgJHtvcmRlci50b1N0YXRpb25OYW1lfX0gJHtvcmRlci5wYXNzU3RhdGlvbk5hbWU/J+WIsCcrb3JkZXIucGFzc1N0YXRpb25OYW1lKycgJzonJ317eWVsbG93ICR7b3JkZXIudHJhaW5EYXRlfX1gO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQuZG8oZXJyPT5wcm9jZXNzLnN0ZG91dC53cml0ZShlcnIpKVxuICAgICAgICAgIC5kZWxheSh0aGlzLm9wdGlvbnMucGVyZm9ybWFuY2UucXVlcnlfaW50ZXJ2YWwgfHwgMTAwMClcbiAgICAgIClcbiAgICAgIC8vIOajgOafpeeUqOaIt+eZu+W9leeKtuaAgVxuICAgICAgLy8gLm1lcmdlTWFwKChvcmRlcjogT3JkZXIpPT50aGlzLm9ic2VydmFibGVDaGVja1VzZXIoKS5tYXAoKCk9Pm9yZGVyKSlcblxuICAgICAgLy8gU3RlcCAxMSDpooTmj5DkuqTorqLljZXvvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT57XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYOmihOaPkOS6pOiuouWNlSB7eWVsbG93ICR7b3JkZXIudHJhaW5bM119fSB7eWVsbG93ICR7b3JkZXIuZnJvbVN0YXRpb25OYW1lfX0g5YiwIHt5ZWxsb3cgJHtvcmRlci50b1N0YXRpb25OYW1lfX0g5pel5pyfIHt5ZWxsb3cgJHtvcmRlci50cmFpbkRhdGV9fWApO1xuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5zdWJtaXRPcmRlclJlcXVlc3Qob3JkZXIpKVxuICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5kZWJ1ZyhcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycikpXG4gICAgICAgICAgICAgICAgLmRlbGF5KDEwMClcbiAgICAgICAgICApXG4gICAgICAgICAgLm1hcChib2R5PT5bb3JkZXIsIGJvZHldKTtcbiAgICAgIH0pXG4gICAgICAubWFwKChbb3JkZXIsIGJvZHldKT0+e1xuICAgICAgICBpZihib2R5LnN0YXR1cykge1xuICAgICAgICAgIHdpbnN0b24uZGVidWcoY2hhbGtge2JsdWUgU3VibWl0IE9yZGVyIFJlcXVlc3Qgc3VjY2VzcyF9YCk7XG4gICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgLy8g5oKo6L+Y5pyJ5pyq5aSE55CG55qE6K6i5Y2VXG4gICAgICAgICAgLy8g6K+l6L2m5qyh5pqC5LiN5Yqe55CG5Lia5YqhXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5Lm1lc3NhZ2VzWzBdfX1gKTtcbiAgICAgICAgICAvLyB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICB0aHJvdyBjaGFsa2B7cmVkLmJvbGQgJHtib2R5Lm1lc3NhZ2VzWzBdfX1gO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLy8gU3RlcCAxMiDmqKHmi5/ot7PovazpobXpnaJJbml0RGPvvIxQb3N0XG4gICAgICAubWVyZ2VNYXAob3JkZXI9PlxuICAgICAgICB0aGlzLmNvbmZpcm1QYXNzZW5nZXJJbml0RGMoKVxuICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgIGVycm9yJC5tZXJnZU1hcCgoZXJyKT0+IHtcbiAgICAgICAgICAgICAgICBpZihlcnIgPT0gdGhpcy5TWVNURU1fQlVTU1kpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKGVyciA9PSB0aGlzLlNZU1RFTV9NT1ZFRCkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDUwMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XG5cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICAgICAgLmRvKG9yZGVyU3VibWl0UmVxdWVzdD0+IHtcbiAgICAgICAgICAgIHdpbnN0b24uZGVidWcoXCJjb25maXJtUGFzc2VuZ2VyIEluaXQgRGMgc3VjY2VzcyEgXCIrb3JkZXJTdWJtaXRSZXF1ZXN0LnRva2VuKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cgJHtvcmRlclN1Ym1pdFJlcXVlc3QudGlja2V0SW5mby5sZWZ0RGV0YWlscy5qb2luKFwiXFx0XCIpfX1gKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5tYXAob3JkZXJTdWJtaXRSZXF1ZXN0PT57XG4gICAgICAgICAgICBvcmRlci5yZXF1ZXN0ID0gb3JkZXJTdWJtaXRSZXF1ZXN0O1xuXG4gICAgICAgICAgICBsZXQgaGFzU2VhdCA9IG9yZGVyLnNlYXRDbGFzc2VzLnNvbWUoKHNlYXRUeXBlOiBzdHJpbmcpPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gb3JkZXJTdWJtaXRSZXF1ZXN0LnRpY2tldEluZm8ubGltaXRCdXlTZWF0VGlja2V0RFRPLnRpY2tldF9zZWF0X2NvZGVNYXBbXCIxXCJdLnNvbWUoKHRpY2tldFNlYXRDb2RlKT0+IHtcbiAgICAgICAgICAgICAgICBpZih0aWNrZXRTZWF0Q29kZS52YWx1ZSA9PSBzZWF0VHlwZSkge1xuICAgICAgICAgICAgICAgICAgb3JkZXIuc2VhdFR5cGUgPSB0aWNrZXRTZWF0Q29kZS5pZDtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmKCFoYXNTZWF0KSB7XG4gICAgICAgICAgICAgIHdpbnN0b24uZGVidWcoXCJjb25maXJtUGFzc2VuZ2VyIEluaXQg5rKh5pyJ5Y+v6LSt5Lmw5L2Z56Wo77yM6YeN5paw5p+l6K+iXCIpO1xuICAgICAgICAgICAgICB0aHJvdyAncmV0cnknO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC8vIFN0ZXAgMTMg5bi455So6IGU57O75Lq656Gu5a6a77yMUG9zdFxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+IHtcbiAgICAgICAgaWYodGhpcy5wYXNzZW5nZXJzKSB7XG4gICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzID0gdGhpcy5wYXNzZW5nZXJzO1xuICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKG9yZGVyKTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXIucmVxdWVzdC50b2tlbilcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgICBlcnJvciQuZG8oKGVycik9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAgICAgICAuZGVsYXkoNTAwKVxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLm1hcChwYXNzZW5nZXJzPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xuICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xuICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIFN0ZXAgMTQg6LSt56Wo5Lq656Gu5a6a77yMUG9zdFxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+XG4gICAgICAgIHRoaXMuY2hlY2tPcmRlckluZm8ob3JkZXIucmVxdWVzdC50b2tlbiwgb3JkZXIuc2VhdFR5cGUsIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICBlcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGVycikpLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICAgICAubWFwKGJvZHk9PntcbiAgICAgICAgICAgIG9yZGVyLnJlcXVlc3Qub3JkZXJJbmZvID0gYm9keTtcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT57XG4gICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYOWHhuWkh+i/m+WFpeaOkumYn2ApO1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnNlYXRUeXBlLCBvcmRlci5yZXF1ZXN0Lm9yZGVyUmVxdWVzdCwgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvKVxuICAgICAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf57mB5b+Z77yM6K+356iN5ZCO6YeN6K+V77yBJyBdLFxuICAgICAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgIHRocm93IGJvZHkubWVzc2FnZXNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgICAgaWYoZXJyID09ICfns7vnu5/nuYHlv5nvvIzor7fnqI3lkI7ph43or5XvvIEnKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoJy4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcigxMDAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgLm1hcChib2R5PT57XG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKGJvZHkpO1xuICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5xdWV1ZUluZm8gPSBib2R5O1xuICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmRvKCgpPT5jb25zb2xlLmxvZygpKVxuICAgICAgfSlcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgIC8vIOiLpSBTdGVwIDE0IOS4reeahCBcImlmU2hvd1Bhc3NDb2RlXCIgPSBcIllcIu+8jOmCo+S5iOWkmuS6hui+k+WFpemqjOivgeeggei/meS4gOatpe+8jFBvc3RcbiAgICAgICAgaWYob3JkZXIucmVxdWVzdC5vcmRlckluZm8uZGF0YS5pZlNob3dQYXNzQ29kZSA9PSBcIllcIikge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVHZXRQYXNzQ29kZU5ldyhvcmRlcik7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT57XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYOaPkOS6pOaOkumYn+iuouWNlWApO1xuICAgICAgICByZXR1cm4gdGhpcy5jb25maXJtU2luZ2xlRm9yUXVldWUob3JkZXIucmVxdWVzdC50b2tlbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnNlYXRUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzLmRhdGEubm9ybWFsX3Bhc3NlbmdlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZGVsYXkoMTAwKSlcbiAgICAgICAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgICAgICAgaWYoYm9keS5zdGF0dXMgJiYgYm9keS5kYXRhLnN1Ym1pdFN0YXR1cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgICAgIGRhdGE6IHsgZXJyTXNnOiAn5L2Z56Wo5LiN6Laz77yBJywgc3VibWl0U3RhdHVzOiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5LmRhdGEuZXJyTXNnfX1gKVxuICAgICAgICAgICAgICAgIHRocm93ICdyZXRyeSc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICB9KVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICBpZihlcnIgPT0gJ3JldHJ5Jykge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlR2V0UGFzc2VuZ2VycyhvcmRlcjogT3JkZXIpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PlxuICAgICAgICB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXIucmVxdWVzdC50b2tlbilcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgICBlcnJvciQuZG8oKGVycik9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAgICAgICAuZGVsYXkoNTAwKVxuICAgICAgICAgICAgKVxuICAgICAgKVxuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlR2V0UGFzc0NvZGVOZXcob3JkZXI6IE9yZGVyKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLnN3aXRjaE1hcCgoKT0+IHRoaXMuZ2V0UGFzc0NvZGVOZXcoKSlcbiAgICAgIC5zd2l0Y2hNYXAoKCk9PiB0aGlzLmNoZWNrUmFuZENvZGVBbnN5bigpKVxuICB9XG5cbiAgcHJpdmF0ZSBidWlsZE9yZGVyRmxvdygpIHtcblxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMubGVmdFRpY2tldEluaXQoKSlcbiAgICAgIC5zd2l0Y2hNYXAoKCk9PnRoaXMucmVjdXJzaXZlUXVlcnlMZWZ0VGlja2V0KCkpXG4gICAgICAvLyBTdGVwIDE4IOafpeivouaOkumYn+etieW+heaXtumXtO+8gVxuICAgICAgLnN1YnNjcmliZShcbiAgICAgICAgKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgICAgdGhpcy5vYnNRdWVyeU9yZGVyV2FpdFQob3JkZXIpXG4gICAgICAgICAgICAubWVyZ2VNYXAoKG9yZGVySWQpPT50aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKSlcbiAgICAgICAgICAgIC5kbygoYm9keSk9PiB7XG4gICAgICAgICAgICAgIGlmKGJvZHkuZGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJpbnRNeU9yZGVyTm9Db21wbGV0ZShib2R5KTtcbiAgICAgICAgICAgICAgICAvLyAwLjXnp5Llk43kuIDmrKHvvIzlk43pk4MzMOWIhumSn1xuICAgICAgICAgICAgICAgIGJlZXBlcig2MCozMCoyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5zdWJzY3JpYmUoKCk9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDnu5PmnZ99YCk7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgIH0sZXJyPT53aW5zdG9uLmVycm9yKGNoYWxrYHt5ZWxsb3cg6ZSZ6K+v57uT5p2fICR7ZXJyfX1gKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVycj0+e1xuICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7SlNPTi5zdHJpbmdpZnkoZXJyKX19YCk7XG4gICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlQ2hlY2tVc2VyKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuXG4gICAgLy8gU3RlcCAxMCDpqozor4HnmbvlvZXvvIxQb3N0XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKSA9PiB0aGlzLmNoZWNrVXNlcigpKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbygoZXJyKT0+Y29uc29sZS5lcnJvcihcIkNoZWNrIHVzZXIgZXJyb3IgXCIrZXJyKSkpXG4gICAgICAubWVyZ2VNYXAoYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5kYXRhLmZsYWcpIHtcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihib2R5KTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbkluaXQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG9ic1F1ZXJ5T3JkZXJXYWl0VChvcmRlcjogT3JkZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgICAubWVyZ2VNYXAoKCk9PiB0aGlzLnF1ZXJ5T3JkZXJXYWl0VGltZShcIlwiKSlcbiAgICAgICAgLm1hcChvcmRlclF1ZXVlPT4ge1xuICAgICAgICAgIHdpbnN0b24uZGVidWcoSlNPTi5zdHJpbmdpZnkob3JkZXJRdWV1ZSkpO1xuICAgICAgICAgIC8qKlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIFwidmFsaWRhdGVNZXNzYWdlc1Nob3dJZFwiOiBcIl92YWxpZGF0b3JNZXNzYWdlXCIsXG4gICAgICAgICAgICBcInN0YXR1c1wiOiB0cnVlLFxuICAgICAgICAgICAgXCJodHRwc3RhdHVzXCI6IDIwMCxcbiAgICAgICAgICAgIFwiZGF0YVwiOiB7XG4gICAgICAgICAgICAgIFwicXVlcnlPcmRlcldhaXRUaW1lU3RhdHVzXCI6IHRydWUsXG4gICAgICAgICAgICAgIFwiY291bnRcIjogMCxcbiAgICAgICAgICAgICAgXCJ3YWl0VGltZVwiOiAyNDQ0LFxuICAgICAgICAgICAgICBcInJlcXVlc3RJZFwiOiA2Mzc2NzI3Mjg1NjM0Nzk3MDAwLFxuICAgICAgICAgICAgICBcIndhaXRDb3VudFwiOiAyMDAwLFxuICAgICAgICAgICAgICBcInRvdXJGbGFnXCI6IFwiZGNcIixcbiAgICAgICAgICAgICAgXCJvcmRlcklkXCI6IG51bGxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIm1lc3NhZ2VzXCI6IFtdLFxuICAgICAgICAgICAgXCJ2YWxpZGF0ZU1lc3NhZ2VzXCI6IHt9XG4gICAgICAgICAgfVxuICAgICAgICAgICovXG4gICAgICAgICAgaWYob3JkZXJRdWV1ZS5zdGF0dXMpIHtcbiAgICAgICAgICAgIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gMCB8fCBvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0xKSB7XG4gICAgICAgICAgICAgIC8vcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYOaCqOeahOi9puelqOiuouWNleWPt+aYryB7cmVkLmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEub3JkZXJJZH19YCk7XG4gICAgICAgICAgICAgIHJldHVybiBvcmRlclF1ZXVlLmRhdGEub3JkZXJJZDtcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTIpe1xuICAgICAgICAgICAgICBpZihvcmRlclF1ZXVlLmRhdGEubXNnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke29yZGVyUXVldWUuZGF0YS5tc2d9fWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRocm93IG9yZGVyUXVldWUuZGF0YS5tc2c7XG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0zKXtcbiAgICAgICAgICAgICAgdGhyb3cgXCLmgqjnmoTovabnpajorqLljZXlt7Lnu4/lj5bmtoghXCI7XG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC00KXtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCLmgqjnmoTovabnpajorqLljZXmraPlnKjlpITnkIYsIOivt+eojeetiS4uLlwiKTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtg5o6S6Zif5Lq65pWw77yae3llbGxvdy5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLndhaXRDb3VudH19IOmihOiuoeetieW+heaXtumXtO+8mnt5ZWxsb3cuYm9sZCAke3BhcnNlSW50KG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSAvIDEuNSl9fSDliIbpkp9gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgJ3JldHJ5JztcbiAgICAgICAgfSlcbiAgICAgICAgLnJldHJ5V2hlbigoZXJyb3JzJCk9PmVycm9ycyQubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICBpZihlcnIgPT0gJ3JldHJ5Jykge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig0MDAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgICAgICB9KVxuICAgICAgICApXG4gICAgICAgIDtcbiAgfVxuXG4gIC8qKlxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cbiAgICpcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXG4gICAqIEBwYXJhbSB0cmFpbk5hbWVzIOWIl+i9plxuICAgKlxuICAgKiBAcmV0dXJuIFByb21pc2VcbiAgICovXG4gIHB1YmxpYyBxdWVyeUxlZnRUaWNrZXRzKHRyYWluRGF0ZTogc3RyaW5nLCBmcm9tU3RhdGlvbjogc3RyaW5nLCB0b1N0YXRpb246IHN0cmluZywgdHJhaW5OYW1lcz86IFJlYWRvbmx5QXJyYXk8c3RyaW5nPik6IE9ic2VydmFibGU8QXJyYXk8YW55Pj4ge1xuICAgIGlmKCF0cmFpbkRhdGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5LmY6L2m5pel5pyffWApO1xuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coJ+ivt+i+k+WFpeS5mOi9puaXpeacnycpO1xuICAgIH1cbiAgICAvLyB0aGlzLkJBQ0tfVFJBSU5fREFURSA9IHRyYWluRGF0ZTtcblxuICAgIGlmKCFmcm9tU3RhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXlh7rlj5Hnq5l9YCk7XG4gICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdygn6K+36L6T5YWl5Ye65Y+R56uZJyk7XG4gICAgfVxuICAgIC8vIHRoaXMuRlJPTV9TVEFUSU9OX05BTUUgPSBmcm9tU3RhdGlvbk5hbWU7XG5cbiAgICBpZighdG9TdGF0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWIsOi+vuermX1gKTtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCfor7fovpPlhaXliLDovr7nq5knKTtcbiAgICB9XG4gICAgLy8gdGhpcy5UT19TVEFUSU9OX05BTUUgPSB0b1N0YXRpb25OYW1lO1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5xdWVyeUxlZnRUaWNrZXQoe3RyYWluRGF0ZTogdHJhaW5EYXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbVN0YXRpb246IGZyb21TdGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9TdGF0aW9uOiB0b1N0YXRpb259KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgIC8vIC5yZXRyeShOdW1iZXIuTUFYX1NBRkVfSU5URUdFUilcbiAgICAgIC5yZXRyeVdoZW4oKGVycm9ycyQpPT5cbiAgICAgICAgZXJyb3JzJC5kbygoKT0+cHJvY2Vzcy5zdGRvdXQud3JpdGUoXCIuXCIpKVxuICAgICAgICAgIC5kZWxheSh0aGlzLm9wdGlvbnMucGVyZm9ybWFuY2UucXVlcnlfaW50ZXJ2YWwgfHwgMTAwMCkpXG4gICAgICAubWFwKHRyYWluc0RhdGEgPT4gdHJhaW5zRGF0YS5yZXN1bHQpXG4gICAgICAubWFwKHJlc3VsdCA9PiB7XG4gICAgICAgIGxldCB0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW107XG5cbiAgICAgICAgcmVzdWx0LmZvckVhY2goKGVsZW1lbnQ6IHN0cmluZyk9PiB7XG4gICAgICAgICAgbGV0IHRyYWluOiBBcnJheTxzdHJpbmc+ID0gZWxlbWVudC5zcGxpdChcInxcIik7XG4gICAgICAgICAgdHJhaW5bNF0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzRdKTtcbiAgICAgICAgICB0cmFpbls1XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNV0pO1xuICAgICAgICAgIHRyYWluWzZdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls2XSk7XG4gICAgICAgICAgdHJhaW5bN10gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzddKTtcbiAgICAgICAgICB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJJU19USU1FX05PVF9CVVlcIiA/IFwi5YiX6L2m5YGc6L+QXCI6dHJhaW5bMTFdO1xuICAgICAgICAgIC8vIHRyYWluWzExXSA9IHRyYWluWzExXSA9PSBcIk5cIiA/IFwi5peg56WoXCI6dHJhaW5bMTFdO1xuICAgICAgICAgIC8vIHRyYWluWzExXSA9IHRyYWluWzExXSA9PSBcIllcIiA/IFwi5pyJ56WoXCI6dHJhaW5bMTFdO1xuICAgICAgICAgIC8vIOWMuemFjei+k+WFpeeahOWIl+i9puWQjeensOeahOato+WImeihqOi+vuW8j+adoeS7tlxuICAgICAgICAgIGlmKCF0cmFpbk5hbWVzIHx8IHRyYWluTmFtZXMuZmlsdGVyKHRuPT50cmFpblszXS5tYXRjaChuZXcgUmVnRXhwKHRuKSkgIT0gbnVsbCkubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdHJhaW5zLnB1c2godHJhaW4pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB0cmFpbnM7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cbiAgICpcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXG4gICAqIEBwYXJhbSBwYXNzU3RhdGlvbk5hbWUg6YCU57uP56uZXG4gICAqIEBwYXJhbSB0cmFpbk5hbWVzIOWIl+i9plxuICAgKiBAcGFyYW0gZiDovabmrKHov4fmu6TmnaHku7ZcbiAgICogQHBhcmFtIHQg5pe26Ze06L+H5ruk5p2h5Lu2XG4gICAqXG4gICAqIEByZXR1cm4gdm9pZFxuICAgKi9cbiAgcHVibGljIGxlZnRUaWNrZXRzKFt0cmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGFzc1N0YXRpb25OYW1lXSwge2ZpbHRlcixmLHRpbWUsdCxvcmRlcmJ5LG99KSB7XG4gICAgbGV0IGZyb21TdGF0aW9uOiBzdHJpbmcgPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKGZyb21TdGF0aW9uTmFtZSk7XG4gICAgbGV0IHRvU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZSh0b1N0YXRpb25OYW1lKTtcbiAgICBsZXQgcGFzc1N0YXRpb246IHN0cmluZyA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUocGFzc1N0YXRpb25OYW1lKTtcblxuICAgIGxldCBwbGFuVHJhaW5zOiBSZWFkb25seUFycmF5PHN0cmluZz58dW5kZWZpbmVkID1cbiAgICAgIHR5cGVvZiBmID09IFwic3RyaW5nXCIgPyBmLnNwbGl0KCcsJyk6KHR5cGVvZiBmaWx0ZXIgPT0gXCJzdHJpbmdcIiA/IGZpbHRlci5zcGxpdCgnLCcpOnVuZGVmaW5lZCk7XG4gICAgbGV0IHBsYW5UaW1lczogUmVhZG9ubHlBcnJheTxzdHJpbmc+fHVuZGVmaW5lZCA9XG4gICAgICB0eXBlb2YgdCA9PSBcInN0cmluZ1wiID8gdC5zcGxpdCgnLCcpOih0eXBlb2YgdGltZSA9PSBcInN0cmluZ1wiID8gdGltZS5zcGxpdCgnLCcpOnVuZGVmaW5lZCk7XG4gICAgbGV0IHBsYW5PcmRlckJ5OiBBcnJheTxzdHJpbmd8bnVtYmVyPnx1bmRlZmluZWQgPVxuICAgICAgdHlwZW9mIG8gPT0gXCJzdHJpbmdcIiA/IG8uc3BsaXQoJywnKToodHlwZW9mIG9yZGVyYnkgPT0gXCJzdHJpbmdcIiA/IG9yZGVyYnkuc3BsaXQoJywnKTp1bmRlZmluZWQpO1xuXG4gICAgaWYocGxhbk9yZGVyQnkpIHtcbiAgICAgIHBsYW5PcmRlckJ5ID0gcGxhbk9yZGVyQnkubWFwKChmaWVsZE5hbWU6c3RyaW5nfG51bWJlcikgPT4ge1xuICAgICAgICBpZihmaWVsZE5hbWVbMF0gPT09ICctJyB8fCBmaWVsZE5hbWVbMF0gPT09ICcrJykge1xuICAgICAgICAgIHJldHVybiBmaWVsZE5hbWVbMF0rdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihmaWVsZE5hbWUuc3Vic3RyaW5nKDEpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihmaWVsZE5hbWUpO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdGhpcy5idWlsZFF1ZXJ5TGVmdFRpY2tldEZsb3coe1xuICAgICAgICB0cmFpbkRhdGU6IHRyYWluRGF0ZVxuICAgICAgICAsYmFja1RyYWluRGF0ZTogdHJhaW5EYXRlXG4gICAgICAgICxmcm9tU3RhdGlvbk5hbWU6IGZyb21TdGF0aW9uTmFtZVxuICAgICAgICAsdG9TdGF0aW9uTmFtZTogdG9TdGF0aW9uTmFtZVxuICAgICAgICAsZnJvbVN0YXRpb246IGZyb21TdGF0aW9uXG4gICAgICAgICx0b1N0YXRpb246IHRvU3RhdGlvblxuICAgICAgICAscGFzc1N0YXRpb246IHBhc3NTdGF0aW9uXG4gICAgICAgICxwbGFuVHJhaW5zOiBwbGFuVHJhaW5zXG4gICAgICAgICxwbGFuVGltZXM6IHBsYW5UaW1lc1xuICAgICAgICAscGxhbk9yZGVyQnk6IHBsYW5PcmRlckJ5XG4gICAgICAgICxzZWF0Q2xhc3NlczogW11cbiAgICAgIH0pXG4gICAgICAuc3Vic2NyaWJlKChvcmRlcjogSU9yZGVyKSA9PiB7XG4gICAgICAgIGxldCB0cmFpbnMgPSB0aGlzLnJlbmRlclRyYWluTGlzdFRpdGxlKG9yZGVyLnRyYWlucyk7XG4gICAgICAgIGlmKHRyYWlucy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICByZXR1cm4gY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDmsqHmnInnrKblkIjmnaHku7bnmoTovabmrKF9YClcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJlbmRlckxlZnRUaWNrZXRzKHRyYWlucyk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyVHJhaW5MaXN0VGl0bGUodHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+Pik6IEFycmF5PEFycmF5PHN0cmluZz4+IHtcbiAgICB2YXIgdGl0bGUgPSB0aGlzLlRJQ0tFVF9USVRMRS5tYXAodD0+Y2hhbGtge2JsdWUgJHt0fX1gKTtcblxuICAgIHRyYWlucy5mb3JFYWNoKCh0cmFpbiwgaW5kZXgpPT4ge1xuICAgICAgaWYoaW5kZXggJSAzMCA9PT0gMCkge1xuICAgICAgICB0cmFpbnMuc3BsaWNlKGluZGV4LCAwLCB0aXRsZSk7XG4gICAgICB9XG4gICAgfSlcbiAgICByZXR1cm4gdHJhaW5zO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJMZWZ0VGlja2V0cyh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KSB7XG4gICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkodHJhaW5zLCB7XG4gICAgICBjb2x1bW5TcGxpdHRlcjogJ3wnLFxuICAgICAgY29sdW1uczogW1wiM1wiLCBcIjRcIiwgXCI1XCIsIFwiNlwiLCBcIjdcIiwgXCI4XCIsIFwiOVwiLCBcIjEwXCIsIFwiMTFcIiwgXCIyMFwiLCBcIjIxXCIsIFwiMjJcIiwgXCIyM1wiLCBcIjI0XCIsIFwiMjVcIixcbiAgICAgICAgICAgICAgICBcIjI2XCIsIFwiMjdcIiwgXCIyOFwiLCBcIjI5XCIsIFwiMzBcIiwgXCIzMVwiLCBcIjMyXCJdXG4gICAgfSlcblxuICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xuICB9XG5cbiAgcHVibGljIG15T3JkZXJOb0NvbXBsZXRlUmVwb3J0KCkge1xuICAgIHRoaXMuaW5pdE5vQ29tcGxldGUoKVxuICAgICAgLm1lcmdlTWFwKCgpPT5cbiAgICAgICAgdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKClcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRlbGF5KDUwMCkpXG4gICAgICApXG4gICAgICAuc3Vic2NyaWJlKHg9PiB7XG4gICAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkoeCwge1xuICAgICAgICAgICAgY29sdW1uU3BsaXR0ZXI6ICcgfCAnXG4gICAgICAgICAgfSk7XG5cbiAgICAgICAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcbiAgICAgICAgfSwgZXJyb3I9PiB7XG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvcik7XG4gICAgICAgIH0pXG4gIH1cblxuICBwdWJsaWMgbG9naW5Jbml0KCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vaW5pdFwiO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmwsXG4gICAgICBtZXRob2Q6IFwiR0VUXCIsXG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0Q2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcbiAgICAgICAgICBcIm1vZHVsZVwiOiBcImxvZ2luXCIsXG4gICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCIsXG4gICAgICAgICAgXCIwLjE3MjMxODcyNzAzMzg5MDYyXCI6XCJcIlxuICAgICAgfTtcblxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShkYXRhLCBudWxsLCBudWxsKVxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtaW1hZ2U/XCIrcGFyYW07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgIH07XG5cbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjx2b2lkPik9PiB7XG4gICAgICB0aGlzLnJhd1JlcXVlc3Qob3B0aW9ucywgKGVycm9yOiBhbnksIHJlc3BvbnNlOiBhbnksIGJvZHk6IHN0cmluZykgPT4ge1xuICAgICAgICBpZihlcnJvcikgcmV0dXJuIG9ic2VydmVyLmVycm9yKGVycm9yKTtcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHF1ZXN0aW9uQ2FwdGNoYSgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcbiAgICAgIGlucHV0OiBwcm9jZXNzLnN0ZGluLFxuICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dFxuICAgIH0pO1xuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPHN0cmluZz4pPT4ge1xuICAgICAgbGV0IGNoaWxkID0gY2hpbGRfcHJvY2Vzcy5leGVjKCdjYXB0Y2hhLkJNUCcsKCk9Pnt9KTtcblxuICAgICAgcmwucXVlc3Rpb24oY2hhbGtge3JlZC5ib2xkIOivt+i+k+WFpemqjOivgeeggX06YCwgKHBvc2l0aW9uU3RyKSA9PiB7XG4gICAgICAgIHJsLmNsb3NlKCk7XG5cbiAgICAgICAgaWYodHlwZW9mIHBvc2l0aW9uU3RyID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICBsZXQgcG9zaXRpb25zOiBBcnJheTxzdHJpbmc+ID0gW107XG4gICAgICAgICAgcG9zaXRpb25TdHIuc3BsaXQoJywnKS5mb3JFYWNoKGVsPT5wb3NpdGlvbnM9cG9zaXRpb25zLmNvbmNhdChlbC5zcGxpdCgnICcpKSk7XG4gICAgICAgICAgb2JzZXJ2ZXIubmV4dChwb3NpdGlvbnMubWFwKChwb3NpdGlvbjogc3RyaW5nKT0+IHtcbiAgICAgICAgICAgICAgc3dpdGNoKHBvc2l0aW9uKSB7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjFcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDQ1XCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjJcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjExMCw0NVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCIzXCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxODAsNDVcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiNFwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDQ1XCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjVcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDExMFwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI2XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxMTAsMTEwXCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjdcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjE4MCwxMTBcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiOFwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDExMFwiO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KS5qb2luKCcsJykpO1xuICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICBvYnNlcnZlci5lcnJvcihcIui+k+WFpeagvOW8j+mUmeivr1wiKTtcbiAgICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tDYXB0Y2hhKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtY2hlY2tcIjtcblxuICAgIHJldHVybiB0aGlzLnF1ZXN0aW9uQ2FwdGNoYSgpXG4gICAgICAubWVyZ2VNYXAocG9zaXRpb25zPT57XG4gICAgICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgICAgXCJhbnN3ZXJcIjogcG9zaXRpb25zLFxuICAgICAgICAgICAgXCJsb2dpbl9zaXRlXCI6IFwiRVwiLFxuICAgICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCJcbiAgICAgICAgICB9O1xuXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICAgIHVybDogdXJsXG4gICAgICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgICAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgICAgICxmb3JtOiBkYXRhXG4gICAgICAgIH07XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpXG4gICAgICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSA0KSB7XG4gICAgICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhyb3cgYm9keS5yZXN1bHRfbWVzc2FnZTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSB1c2VyQXV0aGVudGljYXRlKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgLy8g5Y+R6YCB55m75b2V5L+h5oGvXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXG4gICAgICAgICAgLFwidXNlcm5hbWVcIjogdGhpcy51c2VyTmFtZVxuICAgICAgICAgICxcInBhc3N3b3JkXCI6IHRoaXMudXNlclBhc3N3b3JkXG4gICAgICAgIH07XG5cbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2xvZ2luXCI7XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAyKSB7XG4gICAgICAgICAgdGhyb3cgYm9keS5yZXN1bHRfbWVzc2FnZTtcbiAgICAgICAgfWVsc2UgaWYoYm9keS5yZXN1bHRfY29kZSAhPSAwKSB7XG4gICAgICAgICAgdGhyb3cgYm9keTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiBib2R5LnVhbXRrO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0TmV3QXBwVG9rZW4oKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcbiAgICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9e1xuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvYXV0aC91YW10a1wiXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5KTtcbiAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHkubmV3YXBwdGs7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0aHJvdyBib2R5O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0QXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgXCJ0a1wiOiBuZXdhcHB0a1xuICAgICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3VhbWF1dGhjbGllbnRcIlxuICAgICAgLGhlYWRlcnM6IHtcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgNi4xOyBXT1c2NCkgQXBwbGVXZWJLaXQvNTM3LjE3IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzI0LjAuMTMxMi42MCBTYWZhcmkvNTM3LjE3XCJcbiAgICAgICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzcG9ydD9yZWRpcmVjdD0vb3RuL1wiXG4gICAgICAgICwnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcbiAgICAgIH1cbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICB3aW5zdG9uLmRlYnVnKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xuICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcbiAgICAgICAgICByZXR1cm4gYm9keS5hcHB0aztcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRocm93IGJvZHk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgLy8gcHJpdmF0ZSBnZXRNeTEyMzA2KCk6IFByb21pc2Uge1xuICAvLyAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcbiAgLy8gICAgIHRoaXMucmVxdWVzdCh7XG4gIC8vICAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2luZGV4L2luaXRNeTEyMzA2XCJcbiAgLy8gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gIC8vICAgICAgLG1ldGhvZDogXCJHRVRcIn0sXG4gIC8vICAgICAgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gIC8vICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xuICAvLyAgICAgICAgIGNvbnNvbGUubG9nKFwiR290IG15IDEyMzA2XCIpO1xuICAvLyAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XG4gIC8vICAgICAgIH1cbiAgLy8gICAgICAgcmVqZWN0KCk7XG4gIC8vICAgICB9KTtcbiAgLy8gICB9KTtcbiAgLy8gfVxuXG4gIHByaXZhdGUgY2hlY2tBdXRoZW50aWNhdGlvbihjb29raWVzOiBvYmplY3QpIHtcbiAgICB2YXIgdWFtdGsgPSBcIlwiLCB0ayA9IFwiXCI7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IGNvb2tpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidWFtdGtcIikge1xuICAgICAgICB1YW10ayA9IGNvb2tpZXNbaV0udmFsdWU7XG4gICAgICB9XG5cbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidGtcIikge1xuICAgICAgICB0ayA9IGNvb2tpZXNbaV0udmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICB1YW10azogdWFtdGssXG4gICAgICB0azogdGtcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBsZWZ0VGlja2V0SW5pdCgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiO1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1cmwpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeUxlZnRUaWNrZXQoe3RyYWluRGF0ZSwgZnJvbVN0YXRpb24sIHRvU3RhdGlvbn0pOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciBxdWVyeSA9IHtcbiAgICAgIFwibGVmdFRpY2tldERUTy50cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxuICAgICAgLFwibGVmdFRpY2tldERUTy5mcm9tX3N0YXRpb25cIjogZnJvbVN0YXRpb25cbiAgICAgICxcImxlZnRUaWNrZXREVE8udG9fc3RhdGlvblwiOiB0b1N0YXRpb25cbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXG4gICAgfVxuXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9xdWVyeT9cIitwYXJhbTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiR0VUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxuICAgICAgfSlcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZighYm9keSkge1xuICAgICAgICAgIHRocm93IFwi57O757uf6L+U5Zue5peg5pWw5o2uXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYoYm9keS5pbmRleE9mKFwi6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMCkge1xuICAgICAgICAgIHRocm93IFwi57O757uf57mB5b+ZIVwiO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShib2R5KS5kYXRhO1xuICAgICAgICAgIH1jYXRjaChlcnIpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gUmVzb2x2ZWRcbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrVXNlcigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2NoZWNrVXNlclwiO1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdWJtaXRPcmRlclJlcXVlc3Qoe3RyYWluU2VjcmV0U3RyLCB0cmFpbkRhdGUsIGJhY2tUcmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZX0pOiBPYnNlcnZhYmxlPG9iamVjdD4gIHtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9zdWJtaXRPcmRlclJlcXVlc3RcIjtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJzZWNyZXRTdHJcIjogcXVlcnlzdHJpbmcudW5lc2NhcGUodHJhaW5TZWNyZXRTdHIpXG4gICAgICAsXCJ0cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxuICAgICAgLFwiYmFja190cmFpbl9kYXRlXCI6IGJhY2tUcmFpbkRhdGVcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXG4gICAgICAsXCJxdWVyeV9mcm9tX3N0YXRpb25fbmFtZVwiOiBmcm9tU3RhdGlvbk5hbWVcbiAgICAgICxcInF1ZXJ5X3RvX3N0YXRpb25fbmFtZVwiOiB0b1N0YXRpb25OYW1lXG4gICAgICAsXCJ1bmRlZmluZWRcIjpcIlwiXG4gICAgfTtcblxuICAgIC8vIHVybCA9IHVybCArIFwic2VjcmV0U3RyPVwiK3NlY3JldFN0citcIiZ0cmFpbl9kYXRlPTIwMTgtMDEtMzEmYmFja190cmFpbl9kYXRlPTIwMTgtMDEtMzAmdG91cl9mbGFnPWRjJnB1cnBvc2VfY29kZXM9QURVTFQmcXVlcnlfZnJvbV9zdGF0aW9uX25hbWU95LiK5rW3JnF1ZXJ5X3RvX3N0YXRpb25fbmFtZT3lvpDlt57kuJwmdW5kZWZpbmVkXCI7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1QYXNzZW5nZXJJbml0RGMoKTogT2JzZXJ2YWJsZTxPcmRlclN1Ym1pdFJlcXVlc3Q+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXG4gICAgICAgICxcIlVwZ3JhZGUtSW5zZWN1cmUtUmVxdWVzdHNcIjoxXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcbiAgICAgICAgICB0aHJvdyB0aGlzLlNZU1RFTV9CVVNTWTtcbiAgICAgICAgfVxuICAgICAgICBpZihib2R5KSB7XG4gICAgICAgICAgLy8gR2V0IFJlcGVhdCBTdWJtaXQgVG9rZW5cbiAgICAgICAgICB2YXIgdG9rZW4gPSBib2R5Lm1hdGNoKC92YXIgZ2xvYmFsUmVwZWF0U3VibWl0VG9rZW4gPSAnKC4qPyknOy8pO1xuICAgICAgICAgIHZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSA9IGJvZHkubWF0Y2goL3ZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybT0oLio/KTsvKTtcbiAgICAgICAgICB2YXIgb3JkZXJSZXF1ZXN0RFRPID0gYm9keS5tYXRjaCgvdmFyIG9yZGVyUmVxdWVzdERUTz0oLio/KTsvKTtcbiAgICAgICAgICBpZih0b2tlbikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgdG9rZW46IHRva2VuWzFdXG4gICAgICAgICAgICAgICx0aWNrZXRJbmZvOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSYmSlNPTi5wYXJzZSh0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybVsxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcbiAgICAgICAgICAgICAgLG9yZGVyUmVxdWVzdDogb3JkZXJSZXF1ZXN0RFRPJiZKU09OLnBhcnNlKG9yZGVyUmVxdWVzdERUT1sxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldFBhc3NlbmdlcnModG9rZW46IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2dldFBhc3NlbmdlckRUT3NcIjtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxuICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKTtcbiAgfVxuXG4gIC8qIHNlYXQgdHlwZVxuICDigJjova/ljafigJkgPT4g4oCYNOKAmSxcbiAg4oCY5LqM562J5bqn4oCZID0+IOKAmE/igJksXG4gIOKAmOS4gOetieW6p+KAmSA9PiDigJhN4oCZLFxuICDigJjnoazluqfigJkgPT4g4oCYMeKAmSxcbiAgICovXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2VyVGlja2V0cyhzZWF0VHlwZSwgcGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy/luqfkvY3nsbvlnossMCznpajnsbvlnoso5oiQ5Lq6L+WEv+erpSksbmFtZSzouqvku73nsbvlnoso6Lqr5Lu96K+BL+WGm+WumOivgS4uLi4pLOi6q+S7veivgSznlLXor53lj7fnoIEs5L+d5a2Y54q25oCBXG4gICAgICAgIHZhciB0aWNrZXQgPSAvKnBhc3Nlbmdlci5zZWF0X3R5cGUqLyBzZWF0VHlwZSArXG4gICAgICAgICAgICAgICAgXCIsMCxcIiArXG4gICAgICAgICAgICAgICAgLypsaW1pdF90aWNrZXRzW2FBXS50aWNrZXRfdHlwZSovXCIxXCIgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgKHBhc3Nlbmdlci5waG9uZV9ubyB8fCBcIlwiICkgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCJOXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIik7XG4gIH1cblxuICBwcml2YXRlIGdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy9uYW1lLOi6q+S7veexu+Weiyzouqvku73or4EsMV9cbiAgICAgICAgdmFyIHRpY2tldCA9XG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCIxXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBzZWF0VHlwZSwgcGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jaGVja09yZGVySW5mb1wiO1xuXG4gICAgdmFyIHBhc3NlbmdlclRpY2tldFN0ciA9IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhzZWF0VHlwZSwgcGFzc2VuZ2VycywgcGxhblBlcG9sZXMpO1xuICAgIGlmKCFwYXNzZW5nZXJUaWNrZXRTdHIpIHtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpO1xuICAgIH1cblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJjYW5jZWxfZmxhZ1wiOiAyXG4gICAgICAsXCJiZWRfbGV2ZWxfb3JkZXJfbnVtXCI6IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCJcbiAgICAgICxcInBhc3NlbmdlclRpY2tldFN0clwiOiBwYXNzZW5nZXJUaWNrZXRTdHJcbiAgICAgICxcIm9sZFBhc3NlbmdlclN0clwiOiB0aGlzLmdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXG4gICAgICAsXCJyYW5kQ29kZVwiOiBcIlwiXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOjFcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHN1Ym1pdFRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIC8qXG4gICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgdXJsOiAnL2xlZnRUaWNrZXQvaW5pdCcsXG4gICAgICAgICAgICBzdGF0dXM6IGZhbHNlLFxuICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFsgJ+ezu+e7n+W/me+8jOivt+eojeWQjumHjeivlScgXSxcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICovXG4gICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0aHJvdyBib2R5Lm1lc3NhZ2VzWzBdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UXVldWVDb3VudCh0b2tlbiwgc2VhdFR5cGUsIG9yZGVyUmVxdWVzdERUTywgdGlja2V0SW5mbyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2dldFF1ZXVlQ291bnRcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwidHJhaW5fZGF0ZVwiOiBuZXcgRGF0ZShvcmRlclJlcXVlc3REVE8udHJhaW5fZGF0ZS50aW1lKS50b1N0cmluZygpXG4gICAgICAsXCJ0cmFpbl9ub1wiOiBvcmRlclJlcXVlc3REVE8udHJhaW5fbm9cbiAgICAgICxcInN0YXRpb25UcmFpbkNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLnN0YXRpb25fdHJhaW5fY29kZVxuICAgICAgLFwic2VhdFR5cGVcIjogc2VhdFR5cGVcbiAgICAgICxcImZyb21TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLmZyb21fc3RhdGlvbl90ZWxlY29kZVxuICAgICAgLFwidG9TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLnRvX3N0YXRpb25fdGVsZWNvZGVcbiAgICAgICxcImxlZnRUaWNrZXRcIjogdGlja2V0SW5mby5xdWVyeUxlZnRUaWNrZXRSZXF1ZXN0RFRPLnlwSW5mb0RldGFpbFxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIjAwXCJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm8udHJhaW5fbG9jYXRpb25cbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpXG4gICAgICA7XG4gIH1cblxuICBwcml2YXRlIGdldFBhc3NDb2RlTmV3KCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvZ2V0UGFzc0NvZGVOZXc/bW9kdWxlPXBhc3NlbmdlciZyYW5kPXJhbmRwJlwiK01hdGgucmFuZG9tKDAsMSk7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgfTtcblxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPHZvaWQ+KT0+IHtcbiAgICAgIHRoaXMucmF3UmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiBvYnNlcnZlci5lcnJvcihlcnJvcik7XG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUhPT0yMDApXG4gICAgICAgICAgb2JzZXJ2ZXIuZXJyb3IocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcbiAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gIH1cblxuICBwcml2YXRlIGNoZWNrUmFuZENvZGVBbnN5bigpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvY2hlY2tSYW5kQ29kZUFuc3luXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICByYW5kQ29kZTogXCJcIixcbiAgICAgIHJhbmQ6IFwicmFuZHBcIlxuICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXG4gICAgICBvdXRwdXQ6IHByb2Nlc3Muc3Rkb3V0XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5xdWVzdGlvbkNhcHRjaGEoKVxuICAgICAgLm1lcmdlTWFwKHBvc2l0aW9ucz0+e1xuICAgICAgICBvcHRpb25zLmZvcm0ucmFuZENvZGUgPSBwb3NpdGlvbnM7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICB9KVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1TaW5nbGVGb3JRdWV1ZSh0b2tlbiwgc2VhdFR5cGUsIHBhc3NlbmdlcnMsIHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLCBwbGFuUGVwb2xlcyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NvbmZpcm1TaW5nbGVGb3JRdWV1ZVwiO1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHNlYXRUeXBlLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcylcbiAgICAgICxcIm9sZFBhc3NlbmdlclN0clwiOiB0aGlzLmdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpXG4gICAgICAsXCJyYW5kQ29kZVwiOlwiXCJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0ucHVycG9zZV9jb2Rlc1xuICAgICAgLFwia2V5X2NoZWNrX2lzQ2hhbmdlXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmtleV9jaGVja19pc0NoYW5nZVxuICAgICAgLFwibGVmdFRpY2tldFN0clwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5sZWZ0VGlja2V0U3RyXG4gICAgICAsXCJ0cmFpbl9sb2NhdGlvblwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS50cmFpbl9sb2NhdGlvblxuICAgICAgLFwiY2hvb3NlX3NlYXRzXCI6IFwiXCJcbiAgICAgICxcInNlYXREZXRhaWxUeXBlXCI6IFwiMDAwXCJcbiAgICAgICxcIndoYXRzU2VsZWN0XCI6IDFcbiAgICAgICxcInJvb21UeXBlXCI6IFwiMDBcIlxuICAgICAgLFwiZHdBbGxcIjogXCJOXCJcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeU9yZGVyV2FpdFRpbWUodG9rZW46IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwicmFuZG9tXCI6IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxuICAgICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxRdWV1ZU5vQ29tcGxldGVNeU9yZGVyXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICB0b3VyRmxhZzogXCJkY1wiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgICAgLGpzb246IHRydWVcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcbiAgICAgIC8vIC5tYXAoYm9keT0+IHtcbiAgICAgIC8vICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XG4gICAgICAvLyAgICAgdGhyb3cgdGhpcy5TWVNURU1fQlVTU1k7XG4gICAgICAvLyAgIH1cbiAgICAgIC8vICAgcmV0dXJuIGJvZHk7XG4gICAgICAvLyB9KTtcbiAgfVxuXG4gIHByaXZhdGUgaW5pdE5vQ29tcGxldGUoKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcbiAgfVxuXG4gIHB1YmxpYyBteU9yZGVyTm9Db21wbGV0ZSgpIHtcbiAgICB0aGlzLm9ic2VydmFibGVMb2dpbkluaXQoKVxuICAgICAgLm1lcmdlTWFwKCgpPT4gdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXG4gICAgICAuc3Vic2NyaWJlKCh4KT0+e1xuICAgICAgICAvKlxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgIGRhdGE6IHsgb3JkZXJEQkxpc3Q6IFsgW09iamVjdF0gXSwgdG9fcGFnZTogJ2RiJyB9LFxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgKi9cbiAgICAgICAgIHRoaXMucHJpbnRNeU9yZGVyTm9Db21wbGV0ZSh4KTtcbiAgICAgIH0sIGVycj0+Y29uc29sZS5lcnJvcihlcnIpKTtcbiAgfVxuXG4gIHByaXZhdGUgcHJpbnRNeU9yZGVyTm9Db21wbGV0ZSh4KSB7XG4gICAgaWYoIXguZGF0YSkge1xuICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7eWVsbG93IOayoeacieacquWujOaIkOiuouWNlX1gKVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgIGxldCB0aWNrZXRzID0gW107XG4gICBpZih4LmRhdGEub3JkZXJDYWNoZURUTykge1xuICAgICBsZXQgb3JkZXJDYWNoZSA9IHguZGF0YS5vcmRlckNhY2hlRFRPO1xuICAgICBvcmRlckNhY2hlLnRpY2tldHMuZm9yRWFjaCh0aWNrZXQ9PiB7XG4gICAgICAgdGlja2V0cy5wdXNoKHtcbiAgICAgICAgIFwi5o6S6Zif5Y+3XCI6IG9yZGVyQ2FjaGUucXVldWVOYW1lLFxuICAgICAgICAgXCLnrYnlvoXml7bpl7RcIjogb3JkZXJDYWNoZS53YWl0VGltZSxcbiAgICAgICAgIFwi562J5b6F5Lq65pWwXCI6IG9yZGVyQ2FjaGUud2FpdENvdW50LFxuICAgICAgICAgXCLkvZnnpajmlbBcIjogb3JkZXJDYWNoZS50aWNrZXRDb3VudCxcbiAgICAgICAgIFwi5LmY6L2m5pel5pyfXCI6IG9yZGVyQ2FjaGUudHJhaW5EYXRlLnNsaWNlKDAsMTApLFxuICAgICAgICAgXCLovabmrKFcIjogb3JkZXJDYWNoZS5zdGF0aW9uVHJhaW5Db2RlLFxuICAgICAgICAgXCLlh7rlj5Hnq5lcIjogb3JkZXJDYWNoZS5mcm9tU3RhdGlvbk5hbWUsXG4gICAgICAgICBcIuWIsOi+vuermVwiOiBvcmRlckNhY2hlLnRvU3RhdGlvbk5hbWUsXG4gICAgICAgICBcIuW6p+S9jeetiee6p1wiOiB0aWNrZXQuc2VhdFR5cGVOYW1lLFxuICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3Nlbmdlck5hbWVcbiAgICAgICB9KTtcbiAgICAgfSk7XG5cbiAgIH1lbHNlIGlmKHguZGF0YS5vcmRlckRCTGlzdCl7XG5cbiAgICAgeC5kYXRhLm9yZGVyREJMaXN0LmZvckVhY2gob3JkZXI9PiB7XG4gICAgICAgLy8gY29uc29sZS5sb2coY2hhbGtg6K6i5Y2V5Y+3IHt5ZWxsb3cuYm9sZCAke29yZGVyLnNlcXVlbmNlX25vfX1gKVxuICAgICAgIG9yZGVyLnRpY2tldHMuZm9yRWFjaCh0aWNrZXQ9PiB7XG4gICAgICAgICB0aWNrZXRzLnB1c2goe1xuICAgICAgICAgICBcIuiuouWNleWPt1wiOiB0aWNrZXQuc2VxdWVuY2Vfbm8sXG4gICAgICAgICAgIC8vIFwi6K6i56Wo5Y+3XCI6IHRpY2tldC50aWNrZXRfbm8sXG4gICAgICAgICAgIFwi5LmY6L2m5pel5pyfXCI6IGNoYWxrYHt5ZWxsb3cuYm9sZCAke3RpY2tldC50cmFpbl9kYXRlLnNsaWNlKDAsMTApfX1gLFxuICAgICAgICAgICAvLyBcIuS4i+WNleaXtumXtFwiOiB0aWNrZXQucmVzZXJ2ZV90aW1lLFxuICAgICAgICAgICBcIuS7mOasvuaIquiHs+aXtumXtFwiOiBjaGFsa2B7cmVkLmJvbGQgJHt0aWNrZXQucGF5X2xpbWl0X3RpbWV9fWAsXG4gICAgICAgICAgIFwi6YeR6aKdXCI6IGNoYWxrYHt5ZWxsb3cuYm9sZCAke3RpY2tldC50aWNrZXRfcHJpY2UvMTAwfX1gLFxuICAgICAgICAgICBcIueKtuaAgVwiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudGlja2V0X3N0YXR1c19uYW1lfX1gLFxuICAgICAgICAgICBcIuS5mOi9puS6ulwiOiB0aWNrZXQucGFzc2VuZ2VyRFRPLnBhc3Nlbmdlcl9uYW1lLFxuICAgICAgICAgICBcIui9puasoVwiOiB0aWNrZXQuc3RhdGlvblRyYWluRFRPLnN0YXRpb25fdHJhaW5fY29kZSxcbiAgICAgICAgICAgXCLlh7rlj5Hnq5lcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy5mcm9tX3N0YXRpb25fbmFtZSxcbiAgICAgICAgICAgXCLliLDovr7nq5lcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy50b19zdGF0aW9uX25hbWUsXG4gICAgICAgICAgIFwi5bqn5L2NXCI6IHRpY2tldC5zZWF0X25hbWUsXG4gICAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0X3R5cGVfbmFtZSxcbiAgICAgICAgICAgXCLkuZjovabkurrnsbvlnotcIjogdGlja2V0LnRpY2tldF90eXBlX25hbWVcbiAgICAgICAgIH0pO1xuICAgICAgIH0pO1xuICAgICB9KTtcbiAgIH1cblxuICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkodGlja2V0cywge1xuICAgICBjb2x1bW5TcGxpdHRlcjogJ3wnXG4gICB9KTtcblxuICAgY29uc29sZS5sb2coY29sdW1ucyk7XG4gIH1cblxuICBwcml2YXRlIHF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvcXVlcnlNeU9yZGVyTm9Db21wbGV0ZVwiO1xuICAgIGxldCBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXG4gICAgICB9KVxuICAgICAgLGZvcm06IHtcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgfVxuICAgICAgLGpzb246IHRydWVcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZihib2R5LnN0YXR1cykge1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xuICAgICAgICAgIC8qKlxuICAgICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XG4gICAgICAgICAgICovXG4gICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgYm9keS5tZXNzYWdlcztcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gIDxkaXYgY2xhc3M9XCJ0LWJ0blwiPlxue3tpZiBwYXlfZmxhZz09J1knfX1cbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgaWQ9XCJjb250aW51ZVBheU5vTXlDb21wbGV0ZVwiIG9uY2xpY2s9XCJjb250aXVlUGF5Tm9Db21wbGV0ZU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywncGF5JylcIiAgY2xhc3M9XCJidG45MnNcIj7nu6fnu63mlK/ku5g8L2E+PC9kaXY+XG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIG9uY2xpY2s9XCJjYW5jZWxNeU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywnY2FuY2VsX29yZGVyJylcIiBpZD1cImNhbmNlbF9idXR0b25fcGF5XCIgY2xhc3M9XCJidG45MlwiPuWPlua2iOiuouWNlTwvYT48L2Rpdj5cbnt7L2lmfX1cbnt7aWYgcGF5X3Jlc2lnbl9mbGFnPT0nWSd9fVxuICAgICAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBpZD1cImNvbnRpbnVlUGF5Tm9NeUNvbXBsZXRlXCIgb25jbGljaz1cImNvbnRpdWVQYXlOb0NvbXBsZXRlT3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdyZXNpZ24nKTtcIiAgY2xhc3M9XCJidG45MnNcIj7nu6fnu63mlK/ku5g8L2E+PC9kaXY+XG5cdCAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBvbmNsaWNrPVwiY2FuY2VsTXlPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ2NhbmNlbF9yZXNpZ24nKVwiIGNsYXNzPVwiYnRuOTJcIj7lj5bmtojorqLljZU8L2E+PC9kaXY+XG57ey9pZn19XG5cbiAgICAgICAgPC9kaXY+XG4gICovXG4gIHByaXZhdGUgY2FuY2VsTm9Db21wbGV0ZU15T3JkZXIoc2VxdWVuY2VObzogc3RyaW5nLCBjYW5jZWxJZDogc3RyaW5nID0gJ2NhbmNlbF9vcmRlcicpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxOb0NvbXBsZXRlTXlPcmRlclwiO1xuICAgIGxldCBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXG4gICAgICB9KVxuICAgICAgLGZvcm06IHtcbiAgICAgICAgXCJzZXF1ZW5jZV9ub1wiOiBzZXF1ZW5jZU5vLFxuICBcdFx0XHRcImNhbmNlbF9mbGFnXCI6IGNhbmNlbElkLFxuICAgICAgICBcIl9qc29uX2F0dFwiOlwiXCJcbiAgICAgIH1cbiAgICAgICxqc29uOiB0cnVlXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gIH1cblxuICBwdWJsaWMgY2FuY2VsTm9Db21wbGV0ZU9yZGVyKHNlcXVlbmNlTm86IHN0cmluZywgY2FuY2VsSWQ6IHN0cmluZyA9ICdjYW5jZWxfb3JkZXInKSB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5jYW5jZWxOb0NvbXBsZXRlTXlPcmRlcihzZXF1ZW5jZU5vLCBjYW5jZWxJZCkpXG4gICAgICAuc3Vic2NyaWJlKChib2R5KT0+e1xuICAgICAgICAgIC8vIHtcInZhbGlkYXRlTWVzc2FnZXNTaG93SWRcIjpcIl92YWxpZGF0b3JNZXNzYWdlXCIsXCJzdGF0dXNcIjp0cnVlLFwiaHR0cHN0YXR1c1wiOjIwMCxcImRhdGFcIjp7fSxcIm1lc3NhZ2VzXCI6W10sXCJ2YWxpZGF0ZU1lc3NhZ2VzXCI6e319XG4gICAgICAgICAgaWYgKGJvZHkuZGF0YS5leGlzdEVycm9yID09IFwiWVwiKSB7XG4gICAgICAgICAgICB3aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQgJHtib2R5LmRhdGEuZXJyb3JNc2d9fWApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oY2hhbGtge3llbGxvdyDorqLljZUgJHtzZXF1ZW5jZU5vfSDlt7Llj5bmtoh9YCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAsZXJyPT53aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQgJHtKU09OLnN0cmluZ2lmeShlcnIpfX1gKVxuICAgICAgKTtcbiAgfVxufVxuIl19
