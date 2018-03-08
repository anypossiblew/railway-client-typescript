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
    function Account(name, userPassword, manager) {
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QVEsRUFBa0IsR0FBRyxLQUFyQixJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBSSxDQUFDO1lBQ3BELENBQUM7WUFBQyxJQUFJLENBQUMsQ0FBQztnQkFDTixPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssb0hBQUEsdUJBQWMsRUFBVSxzQkFBTyxLQUFqQixVQUFVLEVBQVEsQ0FBQztZQUNyRCxDQUFDO1FBQ0gsQ0FBQyxFQUNGLFVBQUEsR0FBRyxJQUFFLE9BQUEsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLGlGQUFBLE9BQVEsRUFBbUIsR0FBRyxLQUF0QixJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxFQUFJLEVBQWxELENBQWtELENBQ3ZELENBQUM7SUFDTixDQUFDO0lBQ0gsY0FBQztBQUFELENBdmpEQSxBQXVqREMsSUFBQTtBQXZqRFksMEJBQU8iLCJmaWxlIjoic3JjL0FjY291bnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyIgLy8gaHR0cHM6Ly93d3cubGFuaW5kZXguY29tLzEyMzA2JUU4JUI0JUFEJUU3JUE1JUE4JUU2JUI1JTgxJUU3JUE4JThCJUU1JTg1JUE4JUU4JUE3JUEzJUU2JTlFJTkwL1xuXG5pbXBvcnQgd2luc3RvbiA9IHJlcXVpcmUoJ3dpbnN0b24nKTtcbmltcG9ydCB7RmlsZUNvb2tpZVN0b3JlfSBmcm9tICcuL0ZpbGVDb29raWVTdG9yZSc7XG5pbXBvcnQge1N0YXRpb259IGZyb20gJy4vU3RhdGlvbic7XG5pbXBvcnQgcmVxdWVzdCA9IHJlcXVpcmUoJ3JlcXVlc3QnKTtcbmltcG9ydCBxdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5pbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xuaW1wb3J0IHJlYWRsaW5lID0gcmVxdWlyZSgncmVhZGxpbmUnKTtcbmltcG9ydCBwcm9jZXNzID0gcmVxdWlyZSgncHJvY2VzcycpO1xuaW1wb3J0IFJ4IGZyb20gJ3J4anMvUngnO1xuaW1wb3J0IHsgT2JzZXJ2YWJsZSwgT2JzZXJ2YWJsZUlucHV0IH0gZnJvbSAncnhqcy9PYnNlcnZhYmxlJztcbmltcG9ydCB7IE9ic2VydmVyIH0gZnJvbSAncnhqcy9PYnNlcnZlcic7XG5pbXBvcnQgJ3J4anMvYWRkL29ic2VydmFibGUvYmluZENhbGxiYWNrJztcbmltcG9ydCBjaGFsayA9IHJlcXVpcmUoJ2NoYWxrJyk7XG5pbXBvcnQgY29sdW1uaWZ5ID0gcmVxdWlyZSgnY29sdW1uaWZ5Jyk7XG5pbXBvcnQgYmVlcGVyID0gcmVxdWlyZSgnYmVlcGVyJyk7XG5pbXBvcnQgY2hpbGRfcHJvY2VzcyA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcblxuaW1wb3J0IHtPcmRlclN1Ym1pdFJlcXVlc3QsIElPcmRlciwgT3JkZXJ9IGZyb20gJy4vT3JkZXInO1xuaW1wb3J0IHsgTWFuYWdlciB9IGZyb20gJy4vTWFuYWdlcic7XG5cbmV4cG9ydCBjbGFzcyBBY2NvdW50IHtcbiAgcHJpdmF0ZSBtYW5hZ2VyOiBNYW5hZ2VyO1xuICBwdWJsaWMgdXNlck5hbWUgOiBzdHJpbmc7XG4gIHByaXZhdGUgdXNlclBhc3N3b3JkIDogc3RyaW5nO1xuICBwcml2YXRlIGNoZWNrVXNlclRpbWVyID0gUnguT2JzZXJ2YWJsZS50aW1lcigxMDAwKjYwKjEwLCAxMDAwKjYwKjEwKTsgLy8g5Y2B5YiG6ZKf5LmL5ZCO5byA5aeL77yM5q+P5Y2B5YiG6ZKf5qOA5p+l5LiA5qyhXG4gIHByaXZhdGUgc2NwdENoZWNrVXNlclRpbWVyPzogUnguU3Vic2NyaXB0aW9uO1xuXG4gIHByaXZhdGUgc3RhdGlvbnM6IFN0YXRpb24gPSBuZXcgU3RhdGlvbigpO1xuICBwcml2YXRlIHBhc3NlbmdlcnM/OiBvYmplY3Q7XG5cbiAgcHJpdmF0ZSBTWVNURU1fQlVTU1kgPSBcIlN5c3RlbSBpcyBidXNzeVwiO1xuICBwcml2YXRlIFNZU1RFTV9NT1ZFRCA9IFwiTW92ZWQgVGVtcG9yYXJpbHlcIjtcblxuICBwcml2YXRlIHJhd1JlcXVlc3Q6IChvcHRpb25zOmFueXx1bmRlZmluZWR8bnVsbCwgY2I6YW55KT0+YW55O1xuICBwcml2YXRlIHJlcXVlc3Q6IChvcHRpb25zPzphbnl8dW5kZWZpbmVkfG51bGwpPT5PYnNlcnZhYmxlPGFueT47XG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XG4gIHB1YmxpYyBoZWFkZXJzOiBvYmplY3QgPSB7XG4gICAgXCJDb250ZW50LVR5cGVcIjogXCJhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLThcIlxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxuICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcbiAgICAsXCJPcmlnaW5cIjogXCJodHRwczovL2t5ZncuMTIzMDYuY25cIlxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcbiAgfTtcblxuICBwcml2YXRlIFRJQ0tFVF9USVRMRSA9IFsnJywgJycsICcnLCAn6L2m5qyhJywgJ+i1t+WniycsICfnu4jngrknLCAn5Ye65Y+R56uZJywgJ+WIsOi+vuermScsICflh7rlj5Hml7YnLCAn5Yiw6L6+5pe2JywgJ+WOhuaXticsICcnLCAnJyxcbiAgICAgICAgICAgICAgICfml6XmnJ8nLCAnJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJ+mrmOe6p+i9r+WNpycsICcnLCAn6L2v5Y2nJywgJ+i9r+W6pycsICfnibnnrYnluqcnLCAn5peg5bqnJyxcbiAgICAgICAgICAgICAgICcnLCAn56Gs5Y2nJywgJ+ehrOW6pycsICfkuoznrYnluqcnLCAn5LiA562J5bqnJywgJ+WVhuWKoeW6pyddO1xuXG4gIHByaXZhdGUgcXVlcnkgPSBmYWxzZTtcblxuICBwcml2YXRlIG9yZGVyczogQXJyYXk8T3JkZXI+ID0gW107XG5cbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB1c2VyUGFzc3dvcmQ6IHN0cmluZywgbWFuYWdlcjogTWFuYWdlcikge1xuICAgIHRoaXMubWFuYWdlciA9IG1hbmFnZXI7XG4gICAgdGhpcy51c2VyTmFtZSA9IG5hbWU7XG4gICAgdGhpcy51c2VyUGFzc3dvcmQgPSB1c2VyUGFzc3dvcmQ7XG5cbiAgICB0aGlzLnNldFJlcXVlc3QoKTtcbiAgICB0aGlzLnJhd1JlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XG4gICAgdGhpcy5yZXF1ZXN0ID0gT2JzZXJ2YWJsZS5iaW5kQ2FsbGJhY2s8QXJyYXk8YW55Pj4odGhpcy5yYXdSZXF1ZXN0LCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcbiAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcbiAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgIT09IDIwMCkgdGhyb3cgWydodHRwIGVycm9yJywgcmVzcG9uc2Uuc3RhdHVzQ29kZSwgcmVzcG9uc2Uuc3RhdHVzTWVzc2FnZV0uam9pbignICcpO1xuICAgICAgcmV0dXJuIGJvZHk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5qOA5p+l572R57uc5byC5bi4XG4gICAqL1xuICBwcml2YXRlIGlzU3lzdGVtQnVzc3koYm9keTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGJvZHkuaW5kZXhPZihcIue9kee7nOWPr+iDveWtmOWcqOmXrumimO+8jOivt+aCqOmHjeivleS4gOS4i1wiKSA+IDA7XG4gIH1cblxuICBwdWJsaWMgc2V0UmVxdWVzdCgpIHtcbiAgICBsZXQgY29va2llRmlsZU5hbWU6IHN0cmluZyA9IFwiLi9jb29raWVzL1wiK3RoaXMudXNlck5hbWUrXCIuanNvblwiO1xuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKGNvb2tpZUZpbGVOYW1lLCB7ZW5jcnlwdDogZmFsc2V9KTtcbiAgICBmaWxlU3RvcmUub3B0aW9uID0ge2VuY3J5cHQ6IGZhbHNlfTtcbiAgICB0aGlzLmNvb2tpZWphciA9IHJlcXVlc3QuamFyKGZpbGVTdG9yZSk7XG4gIH1cblxuICBwcml2YXRlIG5leHRPcmRlck51bTogbnVtYmVyID0gMDtcbiAgcHJpdmF0ZSBuZXh0T3JkZXIoKSB7XG4gICAgdGhpcy5uZXh0T3JkZXJOdW0gPSAodGhpcy5uZXh0T3JkZXJOdW0gKyAxKSV0aGlzLm9yZGVycy5sZW5ndGg7XG4gICAgcmV0dXJuIHRoaXMub3JkZXJzW3RoaXMubmV4dE9yZGVyTnVtXTtcbiAgfVxuXG4gIHByaXZhdGUgY3VycmVudE9yZGVyKCkge1xuICAgIHJldHVybiB0aGlzLm9yZGVyc1t0aGlzLm5leHRPcmRlck51bV07XG4gIH1cblxuICBwdWJsaWMgY3JlYXRlT3JkZXIodHJhaW5EYXRlczogQXJyYXk8c3RyaW5nPiwgYmFja1RyYWluRGF0ZTogc3RyaW5nLFxuICAgICAgICAgICAgICAgICAgICAgW2Zyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGFzc1N0YXRpb25OYW1lXSxcbiAgICAgICAgICAgICAgICAgICAgIHBsYW5UcmFpbnM6IEFycmF5PHN0cmluZz4sIHBsYW5QZXBvbGVzOiBBcnJheTxzdHJpbmc+LCBzZWF0Q2xhc3NlczogQXJyYXk8c3RyaW5nPik6IHRoaXMge1xuICAgIHRyYWluRGF0ZXMuZm9yRWFjaCh0cmFpbkRhdGU9PiB7XG4gICAgICBpZighbmV3IERhdGUodHJhaW5EYXRlKS50b0pTT04oKSkge1xuICAgICAgICB0aHJvdyBjaGFsa2B7cmVkIOS5mOi9puaXpeacnyR7dHJhaW5EYXRlfeagvOW8j+S4jeato+ehru+8jOagvOW8j+W6lOivpeaYr3l5eXktTU0tZGR9YDtcbiAgICAgIH1cbiAgICAgIGlmKG5ldyBEYXRlKHRyYWluRGF0ZSkudG9KU09OKCkuc2xpY2UoMCwxMCkgPCBuZXcgRGF0ZSgpLnRvSlNPTigpLnNsaWNlKDAsMTApKSB7XG4gICAgICAgIHRocm93IGNoYWxrYHtyZWQg5LmY6L2m5pel5pyf5bqU6K+l5Li65LuK5aSp5oiW5Lul5ZCOfWA7XG4gICAgICB9XG5cbiAgICAgIHRoaXMub3JkZXJzLnB1c2goXG4gICAgICAgIG5ldyBPcmRlcih0cmFpbkRhdGUsIGJhY2tUcmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgcGFzc1N0YXRpb25OYW1lLCBwbGFuVHJhaW5zLCBwbGFuUGVwb2xlcywgc2VhdENsYXNzZXMpXG4gICAgICApO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBwdWJsaWMgc3VibWl0KCk6IHZvaWQge1xuICAgIC8vIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXG4gICAgT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLy8g5qOA5p+l5pyq5a6M5oiQ6K6i5Y2VXG4gICAgICAubWVyZ2VNYXAoKCk9PiB0aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKSlcbiAgICAgIC5kbyhib2R5PT4ge1xuICAgICAgICBpZihib2R5LmRhdGEpIHtcbiAgICAgICAgICB0aGlzLnByaW50TXlPcmRlck5vQ29tcGxldGUoYm9keSk7XG4gICAgICAgICAgaWYoYm9keS5kYXRhLm9yZGVyQ2FjaGVEVE8pIHtcbiAgICAgICAgICAgIHRocm93ICfmgqjov5jmnInmjpLpmJ/orqLljZUnO1xuICAgICAgICAgIH1lbHNlIGlmKGJvZHkuZGF0YS5vcmRlckRCTGlzdCl7XG4gICAgICAgICAgICB0aHJvdyAn5oKo6L+Y5pyJ5pyq5a6M5oiQ6K6i5Y2VJztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAvLyDlh4blpIflpb3lkI7ov5vooYzorqLnpajmtYHnqItcbiAgICAgIC5zdWJzY3JpYmUoKCk9PntcbiAgICAgICAgdGhpcy5idWlsZE9yZGVyRmxvdygpO1xuXG4gICAgICAgIHRoaXMuc2NwdENoZWNrVXNlclRpbWVyID1cbiAgICAgICAgICB0aGlzLmNoZWNrVXNlclRpbWVyLnN1YnNjcmliZSgoaSk9PiB7XG4gICAgICAgICAgICB0aGlzLm9ic2VydmFibGVDaGVja1VzZXIoKVxuICAgICAgICAgICAgICAuc3Vic2NyaWJlKCgpPT53aW5zdG9uLmRlYnVnKFwiQ2hlY2sgdXNlciBkb25lXCIpKTtcbiAgICAgICAgICB9KTtcbiAgICAgIH0sZXJyPT4ge1xuICAgICAgICBiZWVwZXIoNjAqMzAqMik7XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtyZWQuYm9sZCAke2Vycn19YCk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBvcmRlcldhaXRUaW1lKCkge1xuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXG4gICAgICAuc3Vic2NyaWJlKCgpPT57XG4gICAgICAgIHRoaXMub2JzUXVlcnlPcmRlcldhaXRUKG5ldyBPcmRlcigpKVxuICAgICAgICAgIC5tZXJnZU1hcCgob3JkZXJJZCk9PnRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpKVxuICAgICAgICAgIC5kbygoYm9keSk9PiB7XG4gICAgICAgICAgICBpZihib2R5LmRhdGEpIHtcbiAgICAgICAgICAgICAgdGhpcy5wcmludE15T3JkZXJOb0NvbXBsZXRlKGJvZHkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICAgICAgLnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOe7k+adn31gKTtcbiAgICAgICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAsZXJyPT5jb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOmUmeivr+e7k+adnyAke2Vycn19YClcbiAgICAgICAgICAgICwoKT0+e1xuICAgICAgICAgICAgICB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICApO1xuICAgICAgfVxuICAgICAgLGVycj0+Y29uc29sZS5sb2coY2hhbGtge3llbGxvdyDplJnor6/nu5PmnZ8gJHtlcnJ9fWApXG4gICAgICAsKCk9PntcbiAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHB1YmxpYyBjYW5jZWxPcmRlclF1ZXVlKCkge1xuICAgIHRoaXMuY2FuY2VsUXVldWVOb0NvbXBsZXRlT3JkZXIoKVxuICAgICAgLnRoZW4oeD0+IHtcbiAgICAgICAgaWYoeC5zdGF0dXMgJiYgeC5kYXRhLmV4aXN0RXJyb3IgPT0gJ04nKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg5o6S6Zif6K6i5Y2V5bey5Y+W5raIfWApO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcih4KTtcbiAgICAgICAgfVxuICAgICAgfSwgZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XG4gIH1cblxuICBwdWJsaWMgZGVzdHJveSgpIHtcbiAgICAvLyB0aGlzLnNjcHRDaGVja1VzZXJUaW1lciYmdGhpcy5zY3B0Q2hlY2tVc2VyVGltZXIudW5zdWJzY3JpYmUoKTtcbiAgfVxuXG4gIHByaXZhdGUgb2JzZXJ2YWJsZUNoZWNrQ2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmdldENhcHRjaGEoKSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5jaGVja0NhcHRjaGEoKVxuICAgICAgICAgICAgICAgICAgICAgICAgLmRvKCgpPT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g5qCh6aqM56CB5oiQ5Yqf5ZCO6L+b6KGM5o6I5p2D6K6k6K+BXG4gICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOmqjOivgeeggeagoemqjOaIkOWKn31gKVxuICAgICAgICAgICAgICAgICAgICAgICAgKVxuICAgICAgKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PlxuICAgICAgICBlcnJvciQuZG8oKCk9PmNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDmoKHpqozlpLHotKXvvIzph43mlrDmoKHpqox9YCkpXG4gICAgICApXG4gICAgICA7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVMb2dpbigpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLm9ic2VydmFibGVDaGVja0NhcHRjaGEoKSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+XG4gICAgICAgIHRoaXMudXNlckF1dGhlbnRpY2F0ZSgpXG4gICAgICAgICAgLmRvKCgpPT5jb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDnmbvlvZXmiJDlip99YCkpXG4gICAgICApXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5tZXJnZU1hcChlcnI9PiB7XG4gICAgICAgICAgLypcbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi5a+G56CB6L6T5YWl6ZSZ6K+v44CC5aaC5p6c6L6T6ZSZ5qyh5pWw6LaF6L+HNOasoe+8jOeUqOaIt+Wwhuiiq+mUgeWumuOAglwiLFwicmVzdWx0X2NvZGVcIjoxfVxuICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLpqozor4HnoIHmoKHpqozlpLHotKVcIixcInJlc3VsdF9jb2RlXCI6XCI1XCJ9XG4gICAgICAgICAgKi9cbiAgICAgICAgICBpZih0eXBlb2YgZXJyLnJlc3VsdF9jb2RlID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDEwMDApO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLmNhdGNoKGVycj0+IHtcbiAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyLnJlc3VsdF9tZXNzYWdlfX1gKTtcbiAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlTmV3QXBwVG9rZW4oKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKCgpPT50aGlzLmdldE5ld0FwcFRva2VuKCkpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoZXJyKSlcbiAgICAgICAgICAubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUxvZ2luKCk7XG4gICAgICAgICAgfSlcbiAgICAgICk7XG4gIH1cblxuICBwcml2YXRlIG9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0azogc3RyaW5nKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICBsZXQgbmV3QXBwVG9rZW4gPSBuZXdhcHB0aztcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjxzdHJpbmc+KT0+IHtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dChuZXdBcHBUb2tlbik7XG4gICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XG4gICAgICB9KVxuICAgICAgLm1lcmdlTWFwKChuZXdhcHB0azogc3RyaW5nKT0+dGhpcy5nZXRBcHBUb2tlbihuZXdhcHB0aykpXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgIGVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoZXJyKSlcbiAgICAgICAgICAubWVyZ2VNYXAoZXJyPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOiOt+WPllRva2Vu5aSx6LSlfWApO1xuICAgICAgICAgICAgd2luc3Rvbi5kZWJ1ZyhlcnIpO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZU5ld0FwcFRva2VuKCkuZG8oKG5ld2FwcHRrKT0+bmV3QXBwVG9rZW4gPSBuZXdhcHB0ayk7XG4gICAgICAgICAgICAvLyBpZihlcnIucmVzdWx0X2NvZGUgJiYgZXJyLnJlc3VsdF9jb2RlID09PSAyKSB7XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gfWVsc2Uge1xuICAgICAgICAgICAgLy8gICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgLy8gfVxuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG5cbiAgcHVibGljIG9ic2VydmFibGVMb2dpbkluaXQoKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICAvLyDnmbvlvZXliJ3lp4vljJZcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLm1lcmdlTWFwKG9yZGVyPT50aGlzLmxvZ2luSW5pdCgpKVxuICAgICAgLnJldHJ5KDEwMDApXG4gICAgICAubWFwKG9yZGVyID0+IHRoaXMuY2hlY2tBdXRoZW50aWNhdGlvbih0aGlzLmNvb2tpZWphci5famFyLnRvSlNPTigpLmNvb2tpZXMpKVxuICAgICAgLm1lcmdlTWFwKHRva2Vucz0+IHtcbiAgICAgICAgaWYodG9rZW5zLnRrKSB7XG4gICAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUFwcFRva2VuKHRva2Vucy50ayk7XG4gICAgICAgIH1lbHNlIGlmKHRva2Vucy51YW10aykge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVOZXdBcHBUb2tlbigpXG4gICAgICAgICAgICAubWVyZ2VNYXAobmV3YXBwdGs9PnRoaXMub2JzZXJ2YWJsZUFwcFRva2VuKG5ld2FwcHRrKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMub2JzZXJ2YWJsZUxvZ2luKClcbiAgICAgICAgICAubWVyZ2VNYXAoKCk9PnRoaXMub2JzZXJ2YWJsZU5ld0FwcFRva2VuKCkpXG4gICAgICAgICAgLm1lcmdlTWFwKG5ld2FwcHRrPT50aGlzLm9ic2VydmFibGVBcHBUb2tlbihuZXdhcHB0aykpO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5pWw57uE5aSa5YWz6ZSu5a2X5q615o6S5bqP566X5rOV77yM5a2X5q616buY6K6k5Li66YCS5YeP5o6S5bqP77yM5aaC5p6c5a2X5q615YmN6Z2i5bim5pyJK+espuWPt+WImeS4uumAkuWinuaOkuW6j1xuICAgKi9cbiAgcHJpdmF0ZSBmaWVsZFNvcnRlcihmaWVsZHM6IEFycmF5PHN0cmluZz4pIHtcbiAgICByZXR1cm4gKGE6YW55LCBiOmFueSkgPT4gZmllbGRzLm1hcCgobzpzdHJpbmcpID0+IHtcbiAgICAgICAgICAgICAgbGV0IGRpciA9IC0xO1xuICAgICAgICAgICAgICBpZiAob1swXSA9PT0gJysnKSB7XG4gICAgICAgICAgICAgICAgZGlyID0gMTtcbiAgICAgICAgICAgICAgICBvID0gby5zdWJzdHJpbmcoMSk7XG4gICAgICAgICAgICAgIH1lbHNlIGlmKG9bMF0gPT09ICctJykge1xuICAgICAgICAgICAgICAgIG8gPSBvLnN1YnN0cmluZygxKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gYVtvXSA+IGJbb10gPyBkaXIgOiBhW29dIDwgYltvXSA/IC0oZGlyKSA6IDA7XG4gICAgICAgICAgfSkucmVkdWNlKChwLCBuKSA9PiBwID8gcCA6IG4sIDApO1xuICB9XG5cbiAgcHJpdmF0ZSBidWlsZFF1ZXJ5TGVmdFRpY2tldEZsb3cob3JkZXI6IElPcmRlcik6IE9ic2VydmFibGU8SU9yZGVyPiB7XG5cbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcilcbiAgICAgIC8vIOiOt+WPluS9meelqOS/oeaBr1xuICAgICAgLm1lcmdlTWFwKChvcmRlcjogSU9yZGVyKTogT2JzZXJ2YWJsZUlucHV0PElPcmRlcj4gPT5cbiAgICAgICAgdGhpcy5xdWVyeUxlZnRUaWNrZXRzKG9yZGVyLnRyYWluRGF0ZSwgb3JkZXIuZnJvbVN0YXRpb24sIG9yZGVyLnRvU3RhdGlvbiwgb3JkZXIucGxhblRyYWlucylcbiAgICAgICAgICAubWFwKCh0cmFpbnMpPT4ge1xuICAgICAgICAgICAgb3JkZXIudHJhaW5zID0gdHJhaW5zO1xuICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgIH0pXG4gICAgICApXG4gICAgICAvLyDojrflj5bpgJTnu4/nq5novabmrKHkv6Hmga9cbiAgICAgIC5tZXJnZU1hcCgob3JkZXI6IElPcmRlcik6IE9ic2VydmFibGVJbnB1dDxJT3JkZXI+ID0+IHtcbiAgICAgICAgaWYob3JkZXIucGFzc1N0YXRpb24pIHtcbiAgICAgICAgICBpZighb3JkZXIuZnJvbVRvUGFzc1RyYWlucykge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucXVlcnlMZWZ0VGlja2V0cyhvcmRlci50cmFpbkRhdGUsIG9yZGVyLmZyb21TdGF0aW9uLCBvcmRlci5wYXNzU3RhdGlvbiwgb3JkZXIucGxhblRyYWlucylcbiAgICAgICAgICAgICAgLm1hcChwYXNzVHJhaW5zPT4ge1xuICAgICAgICAgICAgICAgIG9yZGVyLmZyb21Ub1Bhc3NUcmFpbnMgPSBwYXNzVHJhaW5zLm1hcCh0cmFpbj0+IHRyYWluWzNdKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XG4gICAgICB9KVxuICAgICAgLy8g5oyJ6YCU57uP56uZ6L2m5qyh6L+H5rukXG4gICAgICAubWFwKChvcmRlcjogSU9yZGVyKTogSU9yZGVyID0+IHtcbiAgICAgICAgaWYob3JkZXIuZnJvbVRvUGFzc1RyYWlucykge1xuICAgICAgICAgIG9yZGVyLnRyYWlucyA9IG9yZGVyLnRyYWlucy5maWx0ZXIodHJhaW4gPT4gb3JkZXIuZnJvbVRvUGFzc1RyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDmjInml7bpl7TojIPlm7Tov4fmu6RcbiAgICAgIC5tYXAoKG9yZGVyOiBJT3JkZXIpOiBJT3JkZXIgPT4ge1xuICAgICAgICBpZihvcmRlci5wbGFuVGltZXMpIHtcbiAgICAgICAgICBsZXQgdHJhaW5zID0gb3JkZXIudHJhaW5zfHxbXTtcbiAgICAgICAgICBvcmRlci50cmFpbnMgPSB0cmFpbnMuZmlsdGVyKHRyYWluPT4ge1xuICAgICAgICAgICAgcmV0dXJuIChvcmRlci5wbGFuVGltZXNbMF0/b3JkZXIucGxhblRpbWVzWzBdPD10cmFpbls4XTp0cnVlKSYmKG9yZGVyLnBsYW5UaW1lc1sxXT9vcmRlci5wbGFuVGltZXNbMV0+PXRyYWluWzhdOnRydWUpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgfSlcbiAgICAgIC8vIOagueaNruWtl+auteaOkuW6j1xuICAgICAgLm1hcCgob3JkZXI6IElPcmRlcik6IElPcmRlciA9PiB7XG4gICAgICAgIGlmKG9yZGVyLnBsYW5PcmRlckJ5KSB7XG4gICAgICAgICAgb3JkZXIudHJhaW5zID0gb3JkZXIudHJhaW5zLnNvcnQodGhpcy5maWVsZFNvcnRlcihvcmRlci5wbGFuT3JkZXJCeSkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgIH0pXG4gICAgICAvLyDorqHnrpflj6/otK3kubDovabmrKHkv6Hmga9cbiAgICAgIC5tYXAoKG9yZGVyOiBJT3JkZXIpOiBJT3JkZXIgPT4ge1xuICAgICAgICBsZXQgdHJhaW5zID0gb3JkZXIudHJhaW5zfHxbXTtcblxuICAgICAgICBsZXQgcGxhblRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4gPSBbXSwgdGhhdCA9IHRoaXM7XG4gICAgICAgIHRyYWlucy5zb21lKHRyYWluID0+IHtcbiAgICAgICAgICByZXR1cm4gb3JkZXIuc2VhdENsYXNzZXMuc29tZShzZWF0ID0+IHtcbiAgICAgICAgICAgIHZhciBzZWF0TnVtID0gdGhpcy5USUNLRVRfVElUTEUuaW5kZXhPZihzZWF0KTtcbiAgICAgICAgICAgIGlmKHRyYWluW3NlYXROdW1dID09IFwi5pyJXCIgfHwgdHJhaW5bc2VhdE51bV0gPiAwKSB7XG4gICAgICAgICAgICAgIHdpbnN0b24uZGVidWcob3JkZXIudHJhaW5EYXRlK1wiL1wiK3RyYWluWzNdK1wiL1wiK3NlYXQrXCIvXCIrdHJhaW5bc2VhdE51bV0pO1xuICAgICAgICAgICAgICBpZihvcmRlci5wbGFuVHJhaW5zLmluY2x1ZGVzKHRyYWluWzNdKSkge1xuICAgICAgICAgICAgICAgIHBsYW5UcmFpbnMucHVzaCh0cmFpbik7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgb3JkZXIuYXZhaWxhYmxlVHJhaW5zID0gcGxhblRyYWlucztcbiAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlY3Vyc2l2ZVF1ZXJ5TGVmdFRpY2tldCgpOiBPYnNlcnZhYmxlPE9yZGVyPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8T3JkZXI+KT0+IHtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCh0aGlzLm5leHRPcmRlcigpKTtcbiAgICAgIH0pXG4gICAgICAubWVyZ2VNYXAoKG9yZGVyOiBPcmRlcik9PnRoaXMuYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KG9yZGVyKSlcbiAgICAgIC5kbygoKT0+IHtcbiAgICAgICAgaWYodGhpcy5xdWVyeSkge1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmNsZWFyTGluZSgpO1xuICAgICAgICAgIHByb2Nlc3Muc3Rkb3V0LmN1cnNvclRvKDApO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLm1hcChvcmRlcj0+IHtcbiAgICAgICAgaWYob3JkZXIuYXZhaWxhYmxlVHJhaW5zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gZmFsc2U7XG4gICAgICAgICAgLy8gcHJvY2Vzcy5zdGRvdXQud3JpdGUoY2hhbGtge3llbGxvdyDmnInlj6/otK3kubDkvZnnpaggJHtwbGFuVHJhaW4udG9TdHJpbmcoKX19YCk7XG4gICAgICAgICAgb3JkZXIudHJhaW5TZWNyZXRTdHIgPSBvcmRlci5hdmFpbGFibGVUcmFpbnNbMF1bMF07XG4gICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRydWU7XG4gICAgICAgICAgdGhyb3cgY2hhbGtg5rKh5pyJ5Y+v6LSt5Lmw5L2Z56WoIHt5ZWxsb3cgJHtvcmRlci5mcm9tU3RhdGlvbk5hbWV9fSDliLAge3llbGxvdyAke29yZGVyLnRvU3RhdGlvbk5hbWV9fSAke29yZGVyLnBhc3NTdGF0aW9uTmFtZT8n5YiwJytvcmRlci5wYXNzU3RhdGlvbk5hbWUrJyAnOicnfXt5ZWxsb3cgJHtvcmRlci50cmFpbkRhdGV9fWA7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLmRvKGVycj0+cHJvY2Vzcy5zdGRvdXQud3JpdGUoZXJyKSkuZGVsYXkoNTAwKSlcbiAgICAgIC8vIOajgOafpeeUqOaIt+eZu+W9leeKtuaAgVxuICAgICAgLy8gLm1lcmdlTWFwKChvcmRlcjogT3JkZXIpPT50aGlzLm9ic2VydmFibGVDaGVja1VzZXIoKS5tYXAoKCk9Pm9yZGVyKSlcblxuICAgICAgLy8gU3RlcCAxMSDpooTmj5DkuqTorqLljZXvvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT57XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYOmihOaPkOS6pOiuouWNlSB7eWVsbG93ICR7b3JkZXIuZnJvbVN0YXRpb25OYW1lfX0g5YiwIHt5ZWxsb3cgJHtvcmRlci50b1N0YXRpb25OYW1lfX0g5pel5pyfIHt5ZWxsb3cgJHtvcmRlci50cmFpbkRhdGV9fWApO1xuICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5zdWJtaXRPcmRlclJlcXVlc3Qob3JkZXIpKVxuICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgZXJyb3IkLmRvKGVycj0+d2luc3Rvbi5kZWJ1ZyhcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycikpXG4gICAgICAgICAgICAgICAgLmRlbGF5KDEwMClcbiAgICAgICAgICApXG4gICAgICAgICAgLm1hcChib2R5PT5bb3JkZXIsIGJvZHldKTtcbiAgICAgIH0pXG4gICAgICAubWFwKChbb3JkZXIsIGJvZHldKT0+e1xuICAgICAgICBpZihib2R5LnN0YXR1cykge1xuICAgICAgICAgIHdpbnN0b24uZGVidWcoY2hhbGtge2JsdWUgU3VibWl0IE9yZGVyIFJlcXVlc3Qgc3VjY2VzcyF9YCk7XG4gICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgLy8g5oKo6L+Y5pyJ5pyq5aSE55CG55qE6K6i5Y2VXG4gICAgICAgICAgLy8g6K+l6L2m5qyh5pqC5LiN5Yqe55CG5Lia5YqhXG4gICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5Lm1lc3NhZ2VzWzBdfX1gKTtcbiAgICAgICAgICAvLyB0aGlzLmRlc3Ryb3koKTtcbiAgICAgICAgICB0aHJvdyBjaGFsa2B7cmVkLmJvbGQgJHtib2R5Lm1lc3NhZ2VzWzBdfX1gO1xuICAgICAgICB9XG4gICAgICB9KVxuICAgICAgLy8gU3RlcCAxMiDmqKHmi5/ot7PovazpobXpnaJJbml0RGPvvIxQb3N0XG4gICAgICAubWVyZ2VNYXAob3JkZXI9PlxuICAgICAgICB0aGlzLmNvbmZpcm1QYXNzZW5nZXJJbml0RGMoKVxuICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgIGVycm9yJC5tZXJnZU1hcCgoZXJyKT0+IHtcbiAgICAgICAgICAgICAgICBpZihlcnIgPT0gdGhpcy5TWVNURU1fQlVTU1kpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGVycik7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgICAgIH1lbHNlIGlmKGVyciA9PSB0aGlzLlNZU1RFTV9NT1ZFRCkge1xuICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coZXJyKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRpbWVyKDUwMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KGVycik7XG5cbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICApXG4gICAgICAgICAgLmRvKG9yZGVyU3VibWl0UmVxdWVzdD0+IHtcbiAgICAgICAgICAgIHdpbnN0b24uZGVidWcoXCJjb25maXJtUGFzc2VuZ2VyIEluaXQgRGMgc3VjY2VzcyEgXCIrb3JkZXJTdWJtaXRSZXF1ZXN0LnRva2VuKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cgJHtvcmRlclN1Ym1pdFJlcXVlc3QudGlja2V0SW5mby5sZWZ0RGV0YWlscy5qb2luKFwiXFx0XCIpfX1gKTtcbiAgICAgICAgICB9KVxuICAgICAgICAgIC5tYXAob3JkZXJTdWJtaXRSZXF1ZXN0PT57XG4gICAgICAgICAgICBvcmRlci5yZXF1ZXN0ID0gb3JkZXJTdWJtaXRSZXF1ZXN0O1xuXG4gICAgICAgICAgICBsZXQgaGFzU2VhdCA9IG9yZGVyLnNlYXRDbGFzc2VzLnNvbWUoKHNlYXRUeXBlOiBzdHJpbmcpPT4ge1xuICAgICAgICAgICAgICByZXR1cm4gb3JkZXJTdWJtaXRSZXF1ZXN0LnRpY2tldEluZm8ubGltaXRCdXlTZWF0VGlja2V0RFRPLnRpY2tldF9zZWF0X2NvZGVNYXBbXCIxXCJdLnNvbWUoKHRpY2tldFNlYXRDb2RlKT0+IHtcbiAgICAgICAgICAgICAgICBpZih0aWNrZXRTZWF0Q29kZS52YWx1ZSA9PSBzZWF0VHlwZSkge1xuICAgICAgICAgICAgICAgICAgb3JkZXIuc2VhdFR5cGUgPSB0aWNrZXRTZWF0Q29kZS5pZDtcbiAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIGlmKCFoYXNTZWF0KSB7XG4gICAgICAgICAgICAgIHdpbnN0b24uZGVidWcoXCJjb25maXJtUGFzc2VuZ2VyIEluaXQg5rKh5pyJ5Y+v6LSt5Lmw5L2Z56Wo77yM6YeN5paw5p+l6K+iXCIpO1xuICAgICAgICAgICAgICB0aHJvdyAncmV0cnknO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIC8vIFN0ZXAgMTMg5bi455So6IGU57O75Lq656Gu5a6a77yMUG9zdFxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+IHtcbiAgICAgICAgaWYodGhpcy5wYXNzZW5nZXJzKSB7XG4gICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzID0gdGhpcy5wYXNzZW5nZXJzO1xuICAgICAgICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKG9yZGVyKTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXIucmVxdWVzdC50b2tlbilcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgICBlcnJvciQuZG8oKGVycik9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAgICAgICAuZGVsYXkoNTAwKVxuICAgICAgICAgICAgKVxuICAgICAgICAgICAgLm1hcChwYXNzZW5nZXJzPT4ge1xuICAgICAgICAgICAgICB0aGlzLnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xuICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xuICAgICAgICAgICAgICByZXR1cm4gb3JkZXI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC8vIFN0ZXAgMTQg6LSt56Wo5Lq656Gu5a6a77yMUG9zdFxuICAgICAgLnN3aXRjaE1hcCgob3JkZXI6IE9yZGVyKT0+XG4gICAgICAgIHRoaXMuY2hlY2tPcmRlckluZm8ob3JkZXIucmVxdWVzdC50b2tlbiwgb3JkZXIuc2VhdFR5cGUsIG9yZGVyLnJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+XG4gICAgICAgICAgICBlcnJvciQuZG8oZXJyPT53aW5zdG9uLmVycm9yKGVycikpLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgICAgaWYoZXJyID09IFwi5rKh5pyJ55u45YWz6IGU57O75Lq6XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGltZXIoNTAwKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgIClcbiAgICAgICAgICAubWFwKGJvZHk9PntcbiAgICAgICAgICAgIG9yZGVyLnJlcXVlc3Qub3JkZXJJbmZvID0gYm9keTtcbiAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICB9KVxuICAgICAgKVxuICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT57XG4gICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYOWHhuWkh+i/m+WFpeaOkumYn2ApO1xuICAgICAgICByZXR1cm4gdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyLnJlcXVlc3QudG9rZW4sIG9yZGVyLnNlYXRUeXBlLCBvcmRlci5yZXF1ZXN0Lm9yZGVyUmVxdWVzdCwgb3JkZXIucmVxdWVzdC50aWNrZXRJbmZvKVxuICAgICAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgICAgIC8qXG4gICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICBzdGF0dXM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf57mB5b+Z77yM6K+356iN5ZCO6YeN6K+V77yBJyBdLFxuICAgICAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGJvZHk7XG4gICAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICAgIHRocm93IGJvZHkubWVzc2FnZXNbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcbiAgICAgICAgICAucmV0cnlXaGVuKGVycm9yJD0+ZXJyb3IkLm1lcmdlTWFwKGVycj0+IHtcbiAgICAgICAgICAgICAgaWYoZXJyID09ICfns7vnu5/nuYHlv5nvvIzor7fnqI3lkI7ph43or5XvvIEnKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoJy4nKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcigxMDAwKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgfSkpXG4gICAgICAgICAgLm1hcChib2R5PT57XG4gICAgICAgICAgICB3aW5zdG9uLmRlYnVnKGJvZHkpO1xuICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5xdWV1ZUluZm8gPSBib2R5O1xuICAgICAgICAgICAgcmV0dXJuIG9yZGVyO1xuICAgICAgICAgIH0pXG4gICAgICAgICAgLmRvKCgpPT5jb25zb2xlLmxvZygpKVxuICAgICAgfSlcbiAgICAgIC5zd2l0Y2hNYXAoKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgIC8vIOiLpSBTdGVwIDE0IOS4reeahCBcImlmU2hvd1Bhc3NDb2RlXCIgPSBcIllcIu+8jOmCo+S5iOWkmuS6hui+k+WFpemqjOivgeeggei/meS4gOatpe+8jFBvc3RcbiAgICAgICAgaWYob3JkZXIucmVxdWVzdC5vcmRlckluZm8uZGF0YS5pZlNob3dQYXNzQ29kZSA9PSBcIllcIikge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVHZXRQYXNzQ29kZU5ldyhvcmRlcik7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihvcmRlcik7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgICAuc3dpdGNoTWFwKChvcmRlcjogT3JkZXIpPT57XG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYOaPkOS6pOaOkumYn+iuouWNlWApO1xuICAgICAgICByZXR1cm4gdGhpcy5jb25maXJtU2luZ2xlRm9yUXVldWUob3JkZXIucmVxdWVzdC50b2tlbixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9yZGVyLnNlYXRUeXBlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3JkZXIucmVxdWVzdC5wYXNzZW5nZXJzLmRhdGEubm9ybWFsX3Bhc3NlbmdlcnMsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5yZXF1ZXN0LnRpY2tldEluZm8sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcmRlci5wbGFuUGVwb2xlcylcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5lcnJvciQuZGVsYXkoMTAwKSlcbiAgICAgICAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgICAgICAgaWYoYm9keS5zdGF0dXMgJiYgYm9keS5kYXRhLnN1Ym1pdFN0YXR1cykge1xuICAgICAgICAgICAgICAgIHJldHVybiBvcmRlcjtcbiAgICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgICAgIHN0YXR1czogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcbiAgICAgICAgICAgICAgICAgIGRhdGE6IHsgZXJyTXNnOiAn5L2Z56Wo5LiN6Laz77yBJywgc3VibWl0U3RhdHVzOiBmYWxzZSB9LFxuICAgICAgICAgICAgICAgICAgbWVzc2FnZXM6IFtdLFxuICAgICAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAgICAgICovXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7cmVkLmJvbGQgJHtib2R5LmRhdGEuZXJyTXNnfX1gKVxuICAgICAgICAgICAgICAgIHRocm93ICdyZXRyeSc7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICB9KVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbyhlcnI9PndpbnN0b24uZXJyb3IoY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICBpZihlcnIgPT0gJ3JldHJ5Jykge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig1MDApO1xuICAgICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdyhlcnIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG4gICAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlR2V0UGFzc2VuZ2VycyhvcmRlcjogT3JkZXIpOiBPYnNlcnZhYmxlPGFueT4ge1xuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PlxuICAgICAgICB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXIucmVxdWVzdC50b2tlbilcbiAgICAgICAgICAgIC5yZXRyeVdoZW4oZXJyb3IkPT5cbiAgICAgICAgICAgICAgICBlcnJvciQuZG8oKGVycik9PndpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7ZXJyfX1gKSlcbiAgICAgICAgICAgICAgICAuZGVsYXkoNTAwKVxuICAgICAgICAgICAgKVxuICAgICAgKVxuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlR2V0UGFzc0NvZGVOZXcob3JkZXI6IE9yZGVyKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgLnN3aXRjaE1hcCgoKT0+IHRoaXMuZ2V0UGFzc0NvZGVOZXcoKSlcbiAgICAgIC5zd2l0Y2hNYXAoKCk9PiB0aGlzLmNoZWNrUmFuZENvZGVBbnN5bigpKVxuICB9XG5cbiAgcHJpdmF0ZSBidWlsZE9yZGVyRmxvdygpIHtcblxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxuICAgIHJldHVybiBPYnNlcnZhYmxlLm9mKDEpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMubGVmdFRpY2tldEluaXQoKSlcbiAgICAgIC5zd2l0Y2hNYXAoKCk9PnRoaXMucmVjdXJzaXZlUXVlcnlMZWZ0VGlja2V0KCkpXG4gICAgICAvLyBTdGVwIDE4IOafpeivouaOkumYn+etieW+heaXtumXtO+8gVxuICAgICAgLnN1YnNjcmliZShcbiAgICAgICAgKG9yZGVyOiBPcmRlcik9PiB7XG4gICAgICAgICAgdGhpcy5vYnNRdWVyeU9yZGVyV2FpdFQob3JkZXIpXG4gICAgICAgICAgICAubWVyZ2VNYXAoKG9yZGVySWQpPT50aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKSlcbiAgICAgICAgICAgIC5kbygoYm9keSk9PiB7XG4gICAgICAgICAgICAgIGlmKGJvZHkuZGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJpbnRNeU9yZGVyTm9Db21wbGV0ZShib2R5KTtcbiAgICAgICAgICAgICAgICAvLyAwLjXnp5Llk43kuIDmrKHvvIzlk43pk4MzMOWIhumSn1xuICAgICAgICAgICAgICAgIGJlZXBlcig2MCozMCoyKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5zdWJzY3JpYmUoKCk9PiB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDnu5PmnZ99YCk7XG4gICAgICAgICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgICAgICAgIH0sZXJyPT53aW5zdG9uLmVycm9yKGNoYWxrYHt5ZWxsb3cg6ZSZ6K+v57uT5p2fICR7ZXJyfX1gKSk7XG4gICAgICAgIH0sXG4gICAgICAgIGVycj0+e1xuICAgICAgICAgIHdpbnN0b24uZXJyb3IoY2hhbGtge3JlZC5ib2xkICR7SlNPTi5zdHJpbmdpZnkoZXJyKX19YCk7XG4gICAgICAgICAgdGhpcy5kZXN0cm95KCk7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBvYnNlcnZhYmxlQ2hlY2tVc2VyKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuXG4gICAgLy8gU3RlcCAxMCDpqozor4HnmbvlvZXvvIxQb3N0XG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKSA9PiB0aGlzLmNoZWNrVXNlcigpKVxuICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kbygoZXJyKT0+Y29uc29sZS5lcnJvcihcIkNoZWNrIHVzZXIgZXJyb3IgXCIrZXJyKSkpXG4gICAgICAubWVyZ2VNYXAoYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5kYXRhLmZsYWcpIHtcbiAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZihib2R5KTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHJldHVybiB0aGlzLm9ic2VydmFibGVMb2dpbkluaXQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIG9ic1F1ZXJ5T3JkZXJXYWl0VChvcmRlcjogT3JkZXIpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5vZigxKVxuICAgICAgICAubWVyZ2VNYXAoKCk9PiB0aGlzLnF1ZXJ5T3JkZXJXYWl0VGltZShcIlwiKSlcbiAgICAgICAgLm1hcChvcmRlclF1ZXVlPT4ge1xuICAgICAgICAgIHdpbnN0b24uZGVidWcoSlNPTi5zdHJpbmdpZnkob3JkZXJRdWV1ZSkpO1xuICAgICAgICAgIC8qKlxuICAgICAgICAgIHtcbiAgICAgICAgICAgIFwidmFsaWRhdGVNZXNzYWdlc1Nob3dJZFwiOiBcIl92YWxpZGF0b3JNZXNzYWdlXCIsXG4gICAgICAgICAgICBcInN0YXR1c1wiOiB0cnVlLFxuICAgICAgICAgICAgXCJodHRwc3RhdHVzXCI6IDIwMCxcbiAgICAgICAgICAgIFwiZGF0YVwiOiB7XG4gICAgICAgICAgICAgIFwicXVlcnlPcmRlcldhaXRUaW1lU3RhdHVzXCI6IHRydWUsXG4gICAgICAgICAgICAgIFwiY291bnRcIjogMCxcbiAgICAgICAgICAgICAgXCJ3YWl0VGltZVwiOiAyNDQ0LFxuICAgICAgICAgICAgICBcInJlcXVlc3RJZFwiOiA2Mzc2NzI3Mjg1NjM0Nzk3MDAwLFxuICAgICAgICAgICAgICBcIndhaXRDb3VudFwiOiAyMDAwLFxuICAgICAgICAgICAgICBcInRvdXJGbGFnXCI6IFwiZGNcIixcbiAgICAgICAgICAgICAgXCJvcmRlcklkXCI6IG51bGxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBcIm1lc3NhZ2VzXCI6IFtdLFxuICAgICAgICAgICAgXCJ2YWxpZGF0ZU1lc3NhZ2VzXCI6IHt9XG4gICAgICAgICAgfVxuICAgICAgICAgICovXG4gICAgICAgICAgaWYob3JkZXJRdWV1ZS5zdGF0dXMpIHtcbiAgICAgICAgICAgIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gMCB8fCBvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0xKSB7XG4gICAgICAgICAgICAgIC8vcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYOaCqOeahOi9puelqOiuouWNleWPt+aYryB7cmVkLmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEub3JkZXJJZH19YCk7XG4gICAgICAgICAgICAgIHJldHVybiBvcmRlclF1ZXVlLmRhdGEub3JkZXJJZDtcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTIpe1xuICAgICAgICAgICAgICBpZihvcmRlclF1ZXVlLmRhdGEubXNnKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke29yZGVyUXVldWUuZGF0YS5tc2d9fWApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHRocm93IG9yZGVyUXVldWUuZGF0YS5tc2c7XG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0zKXtcbiAgICAgICAgICAgICAgdGhyb3cgXCLmgqjnmoTovabnpajorqLljZXlt7Lnu4/lj5bmtoghXCI7XG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC00KXtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCLmgqjnmoTovabnpajorqLljZXmraPlnKjlpITnkIYsIOivt+eojeetiS4uLlwiKTtcbiAgICAgICAgICAgIH1lbHNlIHtcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtg5o6S6Zif5Lq65pWw77yae3llbGxvdy5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLndhaXRDb3VudH19IOmihOiuoeetieW+heaXtumXtO+8mnt5ZWxsb3cuYm9sZCAke3BhcnNlSW50KG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSAvIDEuNSl9fSDliIbpkp9gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhyb3cgJ3JldHJ5JztcbiAgICAgICAgfSlcbiAgICAgICAgLnJldHJ5V2hlbigoZXJyb3JzJCk9PmVycm9ycyQubWVyZ2VNYXAoKGVycik9PiB7XG4gICAgICAgICAgICBpZihlcnIgPT0gJ3JldHJ5Jykge1xuICAgICAgICAgICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aW1lcig0MDAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coZXJyKTtcbiAgICAgICAgICB9KVxuICAgICAgICApXG4gICAgICAgIDtcbiAgfVxuXG4gIC8qKlxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cbiAgICpcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcbiAgICogQHBhcmFtIHRvU3RhdGlvbk5hbWUg5Yiw6L6+56uZXG4gICAqIEBwYXJhbSB0cmFpbk5hbWVzIOWIl+i9plxuICAgKlxuICAgKiBAcmV0dXJuIFByb21pc2VcbiAgICovXG4gIHB1YmxpYyBxdWVyeUxlZnRUaWNrZXRzKHRyYWluRGF0ZTogc3RyaW5nLCBmcm9tU3RhdGlvbjogc3RyaW5nLCB0b1N0YXRpb246IHN0cmluZywgdHJhaW5OYW1lcz86IFJlYWRvbmx5QXJyYXk8c3RyaW5nPik6IE9ic2VydmFibGU8QXJyYXk8YW55Pj4ge1xuICAgIGlmKCF0cmFpbkRhdGUpIHtcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5LmY6L2m5pel5pyffWApO1xuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coJ+ivt+i+k+WFpeS5mOi9puaXpeacnycpO1xuICAgIH1cbiAgICAvLyB0aGlzLkJBQ0tfVFJBSU5fREFURSA9IHRyYWluRGF0ZTtcblxuICAgIGlmKCFmcm9tU3RhdGlvbikge1xuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXlh7rlj5Hnq5l9YCk7XG4gICAgICByZXR1cm4gT2JzZXJ2YWJsZS50aHJvdygn6K+36L6T5YWl5Ye65Y+R56uZJyk7XG4gICAgfVxuICAgIC8vIHRoaXMuRlJPTV9TVEFUSU9OX05BTUUgPSBmcm9tU3RhdGlvbk5hbWU7XG5cbiAgICBpZighdG9TdGF0aW9uKSB7XG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWIsOi+vuermX1gKTtcbiAgICAgIHJldHVybiBPYnNlcnZhYmxlLnRocm93KCfor7fovpPlhaXliLDovr7nq5knKTtcbiAgICB9XG4gICAgLy8gdGhpcy5UT19TVEFUSU9OX05BTUUgPSB0b1N0YXRpb25OYW1lO1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUub2YoMSlcbiAgICAgIC5tZXJnZU1hcCgoKT0+dGhpcy5xdWVyeUxlZnRUaWNrZXQoe3RyYWluRGF0ZTogdHJhaW5EYXRlLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZnJvbVN0YXRpb246IGZyb21TdGF0aW9uLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdG9TdGF0aW9uOiB0b1N0YXRpb259KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIClcbiAgICAgIC8vIC5yZXRyeShOdW1iZXIuTUFYX1NBRkVfSU5URUdFUilcbiAgICAgIC5yZXRyeVdoZW4oKGVycm9ycyQpPT5lcnJvcnMkLmRvKCgpPT5wcm9jZXNzLnN0ZG91dC53cml0ZShcIi5cIikpLmRlbGF5KDE1MDApKVxuICAgICAgLm1hcCh0cmFpbnNEYXRhID0+IHRyYWluc0RhdGEucmVzdWx0KVxuICAgICAgLm1hcChyZXN1bHQgPT4ge1xuICAgICAgICBsZXQgdHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+PiA9IFtdO1xuXG4gICAgICAgIHJlc3VsdC5mb3JFYWNoKChlbGVtZW50OiBzdHJpbmcpPT4ge1xuICAgICAgICAgIGxldCB0cmFpbjogQXJyYXk8c3RyaW5nPiA9IGVsZW1lbnQuc3BsaXQoXCJ8XCIpO1xuICAgICAgICAgIHRyYWluWzRdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls0XSk7XG4gICAgICAgICAgdHJhaW5bNV0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzVdKTtcbiAgICAgICAgICB0cmFpbls2XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNl0pO1xuICAgICAgICAgIHRyYWluWzddID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpbls3XSk7XG4gICAgICAgICAgdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiSVNfVElNRV9OT1RfQlVZXCIgPyBcIuWIl+i9puWBnOi/kFwiOnRyYWluWzExXTtcbiAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJOXCIgPyBcIuaXoOelqFwiOnRyYWluWzExXTtcbiAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJZXCIgPyBcIuacieelqFwiOnRyYWluWzExXTtcbiAgICAgICAgICAvLyDljLnphY3ovpPlhaXnmoTliJfovablkI3np7DnmoTmraPliJnooajovr7lvI/mnaHku7ZcbiAgICAgICAgICBpZighdHJhaW5OYW1lcyB8fCB0cmFpbk5hbWVzLmZpbHRlcih0bj0+dHJhaW5bM10ubWF0Y2gobmV3IFJlZ0V4cCh0bikpICE9IG51bGwpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRyYWlucy5wdXNoKHRyYWluKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdHJhaW5zO1xuICAgICAgfSk7XG4gIH1cblxuICAvKipcbiAgICog5p+l6K+i5YiX6L2m5L2Z56Wo5L+h5oGvXG4gICAqXG4gICAqIEBwYXJhbSB0cmFpbkRhdGUg5LmY6L2m5pel5pyfXG4gICAqIEBwYXJhbSBmcm9tU3RhdGlvbk5hbWUg5Ye65Y+R56uZXG4gICAqIEBwYXJhbSB0b1N0YXRpb25OYW1lIOWIsOi+vuermVxuICAgKiBAcGFyYW0gcGFzc1N0YXRpb25OYW1lIOmAlOe7j+ermVxuICAgKiBAcGFyYW0gdHJhaW5OYW1lcyDliJfovaZcbiAgICogQHBhcmFtIGYg6L2m5qyh6L+H5ruk5p2h5Lu2XG4gICAqIEBwYXJhbSB0IOaXtumXtOi/h+a7pOadoeS7tlxuICAgKlxuICAgKiBAcmV0dXJuIHZvaWRcbiAgICovXG4gIHB1YmxpYyBsZWZ0VGlja2V0cyhbdHJhaW5EYXRlLCBmcm9tU3RhdGlvbk5hbWUsIHRvU3RhdGlvbk5hbWUsIHBhc3NTdGF0aW9uTmFtZV0sIHtmaWx0ZXIsZix0aW1lLHQsb3JkZXJieSxvfSkge1xuICAgIGxldCBmcm9tU3RhdGlvbjogc3RyaW5nID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShmcm9tU3RhdGlvbk5hbWUpO1xuICAgIGxldCB0b1N0YXRpb246IHN0cmluZyA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUodG9TdGF0aW9uTmFtZSk7XG4gICAgbGV0IHBhc3NTdGF0aW9uOiBzdHJpbmcgPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKHBhc3NTdGF0aW9uTmFtZSk7XG5cbiAgICBsZXQgcGxhblRyYWluczogUmVhZG9ubHlBcnJheTxzdHJpbmc+fHVuZGVmaW5lZCA9XG4gICAgICB0eXBlb2YgZiA9PSBcInN0cmluZ1wiID8gZi5zcGxpdCgnLCcpOih0eXBlb2YgZmlsdGVyID09IFwic3RyaW5nXCIgPyBmaWx0ZXIuc3BsaXQoJywnKTp1bmRlZmluZWQpO1xuICAgIGxldCBwbGFuVGltZXM6IFJlYWRvbmx5QXJyYXk8c3RyaW5nPnx1bmRlZmluZWQgPVxuICAgICAgdHlwZW9mIHQgPT0gXCJzdHJpbmdcIiA/IHQuc3BsaXQoJywnKToodHlwZW9mIHRpbWUgPT0gXCJzdHJpbmdcIiA/IHRpbWUuc3BsaXQoJywnKTp1bmRlZmluZWQpO1xuICAgIGxldCBwbGFuT3JkZXJCeTogQXJyYXk8c3RyaW5nfG51bWJlcj58dW5kZWZpbmVkID1cbiAgICAgIHR5cGVvZiBvID09IFwic3RyaW5nXCIgPyBvLnNwbGl0KCcsJyk6KHR5cGVvZiBvcmRlcmJ5ID09IFwic3RyaW5nXCIgPyBvcmRlcmJ5LnNwbGl0KCcsJyk6dW5kZWZpbmVkKTtcblxuICAgIGlmKHBsYW5PcmRlckJ5KSB7XG4gICAgICBwbGFuT3JkZXJCeSA9IHBsYW5PcmRlckJ5Lm1hcCgoZmllbGROYW1lOnN0cmluZ3xudW1iZXIpID0+IHtcbiAgICAgICAgaWYoZmllbGROYW1lWzBdID09PSAnLScgfHwgZmllbGROYW1lWzBdID09PSAnKycpIHtcbiAgICAgICAgICByZXR1cm4gZmllbGROYW1lWzBdK3RoaXMuVElDS0VUX1RJVExFLmluZGV4T2YoZmllbGROYW1lLnN1YnN0cmluZygxKSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuVElDS0VUX1RJVExFLmluZGV4T2YoZmllbGROYW1lKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuYnVpbGRRdWVyeUxlZnRUaWNrZXRGbG93KHtcbiAgICAgICAgdHJhaW5EYXRlOiB0cmFpbkRhdGVcbiAgICAgICAgLGJhY2tUcmFpbkRhdGU6IHRyYWluRGF0ZVxuICAgICAgICAsZnJvbVN0YXRpb25OYW1lOiBmcm9tU3RhdGlvbk5hbWVcbiAgICAgICAgLHRvU3RhdGlvbk5hbWU6IHRvU3RhdGlvbk5hbWVcbiAgICAgICAgLGZyb21TdGF0aW9uOiBmcm9tU3RhdGlvblxuICAgICAgICAsdG9TdGF0aW9uOiB0b1N0YXRpb25cbiAgICAgICAgLHBhc3NTdGF0aW9uOiBwYXNzU3RhdGlvblxuICAgICAgICAscGxhblRyYWluczogcGxhblRyYWluc1xuICAgICAgICAscGxhblRpbWVzOiBwbGFuVGltZXNcbiAgICAgICAgLHBsYW5PcmRlckJ5OiBwbGFuT3JkZXJCeVxuICAgICAgICAsc2VhdENsYXNzZXM6IFtdXG4gICAgICB9KVxuICAgICAgLnN1YnNjcmliZSgob3JkZXI6IElPcmRlcikgPT4ge1xuICAgICAgICBsZXQgdHJhaW5zID0gdGhpcy5yZW5kZXJUcmFpbkxpc3RUaXRsZShvcmRlci50cmFpbnMpO1xuICAgICAgICBpZih0cmFpbnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg5rKh5pyJ56ym5ZCI5p2h5Lu255qE6L2m5qyhfWApXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5yZW5kZXJMZWZ0VGlja2V0cyh0cmFpbnMpO1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIHJlbmRlclRyYWluTGlzdFRpdGxlKHRyYWluczogQXJyYXk8QXJyYXk8c3RyaW5nPj4pOiBBcnJheTxBcnJheTxzdHJpbmc+PiB7XG4gICAgdmFyIHRpdGxlID0gdGhpcy5USUNLRVRfVElUTEUubWFwKHQ9PmNoYWxrYHtibHVlICR7dH19YCk7XG5cbiAgICB0cmFpbnMuZm9yRWFjaCgodHJhaW4sIGluZGV4KT0+IHtcbiAgICAgIGlmKGluZGV4ICUgMzAgPT09IDApIHtcbiAgICAgICAgdHJhaW5zLnNwbGljZShpbmRleCwgMCwgdGl0bGUpO1xuICAgICAgfVxuICAgIH0pXG4gICAgcmV0dXJuIHRyYWlucztcbiAgfVxuXG4gIHByaXZhdGUgcmVuZGVyTGVmdFRpY2tldHModHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+Pikge1xuICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHRyYWlucywge1xuICAgICAgY29sdW1uU3BsaXR0ZXI6ICd8JyxcbiAgICAgIGNvbHVtbnM6IFtcIjNcIiwgXCI0XCIsIFwiNVwiLCBcIjZcIiwgXCI3XCIsIFwiOFwiLCBcIjlcIiwgXCIxMFwiLCBcIjExXCIsIFwiMjBcIiwgXCIyMVwiLCBcIjIyXCIsIFwiMjNcIiwgXCIyNFwiLCBcIjI1XCIsXG4gICAgICAgICAgICAgICAgXCIyNlwiLCBcIjI3XCIsIFwiMjhcIiwgXCIyOVwiLCBcIjMwXCIsIFwiMzFcIiwgXCIzMlwiXVxuICAgIH0pXG5cbiAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcbiAgfVxuXG4gIHB1YmxpYyBteU9yZGVyTm9Db21wbGV0ZVJlcG9ydCgpIHtcbiAgICB0aGlzLmluaXROb0NvbXBsZXRlKClcbiAgICAgIC5tZXJnZU1hcCgoKT0+XG4gICAgICAgIHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpXG4gICAgICAgICAgLnJldHJ5V2hlbihlcnJvciQ9PmVycm9yJC5kZWxheSg1MDApKVxuICAgICAgKVxuICAgICAgLnN1YnNjcmliZSh4PT4ge1xuICAgICAgICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHgsIHtcbiAgICAgICAgICAgIGNvbHVtblNwbGl0dGVyOiAnIHwgJ1xuICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgY29uc29sZS5sb2coY29sdW1ucyk7XG4gICAgICAgIH0sIGVycm9yPT4ge1xuICAgICAgICAgIHdpbnN0b24uZXJyb3IoZXJyb3IpO1xuICAgICAgICB9KVxuICB9XG5cbiAgcHVibGljIGxvZ2luSW5pdCgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2luaXRcIjtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsLFxuICAgICAgbWV0aG9kOiBcIkdFVFwiLFxuICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gIH1cblxuICBwcml2YXRlIGdldENhcHRjaGEoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXG4gICAgICAgICAgXCJtb2R1bGVcIjogXCJsb2dpblwiLFxuICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiLFxuICAgICAgICAgIFwiMC4xNzIzMTg3MjcwMzM4OTA2MlwiOlwiXCJcbiAgICAgIH07XG5cbiAgICB2YXIgcGFyYW0gPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgbnVsbClcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWltYWdlP1wiK3BhcmFtO1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICB9O1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8dm9pZD4pPT4ge1xuICAgICAgdGhpcy5yYXdSZXF1ZXN0KG9wdGlvbnMsIChlcnJvcjogYW55LCByZXNwb25zZTogYW55LCBib2R5OiBzdHJpbmcpID0+IHtcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiBvYnNlcnZlci5lcnJvcihlcnJvcik7XG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcbiAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVzdGlvbkNhcHRjaGEoKTogT2JzZXJ2YWJsZTxzdHJpbmc+IHtcbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcbiAgICB9KTtcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjxzdHJpbmc+KT0+IHtcbiAgICAgIGxldCBjaGlsZCA9IGNoaWxkX3Byb2Nlc3MuZXhlYygnY2FwdGNoYS5CTVAnLCgpPT57fSk7XG5cbiAgICAgIHJsLnF1ZXN0aW9uKGNoYWxrYHtyZWQuYm9sZCDor7fovpPlhaXpqozor4HnoIF9OmAsIChwb3NpdGlvblN0cikgPT4ge1xuICAgICAgICBybC5jbG9zZSgpO1xuXG4gICAgICAgIGlmKHR5cGVvZiBwb3NpdGlvblN0ciA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgbGV0IHBvc2l0aW9uczogQXJyYXk8c3RyaW5nPiA9IFtdO1xuICAgICAgICAgIHBvc2l0aW9uU3RyLnNwbGl0KCcsJykuZm9yRWFjaChlbD0+cG9zaXRpb25zPXBvc2l0aW9ucy5jb25jYXQoZWwuc3BsaXQoJyAnKSkpO1xuICAgICAgICAgIG9ic2VydmVyLm5leHQocG9zaXRpb25zLm1hcCgocG9zaXRpb246IHN0cmluZyk9PiB7XG4gICAgICAgICAgICAgIHN3aXRjaChwb3NpdGlvbikge1xuICAgICAgICAgICAgICAgIGNhc2UgXCIxXCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCI0MCw0NVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCIyXCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxMTAsNDVcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiM1wiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTgwLDQ1XCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjRcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjI1MCw0NVwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI1XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCI0MCwxMTBcIjtcbiAgICAgICAgICAgICAgICBjYXNlIFwiNlwiOlxuICAgICAgICAgICAgICAgICAgcmV0dXJuIFwiMTEwLDExMFwiO1xuICAgICAgICAgICAgICAgIGNhc2UgXCI3XCI6XG4gICAgICAgICAgICAgICAgICByZXR1cm4gXCIxODAsMTEwXCI7XG4gICAgICAgICAgICAgICAgY2FzZSBcIjhcIjpcbiAgICAgICAgICAgICAgICAgIHJldHVybiBcIjI1MCwxMTBcIjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkuam9pbignLCcpKTtcbiAgICAgICAgICAgIG9ic2VydmVyLmNvbXBsZXRlKCk7XG4gICAgICAgICAgfWVsc2Uge1xuICAgICAgICAgICAgb2JzZXJ2ZXIuZXJyb3IoXCLovpPlhaXmoLzlvI/plJnor69cIik7XG4gICAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGNoZWNrQ2FwdGNoYSgpOiBPYnNlcnZhYmxlPHZvaWQ+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWNoZWNrXCI7XG5cbiAgICByZXR1cm4gdGhpcy5xdWVzdGlvbkNhcHRjaGEoKVxuICAgICAgLm1lcmdlTWFwKHBvc2l0aW9ucz0+e1xuICAgICAgICB2YXIgZGF0YSA9IHtcbiAgICAgICAgICAgIFwiYW5zd2VyXCI6IHBvc2l0aW9ucyxcbiAgICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcbiAgICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiXG4gICAgICAgICAgfTtcblxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgICAgICB1cmw6IHVybFxuICAgICAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcbiAgICAgICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICAgICAsZm9ybTogZGF0YVxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKVxuICAgICAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gNCkge1xuICAgICAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRocm93IGJvZHkucmVzdWx0X21lc3NhZ2U7XG4gICAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgdXNlckF1dGhlbnRpY2F0ZSgpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIC8vIOWPkemAgeeZu+W9leS/oeaBr1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwiYXBwaWRcIjogXCJvdG5cIlxuICAgICAgICAgICxcInVzZXJuYW1lXCI6IHRoaXMudXNlck5hbWVcbiAgICAgICAgICAsXCJwYXNzd29yZFwiOiB0aGlzLnVzZXJQYXNzd29yZFxuICAgICAgICB9O1xuXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9sb2dpblwiO1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgICAgLG1ldGhvZDogJ1BPU1QnXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMikge1xuICAgICAgICAgIHRocm93IGJvZHkucmVzdWx0X21lc3NhZ2U7XG4gICAgICAgIH1lbHNlIGlmKGJvZHkucmVzdWx0X2NvZGUgIT0gMCkge1xuICAgICAgICAgIHRocm93IGJvZHk7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICByZXR1cm4gYm9keS51YW10aztcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldE5ld0FwcFRva2VuKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXG4gICAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPXtcbiAgICAgIHVybDogXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2F1dGgvdWFtdGtcIlxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAgICAgLG1ldGhvZDogJ1BPU1QnXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PkpTT04ucGFyc2UoYm9keSkpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIHdpbnN0b24uZGVidWcoYm9keSk7XG4gICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xuICAgICAgICAgIHJldHVybiBib2R5Lm5ld2FwcHRrO1xuICAgICAgICB9ZWxzZSB7XG4gICAgICAgICAgdGhyb3cgYm9keTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGdldEFwcFRva2VuKG5ld2FwcHRrOiBzdHJpbmcpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgICAgIFwidGtcIjogbmV3YXBwdGtcbiAgICAgIH07XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi91YW1hdXRoY2xpZW50XCJcbiAgICAgICxoZWFkZXJzOiB7XG4gICAgICAgIFwiVXNlci1BZ2VudFwiOiBcIk1vemlsbGEvNS4wIChXaW5kb3dzIE5UIDYuMTsgV09XNjQpIEFwcGxlV2ViS2l0LzUzNy4xNyAoS0hUTUwsIGxpa2UgR2Vja28pIENocm9tZS8yNC4wLjEzMTIuNjAgU2FmYXJpLzUzNy4xN1wiXG4gICAgICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxuICAgICAgICAsJ2NvbnRlbnQtdHlwZSc6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnXG4gICAgICB9XG4gICAgICAsbWV0aG9kOiAnUE9TVCdcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgd2luc3Rvbi5kZWJ1Zyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcbiAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIGJvZHkuYXBwdGs7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0aHJvdyBib2R5O1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIC8vIHByaXZhdGUgZ2V0TXkxMjMwNigpOiBQcm9taXNlIHtcbiAgLy8gICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XG4gIC8vICAgICB0aGlzLnJlcXVlc3Qoe1xuICAvLyAgICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9pbmRleC9pbml0TXkxMjMwNlwiXG4gIC8vICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xuICAvLyAgICAgICxtZXRob2Q6IFwiR0VUXCJ9LFxuICAvLyAgICAgIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAvLyAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcbiAgLy8gICAgICAgICBjb25zb2xlLmxvZyhcIkdvdCBteSAxMjMwNlwiKTtcbiAgLy8gICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xuICAvLyAgICAgICB9XG4gIC8vICAgICAgIHJlamVjdCgpO1xuICAvLyAgICAgfSk7XG4gIC8vICAgfSk7XG4gIC8vIH1cblxuICBwcml2YXRlIGNoZWNrQXV0aGVudGljYXRpb24oY29va2llczogb2JqZWN0KSB7XG4gICAgdmFyIHVhbXRrID0gXCJcIiwgdGsgPSBcIlwiO1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb29raWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInVhbXRrXCIpIHtcbiAgICAgICAgdWFtdGsgPSBjb29raWVzW2ldLnZhbHVlO1xuICAgICAgfVxuXG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInRrXCIpIHtcbiAgICAgICAgdGsgPSBjb29raWVzW2ldLnZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgdWFtdGs6IHVhbXRrLFxuICAgICAgdGs6IHRrXG4gICAgfTtcbiAgfVxuXG4gIHByaXZhdGUgbGVmdFRpY2tldEluaXQoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIjtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3QodXJsKTtcbiAgfVxuXG4gIHByaXZhdGUgcXVlcnlMZWZ0VGlja2V0KHt0cmFpbkRhdGUsIGZyb21TdGF0aW9uLCB0b1N0YXRpb259KTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgcXVlcnkgPSB7XG4gICAgICBcImxlZnRUaWNrZXREVE8udHJhaW5fZGF0ZVwiOiB0cmFpbkRhdGVcbiAgICAgICxcImxlZnRUaWNrZXREVE8uZnJvbV9zdGF0aW9uXCI6IGZyb21TdGF0aW9uXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLnRvX3N0YXRpb25cIjogdG9TdGF0aW9uXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiQURVTFRcIlxuICAgIH1cblxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShxdWVyeSk7XG5cbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvcXVlcnlaP1wiK3BhcmFtO1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1cmwpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKCFib2R5KSB7XG4gICAgICAgICAgdGhyb3cgXCLns7vnu5/ov5Tlm57ml6DmlbDmja5cIjtcbiAgICAgICAgfVxuICAgICAgICBpZihib2R5LmluZGV4T2YoXCLor7fmgqjph43or5XkuIDkuItcIikgPiAwKSB7XG4gICAgICAgICAgdGhyb3cgXCLns7vnu5/nuYHlv5khXCI7XG4gICAgICAgIH1lbHNlIHtcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGRhdGEgPSBKU09OLnBhcnNlKGJvZHkpLmRhdGE7XG4gICAgICAgICAgfWNhdGNoKGVycikge1xuICAgICAgICAgICAgdGhyb3cgZXJyO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBSZXNvbHZlZFxuICAgICAgICAgIHJldHVybiBkYXRhO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tVc2VyKCk6IE9ic2VydmFibGU8dm9pZD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vY2hlY2tVc2VyXCI7XG5cbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+SlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIHN1Ym1pdE9yZGVyUmVxdWVzdCh7dHJhaW5TZWNyZXRTdHIsIHRyYWluRGF0ZSwgYmFja1RyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCB0b1N0YXRpb25OYW1lfSk6IE9ic2VydmFibGU8b2JqZWN0PiAge1xuXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L3N1Ym1pdE9yZGVyUmVxdWVzdFwiO1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcInNlY3JldFN0clwiOiBxdWVyeXN0cmluZy51bmVzY2FwZSh0cmFpblNlY3JldFN0cilcbiAgICAgICxcInRyYWluX2RhdGVcIjogdHJhaW5EYXRlXG4gICAgICAsXCJiYWNrX3RyYWluX2RhdGVcIjogYmFja1RyYWluRGF0ZVxuICAgICAgLFwidG91cl9mbGFnXCI6IFwiZGNcIlxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIkFEVUxUXCJcbiAgICAgICxcInF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lXCI6IGZyb21TdGF0aW9uTmFtZVxuICAgICAgLFwicXVlcnlfdG9fc3RhdGlvbl9uYW1lXCI6IHRvU3RhdGlvbk5hbWVcbiAgICAgICxcInVuZGVmaW5lZFwiOlwiXCJcbiAgICB9O1xuXG4gICAgLy8gdXJsID0gdXJsICsgXCJzZWNyZXRTdHI9XCIrc2VjcmV0U3RyK1wiJnRyYWluX2RhdGU9MjAxOC0wMS0zMSZiYWNrX3RyYWluX2RhdGU9MjAxOC0wMS0zMCZ0b3VyX2ZsYWc9ZGMmcHVycG9zZV9jb2Rlcz1BRFVMVCZxdWVyeV9mcm9tX3N0YXRpb25fbmFtZT3kuIrmtbcmcXVlcnlfdG9fc3RhdGlvbl9uYW1lPeW+kOW3nuS4nCZ1bmRlZmluZWRcIjtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT5KU09OLnBhcnNlKGJvZHkpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlybVBhc3NlbmdlckluaXREYygpOiBPYnNlcnZhYmxlPE9yZGVyU3VibWl0UmVxdWVzdD4ge1xuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICB9O1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcbiAgICAgICAgLFwiVXBncmFkZS1JbnNlY3VyZS1SZXF1ZXN0c1wiOjFcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKHRoaXMuaXNTeXN0ZW1CdXNzeShib2R5KSkge1xuICAgICAgICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xuICAgICAgICB9XG4gICAgICAgIGlmKGJvZHkpIHtcbiAgICAgICAgICAvLyBHZXQgUmVwZWF0IFN1Ym1pdCBUb2tlblxuICAgICAgICAgIHZhciB0b2tlbiA9IGJvZHkubWF0Y2goL3ZhciBnbG9iYWxSZXBlYXRTdWJtaXRUb2tlbiA9ICcoLio/KSc7Lyk7XG4gICAgICAgICAgdmFyIHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtID0gYm9keS5tYXRjaCgvdmFyIHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtPSguKj8pOy8pO1xuICAgICAgICAgIHZhciBvcmRlclJlcXVlc3REVE8gPSBib2R5Lm1hdGNoKC92YXIgb3JkZXJSZXF1ZXN0RFRPPSguKj8pOy8pO1xuICAgICAgICAgIGlmKHRva2VuKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICB0b2tlbjogdG9rZW5bMV1cbiAgICAgICAgICAgICAgLHRpY2tldEluZm86IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtJiZKU09OLnBhcnNlKHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxuICAgICAgICAgICAgICAsb3JkZXJSZXF1ZXN0OiBvcmRlclJlcXVlc3REVE8mJkpTT04ucGFyc2Uob3JkZXJSZXF1ZXN0RFRPWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgdGhpcy5TWVNURU1fQlVTU1k7XG4gICAgICB9KTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2Vycyh0b2tlbjogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UGFzc2VuZ2VyRFRPc1wiO1xuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXG4gICAgfTtcblxuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IEpTT04ucGFyc2UoYm9keSkpO1xuICB9XG5cbiAgLyogc2VhdCB0eXBlXG4gIOKAmOi9r+WNp+KAmSA9PiDigJg04oCZLFxuICDigJjkuoznrYnluqfigJkgPT4g4oCYT+KAmSxcbiAg4oCY5LiA562J5bqn4oCZID0+IOKAmE3igJksXG4gIOKAmOehrOW6p+KAmSA9PiDigJgx4oCZLFxuICAgKi9cbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJUaWNrZXRzKHNlYXRUeXBlLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk6IHN0cmluZyB7XG4gICAgdmFyIHRpY2tldHMgPSBbXTtcbiAgICBwYXNzZW5nZXJzLmZvckVhY2gocGFzc2VuZ2VyPT4ge1xuICAgICAgaWYocGxhblBlcG9sZXMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xuICAgICAgICAvL+W6p+S9jeexu+WeiywwLOelqOexu+WeiyjmiJDkurov5YS/56ulKSxuYW1lLOi6q+S7veexu+Weiyjouqvku73or4Ev5Yab5a6Y6K+BLi4uLiks6Lqr5Lu96K+BLOeUteivneWPt+eggSzkv53lrZjnirbmgIFcbiAgICAgICAgdmFyIHRpY2tldCA9IC8qcGFzc2VuZ2VyLnNlYXRfdHlwZSovIHNlYXRUeXBlICtcbiAgICAgICAgICAgICAgICBcIiwwLFwiICtcbiAgICAgICAgICAgICAgICAvKmxpbWl0X3RpY2tldHNbYUFdLnRpY2tldF90eXBlKi9cIjFcIiArIFwiLFwiICtcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF9ubyArIFwiLFwiICtcbiAgICAgICAgICAgICAgICAocGFzc2VuZ2VyLnBob25lX25vIHx8IFwiXCIgKSArIFwiLFwiICtcbiAgICAgICAgICAgICAgICBcIk5cIjtcbiAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGlja2V0cy5qb2luKFwiX1wiKTtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk6IHN0cmluZyB7XG4gICAgdmFyIHRpY2tldHMgPSBbXTtcbiAgICBwYXNzZW5nZXJzLmZvckVhY2gocGFzc2VuZ2VyPT4ge1xuICAgICAgaWYocGxhblBlcG9sZXMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xuICAgICAgICAvL25hbWUs6Lqr5Lu957G75Z6LLOi6q+S7veivgSwxX1xuICAgICAgICB2YXIgdGlja2V0ID1cbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF9ubyArIFwiLFwiICtcbiAgICAgICAgICAgICAgICBcIjFcIjtcbiAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGlja2V0cy5qb2luKFwiX1wiKStcIl9cIjtcbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tPcmRlckluZm8oc3VibWl0VG9rZW4sIHNlYXRUeXBlLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NoZWNrT3JkZXJJbmZvXCI7XG5cbiAgICB2YXIgcGFzc2VuZ2VyVGlja2V0U3RyID0gdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHNlYXRUeXBlLCBwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcyk7XG4gICAgaWYoIXBhc3NlbmdlclRpY2tldFN0cikge1xuICAgICAgcmV0dXJuIE9ic2VydmFibGUudGhyb3coXCLmsqHmnInnm7jlhbPogZTns7vkurpcIik7XG4gICAgfVxuXG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcImNhbmNlbF9mbGFnXCI6IDJcbiAgICAgICxcImJlZF9sZXZlbF9vcmRlcl9udW1cIjogXCIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBcIlxuICAgICAgLFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHBhc3NlbmdlclRpY2tldFN0clxuICAgICAgLFwib2xkUGFzc2VuZ2VyU3RyXCI6IHRoaXMuZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcylcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcbiAgICAgICxcInJhbmRDb2RlXCI6IFwiXCJcbiAgICAgICxcIndoYXRzU2VsZWN0XCI6MVxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogc3VibWl0VG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSlcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgLypcbiAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICB1cmw6ICcvbGVmdFRpY2tldC9pbml0JyxcbiAgICAgICAgICAgIHN0YXR1czogZmFsc2UsXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICBtZXNzYWdlczogWyAn57O757uf5b+Z77yM6K+356iN5ZCO6YeN6K+VJyBdLFxuICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgKi9cbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICByZXR1cm4gYm9keTtcbiAgICAgICAgfWVsc2Uge1xuICAgICAgICAgIHRocm93IGJvZHkubWVzc2FnZXNbMF07XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICB9XG5cbiAgcHJpdmF0ZSBnZXRRdWV1ZUNvdW50KHRva2VuLCBzZWF0VHlwZSwgb3JkZXJSZXF1ZXN0RFRPLCB0aWNrZXRJbmZvKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UXVldWVDb3VudFwiO1xuICAgIHZhciBkYXRhID0ge1xuICAgICAgXCJ0cmFpbl9kYXRlXCI6IG5ldyBEYXRlKG9yZGVyUmVxdWVzdERUTy50cmFpbl9kYXRlLnRpbWUpLnRvU3RyaW5nKClcbiAgICAgICxcInRyYWluX25vXCI6IG9yZGVyUmVxdWVzdERUTy50cmFpbl9ub1xuICAgICAgLFwic3RhdGlvblRyYWluQ29kZVwiOiBvcmRlclJlcXVlc3REVE8uc3RhdGlvbl90cmFpbl9jb2RlXG4gICAgICAsXCJzZWF0VHlwZVwiOiBzZWF0VHlwZVxuICAgICAgLFwiZnJvbVN0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8uZnJvbV9zdGF0aW9uX3RlbGVjb2RlXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxuICAgICAgLFwibGVmdFRpY2tldFwiOiB0aWNrZXRJbmZvLnF1ZXJ5TGVmdFRpY2tldFJlcXVlc3REVE8ueXBJbmZvRGV0YWlsXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiMDBcIlxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSlcbiAgICAgIDtcbiAgfVxuXG4gIHByaXZhdGUgZ2V0UGFzc0NvZGVOZXcoKTogT2JzZXJ2YWJsZTx2b2lkPiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9nZXRQYXNzQ29kZU5ldz9tb2R1bGU9cGFzc2VuZ2VyJnJhbmQ9cmFuZHAmXCIrTWF0aC5yYW5kb20oMCwxKTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICB9O1xuXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8dm9pZD4pPT4ge1xuICAgICAgdGhpcy5yYXdSZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xuICAgICAgICBpZihlcnJvcikgcmV0dXJuIG9ic2VydmVyLmVycm9yKGVycm9yKTtcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSE9PTIwMClcbiAgICAgICAgICBvYnNlcnZlci5lcnJvcihyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcbiAgICAgICAgb2JzZXJ2ZXIubmV4dCgpO1xuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tSYW5kQ29kZUFuc3luKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9jaGVja1JhbmRDb2RlQW5zeW5cIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIHJhbmRDb2RlOiBcIlwiLFxuICAgICAgcmFuZDogXCJyYW5kcFwiXG4gICAgfTtcbiAgICB2YXIgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybTogZGF0YVxuICAgIH07XG5cbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzLnF1ZXN0aW9uQ2FwdGNoYSgpXG4gICAgICAubWVyZ2VNYXAocG9zaXRpb25zPT57XG4gICAgICAgIG9wdGlvbnMuZm9ybS5yYW5kQ29kZSA9IHBvc2l0aW9ucztcbiAgICAgICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKTtcbiAgICAgIH0pXG4gICAgICAubWFwKGJvZHk9PiBKU09OLnBhcnNlKGJvZHkpKTtcbiAgfVxuXG4gIHByaXZhdGUgY29uZmlybVNpbmdsZUZvclF1ZXVlKHRva2VuLCBzZWF0VHlwZSwgcGFzc2VuZ2VycywgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0sIHBsYW5QZXBvbGVzKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvY29uZmlybVNpbmdsZUZvclF1ZXVlXCI7XG4gICAgdmFyIGRhdGEgPSB7XG4gICAgICBcInBhc3NlbmdlclRpY2tldFN0clwiOiB0aGlzLmdldFBhc3NlbmdlclRpY2tldHMoc2VhdFR5cGUsIHBhc3NlbmdlcnMsIHBsYW5QZXBvbGVzKVxuICAgICAgLFwib2xkUGFzc2VuZ2VyU3RyXCI6IHRoaXMuZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzLCBwbGFuUGVwb2xlcylcbiAgICAgICxcInJhbmRDb2RlXCI6XCJcIlxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5wdXJwb3NlX2NvZGVzXG4gICAgICAsXCJrZXlfY2hlY2tfaXNDaGFuZ2VcIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0ua2V5X2NoZWNrX2lzQ2hhbmdlXG4gICAgICAsXCJsZWZ0VGlja2V0U3RyXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmxlZnRUaWNrZXRTdHJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnRyYWluX2xvY2F0aW9uXG4gICAgICAsXCJjaG9vc2Vfc2VhdHNcIjogXCJcIlxuICAgICAgLFwic2VhdERldGFpbFR5cGVcIjogXCIwMDBcIlxuICAgICAgLFwid2hhdHNTZWxlY3RcIjogMVxuICAgICAgLFwicm9vbVR5cGVcIjogXCIwMFwiXG4gICAgICAsXCJkd0FsbFwiOiBcIk5cIlxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICB9O1xuXG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IGRhdGFcbiAgICB9O1xuXG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdChvcHRpb25zKVxuICAgICAgLm1hcChib2R5PT4gSlNPTi5wYXJzZShib2R5KSk7XG4gIH1cblxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbjogc3RyaW5nKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvcXVlcnlPcmRlcldhaXRUaW1lXCI7XG4gICAgdmFyIG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXG4gICAgICB9KVxuICAgICAgLGZvcm06IHtcbiAgICAgICAgXCJyYW5kb21cIjogbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgICAgLFwidG91ckZsYWdcIjogXCJkY1wiXG4gICAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cbiAgICAgIH1cbiAgICAgICxqc29uOiB0cnVlXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gIH1cblxuICBwcml2YXRlIGNhbmNlbFF1ZXVlTm9Db21wbGV0ZU9yZGVyKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2NhbmNlbFF1ZXVlTm9Db21wbGV0ZU15T3JkZXJcIjtcbiAgICB2YXIgZGF0YSA9IHtcbiAgICAgIHRvdXJGbGFnOiBcImRjXCJcbiAgICB9O1xuICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgdXJsOiB1cmxcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiBkYXRhXG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpXG4gICAgICAubWFwKGJvZHk9PiB7XG4gICAgICAgIGlmKHRoaXMuaXNTeXN0ZW1CdXNzeShib2R5KSkge1xuICAgICAgICAgIHRocm93IHRoaXMuU1lTVEVNX0JVU1NZO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBib2R5O1xuICAgICAgfSk7XG4gIH1cblxuICBwcml2YXRlIGluaXROb0NvbXBsZXRlKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCI7XG4gICAgbGV0IG9wdGlvbnMgPSB7XG4gICAgICB1cmw6IHVybFxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCJcbiAgICAgIH0pXG4gICAgICAsZm9ybToge1xuICAgICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXG4gICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucyk7XG4gIH1cblxuICBwdWJsaWMgbXlPcmRlck5vQ29tcGxldGUoKSB7XG4gICAgdGhpcy5vYnNlcnZhYmxlTG9naW5Jbml0KClcbiAgICAgIC5tZXJnZU1hcCgoKT0+IHRoaXMucXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpKVxuICAgICAgLnN1YnNjcmliZSgoeCk9PntcbiAgICAgICAgLypcbiAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXG4gICAgICAgICAgICBzdGF0dXM6IHRydWUsXG4gICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICBkYXRhOiB7IG9yZGVyREJMaXN0OiBbIFtPYmplY3RdIF0sIHRvX3BhZ2U6ICdkYicgfSxcbiAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cbiAgICAgICAgICovXG4gICAgICAgICB0aGlzLnByaW50TXlPcmRlck5vQ29tcGxldGUoeCk7XG4gICAgICB9LCBlcnI9PmNvbnNvbGUuZXJyb3IoZXJyKSk7XG4gIH1cblxuICBwcml2YXRlIHByaW50TXlPcmRlck5vQ29tcGxldGUoeCkge1xuICAgIGlmKCF4LmRhdGEpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGtge3llbGxvdyDmsqHmnInmnKrlrozmiJDorqLljZV9YClcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICBsZXQgdGlja2V0cyA9IFtdO1xuICAgaWYoeC5kYXRhLm9yZGVyQ2FjaGVEVE8pIHtcbiAgICAgbGV0IG9yZGVyQ2FjaGUgPSB4LmRhdGEub3JkZXJDYWNoZURUTztcbiAgICAgb3JkZXJDYWNoZS50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xuICAgICAgIHRpY2tldHMucHVzaCh7XG4gICAgICAgICBcIuaOkumYn+WPt1wiOiBvcmRlckNhY2hlLnF1ZXVlTmFtZSxcbiAgICAgICAgIFwi562J5b6F5pe26Ze0XCI6IG9yZGVyQ2FjaGUud2FpdFRpbWUsXG4gICAgICAgICBcIuetieW+heS6uuaVsFwiOiBvcmRlckNhY2hlLndhaXRDb3VudCxcbiAgICAgICAgIFwi5L2Z56Wo5pWwXCI6IG9yZGVyQ2FjaGUudGlja2V0Q291bnQsXG4gICAgICAgICBcIuS5mOi9puaXpeacn1wiOiBvcmRlckNhY2hlLnRyYWluRGF0ZS5zbGljZSgwLDEwKSxcbiAgICAgICAgIFwi6L2m5qyhXCI6IG9yZGVyQ2FjaGUuc3RhdGlvblRyYWluQ29kZSxcbiAgICAgICAgIFwi5Ye65Y+R56uZXCI6IG9yZGVyQ2FjaGUuZnJvbVN0YXRpb25OYW1lLFxuICAgICAgICAgXCLliLDovr7nq5lcIjogb3JkZXJDYWNoZS50b1N0YXRpb25OYW1lLFxuICAgICAgICAgXCLluqfkvY3nrYnnuqdcIjogdGlja2V0LnNlYXRUeXBlTmFtZSxcbiAgICAgICAgIFwi5LmY6L2m5Lq6XCI6IHRpY2tldC5wYXNzZW5nZXJOYW1lXG4gICAgICAgfSk7XG4gICAgIH0pO1xuXG4gICB9ZWxzZSBpZih4LmRhdGEub3JkZXJEQkxpc3Qpe1xuXG4gICAgIHguZGF0YS5vcmRlckRCTGlzdC5mb3JFYWNoKG9yZGVyPT4ge1xuICAgICAgIC8vIGNvbnNvbGUubG9nKGNoYWxrYOiuouWNleWPtyB7eWVsbG93LmJvbGQgJHtvcmRlci5zZXF1ZW5jZV9ub319YClcbiAgICAgICBvcmRlci50aWNrZXRzLmZvckVhY2godGlja2V0PT4ge1xuICAgICAgICAgdGlja2V0cy5wdXNoKHtcbiAgICAgICAgICAgXCLorqLljZXlj7dcIjogdGlja2V0LnNlcXVlbmNlX25vLFxuICAgICAgICAgICAvLyBcIuiuouelqOWPt1wiOiB0aWNrZXQudGlja2V0X25vLFxuICAgICAgICAgICBcIuS5mOi9puaXpeacn1wiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudHJhaW5fZGF0ZS5zbGljZSgwLDEwKX19YCxcbiAgICAgICAgICAgLy8gXCLkuIvljZXml7bpl7RcIjogdGlja2V0LnJlc2VydmVfdGltZSxcbiAgICAgICAgICAgXCLku5jmrL7miKroh7Pml7bpl7RcIjogY2hhbGtge3JlZC5ib2xkICR7dGlja2V0LnBheV9saW1pdF90aW1lfX1gLFxuICAgICAgICAgICBcIumHkeminVwiOiBjaGFsa2B7eWVsbG93LmJvbGQgJHt0aWNrZXQudGlja2V0X3ByaWNlLzEwMH19YCxcbiAgICAgICAgICAgXCLnirbmgIFcIjogY2hhbGtge3llbGxvdy5ib2xkICR7dGlja2V0LnRpY2tldF9zdGF0dXNfbmFtZX19YCxcbiAgICAgICAgICAgXCLkuZjovabkurpcIjogdGlja2V0LnBhc3NlbmdlckRUTy5wYXNzZW5nZXJfbmFtZSxcbiAgICAgICAgICAgXCLovabmrKFcIjogdGlja2V0LnN0YXRpb25UcmFpbkRUTy5zdGF0aW9uX3RyYWluX2NvZGUsXG4gICAgICAgICAgIFwi5Ye65Y+R56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8uZnJvbV9zdGF0aW9uX25hbWUsXG4gICAgICAgICAgIFwi5Yiw6L6+56uZXCI6IHRpY2tldC5zdGF0aW9uVHJhaW5EVE8udG9fc3RhdGlvbl9uYW1lLFxuICAgICAgICAgICBcIuW6p+S9jVwiOiB0aWNrZXQuc2VhdF9uYW1lLFxuICAgICAgICAgICBcIuW6p+S9jeetiee6p1wiOiB0aWNrZXQuc2VhdF90eXBlX25hbWUsXG4gICAgICAgICAgIFwi5LmY6L2m5Lq657G75Z6LXCI6IHRpY2tldC50aWNrZXRfdHlwZV9uYW1lXG4gICAgICAgICB9KTtcbiAgICAgICB9KTtcbiAgICAgfSk7XG4gICB9XG5cbiAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHRpY2tldHMsIHtcbiAgICAgY29sdW1uU3BsaXR0ZXI6ICd8J1xuICAgfSk7XG5cbiAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xuICB9XG5cbiAgcHJpdmF0ZSBxdWVyeU15T3JkZXJOb0NvbXBsZXRlKCk6IE9ic2VydmFibGU8YW55PiB7XG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL3F1ZXJ5TXlPcmRlck5vQ29tcGxldGVcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcbiAgICAgIH1cbiAgICAgICxqc29uOiB0cnVlXG4gICAgfTtcblxuICAgIHJldHVybiB0aGlzLnJlcXVlc3Qob3B0aW9ucylcbiAgICAgIC5tYXAoYm9keT0+IHtcbiAgICAgICAgaWYoYm9keS5zdGF0dXMpIHtcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5KTtcbiAgICAgICAgICAvKipcbiAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcbiAgICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxuICAgICAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcbiAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxuICAgICAgICAgICAqL1xuICAgICAgICAgIHJldHVybiBib2R5O1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGJvZHkubWVzc2FnZXM7XG4gICAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICA8ZGl2IGNsYXNzPVwidC1idG5cIj5cbnt7aWYgcGF5X2ZsYWc9PSdZJ319XG4gICAgICAgPGRpdiBjbGFzcz1cImJ0blwiPjxhIGhyZWY9XCIjbm9nb1wiIGlkPVwiY29udGludWVQYXlOb015Q29tcGxldGVcIiBvbmNsaWNrPVwiY29udGl1ZVBheU5vQ29tcGxldGVPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ3BheScpXCIgIGNsYXNzPVwiYnRuOTJzXCI+57un57ut5pSv5LuYPC9hPjwvZGl2PlxuICAgICAgIDxkaXYgY2xhc3M9XCJidG5cIj48YSBocmVmPVwiI25vZ29cIiBvbmNsaWNrPVwiY2FuY2VsTXlPcmRlcigne3s+c2VxdWVuY2Vfbm99fScsJ2NhbmNlbF9vcmRlcicpXCIgaWQ9XCJjYW5jZWxfYnV0dG9uX3BheVwiIGNsYXNzPVwiYnRuOTJcIj7lj5bmtojorqLljZU8L2E+PC9kaXY+XG57ey9pZn19XG57e2lmIHBheV9yZXNpZ25fZmxhZz09J1knfX1cbiAgICAgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgaWQ9XCJjb250aW51ZVBheU5vTXlDb21wbGV0ZVwiIG9uY2xpY2s9XCJjb250aXVlUGF5Tm9Db21wbGV0ZU9yZGVyKCd7ez5zZXF1ZW5jZV9ub319JywncmVzaWduJyk7XCIgIGNsYXNzPVwiYnRuOTJzXCI+57un57ut5pSv5LuYPC9hPjwvZGl2PlxuXHQgICA8ZGl2IGNsYXNzPVwiYnRuXCI+PGEgaHJlZj1cIiNub2dvXCIgb25jbGljaz1cImNhbmNlbE15T3JkZXIoJ3t7PnNlcXVlbmNlX25vfX0nLCdjYW5jZWxfcmVzaWduJylcIiBjbGFzcz1cImJ0bjkyXCI+5Y+W5raI6K6i5Y2VPC9hPjwvZGl2Plxue3svaWZ9fVxuXG4gICAgICAgIDwvZGl2PlxuICAqL1xuICBwcml2YXRlIGNhbmNlbE5vQ29tcGxldGVNeU9yZGVyKHNlcXVlbmNlTm86IHN0cmluZywgY2FuY2VsSWQ6IHN0cmluZyA9ICdjYW5jZWxfb3JkZXInKTogT2JzZXJ2YWJsZTxhbnk+IHtcbiAgICBsZXQgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvY2FuY2VsTm9Db21wbGV0ZU15T3JkZXJcIjtcbiAgICBsZXQgb3B0aW9ucyA9IHtcbiAgICAgIHVybDogdXJsXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvaW5pdE5vQ29tcGxldGVcIlxuICAgICAgfSlcbiAgICAgICxmb3JtOiB7XG4gICAgICAgIFwic2VxdWVuY2Vfbm9cIjogc2VxdWVuY2VObyxcbiAgXHRcdFx0XCJjYW5jZWxfZmxhZ1wiOiBjYW5jZWxJZCxcbiAgICAgICAgXCJfanNvbl9hdHRcIjpcIlwiXG4gICAgICB9XG4gICAgICAsanNvbjogdHJ1ZVxuICAgIH07XG5cbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KG9wdGlvbnMpO1xuICB9XG5cbiAgcHVibGljIGNhbmNlbE5vQ29tcGxldGVPcmRlcihzZXF1ZW5jZU5vOiBzdHJpbmcsIGNhbmNlbElkOiBzdHJpbmcgPSAnY2FuY2VsX29yZGVyJykge1xuICAgIHRoaXMub2JzZXJ2YWJsZUxvZ2luSW5pdCgpXG4gICAgICAubWVyZ2VNYXAoKCk9PnRoaXMuY2FuY2VsTm9Db21wbGV0ZU15T3JkZXIoc2VxdWVuY2VObywgY2FuY2VsSWQpKVxuICAgICAgLnN1YnNjcmliZSgoYm9keSk9PntcbiAgICAgICAgICAvLyB7XCJ2YWxpZGF0ZU1lc3NhZ2VzU2hvd0lkXCI6XCJfdmFsaWRhdG9yTWVzc2FnZVwiLFwic3RhdHVzXCI6dHJ1ZSxcImh0dHBzdGF0dXNcIjoyMDAsXCJkYXRhXCI6e30sXCJtZXNzYWdlc1wiOltdLFwidmFsaWRhdGVNZXNzYWdlc1wiOnt9fVxuICAgICAgICAgIGlmIChib2R5LmRhdGEuZXhpc3RFcnJvciA9PSBcIllcIikge1xuICAgICAgICAgICAgd2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7Ym9keS5kYXRhLmVycm9yTXNnfX1gKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGNoYWxrYHt5ZWxsb3cg6K6i5Y2VICR7c2VxdWVuY2VOb30g5bey5Y+W5raIfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgLGVycj0+d2luc3Rvbi5lcnJvcihjaGFsa2B7cmVkICR7SlNPTi5zdHJpbmdpZnkoZXJyKX19YClcbiAgICAgICk7XG4gIH1cbn1cbiJdfQ==
