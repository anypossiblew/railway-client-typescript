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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxpRkFBQSxPQUFRLEVBQWtCLEdBQUcsS0FBckIsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUksQ0FBQztZQUNwRCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLG9IQUFBLHVCQUFjLEVBQVUsc0JBQU8sS0FBakIsVUFBVSxFQUFRLENBQUM7WUFDckQsQ0FBQztRQUNILENBQUMsRUFDRixVQUFBLEdBQUcsSUFBRSxPQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSyxpRkFBQSxPQUFRLEVBQW1CLEdBQUcsS0FBdEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBSSxFQUFsRCxDQUFrRCxDQUN2RCxDQUFDO0lBQ04sQ0FBQztJQUNILGNBQUM7QUFBRCxDQXJqREEsQUFxakRDLElBQUE7QUFyakRZLDBCQUFPIiwiZmlsZSI6InNyYy9BY2NvdW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiIC8vIGh0dHBzOi8vd3d3LmxhbmluZGV4LmNvbS8xMjMwNiVFOCVCNCVBRCVFNyVBNSVBOCVFNiVCNSU4MSVFNyVBOCU4QiVFNSU4NSVBOCVFOCVBNyVBMyVFNiU5RSU5MC9cblxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XG5pbXBvcnQge0ZpbGVDb29raWVTdG9yZX0gZnJvbSAnLi9GaWxlQ29va2llU3RvcmUnO1xuaW1wb3J0IHtTdGF0aW9ufSBmcm9tICcuL1N0YXRpb24nO1xuaW1wb3J0IHJlcXVlc3QgPSByZXF1aXJlKCdyZXF1ZXN0Jyk7XG5pbXBvcnQgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xuaW1wb3J0IGZzID0gcmVxdWlyZSgnZnMnKTtcbmltcG9ydCByZWFkbGluZSA9IHJlcXVpcmUoJ3JlYWRsaW5lJyk7XG5pbXBvcnQgcHJvY2VzcyA9IHJlcXVpcmUoJ3Byb2Nlc3MnKTtcbmltcG9ydCBSeCBmcm9tICdyeGpzL1J4JztcbmltcG9ydCB7IE9ic2VydmFibGUsIE9ic2VydmFibGVJbnB1dCB9IGZyb20gJ3J4anMvT2JzZXJ2YWJsZSc7XG5pbXBvcnQgeyBPYnNlcnZlciB9IGZyb20gJ3J4anMvT2JzZXJ2ZXInO1xuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2JpbmRDYWxsYmFjayc7XG5pbXBvcnQgY2hhbGsgPSByZXF1aXJlKCdjaGFsaycpO1xuaW1wb3J0IGNvbHVtbmlmeSA9IHJlcXVpcmUoJ2NvbHVtbmlmeScpO1xuaW1wb3J0IGJlZXBlciA9IHJlcXVpcmUoJ2JlZXBlcicpO1xuaW1wb3J0IGNoaWxkX3Byb2Nlc3MgPSByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJyk7XG5cbmltcG9ydCB7T3JkZXJTdWJtaXRSZXF1ZXN0LCBJT3JkZXIsIE9yZGVyfSBmcm9tICcuL09yZGVyJztcblxuaW50ZXJmYWNlIE9yZGVyU3VibWl0UmVxdWVzdCB7XG4gIHRva2VuOiBzdHJpbmc7XG4gIHRpY2tldEluZm86IG9iamVjdDtcbiAgb3JkZXJSZXF1ZXN0OiBvYmplY3Q7XG59XG5cbmV4cG9ydCBjbGFzcyBBY2NvdW50IHtcbiAgcHVibGljIHVzZXJOYW1lIDogc3RyaW5nO1xuICBwdWJsaWMgdXNlclBhc3N3b3JkIDogc3RyaW5nO1xuICBwcml2YXRlIGNoZWNrVXNlclRpbWVyID0gUnguT2JzZXJ2YWJsZS50aW1lcigxMDAwKjYwKjEwLCAxMDAwKjYwKjEwKTsgLy8g5Y2B5YiG6ZKf5LmL5ZCO5byA5aeL77yM5q+P5Y2B5YiG6ZKf5qOA5p+l5LiA5qyhXG4gIHByaXZhdGUgc2NwdENoZWNrVXNlclRpbWVyPzogUnguU3Vic2NyaXB0aW9uO1xuXG4gIHByaXZhdGUgc3RhdGlvbnM6IFN0YXRpb24gPSBuZXcgU3RhdGlvbigpO1xuICBwcml2YXRlIHBhc3NlbmdlcnM/OiBvYmplY3Q7XG5cbiAgcHJpdmF0ZSBTWVNURU1fQlVTU1kgPSBcIlN5c3RlbSBpcyBidXNzeVwiO1xuICBwcml2YXRlIFNZU1RFTV9NT1ZFRCA9IFwiTW92ZWQgVGVtcG9yYXJpbHlcIjtcblxuICBwcml2YXRlIHJhd1JlcXVlc3Q6IChvcHRpb25zOmFueXx1bmRlZmluZWR8bnVsbCwgY2I6YW55KT0+YW55O1xuICBwcml2YXRlIHJlcXVlc3Q6IChvcHRpb25zPzphbnl8dW5kZWZpbmVkfG51bGwpPT5PYnNlcnZhYmxlPGFueT47XG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XG4gIHB1YmxpYyBoZWFkZXJzOiBvYmplY3QgPSB7XG4gICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIlxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxuICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcbiAgICAsXCJPcmlnaW5cIjogXCJodHRwczovL2t5ZncuMTIzMDYuY25cIlxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcbiAgfTtcblxuICBwcml2YXRlIFRJQ0tFVF9USVRMRSA9IFsnJywgJycsICcnLCAn6L2m5qyhJywgJ+i1t+WniycsICfnu4jngrknLCAn5Ye65Y+R56uZJywgJ+WIsOi+vuermScsICflh7rlj5Hml7YnLCAn5Yiw6L6+5pe2JywgJ+WOhuaXticsICcnLCAnJyxcbiAgICAgICAgICAgICAgICfml6XmnJ8nLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ+mrmOe6p+i9r+WNpycsICcnLCAn6L2v5Y2nJywgJ+i9r+W6pycsICfnibnnrYnluqcnLCAn5peg5bqnJyxcbiAgICAgICAgICAgICAgICcnLCAn56Gs5Y2nJywgJ+ehrOW6pycsICfkuoznrYnluqcnLCAn5LiA562J5bqnJywgJ+WVhuWKoeW6pyddO1xuXG4gIHByaXZhdGUgcXVlcnkgPSBmYWxzZTtcblxuICBwcml2YXRlIG9yZGVyczogQXJyYXk8T3JkZXI+ID0gW107XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB1c2VyUGFzc3dvcmQ6IHN0cmluZykge1xuICAgIHRoaXMudXNlck5hbWUgPSBuYW1lO1xuICAgIHRoaXMudXNlclBhc3N3b3JkID0gdXNlclBhc3N3b3JkO1xuXG4gICAgdGhpcy5zZXRSZXF1ZXN0KCk7XG4gICAgdGhpcy5yYXdSZXF1ZXN0ID0gcmVxdWVzdC5kZWZhdWx0cyh7amFyOiB0aGlzLmNvb2tpZWphcn0pO1xuICAgIHRoaXMucmVxdWVzdCA9IE9ic2VydmFibGUuYmluZENhbGxiYWNrPEFycmF5PGFueT4+KHRoaXMucmF3UmVxdWVzdCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XG4gICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XG4gICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlICE9PSAyMDApIHRocm93IFsnaHR0cCBlcnJvcicsIHJlc3BvbnNlLnN0YXR1c0NvZGUsIHJlc3BvbnNlLnN0YXR1c01lc3NhZ2VdLmpvaW4oJyAnKTtcbiAgICAgIHJldHVybiBib2R5O1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOajgOafpee9kee7nOW8guW4uFxuICAgKi9cbiAgcHJpdmF0ZSBpc1N5c3RlbUJ1c3N5KGJvZHk6IHN0cmluZyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBib2R5LmluZGV4T2YoXCLnvZHnu5zlj6/og73lrZjlnKjpl67popjvvIzor7fmgqjph43or5XkuIDkuItcIikgPiAwO1xuICB9XG5cbiAgcHVibGljIHNldFJlcXVlc3QoKSB7XG4gICAgbGV0IGNvb2tpZUZpbGVOYW1lOiBzdHJpbmcgPSBcIi4vY29va2llcy9cIit0aGlzLnVzZXJOYW1lK1wiLmpzb25cIjtcbiAgICB2YXIgZmlsZVN0b3JlID0gbmV3IEZpbGVDb29raWVTdG9yZShjb29raWVGaWxlTmFtZSwge2VuY3J5cHQ6IGZhbHNlfSk7XG4gICAgZmlsZVN0b3JlLm9wdGlvbiA9IHtlbmNyeXB0OiBmYWxzZX07XG5cbiAgICB0aGlzLmNvb2tpZWphciA9IHJlcXVlc3QuamFyKGZpbGVTdG9yZSk7XG5cbiAgICAvLyB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XG5cbiAgfVxuXG4gIHByaXZhdGUgbmV4dE9yZGVyTnVtOiBudW1iZXIgPSAwO1xuICBwcml2YXRlIG5leHRPcmRlcigpIHtcbiAgICB0aGlzLm5leHRPcmRlck51bSA9ICh0aGlzLm5leHRPcmRlck51bSArIDEpJXRoaXMub3JkZXJzLmxlbmd0aDtcbiAgICByZXR1cm4gdGhpcy5vcmRlcnNbdGhpcy5uZXh0T3JkZXJOdW1dO1xuICB9XG5cbiAgcHJpdmF0ZSBjdXJyZW50T3JkZXIoKSB7XG4gICAgcmV0dXJuIHRoaXMub3JkZXJzW3RoaXMubmV4dE9yZGVyTnVtXTtcbiAgfVxuXG4gIHB1YmxpYyBjcmVhdGVPcmRlcih0cmFpbkRhdGVzOiBBcnJheTxzdHJpbmc+LCBiYWNrVHJhaW5EYXRlOiBzdHJpbmcsXG4gICAgICAgICAgICAgICAgICAgICBbZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLFxuICAgICAgICAgICAgICAgICAgICAgcGxhblRyYWluczogQXJyYXk8c3RyaW5nPiwgcGxhblBlcG9sZXM6IEFycmF5PHN0cmluZz4sIHNlYXRDbGFzc2VzOiBBcnJheTxzdHJpbmc+KTogdGhpcyB7XG4gICAgdHJhaW5EYXRlcy5mb3JFYWNoKHRyYWluRGF0ZT0+IHtcbiAgICAgIGlmKCFuZXcgRGF0ZSh0cmFpbkRhdGUpLnRvSlNPTigpKSB7XG4gICAgICAgIHRocm93IGNoYWxrYHtyZWQg5LmY6L2m5pel5pyfJHt0cmFpbkRhdGV95qC85byP5LiN5q2j56Gu77yM5qC85byP5bqU6K+l5piveXl5eS1NTS1kZH1gO1xuICAgICAgfVxuICAgICAgaWYobmV3IERhdGUodHJhaW5EYXRlKS50b0pTT04oKS5zbGljZSgwLDEwKSA8IG5ldyBEYXRlKCkudG9KU09OKCkuc2xpY2UoMCwxMCkpIHtcbiAgICAgICAgdGhyb3cgY2hhbGtge3JlZCDkuZjovabml6XmnJ/lupTor6XkuLrku4rlpKnmiJbku6XlkI59YDtcbiAgICAgIH1cblxuICAgICAgdGhpcy5vcmRlcnMucHVzaChcbiAgICAgICAgbmV3IE9yZGVyKHRyYWluRGF0ZSwgYmFja1RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWUsIHBsYW5UcmFpbnMsIHBsYW5QZXBvbGVzLCBzZWF0Q2xhc3NlcylcbiAgICAgICk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIHB1YmxpYyBzdWJtaXQoKTogdm9pZCB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC8vIOajgOafpeacquWujOaIkOiuouWNlVxuICAgICAgLm1lcmdlTWFwKCgpPT4gdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXG4gICAgICAuZG8oYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5kYXRhKSB7XG4gICAgICAgICAgdGhpcy5wcmludE15T3JkZXJOb0NvbXBsZXRlKGJvZHkpO1xuICAgICAgICAgIGlmKGJvZHkuZGF0YS5vcmRlckNhY2hlRFRPKSB7XG4gICAgICAgICAgICB0aHJvdyAn5oKo6L+Y5pyJ5o6S6Zif6K6i5Y2VJztcbiAgICAgICAgICB9ZWxzZSBpZihib2R5LmRhdGEub3JkZXJEQkxpc3Qpe1xuICAgICAgICAgICAgdGhyb3cgJ+aCqOi/mOacieacquWujOaIkOiuouWNlSc7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLy8g5YeG5aSH5aW95ZCO6L+b6KGM6K6i56Wo5rWB56iLXG4gICAgICAuc3Vic2NyaWJlKCgpPT57XG4gICAgICAgIHRoaXMuYnVpbGRPcmRlckZsb3coKTtcblxuICAgICAgICB0aGlzLnNjcHRDaGVja1VzZXJUaW1lciA9XG4gICAgICAgICAgdGhpcy5jaGVja1VzZXJUaW1lci5zdWJzY3JpYmUoKGkpPT4ge1xuICAgICAgICAgICAgdGhpcy5vYnNlcnZhYmxlQ2hlY2tVc2VyKClcbiAgICAgICAgICAgICAgLnN1YnNjcmliZSgoKT0+d2luc3Rvbi5kZWJ1ZyhcIkNoZWNrIHVzZXIgZG9uZVwiKSk7XG4gICAgICAgICAgfSk7XG4gICAgICB9LGVycj0+IHtcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHVibGljIG9yZGVyV2FpdFRpbWUoKSB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcbiAgICAgICAgdGhpcy5vYnNRdWVyeU9yZGVyV2FpdFQobmV3IE9yZGVyKCkpXG4gICAgICAgICAgLm1lcmdlTWFwKChvcmRlcklkKT0+dGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXG4gICAgICAgICAgLmRvKChib2R5KT0+IHtcbiAgICAgICAgICAgIGlmKGJvZHkuZGF0YSkge1xuICAgICAgICAgICAgICB0aGlzLnByaW50TXlPcmRlck5vQ29tcGxldGUoYm9keSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg57uT5p2ffWApO1xuICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICxlcnI9PmNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6ZSZ6K+v57uT5p2fICR7ZXJyfX1gKVxuICAgICAgICAgICAgLCgpPT57XG4gICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICk7XG4gICAgICB9XG4gICAgICAsZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YClcbiAgICAgICwoKT0+e1xuICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE9yZGVyUXVldWUoKSB7XG4gICAgdGhpcy5jYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpXG4gICAgICAudGhlbih4PT4ge1xuICAgICAgICBpZih4LnN0YXR1cyAmJiB4LmRhdGEuZXhpc3RFcnJvciA9PSAnTicpIHtcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDmjpLpmJ/orqLljZXlt7Llj5bmtoh9YCk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKHgpO1xuICAgICAgICB9XG4gICAgICB9LCBlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcbiAgfVxuXG4gIHB1YmxpYyBkZXN0cm95KCkge1xuICAgIHRoaXMuc2NwdENoZWNrVXNlclRpbWVyJiZ0aGlzLnNjcHRDaGVja1VzZXJUaW1lci51bnN1YnNjcmliZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlQ2hlY2tDYXB0Y2hhKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuZ2V0Q2FwdGNoYSgpKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmNoZWNrQ2FwdGNoYSgpXG4gICAgICAgICAgICAgICAgICAgICAgICAuZG8oKCk9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDmoKHpqoznoIHmiJDlip/lkI7ov5vooYzmjojmnYPorqTor4FcbiAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg6aqM6K+B56CB5qCh6aqM5oiQ5YqffWApXG4gICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICApXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbygoKT0+Y29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjH1gKSlcbiAgICAgICk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVMb2dpbigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVDaGVja0NhcHRjaGEoKSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+XG4gICAgICAgIHRoaXMudXNlckF1dGhlbnRpY2F0ZSgpXG4gICAgICAgICAgLmRvKCgpPT5jb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDnmbvlvZXmiJDlip99YCkpXG4gICAgICApXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5tZXJnZU1hcChlcnI9PiB7XG4gICAgICAgICAgLypcbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi5a+G56CB6L6T5YWl6ZSZ6K+v44CC5aaC5p6c6L6T6ZSZ5qyh5pWw6LaF6L+HNOasoe+8jOeUqOaIt+Wwhuiiq+mUgeWumuOAglwiLFwicmVzdWx0X2NvZGVcIjoxfVxuICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLpqozor4HnoIHmoKHpqozlpLHotKVcIixcInJlc3VsdF9jb2RlXCI6XCI1XCJ9XG4gICAgICAgICAgKi9cbiAgICAgICAgICBpZih0eXBlb2YgZXJyLnJlc3VsdF9jb2RlID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDEwMDApO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLmNhdGNoKGVycj0+IHtcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyLnJlc3VsdF9tZXNzYWdlfX1gKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlTmV3QXBwVG9rZW4oKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmdldE5ld0FwcFRva2VuKCkpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoZXJyKSlcbiAgICAgICAgICAubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUxvZ2luKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0azogc3RyaW5nKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICBsZXQgbmV3QXBwVG9rZW4gPSBuZXdhcHB0aztcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjxzdHJpbmc+KT0+IHtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChuZXdBcHBUb2tlbik7XG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XG4gICAgICB9KVxuICAgICAgLm1lcmdlTWFwKChuZXdhcHB0azogc3RyaW5nKT0+dGhpcy5nZXRBcHBUb2tlbihuZXdhcHB0aykpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoZXJyKSlcbiAgICAgICAgICAubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOiOt+WPllRva2Vu5aSx6LSlfWApO1xuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhlcnIpO1xuICAgICAgICAgICAgaWYoZXJyLnJlc3VsdF9jb2RlICYmIGVyci5yZXN1bHRfY29kZSA9PT0gMikge1xuICAgICAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTmV3QXBwVG9rZW4oKS5kbygobmV3YXBwdGspPT5uZXdBcHBUb2tlbiA9IG5ld2FwcHRrKTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUxvZ2luSW5pdCgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuXG4gICAgLy8g55m75b2V5Yid5aeL5YyWXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcChvcmRlcj0+dGhpcy5sb2dpbkluaXQoKSlcbiAgICAgIC5yZXRyeSgxMDAwKVxuICAgICAgLm1hcChvcmRlciA9PiB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24odGhpcy5jb29raWVqYXIuX2phci50b0pTT04oKS5jb29raWVzKSlcbiAgICAgIC5tZXJnZU1hcCh0b2tlbnM9PiB7XG4gICAgICAgIGlmKHRva2Vucy50aykge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVBcHBUb2tlbih0b2tlbnMudGspO1xuICAgICAgICB9ZWxzZSBpZih0b2tlbnMudWFtdGspIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTmV3QXBwVG9rZW4oKVxuICAgICAgICAgICAgLm1lcmdlTWFwKG5ld2FwcHRrPT50aGlzLm9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0aykpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbigpXG4gICAgICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpKVxuICAgICAgICAgIC5tZXJnZU1hcChuZXdhcHB0az0+dGhpcy5vYnNlcnZhYmxlQXBwVG9rZW4obmV3YXBwdGspKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOaVsOe7hOWkmuWFs+mUruWtl+auteaOkuW6j+eul+azle+8jOWtl+autem7mOiupOS4uumAkuWHj+aOkuW6j++8jOWmguaenOWtl+auteWJjemdouW4puaciSvnrKblj7fliJnkuLrpgJLlop7mjpLluo9cbiAgICovXG4gIHByaXZhdGUgZmllbGRTb3J0ZXIoZmllbGRzOiBBcnJheTxzdHJpbmc+KSB7XG4gICAgcmV0dXJuIChhOmFueSwgYjphbnkpID0+IGZpZWxkcy5tYXAoKG86c3RyaW5nKSA9PiB7XG4gICAgICAgICAgICAgIGxldCBkaXIgPSAtMTtcbiAgICAgICAgICAgICAgaWYgKG9bMF0gPT09ICcrJykge1xuICAgICAgICAgICAgICAgIGRpciA9IDE7XG4gICAgICAgICAgICAgICAgbyA9IG8uc3Vic3RyaW5nKDEpO1xuICAgICAgICAgICAgICB9ZWxzZSBpZihvWzBdID09PSAnLScpIHtcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIGFbb10gPiBiW29dID8gZGlyIDogYVtvXSA8IGJbb10gPyAtKGRpcikgOiAwO1xuICAgICAgICAgIH0pLnJlZHVjZSgocCwgbikgPT4gcCA/IHAgOiBuLCAwKTtcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlPElPcmRlcj4ge1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpXG4gICAgICAvLyDojrflj5bkvZnnpajkv6Hmga9cbiAgICAgIC5tZXJnZU1hcCgob3JkZXI6IElPcmRlcik6IE9ic2VydmFibGVJbnB1dDxJT3JkZXI+ID0+XG4gICAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyhvcmRlci50cmFpbkRhdGUsIG9yZGVyLmZyb21TdGF0aW9uLCBvcmRlci50b1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXG4gICAgICAgICAgLm1hcCgodHJhaW5zKT0+IHtcbiAgICAgICAgICAgIG9yZGVyLnRyYWlucyA9IHRyYWlucztcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLy8g6I635Y+W6YCU57uP56uZ6L2m5qyh5L+h5oGvXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBJT3JkZXIpOiBPYnNlcnZhYmxlSW5wdXQ8SU9yZGVyPiA9PiB7XG4gICAgICAgIGlmKG9yZGVyLnBhc3NTdGF0aW9uKSB7XG4gICAgICAgICAgaWYoIW9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnF1ZXJ5TGVmdFRpY2tldHMob3JkZXIudHJhaW5EYXRlLCBvcmRlci5mcm9tU3RhdGlvbiwgb3JkZXIucGFzc1N0YXRpb24sIG9yZGVyLnBsYW5UcmFpbnMpXG4gICAgICAgICAgICAgIC5tYXAocGFzc1RyYWlucz0+IHtcbiAgICAgICAgICAgICAgICBvcmRlci5mcm9tVG9QYXNzVHJhaW5zID0gcGFzc1RyYWlucy5tYXAodHJhaW49PiB0cmFpblszXSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpO1xuICAgICAgfSlcbiAgICAgIC8vIOaMiemAlOe7j+ermei9puasoei/h+a7pFxuICAgICAgLm1hcCgob3JkZXI6IElPcmRlcik6IElPcmRlciA9PiB7XG4gICAgICAgIGlmKG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMpIHtcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSBvcmRlci50cmFpbnMuZmlsdGVyKHRyYWluID0+IG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMuaW5jbHVkZXModHJhaW5bM10pKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICB9KVxuICAgICAgLy8g5oyJ5pe26Ze06IyD5Zu06L+H5rukXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcbiAgICAgICAgaWYob3JkZXIucGxhblRpbWVzKSB7XG4gICAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG4gICAgICAgICAgb3JkZXIudHJhaW5zID0gdHJhaW5zLmZpbHRlcih0cmFpbj0+IHtcbiAgICAgICAgICAgIHJldHVybiAob3JkZXIucGxhblRpbWVzWzBdP29yZGVyLnBsYW5UaW1lc1swXTw9dHJhaW5bOF06dHJ1ZSkmJihvcmRlci5wbGFuVGltZXNbMV0/b3JkZXIucGxhblRpbWVzWzFdPj10cmFpbls4XTp0cnVlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDmoLnmja7lrZfmrrXmjpLluo9cbiAgICAgIC5tYXAoKG9yZGVyOiBJT3JkZXIpOiBJT3JkZXIgPT4ge1xuICAgICAgICBpZihvcmRlci5wbGFuT3JkZXJCeSkge1xuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IG9yZGVyLnRyYWlucy5zb3J0KHRoaXMuZmllbGRTb3J0ZXIob3JkZXIucGxhbk9yZGVyQnkpKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICB9KVxuICAgICAgLy8g6K6h566X5Y+v6LSt5Lmw6L2m5qyh5L+h5oGvXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcbiAgICAgICAgbGV0IHRyYWlucyA9IG9yZGVyLnRyYWluc3x8W107XG5cbiAgICAgICAgbGV0IHBsYW5UcmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW10sIHRoYXQgPSB0aGlzO1xuICAgICAgICB0cmFpbnMuc29tZSh0cmFpbiA9PiB7XG4gICAgICAgICAgcmV0dXJuIG9yZGVyLnNlYXRDbGFzc2VzLnNvbWUoc2VhdCA9PiB7XG4gICAgICAgICAgICB2YXIgc2VhdE51bSA9IHRoaXMuVElDS0VUX1RJVExFLmluZGV4T2Yoc2VhdCk7XG4gICAgICAgICAgICBpZih0cmFpbltzZWF0TnVtXSA9PSBcIuaciVwiIHx8IHRyYWluW3NlYXROdW1dID4gMCkge1xuICAgICAgICAgICAgICB3aW5zdG9uLmRlYnVnKG9yZGVyLnRyYWluRGF0ZStcIi9cIit0cmFpblszXStcIi9cIitzZWF0K1wiL1wiK3RyYWluW3NlYXROdW1dKTtcbiAgICAgICAgICAgICAgaWYob3JkZXIucGxhblRyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpIHtcbiAgICAgICAgICAgICAgICBwbGFuVHJhaW5zLnB1c2godHJhaW4pO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIG9yZGVyLmF2YWlsYWJsZVRyYWlucyA9IHBsYW5UcmFpbnM7XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZWN1cnNpdmVRdWVyeUxlZnRUaWNrZXQoKTogT2JzZXJ2YWJsZTxPcmRlcj4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPE9yZGVyPik9PiB7XG4gICAgICAgIG9ic2VydmVyLm5leHQodGhpcy5uZXh0T3JkZXIoKSk7XG4gICAgICB9KVxuICAgICAgLm1lcmdlTWFwKChvcmRlcjogT3JkZXIpPT50aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0RmxvdyhvcmRlcikpXG4gICAgICAuZG8oKCk9PiB7XG4gICAgICAgIGlmKHRoaXMucXVlcnkpIHtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5tYXAob3JkZXI9PiB7XG4gICAgICAgIGlmKG9yZGVyLmF2YWlsYWJsZVRyYWlucy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IGZhbHNlO1xuICAgICAgICAgIC8vIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYHt5ZWxsb3cg5pyJ5Y+v6LSt5Lmw5L2Z56WoICR7cGxhblRyYWluLnRvU3RyaW5nKCl9fWApO1xuICAgICAgICAgIG9yZGVyLnRyYWluU2VjcmV0U3RyID0gb3JkZXIuYXZhaWxhYmxlVHJhaW5zWzBdWzBdO1xuICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRoaXMucXVlcnkgPSB0cnVlO1xuICAgICAgICAgIHRocm93IGNoYWxrYOayoeacieWPr+i0reS5sOS9meelqCB7eWVsbG93ICR7b3JkZXIuZnJvbVN0YXRpb25OYW1lfX0g5YiwIHt5ZWxsb3cgJHtvcmRlci50b1N0YXRpb25OYW1lfX0gJHtvcmRlci5wYXNzU3RhdGlvbk5hbWU/J+WIsCcrb3JkZXIucGFzc1N0YXRpb25OYW1lKycgJzonJ317eWVsbG93ICR7b3JkZXIudHJhaW5EYXRlfX1gO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbyhlcnI9PnByb2Nlc3Muc3Rkb3V0LndyaXRlKGVycikpLmRlbGF5KDUwMCkpXG4gICAgICAvLyDmo4Dmn6XnlKjmiLfnmbvlvZXnirbmgIFcbiAgICAgIC8vIC5tZXJnZU1hcCgob3JkZXI6IE9yZGVyKT0+dGhpcy5vYnNlcnZhYmxlQ2hlY2tVc2VyKCkubWFwKCgpPT5vcmRlcikpXG5cbiAgICAgIC8vIFN0ZXAgMTEg6aKE5o+Q5Lqk6K6i5Y2V77yMUG9zdFxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+e1xuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2DpooTmj5DkuqTorqLljZUge3llbGxvdyAke29yZGVyLmZyb21TdGF0aW9uTmFtZX19IOWIsCB7eWVsbG93ICR7b3JkZXIudG9TdGF0aW9uTmFtZX19IOaXpeacnyB7eWVsbG93ICR7b3JkZXIudHJhaW5EYXRlfX1gKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuc3VibWl0T3JkZXJSZXF1ZXN0KG9yZGVyKSlcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZGVidWcoXCJTdWJtaXRPcmRlclJlcXVlc3QgZXJyb3IgXCIgKyBlcnIpKVxuICAgICAgICAgICAgICAgIC5kZWxheSgxMDApXG4gICAgICAgICAgKVxuICAgICAgICAgIC5tYXAoYm9keT0+W29yZGVyLCBib2R5XSk7XG4gICAgICB9KVxuICAgICAgLm1hcCgoW29yZGVyLCBib2R5XSk9PntcbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICB3aW5zdG9uLmRlYnVnKGNoYWxrYHtibHVlIFN1Ym1pdCBPcmRlciBSZXF1ZXN0IHN1Y2Nlc3MhfWApO1xuICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIC8vIOaCqOi/mOacieacquWkhOeQhueahOiuouWNlVxuICAgICAgICAgIC8vIOivpei9puasoeaaguS4jeWKnueQhuS4muWKoVxuICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YCk7XG4gICAgICAgICAgLy8gdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgdGhyb3cgY2hhbGtge3JlZC5ib2xkICR7Ym9keS5tZXNzYWdlc1swXX19YDtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIFN0ZXAgMTIg5qih5ouf6Lez6L2s6aG16Z2iSW5pdERj77yMUG9zdFxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT5cbiAgICAgICAgdGhpcy5jb25maXJtUGFzc2VuZ2VySW5pdERjKClcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICBlcnJvciQubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICAgICAgaWYoZXJyID09IHRoaXMuU1lTVEVNX0JVU1NZKSB7XG4gICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhlcnIpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgICAgICB9ZWxzZSBpZihlcnIgPT0gdGhpcy5TWVNURU1fTU9WRUQpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgKVxuICAgICAgICAgIC5kbyhvcmRlclN1Ym1pdFJlcXVlc3Q9PiB7XG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKFwiY29uZmlybVBhc3NlbmdlciBJbml0IERjIHN1Y2Nlc3MhIFwiK29yZGVyU3VibWl0UmVxdWVzdC50b2tlbik7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93ICR7b3JkZXJTdWJtaXRSZXF1ZXN0LnRpY2tldEluZm8ubGVmdERldGFpbHMuam9pbihcIlxcdFwiKX19YCk7XG4gICAgICAgICAgfSlcbiAgICAgICAgICAubWFwKG9yZGVyU3VibWl0UmVxdWVzdD0+e1xuICAgICAgICAgICAgb3JkZXIucmVxdWVzdCA9IG9yZGVyU3VibWl0UmVxdWVzdDtcblxuICAgICAgICAgICAgbGV0IGhhc1NlYXQgPSBvcmRlci5zZWF0Q2xhc3Nlcy5zb21lKChzZWF0VHlwZTogc3RyaW5nKT0+IHtcbiAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyU3VibWl0UmVxdWVzdC50aWNrZXRJbmZvLmxpbWl0QnV5U2VhdFRpY2tldERUTy50aWNrZXRfc2VhdF9jb2RlTWFwW1wiMVwiXS5zb21lKCh0aWNrZXRTZWF0Q29kZSk9PiB7XG4gICAgICAgICAgICAgICAgaWYodGlja2V0U2VhdENvZGUudmFsdWUgPT0gc2VhdFR5cGUpIHtcbiAgICAgICAgICAgICAgICAgIG9yZGVyLnNlYXRUeXBlID0gdGlja2V0U2VhdENvZGUuaWQ7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBpZighaGFzU2VhdCkge1xuICAgICAgICAgICAgICB3aW5zdG9uLmRlYnVnKFwiY29uZmlybVBhc3NlbmdlciBJbml0IOayoeacieWPr+i0reS5sOS9meelqO+8jOmHjeaWsOafpeivolwiKTtcbiAgICAgICAgICAgICAgdGhyb3cgJ3JldHJ5JztcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgIH0pXG4gICAgICApXG4gICAgICAvLyBTdGVwIDEzIOW4uOeUqOiBlOezu+S6uuehruWumu+8jFBvc3RcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgIGlmKHRoaXMucGFzc2VuZ2Vycykge1xuICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2VycyA9IHRoaXMucGFzc2VuZ2VycztcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQYXNzZW5nZXJzKG9yZGVyLnJlcXVlc3QudG9rZW4pXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICAgICAgZXJyb3IkLmRvKChlcnIpPT53aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke2Vycn19YCkpXG4gICAgICAgICAgICAgICAgLmRlbGF5KDUwMClcbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5tYXAocGFzc2VuZ2Vycz0+IHtcbiAgICAgICAgICAgICAgdGhpcy5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcbiAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcbiAgICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAvLyBTdGVwIDE0IOi0reelqOS6uuehruWumu+8jFBvc3RcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PlxuICAgICAgICB0aGlzLmNoZWNrT3JkZXJJbmZvKG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnNlYXRUeXBlLCBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMuZGF0YS5ub3JtYWxfcGFzc2VuZ2Vycywgb3JkZXIucGxhblBlcG9sZXMpXG4gICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5lcnJvcihlcnIpKS5tZXJnZU1hcChlcnI9PiB7XG4gICAgICAgICAgICAgIGlmKGVyciA9PSBcIuayoeacieebuOWFs+iBlOezu+S6ulwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDUwMClcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICAgICAgLm1hcChib2R5PT57XG4gICAgICAgICAgICBvcmRlci5yZXF1ZXN0Lm9yZGVySW5mbyA9IGJvZHk7XG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC8vIFN0ZXAgMTUg5YeG5aSH6L+b5YWl5o6S6Zif77yMUG9zdFxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+e1xuICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShjaGFsa2Dlh4blpIfov5vlhaXmjpLpmJ9gKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UXVldWVDb3VudChvcmRlci5yZXF1ZXN0LnRva2VuLCBvcmRlci5zZWF0VHlwZSwgb3JkZXIucmVxdWVzdC5vcmRlclJlcXVlc3QsIG9yZGVyLnJlcXVlc3QudGlja2V0SW5mbylcbiAgICAgICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgICAgICAvKlxuICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFsgJ+ezu+e7n+e5geW/me+8jOivt+eojeWQjumHjeivle+8gScgXSxcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XG4gICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XG4gICAgICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICB0aHJvdyBib2R5Lm1lc3NhZ2VzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5tZXJnZU1hcChlcnI9PiB7XG4gICAgICAgICAgICAgIGlmKGVyciA9PSAn57O757uf57mB5b+Z77yM6K+356iN5ZCO6YeN6K+V77yBJykge1xuICAgICAgICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKCcuJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoMTAwMCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgICAgICAgIH0pKVxuICAgICAgICAgIC5tYXAoYm9keT0+e1xuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5KTtcbiAgICAgICAgICAgIG9yZGVyLnJlcXVlc3QucXVldWVJbmZvID0gYm9keTtcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5kbygoKT0+Y29uc29sZS5sb2coKSlcbiAgICAgIH0pXG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT4ge1xuICAgICAgICAvLyDoi6UgU3RlcCAxNCDkuK3nmoQgXCJpZlNob3dQYXNzQ29kZVwiID0gXCJZXCLvvIzpgqPkuYjlpJrkuobovpPlhaXpqozor4HnoIHov5nkuIDmraXvvIxQb3N0XG4gICAgICAgIGlmKG9yZGVyLnJlcXVlc3Qub3JkZXJJbmZvLmRhdGEuaWZTaG93UGFzc0NvZGUgPT0gXCJZXCIpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlR2V0UGFzc0NvZGVOZXcob3JkZXIpO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2Yob3JkZXIpO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+e1xuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2Dmj5DkuqTmjpLpmJ/orqLljZVgKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZmlybVNpbmdsZUZvclF1ZXVlKG9yZGVyLnJlcXVlc3QudG9rZW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5zZWF0VHlwZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucGxhblBlcG9sZXMpXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRlbGF5KDEwMCkpXG4gICAgICAgICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgICAgICAgIGlmKGJvZHkuc3RhdHVzICYmIGJvZHkuZGF0YS5zdWJtaXRTdGF0dXMpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgICAgICBkYXRhOiB7IGVyck1zZzogJ+S9meelqOS4jei2s++8gScsIHN1Ym1pdFN0YXR1czogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7Ym9keS5kYXRhLmVyck1zZ319YClcbiAgICAgICAgICAgICAgICB0aHJvdyAncmV0cnknO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgfSlcbiAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGNoYWxrYHt5ZWxsb3cuYm9sZCAke2Vycn19YCkpXG4gICAgICAgICAgLm1lcmdlTWFwKChlcnIpPT4ge1xuICAgICAgICAgICAgaWYoZXJyID09ICdyZXRyeScpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgKTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUdldFBhc3NlbmdlcnMob3JkZXI6IE9yZGVyKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT5cbiAgICAgICAgdGhpcy5nZXRQYXNzZW5nZXJzKG9yZGVyLnJlcXVlc3QudG9rZW4pXG4gICAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICAgICAgZXJyb3IkLmRvKChlcnIpPT53aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke2Vycn19YCkpXG4gICAgICAgICAgICAgICAgLmRlbGF5KDUwMClcbiAgICAgICAgICAgIClcbiAgICAgIClcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUdldFBhc3NDb2RlTmV3KG9yZGVyOiBPcmRlcik6IE9ic2VydmFibGU8YW55PiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5zd2l0Y2hNYXAoKCk9PiB0aGlzLmdldFBhc3NDb2RlTmV3KCkpXG4gICAgICAuc3dpdGNoTWFwKCgpPT4gdGhpcy5jaGVja1JhbmRDb2RlQW5zeW4oKSlcbiAgfVxuXG4gIHByaXZhdGUgYnVpbGRPcmRlckZsb3coKSB7XG5cbiAgICAvLyDliJ3lp4vljJbmn6Xor6LngavovabkvZnnpajpobXpnaJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmxlZnRUaWNrZXRJbml0KCkpXG4gICAgICAuc3dpdGNoTWFwKCgpPT50aGlzLnJlY3Vyc2l2ZVF1ZXJ5TGVmdFRpY2tldCgpKVxuICAgICAgLy8gU3RlcCAxOCDmn6Xor6LmjpLpmJ/nrYnlvoXml7bpl7TvvIFcbiAgICAgIC5zdWJzY3JpYmUoXG4gICAgICAgIChvcmRlcjogT3JkZXIpPT4ge1xuICAgICAgICAgIHRoaXMub2JzUXVlcnlPcmRlcldhaXRUKG9yZGVyKVxuICAgICAgICAgICAgLm1lcmdlTWFwKChvcmRlcklkKT0+dGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkpXG4gICAgICAgICAgICAuZG8oKGJvZHkpPT4ge1xuICAgICAgICAgICAgICBpZihib2R5LmRhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnByaW50TXlPcmRlck5vQ29tcGxldGUoYm9keSk7XG4gICAgICAgICAgICAgICAgLy8gMC4156eS5ZON5LiA5qyh77yM5ZON6ZODMzDliIbpkp9cbiAgICAgICAgICAgICAgICBiZWVwZXIoNjAqMzAqMik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT4ge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg57uT5p2ffWApO1xuICAgICAgICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgICAgICB9LGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YCkpO1xuICAgICAgICB9LFxuICAgICAgICBlcnI9PntcbiAgICAgICAgICB3aW5zdG9uLmVycm9yKGNoYWxrYHtyZWQuYm9sZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUNoZWNrVXNlcigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcblxuICAgIC8vIFN0ZXAgMTAg6aqM6K+B55m75b2V77yMUG9zdFxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCkgPT4gdGhpcy5jaGVja1VzZXIoKSlcbiAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZG8oKGVycik9PmNvbnNvbGUuZXJyb3IoXCJDaGVjayB1c2VyIGVycm9yIFwiK2VycikpKVxuICAgICAgLm1lcmdlTWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKGJvZHkuZGF0YS5mbGFnKSB7XG4gICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUub2YoYm9keSk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNRdWVyeU9yZGVyV2FpdFQob3JkZXI6IE9yZGVyKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgICAgLm1lcmdlTWFwKCgpPT4gdGhpcy5xdWVyeU9yZGVyV2FpdFRpbWUoXCJcIikpXG4gICAgICAgIC5tYXAob3JkZXJRdWV1ZT0+IHtcbiAgICAgICAgICB3aW5zdG9uLmRlYnVnKEpTT04uc3RyaW5naWZ5KG9yZGVyUXVldWUpKTtcbiAgICAgICAgICAvKipcbiAgICAgICAgICB7XG4gICAgICAgICAgICBcInZhbGlkYXRlTWVzc2FnZXNTaG93SWRcIjogXCJfdmFsaWRhdG9yTWVzc2FnZVwiLFxuICAgICAgICAgICAgXCJzdGF0dXNcIjogdHJ1ZSxcbiAgICAgICAgICAgIFwiaHR0cHN0YXR1c1wiOiAyMDAsXG4gICAgICAgICAgICBcImRhdGFcIjoge1xuICAgICAgICAgICAgICBcInF1ZXJ5T3JkZXJXYWl0VGltZVN0YXR1c1wiOiB0cnVlLFxuICAgICAgICAgICAgICBcImNvdW50XCI6IDAsXG4gICAgICAgICAgICAgIFwid2FpdFRpbWVcIjogMjQ0NCxcbiAgICAgICAgICAgICAgXCJyZXF1ZXN0SWRcIjogNjM3NjcyNzI4NTYzNDc5NzAwMCxcbiAgICAgICAgICAgICAgXCJ3YWl0Q291bnRcIjogMjAwMCxcbiAgICAgICAgICAgICAgXCJ0b3VyRmxhZ1wiOiBcImRjXCIsXG4gICAgICAgICAgICAgIFwib3JkZXJJZFwiOiBudWxsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgXCJtZXNzYWdlc1wiOiBbXSxcbiAgICAgICAgICAgIFwidmFsaWRhdGVNZXNzYWdlc1wiOiB7fVxuICAgICAgICAgIH1cbiAgICAgICAgICAqL1xuICAgICAgICAgIGlmKG9yZGVyUXVldWUuc3RhdHVzKSB7XG4gICAgICAgICAgICBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IDAgfHwgb3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMSkge1xuICAgICAgICAgICAgICAvL3JldHVybiBjb25zb2xlLmxvZyhjaGFsa2DmgqjnmoTovabnpajorqLljZXlj7fmmK8ge3JlZC5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLm9yZGVySWR9fWApO1xuICAgICAgICAgICAgICByZXR1cm4gb3JkZXJRdWV1ZS5kYXRhLm9yZGVySWQ7XG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0yKXtcbiAgICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLm1zZykge1xuICAgICAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEubXNnfX1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0aHJvdyBvcmRlclF1ZXVlLmRhdGEubXNnO1xuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMyl7XG4gICAgICAgICAgICAgIHRocm93IFwi5oKo55qE6L2m56Wo6K6i5Y2V5bey57uP5Y+W5raIIVwiO1xuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtNCl7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwi5oKo55qE6L2m56Wo6K6i5Y2V5q2j5Zyo5aSE55CGLCDor7fnqI3nrYkuLi5cIik7XG4gICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYOaOkumYn+S6uuaVsO+8mnt5ZWxsb3cuYm9sZCAke29yZGVyUXVldWUuZGF0YS53YWl0Q291bnR9fSDpooTorqHnrYnlvoXml7bpl7TvvJp7eWVsbG93LmJvbGQgJHtwYXJzZUludChvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgLyAxLjUpfX0g5YiG6ZKfYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93ICdyZXRyeSc7XG4gICAgICAgIH0pXG4gICAgICAgIC5yZXRyeVdoZW4oKGVycm9ycyQpPT5lcnJvcnMkLm1lcmdlTWFwKChlcnIpPT4ge1xuICAgICAgICAgICAgaWYoZXJyID09ICdyZXRyeScpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNDAwMClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XG4gICAgICAgICAgfSlcbiAgICAgICAgKVxuICAgICAgICA7XG4gIH1cblxuICAvKipcbiAgICog5p+l6K+i5YiX6L2m5L2Z56Wo5L+h5oGvXG4gICAqXG4gICAqIEBwYXJhbSB0cmFpbkRhdGUg5LmY6L2m5pel5pyfXG4gICAqIEBwYXJhbSBmcm9tU3RhdGlvbk5hbWUg5Ye65Y+R56uZXG4gICAqIEBwYXJhbSB0b1N0YXRpb25OYW1lIOWIsOi+vuermVxuICAgKiBAcGFyYW0gdHJhaW5OYW1lcyDliJfovaZcbiAgICpcbiAgICogQHJldHVybiBQcm9taXNlXG4gICAqL1xuICBwdWJsaWMgcXVlcnlMZWZ0VGlja2V0cyh0cmFpbkRhdGU6IHN0cmluZywgZnJvbVN0YXRpb246IHN0cmluZywgdG9TdGF0aW9uOiBzdHJpbmcsIHRyYWluTmFtZXM/OiBSZWFkb25seUFycmF5PHN0cmluZz4pOiBPYnNlcnZhYmxlPEFycmF5PGFueT4+IHtcbiAgICBpZighdHJhaW5EYXRlKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeS5mOi9puaXpeacn31gKTtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCfor7fovpPlhaXkuZjovabml6XmnJ8nKTtcbiAgICB9XG4gICAgLy8gdGhpcy5CQUNLX1RSQUlOX0RBVEUgPSB0cmFpbkRhdGU7XG5cbiAgICBpZighZnJvbVN0YXRpb24pIHtcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5Ye65Y+R56uZfWApO1xuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coJ+ivt+i+k+WFpeWHuuWPkeermScpO1xuICAgIH1cbiAgICAvLyB0aGlzLkZST01fU1RBVElPTl9OQU1FID0gZnJvbVN0YXRpb25OYW1lO1xuXG4gICAgaWYoIXRvU3RhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXliLDovr7nq5l9YCk7XG4gICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdygn6K+36L6T5YWl5Yiw6L6+56uZJyk7XG4gICAgfVxuICAgIC8vIHRoaXMuVE9fU1RBVElPTl9OQU1FID0gdG9TdGF0aW9uTmFtZTtcblxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMucXVlcnlMZWZ0VGlja2V0KHt0cmFpbkRhdGU6IHRyYWluRGF0ZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZyb21TdGF0aW9uOiBmcm9tU3RhdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvU3RhdGlvbjogdG9TdGF0aW9ufSlcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAvLyAucmV0cnkoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpXG4gICAgICAucmV0cnlXaGVuKChlcnJvcnMkKT0+ZXJyb3JzJC5kbygoKT0+cHJvY2Vzcy5zdGRvdXQud3JpdGUoXCIuXCIpKS5kZWxheSgxNTAwKSlcbiAgICAgIC5tYXAodHJhaW5zRGF0YSA9PiB0cmFpbnNEYXRhLnJlc3VsdClcbiAgICAgIC5tYXAocmVzdWx0ID0+IHtcbiAgICAgICAgbGV0IHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4gPSBbXTtcblxuICAgICAgICByZXN1bHQuZm9yRWFjaCgoZWxlbWVudDogc3RyaW5nKT0+IHtcbiAgICAgICAgICBsZXQgdHJhaW46IEFycmF5PHN0cmluZz4gPSBlbGVtZW50LnNwbGl0KFwifFwiKTtcbiAgICAgICAgICB0cmFpbls0XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNF0pO1xuICAgICAgICAgIHRyYWluWzVdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls1XSk7XG4gICAgICAgICAgdHJhaW5bNl0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzZdKTtcbiAgICAgICAgICB0cmFpbls3XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bN10pO1xuICAgICAgICAgIHRyYWluWzExXSA9IHRyYWluWzExXSA9PSBcIklTX1RJTUVfTk9UX0JVWVwiID8gXCLliJfovablgZzov5BcIjp0cmFpblsxMV07XG4gICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiTlwiID8gXCLml6DnpahcIjp0cmFpblsxMV07XG4gICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiWVwiID8gXCLmnInnpahcIjp0cmFpblsxMV07XG4gICAgICAgICAgLy8g5Yy56YWN6L6T5YWl55qE5YiX6L2m5ZCN56ew55qE5q2j5YiZ6KGo6L6+5byP5p2h5Lu2XG4gICAgICAgICAgaWYoIXRyYWluTmFtZXMgfHwgdHJhaW5OYW1lcy5maWx0ZXIodG49PnRyYWluWzNdLm1hdGNoKG5ldyBSZWdFeHAodG4pKSAhPSBudWxsKS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB0cmFpbnMucHVzaCh0cmFpbik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHRyYWlucztcbiAgICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xuICAgKlxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcbiAgICogQHBhcmFtIHBhc3NTdGF0aW9uTmFtZSDpgJTnu4/nq5lcbiAgICogQHBhcmFtIHRyYWluTmFtZXMg5YiX6L2mXG4gICAqIEBwYXJhbSBmIOi9puasoei/h+a7pOadoeS7tlxuICAgKiBAcGFyYW0gdCDml7bpl7Tov4fmu6TmnaHku7ZcbiAgICpcbiAgICogQHJldHVybiB2b2lkXG4gICAqL1xuICBwdWJsaWMgbGVmdFRpY2tldHMoW3RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWVdLCB7ZmlsdGVyLGYsdGltZSx0LG9yZGVyYnksb30pIHtcbiAgICBsZXQgZnJvbVN0YXRpb246IHN0cmluZyA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUoZnJvbVN0YXRpb25OYW1lKTtcbiAgICBsZXQgdG9TdGF0aW9uOiBzdHJpbmcgPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKHRvU3RhdGlvbk5hbWUpO1xuICAgIGxldCBwYXNzU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShwYXNzU3RhdGlvbk5hbWUpO1xuXG4gICAgbGV0IHBsYW5UcmFpbnM6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPnx1bmRlZmluZWQgPVxuICAgICAgdHlwZW9mIGYgPT0gXCJzdHJpbmdcIiA/IGYuc3BsaXQoJywnKToodHlwZW9mIGZpbHRlciA9PSBcInN0cmluZ1wiID8gZmlsdGVyLnNwbGl0KCcsJyk6dW5kZWZpbmVkKTtcbiAgICBsZXQgcGxhblRpbWVzOiBSZWFkb25seUFycmF5PHN0cmluZz58dW5kZWZpbmVkID1cbiAgICAgIHR5cGVvZiB0ID09IFwic3RyaW5nXCIgPyB0LnNwbGl0KCcsJyk6KHR5cGVvZiB0aW1lID09IFwic3RyaW5nXCIgPyB0aW1lLnNwbGl0KCcsJyk6dW5kZWZpbmVkKTtcbiAgICBsZXQgcGxhbk9yZGVyQnk6IEFycmF5PHN0cmluZ3xudW1iZXI+fHVuZGVmaW5lZCA9XG4gICAgICB0eXBlb2YgbyA9PSBcInN0cmluZ1wiID8gby5zcGxpdCgnLCcpOih0eXBlb2Ygb3JkZXJieSA9PSBcInN0cmluZ1wiID8gb3JkZXJieS5zcGxpdCgnLCcpOnVuZGVmaW5lZCk7XG5cbiAgICBpZihwbGFuT3JkZXJCeSkge1xuICAgICAgcGxhbk9yZGVyQnkgPSBwbGFuT3JkZXJCeS5tYXAoKGZpZWxkTmFtZTpzdHJpbmd8bnVtYmVyKSA9PiB7XG4gICAgICAgIGlmKGZpZWxkTmFtZVswXSA9PT0gJy0nIHx8IGZpZWxkTmFtZVswXSA9PT0gJysnKSB7XG4gICAgICAgICAgcmV0dXJuIGZpZWxkTmFtZVswXSt0aGlzLlRJQ0tFVF9USVRMRS5pbmRleE9mKGZpZWxkTmFtZS5zdWJzdHJpbmcoMSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLlRJQ0tFVF9USVRMRS5pbmRleE9mKGZpZWxkTmFtZSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0aGlzLmJ1aWxkUXVlcnlMZWZ0VGlja2V0Rmxvdyh7XG4gICAgICAgIHRyYWluRGF0ZTogdHJhaW5EYXRlXG4gICAgICAgICxiYWNrVHJhaW5EYXRlOiB0cmFpbkRhdGVcbiAgICAgICAgLGZyb21TdGF0aW9uTmFtZTogZnJvbVN0YXRpb25OYW1lXG4gICAgICAgICx0b1N0YXRpb25OYW1lOiB0b1N0YXRpb25OYW1lXG4gICAgICAgICxmcm9tU3RhdGlvbjogZnJvbVN0YXRpb25cbiAgICAgICAgLHRvU3RhdGlvbjogdG9TdGF0aW9uXG4gICAgICAgICxwYXNzU3RhdGlvbjogcGFzc1N0YXRpb25cbiAgICAgICAgLHBsYW5UcmFpbnM6IHBsYW5UcmFpbnNcbiAgICAgICAgLHBsYW5UaW1lczogcGxhblRpbWVzXG4gICAgICAgICxwbGFuT3JkZXJCeTogcGxhbk9yZGVyQnlcbiAgICAgICAgLHNlYXRDbGFzc2VzOiBbXVxuICAgICAgfSlcbiAgICAgIC5zdWJzY3JpYmUoKG9yZGVyOiBJT3JkZXIpID0+IHtcbiAgICAgICAgbGV0IHRyYWlucyA9IHRoaXMucmVuZGVyVHJhaW5MaXN0VGl0bGUob3JkZXIudHJhaW5zKTtcbiAgICAgICAgaWYodHJhaW5zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHJldHVybiBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOayoeacieespuWQiOadoeS7tueahOi9puasoX1gKVxuICAgICAgICB9XG4gICAgICAgIHRoaXMucmVuZGVyTGVmdFRpY2tldHModHJhaW5zKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSByZW5kZXJUcmFpbkxpc3RUaXRsZSh0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+KTogQXJyYXk8QXJyYXk8c3RyaW5nPj4ge1xuICAgIHZhciB0aXRsZSA9IHRoaXMuVElDS0VUX1RJVExFLm1hcCh0PT5jaGFsa2B7Ymx1ZSAke3R9fWApO1xuXG4gICAgdHJhaW5zLmZvckVhY2goKHRyYWluLCBpbmRleCk9PiB7XG4gICAgICBpZihpbmRleCAlIDMwID09PSAwKSB7XG4gICAgICAgIHRyYWlucy5zcGxpY2UoaW5kZXgsIDAsIHRpdGxlKTtcbiAgICAgIH1cbiAgICB9KVxuICAgIHJldHVybiB0cmFpbnM7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlckxlZnRUaWNrZXRzKHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4pIHtcbiAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0cmFpbnMsIHtcbiAgICAgIGNvbHVtblNwbGl0dGVyOiAnfCcsXG4gICAgICBjb2x1bW5zOiBbXCIzXCIsIFwiNFwiLCBcIjVcIiwgXCI2XCIsIFwiN1wiLCBcIjhcIiwgXCI5XCIsIFwiMTBcIiwgXCIxMVwiLCBcIjIwXCIsIFwiMjFcIiwgXCIyMlwiLCBcIjIzXCIsIFwiMjRcIiwgXCIyNVwiLFxuICAgICAgICAgICAgICAgIFwiMjZcIiwgXCIyN1wiLCBcIjI4XCIsIFwiMjlcIiwgXCIzMFwiLCBcIjMxXCIsIFwiMzJcIl1cbiAgICB9KVxuXG4gICAgY29uc29sZS5sb2coY29sdW1ucyk7XG4gIH1cblxuICBwdWJsaWMgbXlPcmRlck5vQ29tcGxldGVSZXBvcnQoKSB7XG4gICAgdGhpcy5pbml0Tm9Db21wbGV0ZSgpXG4gICAgICAubWVyZ2VNYXAoKCk9PlxuICAgICAgICB0aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKVxuICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZGVsYXkoNTAwKSlcbiAgICAgIClcbiAgICAgIC5zdWJzY3JpYmUoeD0+IHtcbiAgICAgICAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh4LCB7XG4gICAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJyB8ICdcbiAgICAgICAgICB9KTtcblxuICAgICAgICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xuICAgICAgICB9LCBlcnJvcj0+IHtcbiAgICAgICAgICB3aW5zdG9uLmVycm9yKGVycm9yKTtcbiAgICAgICAgfSlcbiAgfVxuXG4gIHB1YmxpYyBsb2dpbkluaXQoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sb2dpbi9pbml0XCI7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybCxcbiAgICAgIG1ldGhvZDogXCJHRVRcIixcbiAgICAgIGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRDYXB0Y2hhKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgXCJsb2dpbl9zaXRlXCI6IFwiRVwiLFxuICAgICAgICAgIFwibW9kdWxlXCI6IFwibG9naW5cIixcbiAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIixcbiAgICAgICAgICBcIjAuMTcyMzE4NzI3MDMzODkwNjJcIjpcIlwiXG4gICAgICB9O1xuXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KGRhdGEsIG51bGwsIG51bGwpXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L2NhcHRjaGEvY2FwdGNoYS1pbWFnZT9cIitwYXJhbTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgfTtcblxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPHZvaWQ+KT0+IHtcbiAgICAgIHRoaXMucmF3UmVxdWVzdChvcHRpb25zLCAoZXJyb3I6IGFueSwgcmVzcG9uc2U6IGFueSwgYm9keTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGlmKGVycm9yKSByZXR1cm4gb2JzZXJ2ZXIuZXJyb3IoZXJyb3IpO1xuICAgICAgfSkucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShcImNhcHRjaGEuQk1QXCIpKS5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgcXVlc3Rpb25DYXB0Y2hhKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXG4gICAgICBvdXRwdXQ6IHByb2Nlc3Muc3Rkb3V0XG4gICAgfSk7XG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8c3RyaW5nPik9PiB7XG4gICAgICBsZXQgY2hpbGQgPSBjaGlsZF9wcm9jZXNzLmV4ZWMoJ2NhcHRjaGEuQk1QJywoKT0+e30pO1xuXG4gICAgICBybC5xdWVzdGlvbihjaGFsa2B7cmVkLmJvbGQg6K+36L6T5YWl6aqM6K+B56CBfTpgLCAocG9zaXRpb25TdHIpID0+IHtcbiAgICAgICAgcmwuY2xvc2UoKTtcblxuICAgICAgICBpZih0eXBlb2YgcG9zaXRpb25TdHIgPT0gXCJzdHJpbmdcIikge1xuICAgICAgICAgIGxldCBwb3NpdGlvbnM6IEFycmF5PHN0cmluZz4gPSBbXTtcbiAgICAgICAgICBwb3NpdGlvblN0ci5zcGxpdCgnLCcpLmZvckVhY2goZWw9PnBvc2l0aW9ucz1wb3NpdGlvbnMuY29uY2F0KGVsLnNwbGl0KCcgJykpKTtcbiAgICAgICAgICBvYnNlcnZlci5uZXh0KHBvc2l0aW9ucy5tYXAoKHBvc2l0aW9uOiBzdHJpbmcpPT4ge1xuICAgICAgICAgICAgICBzd2l0Y2gocG9zaXRpb24pIHtcbiAgICAgICAgICAgICAgICBjYXNlIFwiMVwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiNDAsNDVcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiMlwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTEwLDQ1XCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjNcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjE4MCw0NVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI0XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIyNTAsNDVcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiNVwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiNDAsMTEwXCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjZcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjExMCwxMTBcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiN1wiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTgwLDExMFwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI4XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIyNTAsMTEwXCI7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pLmpvaW4oJywnKSk7XG4gICAgICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xuICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgIG9ic2VydmVyLmVycm9yKFwi6L6T5YWl5qC85byP6ZSZ6K+vXCIpO1xuICAgICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBjaGVja0NhcHRjaGEoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L2NhcHRjaGEvY2FwdGNoYS1jaGVja1wiO1xuXG4gICAgcmV0dXJuIHRoaXMucXVlc3Rpb25DYXB0Y2hhKClcbiAgICAgIC5tZXJnZU1hcChwb3NpdGlvbnM9PntcbiAgICAgICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgICBcImFuc3dlclwiOiBwb3NpdGlvbnMsXG4gICAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXG4gICAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIlxuICAgICAgICAgIH07XG5cbiAgICAgICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICAgICAgdXJsOiB1cmxcbiAgICAgICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgICAgICAgLG1ldGhvZDogJ1BPU1QnXG4gICAgICAgICAgLGZvcm06IGRhdGFcbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcbiAgICAgICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDQpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aHJvdyBib2R5LnJlc3VsdF9tZXNzYWdlO1xuICAgICAgICAgIH0pO1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHVzZXJBdXRoZW50aWNhdGUoKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICAvLyDlj5HpgIHnmbvlvZXkv6Hmga9cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcbiAgICAgICAgICAsXCJ1c2VybmFtZVwiOiB0aGlzLnVzZXJOYW1lXG4gICAgICAgICAgLFwicGFzc3dvcmRcIjogdGhpcy51c2VyUGFzc3dvcmRcbiAgICAgICAgfTtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvbG9naW5cIjtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDIpIHtcbiAgICAgICAgICB0aHJvdyBib2R5LnJlc3VsdF9tZXNzYWdlO1xuICAgICAgICB9ZWxzZSBpZihib2R5LnJlc3VsdF9jb2RlICE9IDApIHtcbiAgICAgICAgICB0aHJvdyBib2R5O1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHkudWFtdGs7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXROZXdBcHBUb2tlbigpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxuICAgICAgfTtcblxuICAgIHZhciBvcHRpb25zID17XG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9hdXRoL3VhbXRrXCJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICB3aW5zdG9uLmRlYnVnKGJvZHkpO1xuICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcbiAgICAgICAgICByZXR1cm4gYm9keS5uZXdhcHB0aztcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRocm93IGJvZHk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRBcHBUb2tlbihuZXdhcHB0azogc3RyaW5nKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICBcInRrXCI6IG5ld2FwcHRrXG4gICAgICB9O1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vdWFtYXV0aGNsaWVudFwiXG4gICAgICAsaGVhZGVyczoge1xuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxuICAgICAgICAsXCJIb3N0XCI6IFwia3lmdy4xMjMwNi5jblwiXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcbiAgICAgICAgLCdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJ1xuICAgICAgfVxuICAgICAgLG1ldGhvZDogJ1BPU1QnXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIHdpbnN0b24uZGVidWcoYm9keS5yZXN1bHRfbWVzc2FnZSk7XG4gICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xuICAgICAgICAgIHJldHVybiBib2R5LmFwcHRrO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdGhyb3cgYm9keTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICAvLyBwcml2YXRlIGdldE15MTIzMDYoKTogUHJvbWlzZSB7XG4gIC8vICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xuICAvLyAgICAgdGhpcy5yZXF1ZXN0KHtcbiAgLy8gICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vaW5kZXgvaW5pdE15MTIzMDZcIlxuICAvLyAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgLy8gICAgICAsbWV0aG9kOiBcIkdFVFwifSxcbiAgLy8gICAgICAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgLy8gICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XG4gIC8vICAgICAgICAgY29uc29sZS5sb2coXCJHb3QgbXkgMTIzMDZcIik7XG4gIC8vICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcbiAgLy8gICAgICAgfVxuICAvLyAgICAgICByZWplY3QoKTtcbiAgLy8gICAgIH0pO1xuICAvLyAgIH0pO1xuICAvLyB9XG5cbiAgcHJpdmF0ZSBjaGVja0F1dGhlbnRpY2F0aW9uKGNvb2tpZXM6IG9iamVjdCkge1xuICAgIHZhciB1YW10ayA9IFwiXCIsIHRrID0gXCJcIjtcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYoY29va2llc1tpXS5rZXkgPT0gXCJ1YW10a1wiKSB7XG4gICAgICAgIHVhbXRrID0gY29va2llc1tpXS52YWx1ZTtcbiAgICAgIH1cblxuICAgICAgaWYoY29va2llc1tpXS5rZXkgPT0gXCJ0a1wiKSB7XG4gICAgICAgIHRrID0gY29va2llc1tpXS52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHVhbXRrOiB1YW10ayxcbiAgICAgIHRrOiB0a1xuICAgIH07XG4gIH1cblxuICBwcml2YXRlIGxlZnRUaWNrZXRJbml0KCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCI7XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHVybCk7XG4gIH1cblxuICBwcml2YXRlIHF1ZXJ5TGVmdFRpY2tldCh7dHJhaW5EYXRlLCBmcm9tU3RhdGlvbiwgdG9TdGF0aW9ufSk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHF1ZXJ5ID0ge1xuICAgICAgXCJsZWZ0VGlja2V0RFRPLnRyYWluX2RhdGVcIjogdHJhaW5EYXRlXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLmZyb21fc3RhdGlvblwiOiBmcm9tU3RhdGlvblxuICAgICAgLFwibGVmdFRpY2tldERUTy50b19zdGF0aW9uXCI6IHRvU3RhdGlvblxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIkFEVUxUXCJcbiAgICB9XG5cbiAgICB2YXIgcGFyYW0gPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkocXVlcnkpO1xuXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L3F1ZXJ5Wj9cIitwYXJhbTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXJsKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZighYm9keSkge1xuICAgICAgICAgIHRocm93IFwi57O757uf6L+U5Zue5peg5pWw5o2uXCI7XG4gICAgICAgIH1cbiAgICAgICAgaWYoYm9keS5pbmRleE9mKFwi6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMCkge1xuICAgICAgICAgIHRocm93IFwi57O757uf57mB5b+ZIVwiO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShib2R5KS5kYXRhO1xuICAgICAgICAgIH1jYXRjaChlcnIpIHtcbiAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gUmVzb2x2ZWRcbiAgICAgICAgICByZXR1cm4gZGF0YTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrVXNlcigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2NoZWNrVXNlclwiO1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzdWJtaXRPcmRlclJlcXVlc3Qoe3RyYWluU2VjcmV0U3RyLCB0cmFpbkRhdGUsIGJhY2tUcmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZX0pOiBPYnNlcnZhYmxlPG9iamVjdD4gIHtcblxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9zdWJtaXRPcmRlclJlcXVlc3RcIjtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJzZWNyZXRTdHJcIjogcXVlcnlzdHJpbmcudW5lc2NhcGUodHJhaW5TZWNyZXRTdHIpXG4gICAgICAsXCJ0cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxuICAgICAgLFwiYmFja190cmFpbl9kYXRlXCI6IGJhY2tUcmFpbkRhdGVcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXG4gICAgICAsXCJxdWVyeV9mcm9tX3N0YXRpb25fbmFtZVwiOiBmcm9tU3RhdGlvbk5hbWVcbiAgICAgICxcInF1ZXJ5X3RvX3N0YXRpb25fbmFtZVwiOiB0b1N0YXRpb25OYW1lXG4gICAgICAsXCJ1bmRlZmluZWRcIjpcIlwiXG4gICAgfTtcblxuICAgIC8vIHVybCA9IHVybCArIFwic2VjcmV0U3RyPVwiK3NlY3JldFN0citcIiZ0cmFpbl9kYXRlPTIwMTgtMDEtMzEmYmFja190cmFpbl9kYXRlPTIwMTgtMDEtMzAmdG91cl9mbGFnPWRjJnB1cnBvc2VfY29kZXM9QURVTFQmcXVlcnlfZnJvbV9zdGF0aW9uX25hbWU95LiK5rW3JnF1ZXJ5X3RvX3N0YXRpb25fbmFtZT3lvpDlt57kuJwmdW5kZWZpbmVkXCI7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1QYXNzZW5nZXJJbml0RGMoKTogT2JzZXJ2YWJsZTxPcmRlclN1Ym1pdFJlcXVlc3Q+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXG4gICAgICAgICxcIlVwZ3JhZGUtSW5zZWN1cmUtUmVxdWVzdHNcIjoxXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcbiAgICAgICAgICB0aHJvdyB0aGlzLlNZU1RFTV9CVVNTWTtcbiAgICAgICAgfVxuICAgICAgICBpZihib2R5KSB7XG4gICAgICAgICAgLy8gR2V0IFJlcGVhdCBTdWJtaXQgVG9rZW5cbiAgICAgICAgICB2YXIgdG9rZW4gPSBib2R5Lm1hdGNoKC92YXIgZ2xvYmFsUmVwZWF0U3VibWl0VG9rZW4gPSAnKC4qPyknOy8pO1xuICAgICAgICAgIHZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSA9IGJvZHkubWF0Y2goL3ZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybT0oLio/KTsvKTtcbiAgICAgICAgICB2YXIgb3JkZXJSZXF1ZXN0RFRPID0gYm9keS5tYXRjaCgvdmFyIG9yZGVyUmVxdWVzdERUTz0oLio/KTsvKTtcbiAgICAgICAgICBpZih0b2tlbikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgdG9rZW46IHRva2VuWzFdXG4gICAgICAgICAgICAgICx0aWNrZXRJbmZvOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSYmSlNPTi5wYXJzZSh0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybVsxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcbiAgICAgICAgICAgICAgLG9yZGVyUmVxdWVzdDogb3JkZXJSZXF1ZXN0RFRPJiZKU09OLnBhcnNlKG9yZGVyUmVxdWVzdERUT1sxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldFBhc3NlbmdlcnModG9rZW46IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2dldFBhc3NlbmdlckRUT3NcIjtcblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxuICAgIH07XG5cbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKTtcbiAgfVxuXG4gIC8qIHNlYXQgdHlwZVxuICDigJjova/ljafigJkgPT4g4oCYNOKAmSxcbiAg4oCY5LqM562J5bqn4oCZID0+IOKAmE/igJksXG4gIOKAmOS4gOetieW6p+KAmSA9PiDigJhN4oCZLFxuICDigJjnoazluqfigJkgPT4g4oCYMeKAmSxcbiAgICovXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2VyVGlja2V0cyhzZWF0VHlwZSwgcGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy/luqfkvY3nsbvlnossMCznpajnsbvlnoso5oiQ5Lq6L+WEv+erpSksbmFtZSzouqvku73nsbvlnoso6Lqr5Lu96K+BL+WGm+WumOivgS4uLi4pLOi6q+S7veivgSznlLXor53lj7fnoIEs5L+d5a2Y54q25oCBXG4gICAgICAgIHZhciB0aWNrZXQgPSAvKnBhc3Nlbmdlci5zZWF0X3R5cGUqLyBzZWF0VHlwZSArXG4gICAgICAgICAgICAgICAgXCIsMCxcIiArXG4gICAgICAgICAgICAgICAgLypsaW1pdF90aWNrZXRzW2FBXS50aWNrZXRfdHlwZSovXCIxXCIgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgKHBhc3Nlbmdlci5waG9uZV9ubyB8fCBcIlwiICkgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCJOXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIik7XG4gIH1cblxuICBwcml2YXRlIGdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBzdHJpbmcge1xuICAgIHZhciB0aWNrZXRzID0gW107XG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcbiAgICAgIGlmKHBsYW5QZXBvbGVzLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcbiAgICAgICAgLy9uYW1lLOi6q+S7veexu+Weiyzouqvku73or4EsMV9cbiAgICAgICAgdmFyIHRpY2tldCA9XG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXG4gICAgICAgICAgICAgICAgXCIxXCI7XG4gICAgICAgIHRpY2tldHMucHVzaCh0aWNrZXQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBzZWF0VHlwZSwgcGFzc2VuZ2VycywgcGxhblBlcG9sZXMpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jaGVja09yZGVySW5mb1wiO1xuXG4gICAgdmFyIHBhc3NlbmdlclRpY2tldFN0ciA9IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhzZWF0VHlwZSwgcGFzc2VuZ2VycywgcGxhblBlcG9sZXMpO1xuICAgIGlmKCFwYXNzZW5nZXJUaWNrZXRTdHIpIHtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpO1xuICAgIH1cblxuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJjYW5jZWxfZmxhZ1wiOiAyXG4gICAgICAsXCJiZWRfbGV2ZWxfb3JkZXJfbnVtXCI6IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCJcbiAgICAgICxcInBhc3NlbmdlclRpY2tldFN0clwiOiBwYXNzZW5nZXJUaWNrZXRTdHJcbiAgICAgICxcIm9sZFBhc3NlbmdlclN0clwiOiB0aGlzLmdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXG4gICAgICAsXCJyYW5kQ29kZVwiOiBcIlwiXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOjFcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHN1Ym1pdFRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIC8qXG4gICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgdXJsOiAnL2xlZnRUaWNrZXQvaW5pdCcsXG4gICAgICAgICAgICBzdGF0dXM6IGZhbHNlLFxuICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgbWVzc2FnZXM6IFsgJ+ezu+e7n+W/me+8jOivt+eojeWQjumHjeivlScgXSxcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICovXG4gICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0aHJvdyBib2R5Lm1lc3NhZ2VzWzBdO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UXVldWVDb3VudCh0b2tlbiwgc2VhdFR5cGUsIG9yZGVyUmVxdWVzdERUTywgdGlja2V0SW5mbyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2dldFF1ZXVlQ291bnRcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwidHJhaW5fZGF0ZVwiOiBuZXcgRGF0ZShvcmRlclJlcXVlc3REVE8udHJhaW5fZGF0ZS50aW1lKS50b1N0cmluZygpXG4gICAgICAsXCJ0cmFpbl9ub1wiOiBvcmRlclJlcXVlc3REVE8udHJhaW5fbm9cbiAgICAgICxcInN0YXRpb25UcmFpbkNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLnN0YXRpb25fdHJhaW5fY29kZVxuICAgICAgLFwic2VhdFR5cGVcIjogc2VhdFR5cGVcbiAgICAgICxcImZyb21TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLmZyb21fc3RhdGlvbl90ZWxlY29kZVxuICAgICAgLFwidG9TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLnRvX3N0YXRpb25fdGVsZWNvZGVcbiAgICAgICxcImxlZnRUaWNrZXRcIjogdGlja2V0SW5mby5xdWVyeUxlZnRUaWNrZXRSZXF1ZXN0RFRPLnlwSW5mb0RldGFpbFxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIjAwXCJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm8udHJhaW5fbG9jYXRpb25cbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpXG4gICAgICA7XG4gIH1cblxuICBwcml2YXRlIGdldFBhc3NDb2RlTmV3KCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvZ2V0UGFzc0NvZGVOZXc/bW9kdWxlPXBhc3NlbmdlciZyYW5kPXJhbmRwJlwiK01hdGgucmFuZG9tKDAsMSk7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgfTtcblxuICAgIHJldHVybiBPYnNlcnZhYmxlLmNyZWF0ZSgob2JzZXJ2ZXI6IE9ic2VydmVyPHZvaWQ+KT0+IHtcbiAgICAgIHRoaXMucmF3UmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiBvYnNlcnZlci5lcnJvcihlcnJvcik7XG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUhPT0yMDApXG4gICAgICAgICAgb2JzZXJ2ZXIuZXJyb3IocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcbiAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gIH1cblxuICBwcml2YXRlIGNoZWNrUmFuZENvZGVBbnN5bigpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvY2hlY2tSYW5kQ29kZUFuc3luXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICByYW5kQ29kZTogXCJcIixcbiAgICAgIHJhbmQ6IFwicmFuZHBcIlxuICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXG4gICAgICBvdXRwdXQ6IHByb2Nlc3Muc3Rkb3V0XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcy5xdWVzdGlvbkNhcHRjaGEoKVxuICAgICAgLm1lcmdlTWFwKHBvc2l0aW9ucz0+e1xuICAgICAgICBvcHRpb25zLmZvcm0ucmFuZENvZGUgPSBwb3NpdGlvbnM7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gICAgICB9KVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIGNvbmZpcm1TaW5nbGVGb3JRdWV1ZSh0b2tlbiwgc2VhdFR5cGUsIHBhc3NlbmdlcnMsIHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLCBwbGFuUGVwb2xlcyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NvbmZpcm1TaW5nbGVGb3JRdWV1ZVwiO1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHNlYXRUeXBlLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcylcbiAgICAgICxcIm9sZFBhc3NlbmdlclN0clwiOiB0aGlzLmdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycywgcGxhblBlcG9sZXMpXG4gICAgICAsXCJyYW5kQ29kZVwiOlwiXCJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0ucHVycG9zZV9jb2Rlc1xuICAgICAgLFwia2V5X2NoZWNrX2lzQ2hhbmdlXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmtleV9jaGVja19pc0NoYW5nZVxuICAgICAgLFwibGVmdFRpY2tldFN0clwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5sZWZ0VGlja2V0U3RyXG4gICAgICAsXCJ0cmFpbl9sb2NhdGlvblwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS50cmFpbl9sb2NhdGlvblxuICAgICAgLFwiY2hvb3NlX3NlYXRzXCI6IFwiXCJcbiAgICAgICxcInNlYXREZXRhaWxUeXBlXCI6IFwiMDAwXCJcbiAgICAgICxcIndoYXRzU2VsZWN0XCI6IDFcbiAgICAgICxcInJvb21UeXBlXCI6IFwiMDBcIlxuICAgICAgLFwiZHdBbGxcIjogXCJOXCJcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeU9yZGVyV2FpdFRpbWUodG9rZW46IHN0cmluZyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwicmFuZG9tXCI6IG5ldyBEYXRlKCkuZ2V0VGltZSgpXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxuICAgICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBjYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxRdWV1ZU5vQ29tcGxldGVNeU9yZGVyXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICB0b3VyRmxhZzogXCJkY1wiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgICAgLGpzb246IHRydWVcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4ge1xuICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcbiAgICAgICAgICB0aHJvdyB0aGlzLlNZU1RFTV9CVVNTWTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBpbml0Tm9Db21wbGV0ZSgpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiO1xuICAgIGxldCBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXG4gICAgICB9KVxuICAgICAgLGZvcm06IHtcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxuICAgICAgfVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIG15T3JkZXJOb0NvbXBsZXRlKCkge1xuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXG4gICAgICAubWVyZ2VNYXAoKCk9PiB0aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKSlcbiAgICAgIC5zdWJzY3JpYmUoKHgpPT57XG4gICAgICAgIC8qXG4gICAgICAgICAgeyB2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkOiAnX3ZhbGlkYXRvck1lc3NhZ2UnLFxuICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgZGF0YTogeyBvcmRlckRCTGlzdDogWyBbT2JqZWN0XSBdLCB0b19wYWdlOiAnZGInIH0sXG4gICAgICAgICAgICBtZXNzYWdlczogW10sXG4gICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XG4gICAgICAgICAqL1xuICAgICAgICAgdGhpcy5wcmludE15T3JkZXJOb0NvbXBsZXRlKHgpO1xuICAgICAgfSwgZXJyPT5jb25zb2xlLmVycm9yKGVycikpO1xuICB9XG5cbiAgcHJpdmF0ZSBwcmludE15T3JkZXJOb0NvbXBsZXRlKHgpIHtcbiAgICBpZigheC5kYXRhKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGNoYWxrYHt5ZWxsb3cg5rKh5pyJ5pyq5a6M5oiQ6K6i5Y2VfWApXG4gICAgICByZXR1cm47XG4gICAgfVxuICAgbGV0IHRpY2tldHMgPSBbXTtcbiAgIGlmKHguZGF0YS5vcmRlckNhY2hlRFRPKSB7XG4gICAgIGxldCBvcmRlckNhY2hlID0geC5kYXRhLm9yZGVyQ2FjaGVEVE87XG4gICAgIG9yZGVyQ2FjaGUudGlja2V0cy5mb3JFYWNoKHRpY2tldD0+IHtcbiAgICAgICB0aWNrZXRzLnB1c2goe1xuICAgICAgICAgXCLmjpLpmJ/lj7dcIjogb3JkZXJDYWNoZS5xdWV1ZU5hbWUsXG4gICAgICAgICBcIuetieW+heaXtumXtFwiOiBvcmRlckNhY2hlLndhaXRUaW1lLFxuICAgICAgICAgXCLnrYnlvoXkurrmlbBcIjogb3JkZXJDYWNoZS53YWl0Q291bnQsXG4gICAgICAgICBcIuS9meelqOaVsFwiOiBvcmRlckNhY2hlLnRpY2tldENvdW50LFxuICAgICAgICAgXCLkuZjovabml6XmnJ9cIjogb3JkZXJDYWNoZS50cmFpbkRhdGUuc2xpY2UoMCwxMCksXG4gICAgICAgICBcIui9puasoVwiOiBvcmRlckNhY2hlLnN0YXRpb25UcmFpbkNvZGUsXG4gICAgICAgICBcIuWHuuWPkeermVwiOiBvcmRlckNhY2hlLmZyb21TdGF0aW9uTmFtZSxcbiAgICAgICAgIFwi5Yiw6L6+56uZXCI6IG9yZGVyQ2FjaGUudG9TdGF0aW9uTmFtZSxcbiAgICAgICAgIFwi5bqn5L2N562J57qnXCI6IHRpY2tldC5zZWF0VHlwZU5hbWUsXG4gICAgICAgICBcIuS5mOi9puS6ulwiOiB0aWNrZXQucGFzc2VuZ2VyTmFtZVxuICAgICAgIH0pO1xuICAgICB9KTtcblxuICAgfWVsc2UgaWYoeC5kYXRhLm9yZGVyREJMaXN0KXtcblxuICAgICB4LmRhdGEub3JkZXJEQkxpc3QuZm9yRWFjaChvcmRlcj0+IHtcbiAgICAgICAvLyBjb25zb2xlLmxvZyhjaGFsa2DorqLljZXlj7cge3llbGxvdy5ib2xkICR7b3JkZXIuc2VxdWVuY2Vfbm99fWApXG4gICAgICAgb3JkZXIudGlja2V0cy5mb3JFYWNoKHRpY2tldD0+IHtcbiAgICAgICAgIHRpY2tldHMucHVzaCh7XG4gICAgICAgICAgIFwi6K6i5Y2V5Y+3XCI6IHRpY2tldC5zZXF1ZW5jZV9ubyxcbiAgICAgICAgICAgLy8gXCLorqLnpajlj7dcIjogdGlja2V0LnRpY2tldF9ubyxcbiAgICAgICAgICAgXCLkuZjovabml6XmnJ9cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRyYWluX2RhdGUuc2xpY2UoMCwxMCl9fWAsXG4gICAgICAgICAgIC8vIFwi5LiL5Y2V5pe26Ze0XCI6IHRpY2tldC5yZXNlcnZlX3RpbWUsXG4gICAgICAgICAgIFwi5LuY5qy+5oiq6Iez5pe26Ze0XCI6IGNoYWxrYHtyZWQuYm9sZCAke3RpY2tldC5wYXlfbGltaXRfdGltZX19YCxcbiAgICAgICAgICAgXCLph5Hpop1cIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRpY2tldF9wcmljZS8xMDB9fWAsXG4gICAgICAgICAgIFwi54q25oCBXCI6IGNoYWxrYHt5ZWxsb3cuYm9sZCAke3RpY2tldC50aWNrZXRfc3RhdHVzX25hbWV9fWAsXG4gICAgICAgICAgIFwi5LmY6L2m5Lq6XCI6IHRpY2tldC5wYXNzZW5nZXJEVE8ucGFzc2VuZ2VyX25hbWUsXG4gICAgICAgICAgIFwi6L2m5qyhXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8uc3RhdGlvbl90cmFpbl9jb2RlLFxuICAgICAgICAgICBcIuWHuuWPkeermVwiOiB0aWNrZXQuc3RhdGlvblRyYWluRFRPLmZyb21fc3RhdGlvbl9uYW1lLFxuICAgICAgICAgICBcIuWIsOi+vuermVwiOiB0aWNrZXQuc3RhdGlvblRyYWluRFRPLnRvX3N0YXRpb25fbmFtZSxcbiAgICAgICAgICAgXCLluqfkvY1cIjogdGlja2V0LnNlYXRfbmFtZSxcbiAgICAgICAgICAgXCLluqfkvY3nrYnnuqdcIjogdGlja2V0LnNlYXRfdHlwZV9uYW1lLFxuICAgICAgICAgICBcIuS5mOi9puS6uuexu+Wei1wiOiB0aWNrZXQudGlja2V0X3R5cGVfbmFtZVxuICAgICAgICAgfSk7XG4gICAgICAgfSk7XG4gICAgIH0pO1xuICAgfVxuXG4gICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh0aWNrZXRzLCB7XG4gICAgIGNvbHVtblNwbGl0dGVyOiAnfCdcbiAgIH0pO1xuXG4gICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcbiAgfVxuXG4gIHByaXZhdGUgcXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9xdWVyeU15T3JkZXJOb0NvbXBsZXRlXCI7XG4gICAgbGV0IG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybToge1xuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XG4gICAgICAgICAgLyoqXG4gICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxuICAgICAgICAgICAgICBtZXNzYWdlczogW10sXG4gICAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICAgKi9cbiAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgfVxuICAgICAgICB0aHJvdyBib2R5Lm1lc3NhZ2VzO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgPGRpdiBjbGFzcz1cInQtYnRuXCI+XG57e2lmIHBheV9mbGFnPT0nWSd9fVxuICAgICAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBpZD1cImNvbnRpbnVlUGF5Tm9NeUNvbXBsZXRlXCIgb25jbGljaz1cImNvbnRpdWVQYXlOb0NvbXBsZXRlT3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdwYXknKVwiICBjbGFzcz1cImJ0bjkyc1wiPue7p+e7reaUr+S7mDwvYT48L2Rpdj5cbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfb3JkZXInKVwiIGlkPVwiY2FuY2VsX2J1dHRvbl9wYXlcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2Plxue3svaWZ9fVxue3tpZiBwYXlfcmVzaWduX2ZsYWc9PSdZJ319XG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIGlkPVwiY29udGludWVQYXlOb015Q29tcGxldGVcIiBvbmNsaWNrPVwiY29udGl1ZVBheU5vQ29tcGxldGVPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ3Jlc2lnbicpO1wiICBjbGFzcz1cImJ0bjkyc1wiPue7p+e7reaUr+S7mDwvYT48L2Rpdj5cblx0ICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIG9uY2xpY2s9XCJjYW5jZWxNeU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywnY2FuY2VsX3Jlc2lnbicpXCIgY2xhc3M9XCJidG45MlwiPuWPlua2iOiuouWNlTwvYT48L2Rpdj5cbnt7L2lmfX1cblxuICAgICAgICA8L2Rpdj5cbiAgKi9cbiAgcHJpdmF0ZSBjYW5jZWxOb0NvbXBsZXRlTXlPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2NhbmNlbE5vQ29tcGxldGVNeU9yZGVyXCI7XG4gICAgbGV0IG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybToge1xuICAgICAgICBcInNlcXVlbmNlX25vXCI6IHNlcXVlbmNlTm8sXG4gIFx0XHRcdFwiY2FuY2VsX2ZsYWdcIjogY2FuY2VsSWQsXG4gICAgICAgIFwiX2pzb25fYXR0XCI6XCJcIlxuICAgICAgfVxuICAgICAgLGpzb246IHRydWVcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcbiAgfVxuXG4gIHB1YmxpYyBjYW5jZWxOb0NvbXBsZXRlT3JkZXIoc2VxdWVuY2VObzogc3RyaW5nLCBjYW5jZWxJZDogc3RyaW5nID0gJ2NhbmNlbF9vcmRlcicpIHtcbiAgICB0aGlzLm9ic2VydmFibGVMb2dpbkluaXQoKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmNhbmNlbE5vQ29tcGxldGVNeU9yZGVyKHNlcXVlbmNlTm8sIGNhbmNlbElkKSlcbiAgICAgIC5zdWJzY3JpYmUoKGJvZHkpPT57XG4gICAgICAgICAgLy8ge1widmFsaWRhdGVNZXNzYWdlc1Nob3dJZFwiOlwiX3ZhbGlkYXRvck1lc3NhZ2VcIixcInN0YXR1c1wiOnRydWUsXCJodHRwc3RhdHVzXCI6MjAwLFwiZGF0YVwiOnt9LFwibWVzc2FnZXNcIjpbXSxcInZhbGlkYXRlTWVzc2FnZXNcIjp7fX1cbiAgICAgICAgICBpZiAoYm9keS5kYXRhLmV4aXN0RXJyb3IgPT0gXCJZXCIpIHtcbiAgICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZCAke2JvZHkuZGF0YS5lcnJvck1zZ319YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihjaGFsa2B7eWVsbG93IOiuouWNlSAke3NlcXVlbmNlTm99IOW3suWPlua2iH1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICxlcnI9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZCAke0pTT04uc3RyaW5naWZ5KGVycil9fWApXG4gICAgICApO1xuICB9XG59XG4iXX0=
