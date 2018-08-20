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
            winston.debug(JSON.stringify(body));
            if (body.data) {
                _this.printMyOrderNoComplete(body);
                if (body.data.orderCacheDTO) {
                    if (body.data.orderCacheDTO.status === 3) {
                        winston.warn(body.data.orderCacheDTO.message.message);
                    }
                    else {
                        throw '您还有排队订单';
                    }
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
                return Observable_1.Observable.timer(1000);
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
                    var m = parseInt(orderQueue.data.waitTime / 60);
                    var s = orderQueue.data.waitTime % 60;
                    console.log(chalk(templateObject_29 || (templateObject_29 = __makeTemplateObject(["\u6392\u961F\u4EBA\u6570\uFF1A{yellow.bold ", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", "", " \u79D2"], ["\u6392\u961F\u4EBA\u6570\uFF1A{yellow.bold ", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", "", " \u79D2"])), orderQueue.data.waitCount, m > 0 ? m + ' 分钟 ' : '', s));
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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OUgsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDaEMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLGlGQUFBLE9BQVEsRUFBa0IsR0FBRyxLQUFyQixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBSSxDQUFDO1lBQ3BELENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssb0hBQUEsdUJBQWMsRUFBVSxzQkFBTyxLQUFqQixVQUFVLEVBQVEsQ0FBQztZQUNyRCxDQUFDO1FBQ0gsQ0FBQyxFQUNGLFVBQUEsR0FBRyxJQUFFLE9BQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLGlGQUFBLE9BQVEsRUFBbUIsR0FBRyxLQUF0QixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFJLEVBQWxELENBQWtELENBQ3ZELENBQUM7SUFDTixDQUFDO0lBQ0gsY0FBQztBQUFELENBdmxEQSxBQXVsREMsSUFBQTtBQXZsRFksMEJBQU8iLCJmaWxlIjoic3JjL0FjY291bnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgLy8gaHR0cHM6Ly93d3cubGFuaW5kZXguY29tLzEyMzA2JUU4JUI0JUFEJUU3JUE1JUE4JUU2JUI1JTgxJUU3JUE4JThCJUU1JTg1JUE4JUU4JUE3JUEzJUU2JTlFJTkwL1xyXG5cclxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XHJcbmltcG9ydCB7RmlsZUNvb2tpZVN0b3JlfSBmcm9tICcuL0ZpbGVDb29raWVTdG9yZSc7XHJcbmltcG9ydCB7U3RhdGlvbn0gZnJvbSAnLi9TdGF0aW9uJztcclxuaW1wb3J0IHJlcXVlc3QgPSByZXF1aXJlKCdyZXF1ZXN0Jyk7XHJcbmltcG9ydCBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XHJcbmltcG9ydCBmcyA9IHJlcXVpcmUoJ2ZzJyk7XHJcbmltcG9ydCByZWFkbGluZSA9IHJlcXVpcmUoJ3JlYWRsaW5lJyk7XHJcbmltcG9ydCBwcm9jZXNzID0gcmVxdWlyZSgncHJvY2VzcycpO1xyXG5pbXBvcnQgUnggZnJvbSAncnhqcy9SeCc7XHJcbmltcG9ydCB7IE9ic2VydmFibGUsIE9ic2VydmFibGVJbnB1dCB9IGZyb20gJ3J4anMvT2JzZXJ2YWJsZSc7XHJcbmltcG9ydCB7IE9ic2VydmVyIH0gZnJvbSAncnhqcy9PYnNlcnZlcic7XHJcbmltcG9ydCAncnhqcy9hZGQvb2JzZXJ2YWJsZS9iaW5kQ2FsbGJhY2snO1xyXG5pbXBvcnQgY2hhbGsgPSByZXF1aXJlKCdjaGFsaycpO1xyXG5pbXBvcnQgY29sdW1uaWZ5ID0gcmVxdWlyZSgnY29sdW1uaWZ5Jyk7XHJcbmltcG9ydCBiZWVwZXIgPSByZXF1aXJlKCdiZWVwZXInKTtcclxuaW1wb3J0IGNoaWxkX3Byb2Nlc3MgPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7XHJcblxyXG5pbXBvcnQge09yZGVyU3VibWl0UmVxdWVzdCwgSU9yZGVyLCBPcmRlcn0gZnJvbSAnLi9PcmRlcic7XHJcbmltcG9ydCB7IE1hbmFnZXIgfSBmcm9tICcuL01hbmFnZXInO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBPcHRpb25zIHtcclxuICBwZXJmb3JtYW5jZT86IGFueTtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEFjY291bnQge1xyXG4gIHByaXZhdGUgbWFuYWdlcjogTWFuYWdlcjtcclxuICBwdWJsaWMgdXNlck5hbWUgOiBzdHJpbmc7XHJcbiAgcHJpdmF0ZSB1c2VyUGFzc3dvcmQgOiBzdHJpbmc7XHJcbiAgcHVibGljIG9wdGlvbnM6IE9wdGlvbnM7XHJcbiAgcHJpdmF0ZSBjaGVja1VzZXJUaW1lciA9IFJ4Lk9ic2VydmFibGUudGltZXIoMTAwMCo2MCoxMCwgMTAwMCo2MCoxMCk7IC8vIOWNgeWIhumSn+S5i+WQjuW8gOWni++8jOavj+WNgeWIhumSn+ajgOafpeS4gOasoVxyXG4gIHByaXZhdGUgc2NwdENoZWNrVXNlclRpbWVyPzogUnguU3Vic2NyaXB0aW9uO1xyXG5cclxuICBwcml2YXRlIHN0YXRpb25zOiBTdGF0aW9uID0gbmV3IFN0YXRpb24oKTtcclxuICBwcml2YXRlIHBhc3NlbmdlcnM/OiBvYmplY3Q7XHJcblxyXG4gIHByaXZhdGUgU1lTVEVNX0JVU1NZID0gXCJTeXN0ZW0gaXMgYnVzc3lcIjtcclxuICBwcml2YXRlIFNZU1RFTV9NT1ZFRCA9IFwiTW92ZWQgVGVtcG9yYXJpbHlcIjtcclxuXHJcbiAgcHJpdmF0ZSByYXdSZXF1ZXN0OiAob3B0aW9uczphbnl8dW5kZWZpbmVkfG51bGwsIGNiOmFueSk9PmFueTtcclxuICBwcml2YXRlIHJlcXVlc3Q6IChvcHRpb25zPzphbnl8dW5kZWZpbmVkfG51bGwpPT5PYnNlcnZhYmxlPGFueT47XHJcbiAgcHJpdmF0ZSBjb29raWVqYXI6IGFueTtcclxuICBwdWJsaWMgaGVhZGVyczogb2JqZWN0ID0ge1xyXG4gICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIlxyXG4gICAgLFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDYuMTsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4xNyAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8yNC4wLjEzMTIuNjAgU2FmYXJpLzUzNy4xN1wiXHJcbiAgICAsXCJIb3N0XCI6IFwia3lmdy4xMjMwNi5jblwiXHJcbiAgICAsXCJPcmlnaW5cIjogXCJodHRwczovL2t5ZncuMTIzMDYuY25cIlxyXG4gICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxyXG4gIH07XHJcblxyXG4gIHByaXZhdGUgVElDS0VUX1RJVExFID0gWycnLCAnJywgJycsICfovabmrKEnLCAn6LW35aeLJywgJ+e7iOeCuScsICflh7rlj5Hnq5knLCAn5Yiw6L6+56uZJywgJ+WHuuWPkeaXticsICfliLDovr7ml7YnLCAn5Y6G5pe2JywgJycsICcnLFxyXG4gICAgICAgICAgICAgICAn5pel5pyfJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICfpq5jnuqfova/ljacnLCAnJywgJ+i9r+WNpycsICfova/luqcnLCAn54m5562J5bqnJywgJ+aXoOW6pycsXHJcbiAgICAgICAgICAgICAgICcnLCAn56Gs5Y2nJywgJ+ehrOW6pycsICfkuoznrYnluqcnLCAn5LiA562J5bqnJywgJ+WVhuWKoeW6pyddO1xyXG5cclxuICBwcml2YXRlIHF1ZXJ5ID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgb3JkZXJzOiBBcnJheTxPcmRlcj4gPSBbXTtcclxuXHJcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB1c2VyUGFzc3dvcmQ6IHN0cmluZywgbWFuYWdlcjogTWFuYWdlciwgb3B0aW9ucz86IE9wdGlvbnMpIHtcclxuICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XHJcbiAgICB0aGlzLnVzZXJOYW1lID0gbmFtZTtcclxuICAgIHRoaXMudXNlclBhc3N3b3JkID0gdXNlclBhc3N3b3JkO1xyXG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCAvLyBkZWZhdWx0IG9wdGlvbnNcclxuICAgICAge1xyXG4gICAgICAgIHBlcmZvcm1hbmNlOiB7XHJcbiAgICAgICAgICBxdWVyeV9pbnRlcnZhbDogMTAwMFxyXG4gICAgICAgIH1cclxuICAgICAgfTtcclxuXHJcbiAgICB0aGlzLnNldFJlcXVlc3QoKTtcclxuICAgIHRoaXMucmF3UmVxdWVzdCA9IHJlcXVlc3QuZGVmYXVsdHMoe2phcjogdGhpcy5jb29raWVqYXJ9KTtcclxuICAgIHRoaXMucmVxdWVzdCA9IE9ic2VydmFibGUuYmluZENhbGxiYWNrPEFycmF5PGFueT4+KHRoaXMucmF3UmVxdWVzdCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSAhPT0gMjAwKSB0aHJvdyBbJ2h0dHAgZXJyb3InLCByZXNwb25zZS5zdGF0dXNDb2RlLCByZXNwb25zZS5zdGF0dXNNZXNzYWdlXS5qb2luKCcgJyk7XHJcbiAgICAgIHJldHVybiBib2R5O1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDmo4Dmn6XnvZHnu5zlvILluLhcclxuICAgKi9cclxuICBwcml2YXRlIGlzU3lzdGVtQnVzc3koYm9keTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYm9keS5pbmRleE9mKFwi572R57uc5Y+v6IO95a2Y5Zyo6Zeu6aKY77yM6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzZXRSZXF1ZXN0KCkge1xyXG4gICAgbGV0IGNvb2tpZUZpbGVOYW1lOiBzdHJpbmcgPSBcIi4vY29va2llcy9cIit0aGlzLnVzZXJOYW1lK1wiLmpzb25cIjtcclxuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKGNvb2tpZUZpbGVOYW1lLCB7ZW5jcnlwdDogZmFsc2V9KTtcclxuICAgIGZpbGVTdG9yZS5vcHRpb24gPSB7ZW5jcnlwdDogZmFsc2V9O1xyXG4gICAgdGhpcy5jb29raWVqYXIgPSByZXF1ZXN0LmphcihmaWxlU3RvcmUpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBuZXh0T3JkZXJOdW06IG51bWJlciA9IDA7XHJcbiAgcHJpdmF0ZSBuZXh0T3JkZXIoKSB7XHJcbiAgICB0aGlzLm5leHRPcmRlck51bSA9ICh0aGlzLm5leHRPcmRlck51bSArIDEpJXRoaXMub3JkZXJzLmxlbmd0aDtcclxuICAgIHJldHVybiB0aGlzLm9yZGVyc1t0aGlzLm5leHRPcmRlck51bV07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGN1cnJlbnRPcmRlcigpIHtcclxuICAgIHJldHVybiB0aGlzLm9yZGVyc1t0aGlzLm5leHRPcmRlck51bV07XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY3JlYXRlT3JkZXIodHJhaW5EYXRlczogQXJyYXk8c3RyaW5nPiwgYmFja1RyYWluRGF0ZTogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICBbZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLFxyXG4gICAgICAgICAgICAgICAgICAgICBwbGFuVHJhaW5zOiBBcnJheTxzdHJpbmc+LCBwbGFuUGVwb2xlczogQXJyYXk8c3RyaW5nPiwgc2VhdENsYXNzZXM6IEFycmF5PHN0cmluZz4pOiB0aGlzIHtcclxuICAgIHRyYWluRGF0ZXMuZm9yRWFjaCh0cmFpbkRhdGU9PiB7XHJcbiAgICAgIGlmKCFuZXcgRGF0ZSh0cmFpbkRhdGUpLnRvSlNPTigpKSB7XHJcbiAgICAgICAgdGhyb3cgY2hhbGtge3JlZCDkuZjovabml6XmnJ8ke3RyYWluRGF0ZX3moLzlvI/kuI3mraPnoa7vvIzmoLzlvI/lupTor6XmmK95eXl5LU1NLWRkfWA7XHJcbiAgICAgIH1cclxuICAgICAgaWYobmV3IERhdGUodHJhaW5EYXRlKS50b0pTT04oKS5zbGljZSgwLDEwKSA8IG5ldyBEYXRlKCkudG9KU09OKCkuc2xpY2UoMCwxMCkpIHtcclxuICAgICAgICB0aHJvdyBjaGFsa2B7cmVkIOS5mOi9puaXpeacn+W6lOivpeS4uuS7iuWkqeaIluS7peWQjn1gO1xyXG4gICAgICB9XHJcblxyXG4gICAgICB0aGlzLm9yZGVycy5wdXNoKFxyXG4gICAgICAgIG5ldyBPcmRlcih0cmFpbkRhdGUsIGJhY2tUcmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGFzc1N0YXRpb25OYW1lLCBwbGFuVHJhaW5zLCBwbGFuUGVwb2xlcywgc2VhdENsYXNzZXMpXHJcbiAgICAgICk7XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdWJtaXQoKTogdm9pZCB7XHJcbiAgICAvLyB0aGlzLm9ic2VydmFibGVMb2dpbkluaXQoKVxyXG4gICAgT2JzZXJ2YWJsZS5vZigxKVxyXG4gICAgICAvLyDmo4Dmn6XmnKrlrozmiJDorqLljZVcclxuICAgICAgLm1lcmdlTWFwKCgpPT4gdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXHJcbiAgICAgIC5kbyhib2R5PT4ge1xyXG4gICAgICAgIHdpbnN0b24uZGVidWcoSlNPTi5zdHJpbmdpZnkoYm9keSkpO1xyXG4gICAgICAgIGlmKGJvZHkuZGF0YSkge1xyXG4gICAgICAgICAgdGhpcy5wcmludE15T3JkZXJOb0NvbXBsZXRlKGJvZHkpO1xyXG4gICAgICAgICAgaWYoYm9keS5kYXRhLm9yZGVyQ2FjaGVEVE8pIHtcclxuICAgICAgICAgICAgICBpZihib2R5LmRhdGEub3JkZXJDYWNoZURUTy5zdGF0dXMgPT09IDMpIHtcclxuICAgICAgICAgICAgICAgIHdpbnN0b24ud2Fybihib2R5LmRhdGEub3JkZXJDYWNoZURUTy5tZXNzYWdlLm1lc3NhZ2UpO1xyXG4gICAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICAgIHRocm93ICfmgqjov5jmnInmjpLpmJ/orqLljZUnO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1lbHNlIGlmKGJvZHkuZGF0YS5vcmRlckRCTGlzdCl7XHJcbiAgICAgICAgICAgIHRocm93ICfmgqjov5jmnInmnKrlrozmiJDorqLljZUnO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLy8g5YeG5aSH5aW95ZCO6L+b6KGM6K6i56Wo5rWB56iLXHJcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcclxuICAgICAgICB0aGlzLmJ1aWxkT3JkZXJGbG93KCk7XHJcblxyXG4gICAgICAgIHRoaXMuc2NwdENoZWNrVXNlclRpbWVyID1cclxuICAgICAgICAgIHRoaXMuY2hlY2tVc2VyVGltZXIuc3Vic2NyaWJlKChpKT0+IHtcclxuICAgICAgICAgICAgdGhpcy5vYnNlcnZhYmxlQ2hlY2tVc2VyKClcclxuICAgICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT53aW5zdG9uLmRlYnVnKFwiQ2hlY2sgdXNlciBkb25lXCIpKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9LGVycj0+IHtcclxuICAgICAgICBiZWVwZXIoNjAqMzAqMik7XHJcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgb3JkZXJXYWl0VGltZSgpIHtcclxuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXHJcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcclxuICAgICAgICB0aGlzLm9ic1F1ZXJ5T3JkZXJXYWl0VChuZXcgT3JkZXIoKSlcclxuICAgICAgICAgIC5tZXJnZU1hcCgob3JkZXJJZCk9PnRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpKVxyXG4gICAgICAgICAgLmRvKChib2R5KT0+IHtcclxuICAgICAgICAgICAgaWYoYm9keS5kYXRhKSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5wcmludE15T3JkZXJOb0NvbXBsZXRlKGJvZHkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg57uT5p2ffWApO1xyXG4gICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICxlcnI9PmNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6ZSZ6K+v57uT5p2fICR7ZXJyfX1gKVxyXG4gICAgICAgICAgICAsKCk9PntcclxuICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgKTtcclxuICAgICAgfVxyXG4gICAgICAsZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YClcclxuICAgICAgLCgpPT57XHJcbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNhbmNlbE9yZGVyUXVldWUoKSB7XHJcbiAgICB0aGlzLmNhbmNlbFF1ZXVlTm9Db21wbGV0ZU9yZGVyKClcclxuICAgICAgLnN1YnNjcmliZSh4PT4ge1xyXG4gICAgICAgIGlmKHguc3RhdHVzICYmIHguZGF0YS5leGlzdEVycm9yID09ICdOJykge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg5o6S6Zif6K6i5Y2V5bey5Y+W5raIfWApO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoeCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBkZXN0cm95KCkge1xyXG4gICAgLy8gdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXImJnRoaXMuc2NwdENoZWNrVXNlclRpbWVyLnVuc3Vic2NyaWJlKCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG9ic2VydmFibGVDaGVja0NhcHRjaGEoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxyXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuZ2V0Q2FwdGNoYSgpKVxyXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuY2hlY2tDYXB0Y2hhKClcclxuICAgICAgICAgICAgICAgICAgICAgICAgLmRvKCgpPT5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDmoKHpqoznoIHmiJDlip/lkI7ov5vooYzmjojmnYPorqTor4FcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDpqozor4HnoIHmoKHpqozmiJDlip99YClcclxuICAgICAgICAgICAgICAgICAgICAgICAgKVxyXG4gICAgICApXHJcbiAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cclxuICAgICAgICBlcnJvciQuZG8oKCk9PmNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDmoKHpqozlpLHotKXvvIzph43mlrDmoKHpqox9YCkpXHJcbiAgICAgIClcclxuICAgICAgO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvYnNlcnZhYmxlTG9naW4oKTogT2JzZXJ2YWJsZTx2b2lkPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxyXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMub2JzZXJ2YWJsZUNoZWNrQ2FwdGNoYSgpKVxyXG4gICAgICAubWVyZ2VNYXAoKCk9PlxyXG4gICAgICAgIHRoaXMudXNlckF1dGhlbnRpY2F0ZSgpXHJcbiAgICAgICAgICAuZG8oKCk9PmNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOeZu+W9leaIkOWKn31gKSlcclxuICAgICAgKVxyXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XHJcbiAgICAgICAgZXJyb3IkLm1lcmdlTWFwKGVycj0+IHtcclxuICAgICAgICAgIC8qXHJcbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi5a+G56CB6L6T5YWl6ZSZ6K+v44CC5aaC5p6c6L6T6ZSZ5qyh5pWw6LaF6L+HNOasoe+8jOeUqOaIt+Wwhuiiq+mUgeWumuOAglwiLFwicmVzdWx0X2NvZGVcIjoxfVxyXG4gICAgICAgICAge1wicmVzdWx0X21lc3NhZ2VcIjpcIumqjOivgeeggeagoemqjOWksei0pVwiLFwicmVzdWx0X2NvZGVcIjpcIjVcIn1cclxuICAgICAgICAgICovXHJcbiAgICAgICAgICBpZih0eXBlb2YgZXJyLnJlc3VsdF9jb2RlID09IFwidW5kZWZpbmVkXCIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoMTAwMCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgIClcclxuICAgICAgLmNhdGNoKGVycj0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQgJHtlcnIucmVzdWx0X21lc3NhZ2V9fWApO1xyXG4gICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvYnNlcnZhYmxlTmV3QXBwVG9rZW4oKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXHJcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5nZXROZXdBcHBUb2tlbigpKVxyXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XHJcbiAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5lcnJvcihlcnIpKVxyXG4gICAgICAgICAgLm1lcmdlTWFwKGVycj0+IHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUxvZ2luKCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvYnNlcnZhYmxlQXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XHJcbiAgICBsZXQgbmV3QXBwVG9rZW4gPSBuZXdhcHB0aztcclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPHN0cmluZz4pPT4ge1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQobmV3QXBwVG9rZW4pO1xyXG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5tZXJnZU1hcCgobmV3YXBwdGs6IHN0cmluZyk9PnRoaXMuZ2V0QXBwVG9rZW4obmV3YXBwdGspKVxyXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XHJcbiAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5lcnJvcihlcnIpKVxyXG4gICAgICAgICAgLm1lcmdlTWFwKGVycj0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOiOt+WPllRva2Vu5aSx6LSlfWApO1xyXG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKGVycik7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpLmRvKChuZXdhcHB0ayk9Pm5ld0FwcFRva2VuID0gbmV3YXBwdGspO1xyXG4gICAgICAgICAgICAvLyBpZihlcnIucmVzdWx0X2NvZGUgJiYgZXJyLnJlc3VsdF9jb2RlID09PSAyKSB7XHJcbiAgICAgICAgICAgIC8vXHJcbiAgICAgICAgICAgIC8vIH1lbHNlIHtcclxuICAgICAgICAgICAgLy8gICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xyXG4gICAgICAgICAgICAvLyB9XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG9ic2VydmFibGVMb2dpbkluaXQoKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcclxuICAgIC8vIOeZu+W9leWIneWni+WMllxyXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcclxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT50aGlzLmxvZ2luSW5pdCgpKVxyXG4gICAgICAucmV0cnkoMTAwMClcclxuICAgICAgLm1hcChvcmRlciA9PiB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24odGhpcy5jb29raWVqYXIuX2phci50b0pTT04oKS5jb29raWVzKSlcclxuICAgICAgLm1lcmdlTWFwKHRva2Vucz0+IHtcclxuICAgICAgICBpZih0b2tlbnMudGspIHtcclxuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVBcHBUb2tlbih0b2tlbnMudGspO1xyXG4gICAgICAgIH1lbHNlIGlmKHRva2Vucy51YW10aykge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZU5ld0FwcFRva2VuKClcclxuICAgICAgICAgICAgLm1lcmdlTWFwKG5ld2FwcHRrPT50aGlzLm9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0aykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTG9naW4oKVxyXG4gICAgICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpKVxyXG4gICAgICAgICAgLm1lcmdlTWFwKG5ld2FwcHRrPT50aGlzLm9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0aykpO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOaVsOe7hOWkmuWFs+mUruWtl+auteaOkuW6j+eul+azle+8jOWtl+autem7mOiupOS4uumAkuWHj+aOkuW6j++8jOWmguaenOWtl+auteWJjemdouW4puaciSvnrKblj7fliJnkuLrpgJLlop7mjpLluo9cclxuICAgKi9cclxuICBwcml2YXRlIGZpZWxkU29ydGVyKGZpZWxkczogQXJyYXk8c3RyaW5nPikge1xyXG4gICAgcmV0dXJuIChhOmFueSwgYjphbnkpID0+IGZpZWxkcy5tYXAoKG86c3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICAgICAgbGV0IGRpciA9IC0xO1xyXG4gICAgICAgICAgICAgIGlmIChvWzBdID09PSAnKycpIHtcclxuICAgICAgICAgICAgICAgIGRpciA9IDE7XHJcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XHJcbiAgICAgICAgICAgICAgfWVsc2UgaWYob1swXSA9PT0gJy0nKSB7XHJcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIHJldHVybiBhW29dID4gYltvXSA/IGRpciA6IGFbb10gPCBiW29dID8gLShkaXIpIDogMDtcclxuICAgICAgICAgIH0pLnJlZHVjZSgocCwgbikgPT4gcCA/IHAgOiBuLCAwKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlPElPcmRlcj4ge1xyXG5cclxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKG9yZGVyKVxyXG4gICAgICAvLyDojrflj5bkvZnnpajkv6Hmga9cclxuICAgICAgLm1lcmdlTWFwKChvcmRlcjogSU9yZGVyKTogT2JzZXJ2YWJsZUlucHV0PElPcmRlcj4gPT5cclxuICAgICAgICB0aGlzLnF1ZXJ5TGVmdFRpY2tldHMob3JkZXIudHJhaW5EYXRlLCBvcmRlci5mcm9tU3RhdGlvbiwgb3JkZXIudG9TdGF0aW9uLCBvcmRlci5wbGFuVHJhaW5zKVxyXG4gICAgICAgICAgLm1hcCgodHJhaW5zKT0+IHtcclxuICAgICAgICAgICAgb3JkZXIudHJhaW5zID0gdHJhaW5zO1xyXG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApXHJcbiAgICAgIC8vIOiOt+WPlumAlOe7j+ermei9puasoeS/oeaBr1xyXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlSW5wdXQ8SU9yZGVyPiA9PiB7XHJcbiAgICAgICAgaWYob3JkZXIucGFzc1N0YXRpb24pIHtcclxuICAgICAgICAgIGlmKCFvcmRlci5mcm9tVG9QYXNzVHJhaW5zKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnF1ZXJ5TGVmdFRpY2tldHMob3JkZXIudHJhaW5EYXRlLCBvcmRlci5mcm9tU3RhdGlvbiwgb3JkZXIucGFzc1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXHJcbiAgICAgICAgICAgICAgLm1hcChwYXNzVHJhaW5zPT4ge1xyXG4gICAgICAgICAgICAgICAgb3JkZXIuZnJvbVRvUGFzc1RyYWlucyA9IHBhc3NUcmFpbnMubWFwKHRyYWluPT4gdHJhaW5bM10pO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XHJcbiAgICAgIH0pXHJcbiAgICAgIC8vIOaMiemAlOe7j+ermei9puasoei/h+a7pFxyXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcclxuICAgICAgICBpZihvcmRlci5mcm9tVG9QYXNzVHJhaW5zKSB7XHJcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSBvcmRlci50cmFpbnMuZmlsdGVyKHRyYWluID0+IG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMuaW5jbHVkZXModHJhaW5bM10pKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG9yZGVyO1xyXG4gICAgICB9KVxyXG4gICAgICAvLyDmjInml7bpl7TojIPlm7Tov4fmu6RcclxuICAgICAgLm1hcCgob3JkZXI6IElPcmRlcik6IElPcmRlciA9PiB7XHJcbiAgICAgICAgaWYob3JkZXIucGxhblRpbWVzKSB7XHJcbiAgICAgICAgICBsZXQgdHJhaW5zID0gb3JkZXIudHJhaW5zfHxbXTtcclxuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IHRyYWlucy5maWx0ZXIodHJhaW49PiB7XHJcbiAgICAgICAgICAgIHJldHVybiAob3JkZXIucGxhblRpbWVzWzBdP29yZGVyLnBsYW5UaW1lc1swXTw9dHJhaW5bOF06dHJ1ZSkmJihvcmRlci5wbGFuVGltZXNbMV0/b3JkZXIucGxhblRpbWVzWzFdPj10cmFpbls4XTp0cnVlKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIG9yZGVyO1xyXG4gICAgICB9KVxyXG4gICAgICAvLyDmoLnmja7lrZfmrrXmjpLluo9cclxuICAgICAgLm1hcCgob3JkZXI6IElPcmRlcik6IElPcmRlciA9PiB7XHJcbiAgICAgICAgaWYob3JkZXIucGxhbk9yZGVyQnkpIHtcclxuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IG9yZGVyLnRyYWlucy5zb3J0KHRoaXMuZmllbGRTb3J0ZXIob3JkZXIucGxhbk9yZGVyQnkpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIG9yZGVyO1xyXG4gICAgICB9KVxyXG4gICAgICAvLyDorqHnrpflj6/otK3kubDovabmrKHkv6Hmga9cclxuICAgICAgLm1hcCgob3JkZXI6IElPcmRlcik6IElPcmRlciA9PiB7XHJcbiAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XHJcblxyXG4gICAgICAgIGxldCBwbGFuVHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+PiA9IFtdLCB0aGF0ID0gdGhpcztcclxuICAgICAgICB0cmFpbnMuc29tZSh0cmFpbiA9PiB7XHJcbiAgICAgICAgICByZXR1cm4gb3JkZXIuc2VhdENsYXNzZXMuc29tZShzZWF0ID0+IHtcclxuICAgICAgICAgICAgdmFyIHNlYXROdW0gPSB0aGlzLlRJQ0tFVF9USVRMRS5pbmRleE9mKHNlYXQpO1xyXG4gICAgICAgICAgICBpZih0cmFpbltzZWF0TnVtXSA9PSBcIuaciVwiIHx8IHRyYWluW3NlYXROdW1dID4gMCkge1xyXG4gICAgICAgICAgICAgIHdpbnN0b24uZGVidWcob3JkZXIudHJhaW5EYXRlK1wiL1wiK3RyYWluWzNdK1wiL1wiK3NlYXQrXCIvXCIrdHJhaW5bc2VhdE51bV0pO1xyXG4gICAgICAgICAgICAgIGlmKG9yZGVyLnBsYW5UcmFpbnMuaW5jbHVkZXModHJhaW5bM10pKSB7XHJcbiAgICAgICAgICAgICAgICBpZih0cmFpbltzZWF0TnVtXSA9PSBcIuaciVwiIHx8IHRyYWluW3NlYXROdW1dID4gb3JkZXIucGxhblBlcG9sZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgIHBsYW5UcmFpbnMucHVzaCh0cmFpbik7XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgb3JkZXIuYXZhaWxhYmxlVHJhaW5zID0gcGxhblRyYWlucztcclxuICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSByZWN1cnNpdmVRdWVyeUxlZnRUaWNrZXQoKTogT2JzZXJ2YWJsZTxPcmRlcj4ge1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8T3JkZXI+KT0+IHtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KHRoaXMubmV4dE9yZGVyKCkpO1xyXG4gICAgICB9KVxyXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBPcmRlcik9PnRoaXMuYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyKSlcclxuICAgICAgLmRvKCgpPT4ge1xyXG4gICAgICAgIGlmKHRoaXMucXVlcnkpIHtcclxuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xyXG4gICAgICAgICAgcHJvY2Vzcy5zdGRvdXQuY3Vyc29yVG8oMCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KVxyXG4gICAgICAubWFwKG9yZGVyPT4ge1xyXG4gICAgICAgIGlmKG9yZGVyLmF2YWlsYWJsZVRyYWlucy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gZmFsc2U7XHJcbiAgICAgICAgICAvLyBwcm9jZXNzLnN0ZG91dC53cml0ZShjaGFsa2B7eWVsbG93IOacieWPr+i0reS5sOS9meelqCAke3BsYW5UcmFpbi50b1N0cmluZygpfX1gKTtcclxuICAgICAgICAgIG9yZGVyLnRyYWluU2VjcmV0U3RyID0gb3JkZXIuYXZhaWxhYmxlVHJhaW5zWzBdWzBdO1xyXG4gICAgICAgICAgb3JkZXIudHJhaW4gPSBvcmRlci5hdmFpbGFibGVUcmFpbnNbMF07XHJcbiAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRydWU7XHJcbiAgICAgICAgICB0aHJvdyBjaGFsa2DmsqHmnInlj6/otK3kubDkvZnnpagge3llbGxvdyAke29yZGVyLmZyb21TdGF0aW9uTmFtZX19IOWIsCB7eWVsbG93ICR7b3JkZXIudG9TdGF0aW9uTmFtZX19ICR7b3JkZXIucGFzc1N0YXRpb25OYW1lPyfliLAnK29yZGVyLnBhc3NTdGF0aW9uTmFtZSsnICc6Jyd9e3llbGxvdyAke29yZGVyLnRyYWluRGF0ZX19YDtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cclxuICAgICAgICBlcnJvciQuZG8oZXJyPT5wcm9jZXNzLnN0ZG91dC53cml0ZShlcnIpKVxyXG4gICAgICAgICAgLmRlbGF5KHRoaXMub3B0aW9ucy5wZXJmb3JtYW5jZS5xdWVyeV9pbnRlcnZhbCB8fCAxMDAwKVxyXG4gICAgICApXHJcbiAgICAgIC8vIOajgOafpeeUqOaIt+eZu+W9leeKtuaAgVxyXG4gICAgICAvLyAubWVyZ2VNYXAoKG9yZGVyOiBPcmRlcik9PnRoaXMub2JzZXJ2YWJsZUNoZWNrVXNlcigpLm1hcCgoKT0+b3JkZXIpKVxyXG5cclxuICAgICAgLy8gU3RlcCAxMSDpooTmj5DkuqTorqLljZXvvIxQb3N0XHJcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PntcclxuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2DpooTmj5DkuqTorqLljZUge3llbGxvdyAke29yZGVyLnRyYWluWzNdfX0ge3llbGxvdyAke29yZGVyLmZyb21TdGF0aW9uTmFtZX19IOWIsCB7eWVsbG93ICR7b3JkZXIudG9TdGF0aW9uTmFtZX19IOaXpeacnyB7eWVsbG93ICR7b3JkZXIudHJhaW5EYXRlfX1gKTtcclxuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxyXG4gICAgICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLnN1Ym1pdE9yZGVyUmVxdWVzdChvcmRlcikpXHJcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XHJcbiAgICAgICAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5kZWJ1ZyhcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycikpXHJcbiAgICAgICAgICAgICAgICAuZGVsYXkoMTAwKVxyXG4gICAgICAgICAgKVxyXG4gICAgICAgICAgLm1hcChib2R5PT5bb3JkZXIsIGJvZHldKTtcclxuICAgICAgfSlcclxuICAgICAgLm1hcCgoW29yZGVyLCBib2R5XSk9PntcclxuICAgICAgICBpZihib2R5LnN0YXR1cykge1xyXG4gICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhjaGFsa2B7Ymx1ZSBTdWJtaXQgT3JkZXIgUmVxdWVzdCBzdWNjZXNzIX1gKTtcclxuICAgICAgICAgIHJldHVybiBvcmRlcjtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAvLyDmgqjov5jmnInmnKrlpITnkIbnmoTorqLljZVcclxuICAgICAgICAgIC8vIOivpei9puasoeaaguS4jeWKnueQhuS4muWKoVxyXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5Lm1lc3NhZ2VzWzBdfX1gKTtcclxuICAgICAgICAgIC8vIHRoaXMuZGVzdHJveSgpO1xyXG4gICAgICAgICAgdGhyb3cgY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YDtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC8vIFN0ZXAgMTIg5qih5ouf6Lez6L2s6aG16Z2iSW5pdERj77yMUG9zdFxyXG4gICAgICAubWVyZ2VNYXAob3JkZXI9PlxyXG4gICAgICAgIHRoaXMuY29uZmlybVBhc3NlbmdlckluaXREYygpXHJcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XHJcbiAgICAgICAgICAgIGVycm9yJC5tZXJnZU1hcCgoZXJyKT0+IHtcclxuICAgICAgICAgICAgICAgIGlmKGVyciA9PSB0aGlzLlNZU1RFTV9CVVNTWSkge1xyXG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xyXG4gICAgICAgICAgICAgICAgfWVsc2UgaWYoZXJyID09IHRoaXMuU1lTVEVNX01PVkVEKSB7XHJcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDUwMCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xyXG5cclxuICAgICAgICAgICAgICB9KVxyXG4gICAgICAgICAgKVxyXG4gICAgICAgICAgLmRvKG9yZGVyU3VibWl0UmVxdWVzdD0+IHtcclxuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhcImNvbmZpcm1QYXNzZW5nZXIgSW5pdCBEYyBzdWNjZXNzISBcIitvcmRlclN1Ym1pdFJlcXVlc3QudG9rZW4pO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93ICR7b3JkZXJTdWJtaXRSZXF1ZXN0LnRpY2tldEluZm8ubGVmdERldGFpbHMuam9pbihcIlxcdFwiKX19YCk7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLm1hcChvcmRlclN1Ym1pdFJlcXVlc3Q9PntcclxuICAgICAgICAgICAgb3JkZXIucmVxdWVzdCA9IG9yZGVyU3VibWl0UmVxdWVzdDtcclxuXHJcbiAgICAgICAgICAgIGxldCBoYXNTZWF0ID0gb3JkZXIuc2VhdENsYXNzZXMuc29tZSgoc2VhdFR5cGU6IHN0cmluZyk9PiB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyU3VibWl0UmVxdWVzdC50aWNrZXRJbmZvLmxpbWl0QnV5U2VhdFRpY2tldERUTy50aWNrZXRfc2VhdF9jb2RlTWFwW1wiMVwiXS5zb21lKCh0aWNrZXRTZWF0Q29kZSk9PiB7XHJcbiAgICAgICAgICAgICAgICBpZih0aWNrZXRTZWF0Q29kZS52YWx1ZSA9PSBzZWF0VHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICBvcmRlci5zZWF0VHlwZSA9IHRpY2tldFNlYXRDb2RlLmlkO1xyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBpZighaGFzU2VhdCkge1xyXG4gICAgICAgICAgICAgIHdpbnN0b24uZGVidWcoXCJjb25maXJtUGFzc2VuZ2VyIEluaXQg5rKh5pyJ5Y+v6LSt5Lmw5L2Z56Wo77yM6YeN5paw5p+l6K+iXCIpO1xyXG4gICAgICAgICAgICAgIHRocm93ICdyZXRyeSc7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcclxuICAgICAgICAgIH0pXHJcbiAgICAgIClcclxuICAgICAgLy8gU3RlcCAxMyDluLjnlKjogZTns7vkurrnoa7lrprvvIxQb3N0XHJcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PiB7XHJcbiAgICAgICAgaWYodGhpcy5wYXNzZW5nZXJzKSB7XHJcbiAgICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMgPSB0aGlzLnBhc3NlbmdlcnM7XHJcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UGFzc2VuZ2VycyhvcmRlci5yZXF1ZXN0LnRva2VuKVxyXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XHJcbiAgICAgICAgICAgICAgICBlcnJvciQuZG8oKGVycik9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKSlcclxuICAgICAgICAgICAgICAgIC5kZWxheSg1MDApXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgLm1hcChwYXNzZW5nZXJzPT4ge1xyXG4gICAgICAgICAgICAgIHRoaXMucGFzc2VuZ2VycyA9IHBhc3NlbmdlcnM7XHJcbiAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcclxuICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgICAgfSlcclxuICAgICAgLy8gU3RlcCAxNCDotK3npajkurrnoa7lrprvvIxQb3N0XHJcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PlxyXG4gICAgICAgIHRoaXMuY2hlY2tPcmRlckluZm8ob3JkZXIucmVxdWVzdC50b2tlbiwgb3JkZXIuc2VhdFR5cGUsIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlci5wbGFuUGVwb2xlcylcclxuICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cclxuICAgICAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5lcnJvcihlcnIpKS5tZXJnZU1hcChlcnI9PiB7XHJcbiAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XHJcbiAgICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKVxyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSlcclxuICAgICAgICAgIClcclxuICAgICAgICAgIC5tYXAoYm9keT0+e1xyXG4gICAgICAgICAgICBvcmRlci5yZXF1ZXN0Lm9yZGVySW5mbyA9IGJvZHk7XHJcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcclxuICAgICAgICAgIH0pXHJcbiAgICAgIClcclxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XHJcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PntcclxuICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShjaGFsa2Dlh4blpIfov5vlhaXmjpLpmJ9gKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnNlYXRUeXBlLCBvcmRlci5yZXF1ZXN0Lm9yZGVyUmVxdWVzdCwgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvKVxyXG4gICAgICAgICAgLm1hcChib2R5PT4ge1xyXG4gICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXHJcbiAgICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf57mB5b+Z77yM6K+356iN5ZCO6YeN6K+V77yBJyBdLFxyXG4gICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxyXG4gICAgICAgICAgICAgKi9cclxuICAgICAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gYm9keTtcclxuICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgIHRocm93IGJvZHkubWVzc2FnZXNbMF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLm1lcmdlTWFwKGVycj0+IHtcclxuICAgICAgICAgICAgICBpZihlcnIgPT0gJ+ezu+e7n+e5geW/me+8jOivt+eojeWQjumHjeivle+8gScpIHtcclxuICAgICAgICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCcuJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcigxMDAwKTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcclxuICAgICAgICAgICAgfSkpXHJcbiAgICAgICAgICAubWFwKGJvZHk9PntcclxuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5KTtcclxuICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5xdWV1ZUluZm8gPSBib2R5O1xyXG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgICB9KVxyXG4gICAgICAgICAgLmRvKCgpPT5jb25zb2xlLmxvZygpKVxyXG4gICAgICB9KVxyXG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT4ge1xyXG4gICAgICAgIC8vIOiLpSBTdGVwIDE0IOS4reeahCBcImlmU2hvd1Bhc3NDb2RlXCIgPSBcIllcIu+8jOmCo+S5iOWkmuS6hui+k+WFpemqjOivgeeggei/meS4gOatpe+8jFBvc3RcclxuICAgICAgICBpZihvcmRlci5yZXF1ZXN0Lm9yZGVySW5mby5kYXRhLmlmU2hvd1Bhc3NDb2RlID09IFwiWVwiKSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlR2V0UGFzc0NvZGVOZXcob3JkZXIpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKG9yZGVyKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PntcclxuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2Dmj5DkuqTmjpLpmJ/orqLljZVgKTtcclxuICAgICAgICByZXR1cm4gdGhpcy5jb25maXJtU2luZ2xlRm9yUXVldWUob3JkZXIucmVxdWVzdC50b2tlbixcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIuc2VhdFR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnBsYW5QZXBvbGVzKVxyXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRlbGF5KDEwMCkpXHJcbiAgICAgICAgICAgIC5tYXAoYm9keT0+IHtcclxuICAgICAgICAgICAgICBpZihib2R5LnN0YXR1cyAmJiBib2R5LmRhdGEuc3VibWl0U3RhdHVzKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XHJcbiAgICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcclxuICAgICAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxyXG4gICAgICAgICAgICAgICAgICBkYXRhOiB7IGVyck1zZzogJ+S9meelqOS4jei2s++8gScsIHN1Ym1pdFN0YXR1czogZmFsc2UgfSxcclxuICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5LmRhdGEuZXJyTXNnfX1gKVxyXG4gICAgICAgICAgICAgICAgdGhyb3cgJ3JldHJ5JztcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgIH0pXHJcbiAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGNoYWxrYHt5ZWxsb3cuYm9sZCAke2Vycn19YCkpXHJcbiAgICAgICAgICAubWVyZ2VNYXAoKGVycik9PiB7XHJcbiAgICAgICAgICAgIGlmKGVyciA9PSAncmV0cnknKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoMTAwMCk7XHJcbiAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9KVxyXG4gICAgICApO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBvYnNlcnZhYmxlR2V0UGFzc2VuZ2VycyhvcmRlcjogT3JkZXIpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcclxuICAgICAgLm1lcmdlTWFwKCgpPT5cclxuICAgICAgICB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXIucmVxdWVzdC50b2tlbilcclxuICAgICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxyXG4gICAgICAgICAgICAgICAgZXJyb3IkLmRvKChlcnIpPT53aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke2Vycn19YCkpXHJcbiAgICAgICAgICAgICAgICAuZGVsYXkoNTAwKVxyXG4gICAgICAgICAgICApXHJcbiAgICAgIClcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUdldFBhc3NDb2RlTmV3KG9yZGVyOiBPcmRlcik6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxyXG4gICAgICAuc3dpdGNoTWFwKCgpPT4gdGhpcy5nZXRQYXNzQ29kZU5ldygpKVxyXG4gICAgICAuc3dpdGNoTWFwKCgpPT4gdGhpcy5jaGVja1JhbmRDb2RlQW5zeW4oKSlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRPcmRlckZsb3coKSB7XHJcblxyXG4gICAgLy8g5Yid5aeL5YyW5p+l6K+i54Gr6L2m5L2Z56Wo6aG16Z2iXHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxyXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMubGVmdFRpY2tldEluaXQoKSlcclxuICAgICAgLnN3aXRjaE1hcCgoKT0+dGhpcy5yZWN1cnNpdmVRdWVyeUxlZnRUaWNrZXQoKSlcclxuICAgICAgLy8gU3RlcCAxOCDmn6Xor6LmjpLpmJ/nrYnlvoXml7bpl7TvvIFcclxuICAgICAgLnN1YnNjcmliZShcclxuICAgICAgICAob3JkZXI6IE9yZGVyKT0+IHtcclxuICAgICAgICAgIHRoaXMub2JzUXVlcnlPcmRlcldhaXRUKG9yZGVyKVxyXG4gICAgICAgICAgICAubWVyZ2VNYXAoKG9yZGVySWQpPT50aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKSlcclxuICAgICAgICAgICAgLmRvKChib2R5KT0+IHtcclxuICAgICAgICAgICAgICBpZihib2R5LmRhdGEpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMucHJpbnRNeU9yZGVyTm9Db21wbGV0ZShib2R5KTtcclxuICAgICAgICAgICAgICAgIC8vIDAuNeenkuWTjeS4gOasoe+8jOWTjemTgzMw5YiG6ZKfXHJcbiAgICAgICAgICAgICAgICBiZWVwZXIoNjAqMzAqMik7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDnu5PmnZ99YCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcclxuICAgICAgICAgICAgICB9LGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YCkpO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZXJyPT57XHJcbiAgICAgICAgICB3aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApO1xyXG4gICAgICAgICAgdGhpcy5kZXN0cm95KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIG9ic2VydmFibGVDaGVja1VzZXIoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XHJcblxyXG4gICAgLy8gU3RlcCAxMCDpqozor4HnmbvlvZXvvIxQb3N0XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxyXG4gICAgICAubWVyZ2VNYXAoKCkgPT4gdGhpcy5jaGVja1VzZXIoKSlcclxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbygoZXJyKT0+Y29uc29sZS5lcnJvcihcIkNoZWNrIHVzZXIgZXJyb3IgXCIrZXJyKSkpXHJcbiAgICAgIC5tZXJnZU1hcChib2R5PT4ge1xyXG4gICAgICAgIGlmKGJvZHkuZGF0YS5mbGFnKSB7XHJcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihib2R5KTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgb2JzUXVlcnlPcmRlcldhaXRUKG9yZGVyOiBPcmRlcik6IE9ic2VydmFibGU8dm9pZD4ge1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcclxuICAgICAgICAubWVyZ2VNYXAoKCk9PiB0aGlzLnF1ZXJ5T3JkZXJXYWl0VGltZShcIlwiKSlcclxuICAgICAgICAubWFwKG9yZGVyUXVldWU9PiB7XHJcbiAgICAgICAgICB3aW5zdG9uLmRlYnVnKEpTT04uc3RyaW5naWZ5KG9yZGVyUXVldWUpKTtcclxuICAgICAgICAgIC8qKlxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBcInZhbGlkYXRlTWVzc2FnZXNTaG93SWRcIjogXCJfdmFsaWRhdG9yTWVzc2FnZVwiLFxyXG4gICAgICAgICAgICBcInN0YXR1c1wiOiB0cnVlLFxyXG4gICAgICAgICAgICBcImh0dHBzdGF0dXNcIjogMjAwLFxyXG4gICAgICAgICAgICBcImRhdGFcIjoge1xyXG4gICAgICAgICAgICAgIFwicXVlcnlPcmRlcldhaXRUaW1lU3RhdHVzXCI6IHRydWUsXHJcbiAgICAgICAgICAgICAgXCJjb3VudFwiOiAwLFxyXG4gICAgICAgICAgICAgIFwid2FpdFRpbWVcIjogMjQ0NCxcclxuICAgICAgICAgICAgICBcInJlcXVlc3RJZFwiOiA2Mzc2NzI3Mjg1NjM0Nzk3MDAwLFxyXG4gICAgICAgICAgICAgIFwid2FpdENvdW50XCI6IDIwMDAsXHJcbiAgICAgICAgICAgICAgXCJ0b3VyRmxhZ1wiOiBcImRjXCIsXHJcbiAgICAgICAgICAgICAgXCJvcmRlcklkXCI6IG51bGxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXCJtZXNzYWdlc1wiOiBbXSxcclxuICAgICAgICAgICAgXCJ2YWxpZGF0ZU1lc3NhZ2VzXCI6IHt9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICAqL1xyXG4gICAgICAgICAgaWYob3JkZXJRdWV1ZS5zdGF0dXMpIHtcclxuICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAwIHx8IG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAvL3JldHVybiBjb25zb2xlLmxvZyhjaGFsa2DmgqjnmoTovabnpajorqLljZXlj7fmmK8ge3JlZC5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLm9yZGVySWR9fWApO1xyXG4gICAgICAgICAgICAgIHJldHVybiBvcmRlclF1ZXVlLmRhdGEub3JkZXJJZDtcclxuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMil7XHJcbiAgICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLm1zZykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke29yZGVyUXVldWUuZGF0YS5tc2d9fWApO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICB0aHJvdyBvcmRlclF1ZXVlLmRhdGEubXNnO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0zKXtcclxuICAgICAgICAgICAgICB0aHJvdyBcIuaCqOeahOi9puelqOiuouWNleW3sue7j+WPlua2iCFcIjtcclxuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtNCl7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCLmgqjnmoTovabnpajorqLljZXmraPlnKjlpITnkIYsIOivt+eojeetiS4uLlwiKTtcclxuICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgIGxldCBtID0gcGFyc2VJbnQob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lIC8gNjApO1xyXG4gICAgICAgICAgICAgIGxldCBzID0gb3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lICUgNjA7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtg5o6S6Zif5Lq65pWw77yae3llbGxvdy5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLndhaXRDb3VudH19IOmihOiuoeetieW+heaXtumXtO+8miR7bT4wP20rJyDliIbpkp8gJzonJ30ke3N9IOenkmApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKG9yZGVyUXVldWUpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdGhyb3cgJ3JldHJ5JztcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5yZXRyeVdoZW4oKGVycm9ycyQpPT5lcnJvcnMkLm1lcmdlTWFwKChlcnIpPT4ge1xyXG4gICAgICAgICAgICBpZihlcnIgPT0gJ3JldHJ5Jykge1xyXG4gICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDQwMDApXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcclxuICAgICAgICAgIH0pXHJcbiAgICAgICAgKVxyXG4gICAgICAgIDtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xyXG4gICAqXHJcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cclxuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxyXG4gICAqIEBwYXJhbSB0b1N0YXRpb25OYW1lIOWIsOi+vuermVxyXG4gICAqIEBwYXJhbSB0cmFpbk5hbWVzIOWIl+i9plxyXG4gICAqXHJcbiAgICogQHJldHVybiBQcm9taXNlXHJcbiAgICovXHJcbiAgcHVibGljIHF1ZXJ5TGVmdFRpY2tldHModHJhaW5EYXRlOiBzdHJpbmcsIGZyb21TdGF0aW9uOiBzdHJpbmcsIHRvU3RhdGlvbjogc3RyaW5nLCB0cmFpbk5hbWVzPzogUmVhZG9ubHlBcnJheTxzdHJpbmc+KTogT2JzZXJ2YWJsZTxBcnJheTxhbnk+PiB7XHJcbiAgICBpZighdHJhaW5EYXRlKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5LmY6L2m5pel5pyffWApO1xyXG4gICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdygn6K+36L6T5YWl5LmY6L2m5pel5pyfJyk7XHJcbiAgICB9XHJcbiAgICAvLyB0aGlzLkJBQ0tfVFJBSU5fREFURSA9IHRyYWluRGF0ZTtcclxuXHJcbiAgICBpZighZnJvbVN0YXRpb24pIHtcclxuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXlh7rlj5Hnq5l9YCk7XHJcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCfor7fovpPlhaXlh7rlj5Hnq5knKTtcclxuICAgIH1cclxuICAgIC8vIHRoaXMuRlJPTV9TVEFUSU9OX05BTUUgPSBmcm9tU3RhdGlvbk5hbWU7XHJcblxyXG4gICAgaWYoIXRvU3RhdGlvbikge1xyXG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWIsOi+vuermX1gKTtcclxuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coJ+ivt+i+k+WFpeWIsOi+vuermScpO1xyXG4gICAgfVxyXG4gICAgLy8gdGhpcy5UT19TVEFUSU9OX05BTUUgPSB0b1N0YXRpb25OYW1lO1xyXG5cclxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXHJcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5xdWVyeUxlZnRUaWNrZXQoe3RyYWluRGF0ZTogdHJhaW5EYXRlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcm9tU3RhdGlvbjogZnJvbVN0YXRpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvU3RhdGlvbjogdG9TdGF0aW9ufSlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcclxuICAgICAgLy8gLnJldHJ5KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKVxyXG4gICAgICAucmV0cnlXaGVuKChlcnJvcnMkKT0+XHJcbiAgICAgICAgZXJyb3JzJC5kbygoKT0+cHJvY2Vzcy5zdGRvdXQud3JpdGUoXCIuXCIpKVxyXG4gICAgICAgICAgLmRlbGF5KHRoaXMub3B0aW9ucy5wZXJmb3JtYW5jZS5xdWVyeV9pbnRlcnZhbCB8fCAxMDAwKSlcclxuICAgICAgLm1hcCh0cmFpbnNEYXRhID0+IHRyYWluc0RhdGEucmVzdWx0KVxyXG4gICAgICAubWFwKHJlc3VsdCA9PiB7XHJcbiAgICAgICAgbGV0IHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4gPSBbXTtcclxuXHJcbiAgICAgICAgcmVzdWx0LmZvckVhY2goKGVsZW1lbnQ6IHN0cmluZyk9PiB7XHJcbiAgICAgICAgICBsZXQgdHJhaW46IEFycmF5PHN0cmluZz4gPSBlbGVtZW50LnNwbGl0KFwifFwiKTtcclxuICAgICAgICAgIHRyYWluWzRdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls0XSk7XHJcbiAgICAgICAgICB0cmFpbls1XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNV0pO1xyXG4gICAgICAgICAgdHJhaW5bNl0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzZdKTtcclxuICAgICAgICAgIHRyYWluWzddID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls3XSk7XHJcbiAgICAgICAgICB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJJU19USU1FX05PVF9CVVlcIiA/IFwi5YiX6L2m5YGc6L+QXCI6dHJhaW5bMTFdO1xyXG4gICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiTlwiID8gXCLml6DnpahcIjp0cmFpblsxMV07XHJcbiAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJZXCIgPyBcIuacieelqFwiOnRyYWluWzExXTtcclxuICAgICAgICAgIC8vIOWMuemFjei+k+WFpeeahOWIl+i9puWQjeensOeahOato+WImeihqOi+vuW8j+adoeS7tlxyXG4gICAgICAgICAgaWYoIXRyYWluTmFtZXMgfHwgdHJhaW5OYW1lcy5maWx0ZXIodG49PnRyYWluWzNdLm1hdGNoKG5ldyBSZWdFeHAodG4pKSAhPSBudWxsKS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIHRyYWlucy5wdXNoKHRyYWluKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdHJhaW5zO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xyXG4gICAqXHJcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cclxuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxyXG4gICAqIEBwYXJhbSB0b1N0YXRpb25OYW1lIOWIsOi+vuermVxyXG4gICAqIEBwYXJhbSBwYXNzU3RhdGlvbk5hbWUg6YCU57uP56uZXHJcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXHJcbiAgICogQHBhcmFtIGYg6L2m5qyh6L+H5ruk5p2h5Lu2XHJcbiAgICogQHBhcmFtIHQg5pe26Ze06L+H5ruk5p2h5Lu2XHJcbiAgICpcclxuICAgKiBAcmV0dXJuIHZvaWRcclxuICAgKi9cclxuICBwdWJsaWMgbGVmdFRpY2tldHMoW3RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLCB7ZmlsdGVyLGYsdGltZSx0LG9yZGVyYnksb30pIHtcclxuICAgIGxldCBmcm9tU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShmcm9tU3RhdGlvbk5hbWUpO1xyXG4gICAgbGV0IHRvU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZSh0b1N0YXRpb25OYW1lKTtcclxuICAgIGxldCBwYXNzU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShwYXNzU3RhdGlvbk5hbWUpO1xyXG5cclxuICAgIGxldCBwbGFuVHJhaW5zOiBSZWFkb25seUFycmF5PHN0cmluZz58dW5kZWZpbmVkID1cclxuICAgICAgdHlwZW9mIGYgPT0gXCJzdHJpbmdcIiA/IGYuc3BsaXQoJywnKToodHlwZW9mIGZpbHRlciA9PSBcInN0cmluZ1wiID8gZmlsdGVyLnNwbGl0KCcsJyk6dW5kZWZpbmVkKTtcclxuICAgIGxldCBwbGFuVGltZXM6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPnx1bmRlZmluZWQgPVxyXG4gICAgICB0eXBlb2YgdCA9PSBcInN0cmluZ1wiID8gdC5zcGxpdCgnLCcpOih0eXBlb2YgdGltZSA9PSBcInN0cmluZ1wiID8gdGltZS5zcGxpdCgnLCcpOnVuZGVmaW5lZCk7XHJcbiAgICBsZXQgcGxhbk9yZGVyQnk6IEFycmF5PHN0cmluZ3xudW1iZXI+fHVuZGVmaW5lZCA9XHJcbiAgICAgIHR5cGVvZiBvID09IFwic3RyaW5nXCIgPyBvLnNwbGl0KCcsJyk6KHR5cGVvZiBvcmRlcmJ5ID09IFwic3RyaW5nXCIgPyBvcmRlcmJ5LnNwbGl0KCcsJyk6dW5kZWZpbmVkKTtcclxuXHJcbiAgICBpZihwbGFuT3JkZXJCeSkge1xyXG4gICAgICBwbGFuT3JkZXJCeSA9IHBsYW5PcmRlckJ5Lm1hcCgoZmllbGROYW1lOnN0cmluZ3xudW1iZXIpID0+IHtcclxuICAgICAgICBpZihmaWVsZE5hbWVbMF0gPT09ICctJyB8fCBmaWVsZE5hbWVbMF0gPT09ICcrJykge1xyXG4gICAgICAgICAgcmV0dXJuIGZpZWxkTmFtZVswXSt0aGlzLlRJQ0tFVF9USVRMRS5pbmRleE9mKGZpZWxkTmFtZS5zdWJzdHJpbmcoMSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihmaWVsZE5hbWUpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICB0aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0Rmxvdyh7XHJcbiAgICAgICAgdHJhaW5EYXRlOiB0cmFpbkRhdGVcclxuICAgICAgICAsYmFja1RyYWluRGF0ZTogdHJhaW5EYXRlXHJcbiAgICAgICAgLGZyb21TdGF0aW9uTmFtZTogZnJvbVN0YXRpb25OYW1lXHJcbiAgICAgICAgLHRvU3RhdGlvbk5hbWU6IHRvU3RhdGlvbk5hbWVcclxuICAgICAgICAsZnJvbVN0YXRpb246IGZyb21TdGF0aW9uXHJcbiAgICAgICAgLHRvU3RhdGlvbjogdG9TdGF0aW9uXHJcbiAgICAgICAgLHBhc3NTdGF0aW9uOiBwYXNzU3RhdGlvblxyXG4gICAgICAgICxwbGFuVHJhaW5zOiBwbGFuVHJhaW5zXHJcbiAgICAgICAgLHBsYW5UaW1lczogcGxhblRpbWVzXHJcbiAgICAgICAgLHBsYW5PcmRlckJ5OiBwbGFuT3JkZXJCeVxyXG4gICAgICAgICxzZWF0Q2xhc3NlczogW11cclxuICAgICAgfSlcclxuICAgICAgLnN1YnNjcmliZSgob3JkZXI6IElPcmRlcikgPT4ge1xyXG4gICAgICAgIGxldCB0cmFpbnMgPSB0aGlzLnJlbmRlclRyYWluTGlzdFRpdGxlKG9yZGVyLnRyYWlucyk7XHJcbiAgICAgICAgaWYodHJhaW5zLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg5rKh5pyJ56ym5ZCI5p2h5Lu255qE6L2m5qyhfWApXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVuZGVyTGVmdFRpY2tldHModHJhaW5zKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlclRyYWluTGlzdFRpdGxlKHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4pOiBBcnJheTxBcnJheTxzdHJpbmc+PiB7XHJcbiAgICB2YXIgdGl0bGUgPSB0aGlzLlRJQ0tFVF9USVRMRS5tYXAodD0+Y2hhbGtge2JsdWUgJHt0fX1gKTtcclxuXHJcbiAgICB0cmFpbnMuZm9yRWFjaCgodHJhaW4sIGluZGV4KT0+IHtcclxuICAgICAgaWYoaW5kZXggJSAzMCA9PT0gMCkge1xyXG4gICAgICAgIHRyYWlucy5zcGxpY2UoaW5kZXgsIDAsIHRpdGxlKTtcclxuICAgICAgfVxyXG4gICAgfSlcclxuICAgIHJldHVybiB0cmFpbnM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHJlbmRlckxlZnRUaWNrZXRzKHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4pIHtcclxuICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHRyYWlucywge1xyXG4gICAgICBjb2x1bW5TcGxpdHRlcjogJ3wnLFxyXG4gICAgICBjb2x1bW5zOiBbXCIzXCIsIFwiNFwiLCBcIjVcIiwgXCI2XCIsIFwiN1wiLCBcIjhcIiwgXCI5XCIsIFwiMTBcIiwgXCIxMVwiLCBcIjIwXCIsIFwiMjFcIiwgXCIyMlwiLCBcIjIzXCIsIFwiMjRcIiwgXCIyNVwiLFxyXG4gICAgICAgICAgICAgICAgXCIyNlwiLCBcIjI3XCIsIFwiMjhcIiwgXCIyOVwiLCBcIjMwXCIsIFwiMzFcIiwgXCIzMlwiXVxyXG4gICAgfSlcclxuXHJcbiAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBteU9yZGVyTm9Db21wbGV0ZVJlcG9ydCgpIHtcclxuICAgIHRoaXMuaW5pdE5vQ29tcGxldGUoKVxyXG4gICAgICAubWVyZ2VNYXAoKCk9PlxyXG4gICAgICAgIHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpXHJcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRlbGF5KDUwMCkpXHJcbiAgICAgIClcclxuICAgICAgLnN1YnNjcmliZSh4PT4ge1xyXG4gICAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkoeCwge1xyXG4gICAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJyB8ICdcclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfSlcclxuICB9XHJcblxyXG4gIHB1YmxpYyBsb2dpbkluaXQoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2luaXRcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybCxcclxuICAgICAgbWV0aG9kOiBcIkdFVFwiLFxyXG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcclxuICAgICAgICAgIFwibW9kdWxlXCI6IFwibG9naW5cIixcclxuICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiLFxyXG4gICAgICAgICAgXCIwLjE3MjMxODcyNzAzMzg5MDYyXCI6XCJcIlxyXG4gICAgICB9O1xyXG5cclxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShkYXRhLCBudWxsLCBudWxsKVxyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L2NhcHRjaGEvY2FwdGNoYS1pbWFnZT9cIitwYXJhbTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPHZvaWQ+KT0+IHtcclxuICAgICAgdGhpcy5yYXdSZXF1ZXN0KG9wdGlvbnMsIChlcnJvcjogYW55LCByZXNwb25zZTogYW55LCBib2R5OiBzdHJpbmcpID0+IHtcclxuICAgICAgICBpZihlcnJvcikgcmV0dXJuIG9ic2VydmVyLmVycm9yKGVycm9yKTtcclxuICAgICAgfSkucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShcImNhcHRjaGEuQk1QXCIpKS5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVzdGlvbkNhcHRjaGEoKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcclxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcclxuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcclxuICAgIH0pO1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8c3RyaW5nPik9PiB7XHJcbiAgICAgIGxldCBjaGlsZCA9IGNoaWxkX3Byb2Nlc3MuZXhlYygnY2FwdGNoYS5CTVAnLCgpPT57fSk7XHJcblxyXG4gICAgICBybC5xdWVzdGlvbihjaGFsa2B7cmVkLmJvbGQg6K+36L6T5YWl6aqM6K+B56CBfTpgLCAocG9zaXRpb25TdHIpID0+IHtcclxuICAgICAgICBybC5jbG9zZSgpO1xyXG5cclxuICAgICAgICBpZih0eXBlb2YgcG9zaXRpb25TdHIgPT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgbGV0IHBvc2l0aW9uczogQXJyYXk8c3RyaW5nPiA9IFtdO1xyXG4gICAgICAgICAgcG9zaXRpb25TdHIuc3BsaXQoJywnKS5mb3JFYWNoKGVsPT5wb3NpdGlvbnM9cG9zaXRpb25zLmNvbmNhdChlbC5zcGxpdCgnICcpKSk7XHJcbiAgICAgICAgICBvYnNlcnZlci5uZXh0KHBvc2l0aW9ucy5tYXAoKHBvc2l0aW9uOiBzdHJpbmcpPT4ge1xyXG4gICAgICAgICAgICAgIHN3aXRjaChwb3NpdGlvbikge1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjFcIjpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiNDAsNDVcIjtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCIyXCI6XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjExMCw0NVwiO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjNcIjpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTgwLDQ1XCI7XHJcbiAgICAgICAgICAgICAgICBjYXNlIFwiNFwiOlxyXG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIyNTAsNDVcIjtcclxuICAgICAgICAgICAgICAgIGNhc2UgXCI1XCI6XHJcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjQwLDExMFwiO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjZcIjpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTEwLDExMFwiO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjdcIjpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTgwLDExMFwiO1xyXG4gICAgICAgICAgICAgICAgY2FzZSBcIjhcIjpcclxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMjUwLDExMFwiO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSkuam9pbignLCcpKTtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgb2JzZXJ2ZXIuZXJyb3IoXCLovpPlhaXmoLzlvI/plJnor69cIik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrQ2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtY2hlY2tcIjtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5xdWVzdGlvbkNhcHRjaGEoKVxyXG4gICAgICAubWVyZ2VNYXAocG9zaXRpb25zPT57XHJcbiAgICAgICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICAgIFwiYW5zd2VyXCI6IHBvc2l0aW9ucyxcclxuICAgICAgICAgICAgXCJsb2dpbl9zaXRlXCI6IFwiRVwiLFxyXG4gICAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIlxyXG4gICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgICAgICB1cmw6IHVybFxyXG4gICAgICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICAgICAsZm9ybTogZGF0YVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxyXG4gICAgICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxyXG4gICAgICAgICAgLm1hcChib2R5PT4ge1xyXG4gICAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDQpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gYm9keTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aHJvdyBib2R5LnJlc3VsdF9tZXNzYWdlO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSB1c2VyQXV0aGVudGljYXRlKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XHJcbiAgICAvLyDlj5HpgIHnmbvlvZXkv6Hmga9cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXHJcbiAgICAgICAgICAsXCJ1c2VybmFtZVwiOiB0aGlzLnVzZXJOYW1lXHJcbiAgICAgICAgICAsXCJwYXNzd29yZFwiOiB0aGlzLnVzZXJQYXNzd29yZFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9sb2dpblwiO1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXHJcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcclxuICAgICAgLm1hcChib2R5PT4ge1xyXG4gICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMikge1xyXG4gICAgICAgICAgdGhyb3cgYm9keS5yZXN1bHRfbWVzc2FnZTtcclxuICAgICAgICB9ZWxzZSBpZihib2R5LnJlc3VsdF9jb2RlICE9IDApIHtcclxuICAgICAgICAgIHRocm93IGJvZHk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIGJvZHkudWFtdGs7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TmV3QXBwVG9rZW4oKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXHJcbiAgICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPXtcclxuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvYXV0aC91YW10a1wiXHJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcclxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxyXG4gICAgICAubWFwKGJvZHk9PiB7XHJcbiAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5KTtcclxuICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcclxuICAgICAgICAgIHJldHVybiBib2R5Lm5ld2FwcHRrO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHRocm93IGJvZHk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0QXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZyk6IE9ic2VydmFibGU8c3RyaW5nPiB7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwidGtcIjogbmV3YXBwdGtcclxuICAgICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi91YW1hdXRoY2xpZW50XCJcclxuICAgICAgLGhlYWRlcnM6IHtcclxuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxyXG4gICAgICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzcG9ydD9yZWRpcmVjdD0vb3RuL1wiXHJcbiAgICAgICAgLCdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJ1xyXG4gICAgICB9XHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXHJcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcclxuICAgICAgLm1hcChib2R5PT4ge1xyXG4gICAgICAgIHdpbnN0b24uZGVidWcoYm9keS5yZXN1bHRfbWVzc2FnZSk7XHJcbiAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gYm9keS5hcHB0aztcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICB0aHJvdyBib2R5O1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICAvLyBwcml2YXRlIGdldE15MTIzMDYoKTogUHJvbWlzZSB7XHJcbiAgLy8gICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgLy8gICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgLy8gICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vaW5kZXgvaW5pdE15MTIzMDZcIlxyXG4gIC8vICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gIC8vICAgICAgLG1ldGhvZDogXCJHRVRcIn0sXHJcbiAgLy8gICAgICAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAvLyAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAvLyAgICAgICAgIGNvbnNvbGUubG9nKFwiR290IG15IDEyMzA2XCIpO1xyXG4gIC8vICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAvLyAgICAgICB9XHJcbiAgLy8gICAgICAgcmVqZWN0KCk7XHJcbiAgLy8gICAgIH0pO1xyXG4gIC8vICAgfSk7XHJcbiAgLy8gfVxyXG5cclxuICBwcml2YXRlIGNoZWNrQXV0aGVudGljYXRpb24oY29va2llczogb2JqZWN0KSB7XHJcbiAgICB2YXIgdWFtdGsgPSBcIlwiLCB0ayA9IFwiXCI7XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInVhbXRrXCIpIHtcclxuICAgICAgICB1YW10ayA9IGNvb2tpZXNbaV0udmFsdWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidGtcIikge1xyXG4gICAgICAgIHRrID0gY29va2llc1tpXS52YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdWFtdGs6IHVhbXRrLFxyXG4gICAgICB0azogdGtcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxlZnRUaWNrZXRJbml0KCk6IE9ic2VydmFibGU8dm9pZD4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIjtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHVybCk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHF1ZXJ5TGVmdFRpY2tldCh7dHJhaW5EYXRlLCBmcm9tU3RhdGlvbiwgdG9TdGF0aW9ufSk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICB2YXIgcXVlcnkgPSB7XHJcbiAgICAgIFwibGVmdFRpY2tldERUTy50cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLmZyb21fc3RhdGlvblwiOiBmcm9tU3RhdGlvblxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLnRvX3N0YXRpb25cIjogdG9TdGF0aW9uXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvcXVlcnk/XCIrcGFyYW07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiR0VUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcclxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxyXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXHJcbiAgICAgIH0pXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcclxuICAgICAgLm1hcChib2R5PT4ge1xyXG4gICAgICAgIGlmKCFib2R5KSB7XHJcbiAgICAgICAgICB0aHJvdyBcIuezu+e7n+i/lOWbnuaXoOaVsOaNrlwiO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZihib2R5LmluZGV4T2YoXCLor7fmgqjph43or5XkuIDkuItcIikgPiAwKSB7XHJcbiAgICAgICAgICB0aHJvdyBcIuezu+e7n+e5geW/mSFcIjtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoYm9keSkuZGF0YTtcclxuICAgICAgICAgIH1jYXRjaChlcnIpIHtcclxuICAgICAgICAgICAgdGhyb3cgZXJyO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gUmVzb2x2ZWRcclxuICAgICAgICAgIHJldHVybiBkYXRhO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrVXNlcigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vY2hlY2tVc2VyXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXHJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXHJcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN1Ym1pdE9yZGVyUmVxdWVzdCh7dHJhaW5TZWNyZXRTdHIsIHRyYWluRGF0ZSwgYmFja1RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lfSk6IE9ic2VydmFibGU8b2JqZWN0PiAge1xyXG5cclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9zdWJtaXRPcmRlclJlcXVlc3RcIjtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJzZWNyZXRTdHJcIjogcXVlcnlzdHJpbmcudW5lc2NhcGUodHJhaW5TZWNyZXRTdHIpXHJcbiAgICAgICxcInRyYWluX2RhdGVcIjogdHJhaW5EYXRlXHJcbiAgICAgICxcImJhY2tfdHJhaW5fZGF0ZVwiOiBiYWNrVHJhaW5EYXRlXHJcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIkFEVUxUXCJcclxuICAgICAgLFwicXVlcnlfZnJvbV9zdGF0aW9uX25hbWVcIjogZnJvbVN0YXRpb25OYW1lXHJcbiAgICAgICxcInF1ZXJ5X3RvX3N0YXRpb25fbmFtZVwiOiB0b1N0YXRpb25OYW1lXHJcbiAgICAgICxcInVuZGVmaW5lZFwiOlwiXCJcclxuICAgIH07XHJcblxyXG4gICAgLy8gdXJsID0gdXJsICsgXCJzZWNyZXRTdHI9XCIrc2VjcmV0U3RyK1wiJnRyYWluX2RhdGU9MjAxOC0wMS0zMSZiYWNrX3RyYWluX2RhdGU9MjAxOC0wMS0zMCZ0b3VyX2ZsYWc9ZGMmcHVycG9zZV9jb2Rlcz1BRFVMVCZxdWVyeV9mcm9tX3N0YXRpb25fbmFtZT3kuIrmtbcmcXVlcnlfdG9fc3RhdGlvbl9uYW1lPeW+kOW3nuS4nCZ1bmRlZmluZWRcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxyXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxyXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb25maXJtUGFzc2VuZ2VySW5pdERjKCk6IE9ic2VydmFibGU8T3JkZXJTdWJtaXRSZXF1ZXN0PiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWRcIlxyXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXHJcbiAgICAgICAgLFwiVXBncmFkZS1JbnNlY3VyZS1SZXF1ZXN0c1wiOjFcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxyXG4gICAgICAubWFwKGJvZHk9PiB7XHJcbiAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICB0aHJvdyB0aGlzLlNZU1RFTV9CVVNTWTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYoYm9keSkge1xyXG4gICAgICAgICAgLy8gR2V0IFJlcGVhdCBTdWJtaXQgVG9rZW5cclxuICAgICAgICAgIHZhciB0b2tlbiA9IGJvZHkubWF0Y2goL3ZhciBnbG9iYWxSZXBlYXRTdWJtaXRUb2tlbiA9ICcoLio/KSc7Lyk7XHJcbiAgICAgICAgICB2YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0gPSBib2R5Lm1hdGNoKC92YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm09KC4qPyk7Lyk7XHJcbiAgICAgICAgICB2YXIgb3JkZXJSZXF1ZXN0RFRPID0gYm9keS5tYXRjaCgvdmFyIG9yZGVyUmVxdWVzdERUTz0oLio/KTsvKTtcclxuICAgICAgICAgIGlmKHRva2VuKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgdG9rZW46IHRva2VuWzFdXHJcbiAgICAgICAgICAgICAgLHRpY2tldEluZm86IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtJiZKU09OLnBhcnNlKHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxyXG4gICAgICAgICAgICAgICxvcmRlclJlcXVlc3Q6IG9yZGVyUmVxdWVzdERUTyYmSlNPTi5wYXJzZShvcmRlclJlcXVlc3REVE9bMV0ucmVwbGFjZSgvJy9nLCBcIlxcXCJcIikpXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2Vycyh0b2tlbjogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXHJcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xyXG4gIH1cclxuXHJcbiAgLyogc2VhdCB0eXBlXHJcbiAg4oCY6L2v5Y2n4oCZID0+IOKAmDTigJksXHJcbiAg4oCY5LqM562J5bqn4oCZID0+IOKAmE/igJksXHJcbiAg4oCY5LiA562J5bqn4oCZID0+IOKAmE3igJksXHJcbiAg4oCY56Gs5bqn4oCZID0+IOKAmDHigJksXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJUaWNrZXRzKHNlYXRUeXBlLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk6IHN0cmluZyB7XHJcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xyXG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcclxuICAgICAgaWYocGxhblBlcG9sZXMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xyXG4gICAgICAgIC8v5bqn5L2N57G75Z6LLDAs56Wo57G75Z6LKOaIkOS6ui/lhL/nq6UpLG5hbWUs6Lqr5Lu957G75Z6LKOi6q+S7veivgS/lhpvlrpjor4EuLi4uKSzouqvku73or4Es55S16K+d5Y+356CBLOS/neWtmOeKtuaAgVxyXG4gICAgICAgIHZhciB0aWNrZXQgPSAvKnBhc3Nlbmdlci5zZWF0X3R5cGUqLyBzZWF0VHlwZSArXHJcbiAgICAgICAgICAgICAgICBcIiwwLFwiICtcclxuICAgICAgICAgICAgICAgIC8qbGltaXRfdGlja2V0c1thQV0udGlja2V0X3R5cGUqL1wiMVwiICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgKHBhc3Nlbmdlci5waG9uZV9ubyB8fCBcIlwiICkgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBcIk5cIjtcclxuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xyXG4gICAgdmFyIHRpY2tldHMgPSBbXTtcclxuICAgIHBhc3NlbmdlcnMuZm9yRWFjaChwYXNzZW5nZXI9PiB7XHJcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcclxuICAgICAgICAvL25hbWUs6Lqr5Lu957G75Z6LLOi6q+S7veivgSwxX1xyXG4gICAgICAgIHZhciB0aWNrZXQgPVxyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgXCIxXCI7XHJcbiAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aWNrZXRzLmpvaW4oXCJfXCIpK1wiX1wiO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja09yZGVySW5mbyhzdWJtaXRUb2tlbiwgc2VhdFR5cGUsIHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jaGVja09yZGVySW5mb1wiO1xyXG5cclxuICAgIHZhciBwYXNzZW5nZXJUaWNrZXRTdHIgPSB0aGlzLmdldFBhc3NlbmdlclRpY2tldHMoc2VhdFR5cGUsIHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKTtcclxuICAgIGlmKCFwYXNzZW5nZXJUaWNrZXRTdHIpIHtcclxuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coXCLmsqHmnInnm7jlhbPogZTns7vkurpcIik7XHJcbiAgICB9XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiY2FuY2VsX2ZsYWdcIjogMlxyXG4gICAgICAsXCJiZWRfbGV2ZWxfb3JkZXJfbnVtXCI6IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCJcclxuICAgICAgLFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHBhc3NlbmdlclRpY2tldFN0clxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInJhbmRDb2RlXCI6IFwiXCJcclxuICAgICAgLFwid2hhdHNTZWxlY3RcIjoxXHJcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogc3VibWl0VG9rZW5cclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxyXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKVxyXG4gICAgICAubWFwKGJvZHk9PiB7XHJcbiAgICAgICAgLypcclxuICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgICAgdXJsOiAnL2xlZnRUaWNrZXQvaW5pdCcsXHJcbiAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXHJcbiAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgICAgbWVzc2FnZXM6IFsgJ+ezu+e7n+W/me+8jOivt+eojeWQjumHjeivlScgXSxcclxuICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XHJcbiAgICAgICAgICByZXR1cm4gYm9keTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICB0aHJvdyBib2R5Lm1lc3NhZ2VzWzBdO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFF1ZXVlQ291bnQodG9rZW4sIHNlYXRUeXBlLCBvcmRlclJlcXVlc3REVE8sIHRpY2tldEluZm8pOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2dldFF1ZXVlQ291bnRcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcInRyYWluX2RhdGVcIjogbmV3IERhdGUob3JkZXJSZXF1ZXN0RFRPLnRyYWluX2RhdGUudGltZSkudG9TdHJpbmcoKVxyXG4gICAgICAsXCJ0cmFpbl9ub1wiOiBvcmRlclJlcXVlc3REVE8udHJhaW5fbm9cclxuICAgICAgLFwic3RhdGlvblRyYWluQ29kZVwiOiBvcmRlclJlcXVlc3REVE8uc3RhdGlvbl90cmFpbl9jb2RlXHJcbiAgICAgICxcInNlYXRUeXBlXCI6IHNlYXRUeXBlXHJcbiAgICAgICxcImZyb21TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLmZyb21fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0XCI6IHRpY2tldEluZm8ucXVlcnlMZWZ0VGlja2V0UmVxdWVzdERUTy55cEluZm9EZXRhaWxcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIjAwXCJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcclxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSlcclxuICAgICAgO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRQYXNzQ29kZU5ldygpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvZ2V0UGFzc0NvZGVOZXc/bW9kdWxlPXBhc3NlbmdlciZyYW5kPXJhbmRwJlwiK01hdGgucmFuZG9tKDAsMSk7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjx2b2lkPik9PiB7XHJcbiAgICAgIHRoaXMucmF3UmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgcmV0dXJuIG9ic2VydmVyLmVycm9yKGVycm9yKTtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlIT09MjAwKVxyXG4gICAgICAgICAgb2JzZXJ2ZXIuZXJyb3IocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrUmFuZENvZGVBbnN5bigpOiBPYnNlcnZhYmxlPGFueT4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9jaGVja1JhbmRDb2RlQW5zeW5cIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICByYW5kQ29kZTogXCJcIixcclxuICAgICAgcmFuZDogXCJyYW5kcFwiXHJcbiAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xyXG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcclxuICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucXVlc3Rpb25DYXB0Y2hhKClcclxuICAgICAgLm1lcmdlTWFwKHBvc2l0aW9ucz0+e1xyXG4gICAgICAgIG9wdGlvbnMuZm9ybS5yYW5kQ29kZSA9IHBvc2l0aW9ucztcclxuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xyXG4gICAgICB9KVxyXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVNpbmdsZUZvclF1ZXVlKHRva2VuLCBzZWF0VHlwZSwgcGFzc2VuZ2VycywgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0sIHBsYW5QZXBvbGVzKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jb25maXJtU2luZ2xlRm9yUXVldWVcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcInBhc3NlbmdlclRpY2tldFN0clwiOiB0aGlzLmdldFBhc3NlbmdlclRpY2tldHMoc2VhdFR5cGUsIHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxyXG4gICAgICAsXCJyYW5kQ29kZVwiOlwiXCJcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5wdXJwb3NlX2NvZGVzXHJcbiAgICAgICxcImtleV9jaGVja19pc0NoYW5nZVwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5rZXlfY2hlY2tfaXNDaGFuZ2VcclxuICAgICAgLFwibGVmdFRpY2tldFN0clwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5sZWZ0VGlja2V0U3RyXHJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnRyYWluX2xvY2F0aW9uXHJcbiAgICAgICxcImNob29zZV9zZWF0c1wiOiBcIlwiXHJcbiAgICAgICxcInNlYXREZXRhaWxUeXBlXCI6IFwiMDAwXCJcclxuICAgICAgLFwid2hhdHNTZWxlY3RcIjogMVxyXG4gICAgICAsXCJyb29tVHlwZVwiOiBcIjAwXCJcclxuICAgICAgLFwiZHdBbGxcIjogXCJOXCJcclxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXHJcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVyeU9yZGVyV2FpdFRpbWUodG9rZW46IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvcXVlcnlPcmRlcldhaXRUaW1lXCI7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybToge1xyXG4gICAgICAgIFwicmFuZG9tXCI6IG5ldyBEYXRlKCkuZ2V0VGltZSgpXHJcbiAgICAgICAgLFwidG91ckZsYWdcIjogXCJkY1wiXHJcbiAgICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICAgIH1cclxuICAgICAgLGpzb246IHRydWVcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2FuY2VsUXVldWVOb0NvbXBsZXRlT3JkZXIoKTogT2JzZXJ2YWJsZTxhbnk+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxRdWV1ZU5vQ29tcGxldGVNeU9yZGVyXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgdG91ckZsYWc6IFwiZGNcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XHJcbiAgICAgIC8vIC5tYXAoYm9keT0+IHtcclxuICAgICAgLy8gICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgLy8gICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xyXG4gICAgICAvLyAgIH1cclxuICAgICAgLy8gICByZXR1cm4gYm9keTtcclxuICAgICAgLy8gfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXROb0NvbXBsZXRlKCk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIjtcclxuICAgIGxldCBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBteU9yZGVyTm9Db21wbGV0ZSgpIHtcclxuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXHJcbiAgICAgIC5tZXJnZU1hcCgoKT0+IHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpKVxyXG4gICAgICAuc3Vic2NyaWJlKCh4KT0+e1xyXG4gICAgICAgIC8qXHJcbiAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcclxuICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxyXG4gICAgICAgICAgICBkYXRhOiB7IG9yZGVyREJMaXN0OiBbIFtPYmplY3RdIF0sIHRvX3BhZ2U6ICdkYicgfSxcclxuICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxyXG4gICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgIHRoaXMucHJpbnRNeU9yZGVyTm9Db21wbGV0ZSh4KTtcclxuICAgICAgfSwgZXJyPT5jb25zb2xlLmVycm9yKGVycikpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBwcmludE15T3JkZXJOb0NvbXBsZXRlKHgpIHtcclxuICAgIGlmKCF4LmRhdGEpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7eWVsbG93IOayoeacieacquWujOaIkOiuouWNlX1gKVxyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgIGxldCB0aWNrZXRzID0gW107XHJcbiAgIGlmKHguZGF0YS5vcmRlckNhY2hlRFRPKSB7XHJcbiAgICAgbGV0IG9yZGVyQ2FjaGUgPSB4LmRhdGEub3JkZXJDYWNoZURUTztcclxuICAgICBvcmRlckNhY2hlLnRpY2tldHMuZm9yRWFjaCh0aWNrZXQ9PiB7XHJcbiAgICAgICB0aWNrZXRzLnB1c2goe1xyXG4gICAgICAgICBcIuaOkumYn+WPt1wiOiBvcmRlckNhY2hlLnF1ZXVlTmFtZSxcclxuICAgICAgICAgXCLnrYnlvoXml7bpl7RcIjogb3JkZXJDYWNoZS53YWl0VGltZSxcclxuICAgICAgICAgXCLnrYnlvoXkurrmlbBcIjogb3JkZXJDYWNoZS53YWl0Q291bnQsXHJcbiAgICAgICAgIFwi5L2Z56Wo5pWwXCI6IG9yZGVyQ2FjaGUudGlja2V0Q291bnQsXHJcbiAgICAgICAgIFwi5LmY6L2m5pel5pyfXCI6IG9yZGVyQ2FjaGUudHJhaW5EYXRlLnNsaWNlKDAsMTApLFxyXG4gICAgICAgICBcIui9puasoVwiOiBvcmRlckNhY2hlLnN0YXRpb25UcmFpbkNvZGUsXHJcbiAgICAgICAgIFwi5Ye65Y+R56uZXCI6IG9yZGVyQ2FjaGUuZnJvbVN0YXRpb25OYW1lLFxyXG4gICAgICAgICBcIuWIsOi+vuermVwiOiBvcmRlckNhY2hlLnRvU3RhdGlvbk5hbWUsXHJcbiAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0VHlwZU5hbWUsXHJcbiAgICAgICAgIFwi5LmY6L2m5Lq6XCI6IHRpY2tldC5wYXNzZW5nZXJOYW1lXHJcbiAgICAgICB9KTtcclxuICAgICB9KTtcclxuXHJcbiAgIH1lbHNlIGlmKHguZGF0YS5vcmRlckRCTGlzdCl7XHJcblxyXG4gICAgIHguZGF0YS5vcmRlckRCTGlzdC5mb3JFYWNoKG9yZGVyPT4ge1xyXG4gICAgICAgLy8gY29uc29sZS5sb2coY2hhbGtg6K6i5Y2V5Y+3IHt5ZWxsb3cuYm9sZCAke29yZGVyLnNlcXVlbmNlX25vfX1gKVxyXG4gICAgICAgb3JkZXIudGlja2V0cy5mb3JFYWNoKHRpY2tldD0+IHtcclxuICAgICAgICAgdGlja2V0cy5wdXNoKHtcclxuICAgICAgICAgICBcIuiuouWNleWPt1wiOiB0aWNrZXQuc2VxdWVuY2Vfbm8sXHJcbiAgICAgICAgICAgLy8gXCLorqLnpajlj7dcIjogdGlja2V0LnRpY2tldF9ubyxcclxuICAgICAgICAgICBcIuS5mOi9puaXpeacn1wiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudHJhaW5fZGF0ZS5zbGljZSgwLDEwKX19YCxcclxuICAgICAgICAgICAvLyBcIuS4i+WNleaXtumXtFwiOiB0aWNrZXQucmVzZXJ2ZV90aW1lLFxyXG4gICAgICAgICAgIFwi5LuY5qy+5oiq6Iez5pe26Ze0XCI6IGNoYWxrYHtyZWQuYm9sZCAke3RpY2tldC5wYXlfbGltaXRfdGltZX19YCxcclxuICAgICAgICAgICBcIumHkeminVwiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudGlja2V0X3ByaWNlLzEwMH19YCxcclxuICAgICAgICAgICBcIueKtuaAgVwiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudGlja2V0X3N0YXR1c19uYW1lfX1gLFxyXG4gICAgICAgICAgIFwi5LmY6L2m5Lq6XCI6IHRpY2tldC5wYXNzZW5nZXJEVE8ucGFzc2VuZ2VyX25hbWUsXHJcbiAgICAgICAgICAgXCLovabmrKFcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy5zdGF0aW9uX3RyYWluX2NvZGUsXHJcbiAgICAgICAgICAgXCLlh7rlj5Hnq5lcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy5mcm9tX3N0YXRpb25fbmFtZSxcclxuICAgICAgICAgICBcIuWIsOi+vuermVwiOiB0aWNrZXQuc3RhdGlvblRyYWluRFRPLnRvX3N0YXRpb25fbmFtZSxcclxuICAgICAgICAgICBcIuW6p+S9jVwiOiB0aWNrZXQuc2VhdF9uYW1lLFxyXG4gICAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0X3R5cGVfbmFtZSxcclxuICAgICAgICAgICBcIuS5mOi9puS6uuexu+Wei1wiOiB0aWNrZXQudGlja2V0X3R5cGVfbmFtZVxyXG4gICAgICAgICB9KTtcclxuICAgICAgIH0pO1xyXG4gICAgIH0pO1xyXG4gICB9XHJcblxyXG4gICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0aWNrZXRzLCB7XHJcbiAgICAgY29sdW1uU3BsaXR0ZXI6ICd8J1xyXG4gICB9KTtcclxuXHJcbiAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVyeU15T3JkZXJOb0NvbXBsZXRlKCk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvcXVlcnlNeU9yZGVyTm9Db21wbGV0ZVwiO1xyXG4gICAgbGV0IG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybToge1xyXG4gICAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgfVxyXG4gICAgICAsanNvbjogdHJ1ZVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXHJcbiAgICAgIC5tYXAoYm9keT0+IHtcclxuICAgICAgICBpZihib2R5LnN0YXR1cykge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICAvKipcclxuICAgICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxyXG4gICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcclxuICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxyXG4gICAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cclxuICAgICAgICAgICAqL1xyXG4gICAgICAgICAgcmV0dXJuIGJvZHk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IGJvZHkubWVzc2FnZXM7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgPGRpdiBjbGFzcz1cInQtYnRuXCI+XHJcbnt7aWYgcGF5X2ZsYWc9PSdZJ319XHJcbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgaWQ9XCJjb250aW51ZVBheU5vTXlDb21wbGV0ZVwiIG9uY2xpY2s9XCJjb250aXVlUGF5Tm9Db21wbGV0ZU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywncGF5JylcIiAgY2xhc3M9XCJidG45MnNcIj7nu6fnu63mlK/ku5g8L2E+PC9kaXY+XHJcbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfb3JkZXInKVwiIGlkPVwiY2FuY2VsX2J1dHRvbl9wYXlcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2PlxyXG57ey9pZn19XHJcbnt7aWYgcGF5X3Jlc2lnbl9mbGFnPT0nWSd9fVxyXG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIGlkPVwiY29udGludWVQYXlOb015Q29tcGxldGVcIiBvbmNsaWNrPVwiY29udGl1ZVBheU5vQ29tcGxldGVPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ3Jlc2lnbicpO1wiICBjbGFzcz1cImJ0bjkyc1wiPue7p+e7reaUr+S7mDwvYT48L2Rpdj5cclxuXHQgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfcmVzaWduJylcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2PlxyXG57ey9pZn19XHJcblxyXG4gICAgICAgIDwvZGl2PlxyXG4gICovXHJcbiAgcHJpdmF0ZSBjYW5jZWxOb0NvbXBsZXRlTXlPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJyk6IE9ic2VydmFibGU8YW55PiB7XHJcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvY2FuY2VsTm9Db21wbGV0ZU15T3JkZXJcIjtcclxuICAgIGxldCBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcInNlcXVlbmNlX25vXCI6IHNlcXVlbmNlTm8sXHJcbiAgXHRcdFx0XCJjYW5jZWxfZmxhZ1wiOiBjYW5jZWxJZCxcclxuICAgICAgICBcIl9qc29uX2F0dFwiOlwiXCJcclxuICAgICAgfVxyXG4gICAgICAsanNvbjogdHJ1ZVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNhbmNlbE5vQ29tcGxldGVPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJykge1xyXG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcclxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmNhbmNlbE5vQ29tcGxldGVNeU9yZGVyKHNlcXVlbmNlTm8sIGNhbmNlbElkKSlcclxuICAgICAgLnN1YnNjcmliZSgoYm9keSk9PntcclxuICAgICAgICAgIC8vIHtcInZhbGlkYXRlTWVzc2FnZXNTaG93SWRcIjpcIl92YWxpZGF0b3JNZXNzYWdlXCIsXCJzdGF0dXNcIjp0cnVlLFwiaHR0cHN0YXR1c1wiOjIwMCxcImRhdGFcIjp7fSxcIm1lc3NhZ2VzXCI6W10sXCJ2YWxpZGF0ZU1lc3NhZ2VzXCI6e319XHJcbiAgICAgICAgICBpZiAoYm9keS5kYXRhLmV4aXN0RXJyb3IgPT0gXCJZXCIpIHtcclxuICAgICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7Ym9keS5kYXRhLmVycm9yTXNnfX1gKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihjaGFsa2B7eWVsbG93IOiuouWNlSAke3NlcXVlbmNlTm99IOW3suWPlua2iH1gKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICxlcnI9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApXHJcbiAgICAgICk7XHJcbiAgfVxyXG59XHJcbiJdfQ==
