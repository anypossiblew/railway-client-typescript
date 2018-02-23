"use strict";
// https://www.lanindex.com/12306%E8%B4%AD%E7%A5%A8%E6%B5%81%E7%A8%8B%E5%85%A8%E8%A7%A3%E6%9E%90/
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
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
        this.query = false;
        this.orders = [];
        // Login init
        this.sjLoginInit = new Rx.Subject();
        // Check Captcha
        this.sjCaptcha = new Rx.Subject();
        // Login
        this.sjLogin = new Rx.Subject();
        // Get new app token
        this.sjNewAppToken = new Rx.Subject();
        // Get app token
        this.sjAppToken = new Rx.Subject();
        // Get my main page
        this.sjMyPage = new Rx.Subject();
        this.sjLfTicketInit = new Rx.Subject();
        this.sjQueryLfTicket = new Rx.Subject();
        this.sjSmOReqCheckUser = new Rx.Subject();
        this.sjSmOrderReq = new Rx.Subject();
        this.sjCPasInitDc = new Rx.Subject();
        this.sjGetPassengers = new Rx.Subject();
        this.sjCheckOrderInfo = new Rx.Subject();
        this.sjGetQueueCount = new Rx.Subject();
        this.sjGetPassCodeNew = new Rx.Subject();
        this.sjConfirmSingle4Q = new Rx.Subject();
        this.sjQueryOrderWaitT = new Rx.Subject();
        this.userName = name;
        this.userPassword = userPassword;
        this.setRequest();
        this.buildLoginFlow();
        this.buildOrderFlow();
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
    Account.prototype.createOrder = function (trainDates, backTrainDate, fromStationName, toStationName, planTrains, planPepoles) {
        var _this = this;
        // if(typeof trainDate == "object" && trainDate.constructor.name == "Array") {
        //
        // }
        trainDates.forEach(function (trainDate) {
            _this.orders.push({
                TRAIN_DATE: trainDate,
                BACK_TRAIN_DATE: backTrainDate,
                FROM_STATION_NAME: fromStationName,
                TO_STATION_NAME: toStationName,
                PLAN_TRAINS: planTrains,
                PLAN_PEPOLES: planPepoles,
                FROM_STATION: _this.stations.getStationCode(fromStationName),
                TO_STATION: _this.stations.getStationCode(toStationName)
            });
        });
        return this;
    };
    Account.prototype.setOrder = function (order) {
        this.TRAIN_DATE = order.TRAIN_DATE;
        this.BACK_TRAIN_DATE = order.BACK_TRAIN_DATE;
        this.FROM_STATION_NAME = order.FROM_STATION_NAME;
        this.TO_STATION_NAME = order.TO_STATION_NAME;
        this.PLAN_TRAINS = order.PLAN_TRAINS;
        this.PLAN_PEPOLES = order.PLAN_PEPOLES;
        this.FROM_STATION = order.FROM_STATION;
        this.TO_STATION = order.TO_STATION;
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
    Account.prototype.buildOrderFlow = function () {
        var _this = this;
        // 初始化查询火车余票页面
        this.sjLfTicketInit.subscribe(function () {
            _this.leftTicketInit()
                .then(function () { return _this.sjQueryLfTicket.next(0); }, function (error) {
                console.error(error);
            });
        });
        // 查询火车余票
        this.sjQueryLfTicket.subscribe(function (i) {
            var order = _this.orders[i];
            _this.setOrder(order);
            if (_this.query) {
                process.stdout.clearLine();
                process.stdout.cursorTo(0);
            }
            _this.queryLeftTicket(order.TRAIN_DATE).then(function (trainsData) {
                //console.log(trainsData);
                var trains = trainsData.result;
                //console.log("查询到火车数量 "+trains.length);
                var planTrain, that = _this;
                trains.forEach(function (train) {
                    train = train.split("|");
                    if (train[30] == "有" || (train[30] > 0 && train[30] != "无" && train[30] != "0")) {
                        console.log(order.TRAIN_DATE + "/" + train[3] + "/" + train[30]);
                        if (order.PLAN_TRAINS.includes(train[3])) {
                            planTrain = train;
                        }
                    }
                });
                if (planTrain) {
                    return planTrain;
                }
                else {
                    // console.log(chalk`{yellow 没有可购买余票 ${this.TRAIN_DATE[i]}}`);
                    process.stdout.write(chalk(templateObject_2 || (templateObject_2 = __makeTemplateObject(["{yellow \u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 ", "}"], ["{yellow \u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968 ", "}"])), order.TRAIN_DATE));
                    return Promise.reject();
                }
            }, function (err) {
                // console.error(chalk`{yellow ${err}}`);
                process.stdout.write(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{yellow ", "}"], ["{yellow ", "}"])), err));
                return Promise.reject();
            })
                .then(function (planTrain) {
                _this.query = false;
                _this.sjSmOReqCheckUser.next(planTrain[0]);
            }, function () {
                i = (i + 1) % _this.orders.length;
                setTimeout(function () {
                    _this.sjQueryLfTicket.next(i);
                }, 1500);
                _this.query = true;
            });
        });
        // Step 10 验证登录，Post
        this.sjSmOReqCheckUser.subscribe(function (train) {
            console.log("submit order request check user");
            _this.checkUser().then(function () { return _this.sjSmOrderReq.next(train); }, function (error) {
                console.error("Check user error ");
                console.error(error);
                /* TODO add relogin logic
                { validateMessagesShowId: '_validatorMessage',
                  status: true,
                  httpstatus: 200,
                  data: { flag: false },
                  messages: [],
                  validateMessages: {} }
                */
                _this.sjSmOReqCheckUser.next(train);
            });
        });
        // Step 11 预提交订单，Post
        this.sjSmOrderReq.subscribe(function (train) {
            console.log("submit order request");
            _this.submitOrderRequest(train).then(function (x) {
                console.log("Submit Order Request success!");
                _this.sjCPasInitDc.next();
            }, function (error) {
                console.error("SubmitOrderRequest error " + error);
                _this.sjSmOrderReq.next(train);
            });
        });
        // Step 12 模拟跳转页面InitDc，Post
        this.sjCPasInitDc.subscribe(function (train) {
            _this.confirmPassengerInitDc().then(function (orderRequest) {
                console.log("confirmPassenger Init Dc success! " + orderRequest.token);
                // console.log(orderRequest.ticketInfo);
                if (_this.passengers) {
                    orderRequest.passengers = _this.passengers;
                    _this.sjCheckOrderInfo.next(orderRequest);
                }
                else {
                    _this.sjGetPassengers.next(orderRequest);
                }
            }, function (error) {
                if (error == _this.SYSTEM_BUSSY) {
                    console.log(error);
                    _this.sjCPasInitDc.next();
                }
                else if (error == _this.SYSTEM_MOVED) {
                    console.log(error);
                    _this.sjCPasInitDc.next();
                }
                else {
                    console.error(error);
                }
            }).catch(function (error) { return console.error(error); });
        });
        // Step 13 常用联系人确定，Post
        this.sjGetPassengers.subscribe(function (orderRequest) {
            _this.getPassengers(orderRequest.token).then(function (passengers) {
                _this.passengers = passengers;
                orderRequest.passengers = passengers;
                _this.sjCheckOrderInfo.next(orderRequest);
            }, function (error) {
                console.error(error + " Retry get passengers");
                _this.sjGetPassengers.next(orderRequest);
            })
                .catch(function (error) { return console.error(error); });
        });
        // Step 14 购票人确定，Post
        this.sjCheckOrderInfo.subscribe(function (orderRequest) {
            _this.checkOrderInfo(orderRequest.token, orderRequest.passengers.data.normal_passengers)
                .then(function (orderInfo) {
                console.log(orderInfo);
                // Step 15 准备进入排队，Post
                _this.getQueueCount(orderRequest.token, orderRequest.orderRequest, orderRequest.ticketInfo)
                    .then(function (x) {
                    console.log(x);
                    // 若 Step 14 中的 "ifShowPassCode" = "Y"，那么多了输入验证码这一步，Post
                    if (orderInfo.data.ifShowPassCode == "Y") {
                        _this.sjGetPassCodeNew.next(orderRequest);
                    }
                    else {
                        // Step 17 确认购买，Post
                        _this.sjConfirmSingle4Q.next(orderRequest);
                    }
                }, function (error) {
                    console.error(error);
                });
            }, function (error) {
                console.error(error);
                _this.sjCheckOrderInfo.next(orderRequest);
            });
        });
        this.sjGetPassCodeNew.subscribe(function (orderRequest) {
            // Step 16 乘客买票验证码，Get POST
            _this.getPassCodeNew().then(function () { return _this.checkRandCodeAnsyn(); })
                .then(function (x) {
                console.log(x);
                _this.sjConfirmSingle4Q.next(orderRequest);
            }, function (error) { return console.error(error); });
        });
        this.sjConfirmSingle4Q.subscribe(function (orderRequest) {
            _this.confirmSingleForQueue(orderRequest.token, orderRequest.passengers.data.normal_passengers, orderRequest.ticketInfo)
                .then(function (x) {
                if (x.status && x.data.submitStatus) {
                    // Step 18 查询排队等待时间！
                    _this.sjQueryOrderWaitT.next(orderRequest);
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
                    console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), x.data.errMsg));
                    // 重新开始查询
                    _this.sjQueryLfTicket.next(0);
                }
            }, function (error) {
                console.error(error);
                _this.sjConfirmSingle4Q.next(orderRequest);
            });
        });
        this.sjQueryOrderWaitT.subscribe(function (orderRequest) {
            _this.queryOrderWaitTime(orderRequest.token)
                .then(function (orderQueue) {
                if (orderQueue.status) {
                    if (orderQueue.data.waitTime === 0 || orderQueue.data.waitTime === -1) {
                        console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["Your ticket order number is {red.bold ", "}"], ["Your ticket order number is {red.bold ", "}"])), orderQueue.data.orderId));
                    }
                    else if (orderQueue.data.waitTime === -2) {
                        console.log(orderQueue);
                    }
                    else if (orderQueue.data.waitTime === -3) {
                        console.log("Your ticket request has been canceled!");
                    }
                    else if (orderQueue.data.waitTime === -4) {
                        console.log("Your ticket request is being processed, please wait a moment!");
                        setTimeout(function (x) {
                            _this.sjQueryOrderWaitT.next(orderRequest);
                        }, 4000);
                    }
                    else {
                        console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"], ["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
                        setTimeout(function (x) {
                            _this.sjQueryOrderWaitT.next(orderRequest);
                        }, 4000);
                    }
                }
                else {
                    console.log(orderQueue);
                    setTimeout(function (x) {
                        _this.sjQueryOrderWaitT.next(orderRequest);
                    }, 4000);
                }
            }, function (error) {
                console.log(chalk.bgBlue(error + " ReCheck Order waiting time"));
                setTimeout(function (x) {
                    _this.sjQueryOrderWaitT.next(orderRequest);
                }, 4000);
            });
        });
    };
    Account.prototype.buildLoginFlow = function () {
        var _this = this;
        this.sjLoginInit.subscribe(function () {
            _this.loginInit()
                .then(function () {
                var tokens = _this.checkAuthentication(_this.cookiejar._jar.toJSON().cookies);
                if (tokens.tk) {
                    return _this.sjAppToken.next(tokens.tk);
                }
                else if (tokens.uamtk) {
                    return _this.sjNewAppToken.next();
                }
                _this.sjCaptcha.next();
            })
                .catch(function (error) {
                console.error(error);
            });
        });
        this.sjCaptcha.subscribe(function () {
            _this.getCaptcha().then(function () { return _this.checkCaptcha(); })
                .then(function () {
                // 校验码成功后进行授权认证
                console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
                _this.sjLogin.next();
            }, function (error) {
                // 校验失败，重新校验
                console.log(chalk(templateObject_8 || (templateObject_8 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"]))));
                _this.sjCaptcha.next();
            });
        });
        this.sjLogin.subscribe(function () {
            _this.userAuthenticate()
                .then(function () {
                console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
                _this.sjNewAppToken.next();
            }, function (error) {
                /*
                {"result_message":"密码输入错误。如果输错次数超过4次，用户将被锁定。","result_code":1}
                {"result_message":"验证码校验失败","result_code":"5"}
                */
                if (typeof error.result_code == "undefined") {
                    _this.sjLogin.next();
                }
                else {
                    if (error.result_code === 1) {
                        throw error.result_message;
                    }
                    else if (error.result_code === 5) {
                        _this.sjCaptcha.next();
                    }
                    else {
                        _this.sjCaptcha.next();
                    }
                }
            });
        });
        this.sjNewAppToken.subscribe(function () {
            _this.getNewAppToken()
                .then(function (newapptk) { return _this.sjAppToken.next(newapptk); }, function (error) {
                _this.sjCaptcha.next();
            });
        });
        this.sjAppToken.subscribe(function (newapptk) {
            _this.getAppToken(newapptk).then(function (x) {
                _this.sjMyPage.next();
            }, function (error) {
                console.log(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"]))));
                console.log(error);
                if (error.result_code && error.result_code === 2) {
                    _this.sjCaptcha.next();
                }
                else {
                    // TODO
                    setTimeout(function (x) { return _this.sjAppToken.next(newapptk); }, 1000);
                }
            });
        });
        this.sjMyPage.subscribe(function () {
            _this.getMy12306()
                .then(function () {
                console.log(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
                _this.sjLfTicketInit.next();
            });
        });
    };
    Account.prototype.submit = function () {
        this.sjLoginInit.next();
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
            console.log(chalk(templateObject_12 || (templateObject_12 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"], ["{yellow \u8BF7\u8F93\u5165\u4E58\u8F66\u65E5\u671F}"]))));
            return;
        }
        this.BACK_TRAIN_DATE = trainDate;
        if (!fromStationName) {
            console.log(chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u51FA\u53D1\u7AD9}"]))));
            return;
        }
        this.FROM_STATION_NAME = fromStationName;
        if (!toStationName) {
            console.log(chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"], ["{yellow \u8BF7\u8F93\u5165\u5230\u8FBE\u7AD9}"]))));
            return;
        }
        this.TO_STATION_NAME = toStationName;
        this.FROM_STATION = this.stations.getStationCode(fromStationName);
        this.TO_STATION = this.stations.getStationCode(toStationName);
        var subjectLeftTicket = new Rx.Subject();
        return new Promise(function (resolve, reject) {
            subjectLeftTicket.subscribe(function () {
                _this.queryLeftTicket(trainDate).then(function (trainsData) {
                    var trains = [];
                    trainsData.result.forEach(function (element) {
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
                    resolve(trains);
                }, function (error) {
                    console.error(chalk(templateObject_15 || (templateObject_15 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), error));
                    subjectLeftTicket.next();
                })
                    .catch(function (error) { return console.error(error); });
            }, function (err) { return console.error(err); });
            subjectLeftTicket.next();
        });
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
        var title = ['', '', '', '车次', '起始', '终点', '出发', '到达', '出发', '到达', '历时', '', '',
            '日期', '', '', '', '', '', '', '', '高级软卧', '', '软卧', '软座', '特等座', '无座',
            '', '硬卧', '硬座', '二等座', '一等座', '商务座'];
        title = title.map(function (t) { return chalk(templateObject_16 || (templateObject_16 = __makeTemplateObject(["{blue ", "}"], ["{blue ", "}"])), t); });
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
            rl.question(chalk(templateObject_17 || (templateObject_17 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positionStr) {
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
                    throw error;
                if (response.statusCode === 200) {
                    body = JSON.parse(body);
                    if (body.data.flag) {
                        return resolve();
                    }
                    return reject(body);
                }
                reject(response.statusMessage);
            });
        });
    };
    Account.prototype.submitOrderRequest = function (secretStr) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/leftTicket/submitOrderRequest";
        var data = {
            "secretStr": querystring.unescape(secretStr),
            "train_date": this.TRAIN_DATE,
            "back_train_date": this.BACK_TRAIN_DATE,
            "tour_flag": "dc",
            "purpose_codes": "ADULT",
            "query_from_station_name": this.FROM_STATION_NAME,
            "query_to_station_name": this.TO_STATION_NAME,
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
                    if (body.status) {
                        return resolve(body);
                    }
                    // console.error(body);
                    if (body.messages[0].indexOf('您还有未处理的订单') > -1) {
                        throw chalk(templateObject_18 || (templateObject_18 = __makeTemplateObject(["{red.bold \u60A8\u8FD8\u6709\u672A\u5904\u7406\u7684\u8BA2\u5355}"], ["{red.bold \u60A8\u8FD8\u6709\u672A\u5904\u7406\u7684\u8BA2\u5355}"])));
                    }
                    return reject(body.messages[0]);
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
    Account.prototype.getPassengerTickets = function (passengers) {
        var _this = this;
        var tickets = [];
        passengers.forEach(function (passenger) {
            if (_this.PLAN_PEPOLES.includes(passenger.passenger_name)) {
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
    Account.prototype.getOldPassengers = function (passengers) {
        var _this = this;
        var tickets = [];
        passengers.forEach(function (passenger) {
            if (_this.PLAN_PEPOLES.includes(passenger.passenger_name)) {
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
    Account.prototype.checkOrderInfo = function (submitToken, passengers) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/checkOrderInfo";
        var data = {
            "cancel_flag": 2,
            "bed_level_order_num": "000000000000000000000000000000",
            "passengerTicketStr": this.getPassengerTickets(passengers),
            "oldPassengerStr": this.getOldPassengers(passengers),
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
    Account.prototype.confirmSingleForQueue = function (token, passengers, ticketInfoForPassengerForm) {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/confirmPassenger/confirmSingleForQueue";
        var data = {
            "passengerTicketStr": this.getPassengerTickets(passengers),
            "oldPassengerStr": this.getOldPassengers(passengers),
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
                        return resolve(body.data.orderDBList);
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
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15, templateObject_16, templateObject_17, templateObject_18;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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SyxDQUFDO2dCQUN0QixFQUFFLENBQUEsQ0FBQyxRQUFRLENBQUMsVUFBVSxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUM7b0JBQy9CLEVBQUUsQ0FBQSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO3dCQUNmLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQTtvQkFDdkMsQ0FBQztvQkFDRCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDL0IsQ0FBQztnQkFBQSxJQUFJLENBQUMsQ0FBQztvQkFDTCxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM5QixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFSCxjQUFDO0FBQUQsQ0F6NkNBLEFBeTZDQyxJQUFBO0FBejZDWSwwQkFBTyIsImZpbGUiOiJzcmMvQWNjb3VudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiAvLyBodHRwczovL3d3dy5sYW5pbmRleC5jb20vMTIzMDYlRTglQjQlQUQlRTclQTUlQTglRTYlQjUlODElRTclQTglOEIlRTUlODUlQTglRTglQTclQTMlRTYlOUUlOTAvXHJcblxyXG5pbXBvcnQge0ZpbGVDb29raWVTdG9yZX0gZnJvbSAnLi9GaWxlQ29va2llU3RvcmUnO1xyXG5pbXBvcnQge1N0YXRpb259IGZyb20gJy4vU3RhdGlvbic7XHJcbmltcG9ydCByZXF1ZXN0ID0gcmVxdWlyZSgncmVxdWVzdCcpO1xyXG5pbXBvcnQgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xyXG5pbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xyXG5pbXBvcnQgcmVhZGxpbmUgPSByZXF1aXJlKCdyZWFkbGluZScpO1xyXG5pbXBvcnQgcHJvY2VzcyA9IHJlcXVpcmUoJ3Byb2Nlc3MnKTtcclxuaW1wb3J0IFJ4ID0gcmVxdWlyZSgnQHJlYWN0aXZleC9yeGpzJyk7XHJcbmltcG9ydCBjaGFsayA9IHJlcXVpcmUoJ2NoYWxrJyk7XHJcbmltcG9ydCBjb2x1bW5pZnkgPSByZXF1aXJlKCdjb2x1bW5pZnknKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBBY2NvdW50IHtcclxuICBwdWJsaWMgdXNlck5hbWUgOiBzdHJpbmc7XHJcbiAgcHVibGljIHVzZXJQYXNzd29yZCA6IHN0cmluZztcclxuICBwdWJsaWMgVFJBSU5fREFURTogc3RyaW5nO1xyXG4gIHB1YmxpYyBCQUNLX1RSQUlOX0RBVEU6IHN0cmluZztcclxuICBwdWJsaWMgUExBTl9UUkFJTlM6IEFycmF5PHN0cmluZz47XHJcbiAgcHVibGljIFBMQU5fUEVQT0xFUzogQXJyYXk8c3RyaW5nPjtcclxuICBwdWJsaWMgRlJPTV9TVEFUSU9OOiBzdHJpbmc7XHJcbiAgcHVibGljIFRPX1NUQVRJT046IHN0cmluZztcclxuICBwdWJsaWMgRlJPTV9TVEFUSU9OX05BTUU6IHN0cmluZztcclxuICBwdWJsaWMgVE9fU1RBVElPTl9OQU1FOiBzdHJpbmc7XHJcblxyXG4gIHByaXZhdGUgc3RhdGlvbnM6IFN0YXRpb24gPSBuZXcgU3RhdGlvbigpO1xyXG4gIHByaXZhdGUgcGFzc2VuZ2Vyczogb2JqZWN0O1xyXG5cclxuICBwcml2YXRlIFNZU1RFTV9CVVNTWSA9IFwiU3lzdGVtIGlzIGJ1c3N5XCI7XHJcbiAgcHJpdmF0ZSBTWVNURU1fTU9WRUQgPSBcIk1vdmVkIFRlbXBvcmFyaWx5XCI7XHJcblxyXG4gIHByaXZhdGUgcmVxdWVzdDogcmVxdWVzdC5SZXF1ZXN0QVBJPGFueSwgYW55LCBhbnk+O1xyXG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XHJcbiAgcHVibGljIGhlYWRlcnM6IG9iamVjdCA9IHtcclxuICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCJcclxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxyXG4gICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxyXG4gICAgLFwiT3JpZ2luXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuXCJcclxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcclxuICB9O1xyXG5cclxuICBwcml2YXRlIHF1ZXJ5ID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgb3JkZXJzOiBBcnJheTxvYmplY3Q+ID0gW107XHJcblxyXG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgdXNlclBhc3N3b3JkOiBzdHJpbmcpIHtcclxuICAgIHRoaXMudXNlck5hbWUgPSBuYW1lO1xyXG4gICAgdGhpcy51c2VyUGFzc3dvcmQgPSB1c2VyUGFzc3dvcmQ7XHJcblxyXG4gICAgdGhpcy5zZXRSZXF1ZXN0KCk7XHJcbiAgICB0aGlzLmJ1aWxkTG9naW5GbG93KCk7XHJcbiAgICB0aGlzLmJ1aWxkT3JkZXJGbG93KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDmo4Dmn6XnvZHnu5zlvILluLhcclxuICAgKi9cclxuICBwcml2YXRlIGlzU3lzdGVtQnVzc3koYm9keTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYm9keS5pbmRleE9mKFwi572R57uc5Y+v6IO95a2Y5Zyo6Zeu6aKY77yM6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzZXRSZXF1ZXN0KCkge1xyXG4gICAgbGV0IGNvb2tpZUZpbGVOYW1lOiBzdHJpbmcgPSBcIi4vY29va2llcy9cIit0aGlzLnVzZXJOYW1lK1wiLmpzb25cIjtcclxuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKGNvb2tpZUZpbGVOYW1lLCB7ZW5jcnlwdDogZmFsc2V9KTtcclxuICAgIGZpbGVTdG9yZS5vcHRpb24gPSB7ZW5jcnlwdDogZmFsc2V9O1xyXG5cclxuICAgIHRoaXMuY29va2llamFyID0gcmVxdWVzdC5qYXIoZmlsZVN0b3JlKTtcclxuXHJcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY3JlYXRlT3JkZXIodHJhaW5EYXRlczogQXJyYXk8c3RyaW5nPiwgYmFja1RyYWluRGF0ZTogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICBmcm9tU3RhdGlvbk5hbWU6IHN0cmluZywgdG9TdGF0aW9uTmFtZTogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICBwbGFuVHJhaW5zOiBBcnJheTxzdHJpbmc+LCBwbGFuUGVwb2xlczogQXJyYXk8c3RyaW5nPik6IHRoaXMge1xyXG5cclxuICAgIC8vIGlmKHR5cGVvZiB0cmFpbkRhdGUgPT0gXCJvYmplY3RcIiAmJiB0cmFpbkRhdGUuY29uc3RydWN0b3IubmFtZSA9PSBcIkFycmF5XCIpIHtcclxuICAgIC8vXHJcbiAgICAvLyB9XHJcbiAgICB0cmFpbkRhdGVzLmZvckVhY2godHJhaW5EYXRlPT4ge1xyXG4gICAgICB0aGlzLm9yZGVycy5wdXNoKHtcclxuICAgICAgICBUUkFJTl9EQVRFOiB0cmFpbkRhdGVcclxuICAgICAgICAsQkFDS19UUkFJTl9EQVRFOiBiYWNrVHJhaW5EYXRlXHJcbiAgICAgICAgLEZST01fU1RBVElPTl9OQU1FOiBmcm9tU3RhdGlvbk5hbWU7XHJcbiAgICAgICAgLFRPX1NUQVRJT05fTkFNRTogdG9TdGF0aW9uTmFtZTtcclxuICAgICAgICAsUExBTl9UUkFJTlM6IHBsYW5UcmFpbnM7XHJcbiAgICAgICAgLFBMQU5fUEVQT0xFUzogcGxhblBlcG9sZXM7XHJcbiAgICAgICAgLEZST01fU1RBVElPTjogdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShmcm9tU3RhdGlvbk5hbWUpO1xyXG4gICAgICAgICxUT19TVEFUSU9OOiB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKHRvU3RhdGlvbk5hbWUpO1xyXG4gICAgICB9KVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHNldE9yZGVyKG9yZGVyKSB7XHJcbiAgICB0aGlzLlRSQUlOX0RBVEUgPSBvcmRlci5UUkFJTl9EQVRFO1xyXG4gICAgdGhpcy5CQUNLX1RSQUlOX0RBVEUgPSBvcmRlci5CQUNLX1RSQUlOX0RBVEU7XHJcbiAgICB0aGlzLkZST01fU1RBVElPTl9OQU1FID0gb3JkZXIuRlJPTV9TVEFUSU9OX05BTUU7XHJcbiAgICB0aGlzLlRPX1NUQVRJT05fTkFNRSA9IG9yZGVyLlRPX1NUQVRJT05fTkFNRTtcclxuICAgIHRoaXMuUExBTl9UUkFJTlMgPSBvcmRlci5QTEFOX1RSQUlOUztcclxuICAgIHRoaXMuUExBTl9QRVBPTEVTID0gb3JkZXIuUExBTl9QRVBPTEVTO1xyXG4gICAgdGhpcy5GUk9NX1NUQVRJT04gPSBvcmRlci5GUk9NX1NUQVRJT047XHJcbiAgICB0aGlzLlRPX1NUQVRJT04gPSBvcmRlci5UT19TVEFUSU9OO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNhbmNlbE9yZGVyUXVldWUoKSB7XHJcbiAgICB0aGlzLmNhbmNlbFF1ZXVlTm9Db21wbGV0ZU9yZGVyKClcclxuICAgICAgLnRoZW4oeD0+IHtcclxuICAgICAgICBpZih4LnN0YXR1cyAmJiB4LmRhdGEuZXhpc3RFcnJvciA9PSAnTicpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOaOkumYn+iuouWNleW3suWPlua2iH1gKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKHgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgfVxyXG5cclxuICAvLyBMb2dpbiBpbml0XHJcbiAgcHJpdmF0ZSBzakxvZ2luSW5pdCAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAvLyBDaGVjayBDYXB0Y2hhXHJcbiAgcHJpdmF0ZSBzakNhcHRjaGEgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAvLyBMb2dpblxyXG4gIHByaXZhdGUgc2pMb2dpbiAgICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgLy8gR2V0IG5ldyBhcHAgdG9rZW5cclxuICBwcml2YXRlIHNqTmV3QXBwVG9rZW4gPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIC8vIEdldCBhcHAgdG9rZW5cclxuICBwcml2YXRlIHNqQXBwVG9rZW4gICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XHJcbiAgLy8gR2V0IG15IG1haW4gcGFnZVxyXG4gIHByaXZhdGUgc2pNeVBhZ2UgICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcblxyXG4gIHByaXZhdGUgc2pMZlRpY2tldEluaXQgICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzalF1ZXJ5TGZUaWNrZXQgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqU21PUmVxQ2hlY2tVc2VyICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBzalNtT3JkZXJSZXEgICAgICAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgc2pDUGFzSW5pdERjICAgICAgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHNqR2V0UGFzc2VuZ2VycyAgICAgPSBuZXcgUnguU3ViamVjdDxvYmplY3Q+KCk7XHJcbiAgcHJpdmF0ZSBzakNoZWNrT3JkZXJJbmZvICAgID0gbmV3IFJ4LlN1YmplY3Q8b2JqZWN0PigpO1xyXG4gIHByaXZhdGUgc2pHZXRRdWV1ZUNvdW50ICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzakdldFBhc3NDb2RlTmV3ICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqQ29uZmlybVNpbmdsZTRRICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pRdWVyeU9yZGVyV2FpdFQgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcblxyXG4gIHByaXZhdGUgYnVpbGRPcmRlckZsb3coKSB7XHJcbiAgICAvLyDliJ3lp4vljJbmn6Xor6LngavovabkvZnnpajpobXpnaJcclxuICAgIHRoaXMuc2pMZlRpY2tldEluaXQuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmxlZnRUaWNrZXRJbml0KClcclxuICAgICAgICAudGhlbigoKT0+dGhpcy5zalF1ZXJ5TGZUaWNrZXQubmV4dCgwKSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDmn6Xor6LngavovabkvZnnpahcclxuICAgIHRoaXMuc2pRdWVyeUxmVGlja2V0LnN1YnNjcmliZSgoaSk9PiB7XHJcblxyXG4gICAgICBsZXQgb3JkZXIgPSB0aGlzLm9yZGVyc1tpXTtcclxuICAgICAgdGhpcy5zZXRPcmRlcihvcmRlcik7XHJcblxyXG4gICAgICBpZih0aGlzLnF1ZXJ5KSB7XHJcbiAgICAgICAgcHJvY2Vzcy5zdGRvdXQuY2xlYXJMaW5lKCk7XHJcbiAgICAgICAgcHJvY2Vzcy5zdGRvdXQuY3Vyc29yVG8oMCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0KG9yZGVyLlRSQUlOX0RBVEUpLnRoZW4odHJhaW5zRGF0YSA9PiB7XHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyh0cmFpbnNEYXRhKTtcclxuICAgICAgICB2YXIgdHJhaW5zID0gdHJhaW5zRGF0YS5yZXN1bHQ7XHJcblxyXG4gICAgICAgIC8vY29uc29sZS5sb2coXCLmn6Xor6LliLDngavovabmlbDph48gXCIrdHJhaW5zLmxlbmd0aCk7XHJcbiAgICAgICAgdmFyIHBsYW5UcmFpbiwgdGhhdCA9IHRoaXM7XHJcbiAgICAgICAgdHJhaW5zLmZvckVhY2goZnVuY3Rpb24odHJhaW4pIHtcclxuICAgICAgICAgIHRyYWluID0gdHJhaW4uc3BsaXQoXCJ8XCIpO1xyXG5cclxuICAgICAgICAgIGlmKHRyYWluWzMwXSA9PSBcIuaciVwiIHx8ICh0cmFpblszMF0gPiAwICYmIHRyYWluWzMwXSAhPSBcIuaXoFwiICYmIHRyYWluWzMwXSAhPSBcIjBcIikpIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXIuVFJBSU5fREFURStcIi9cIit0cmFpblszXStcIi9cIit0cmFpblszMF0pO1xyXG4gICAgICAgICAgICBpZihvcmRlci5QTEFOX1RSQUlOUy5pbmNsdWRlcyh0cmFpblszXSkpIHtcclxuICAgICAgICAgICAgICBwbGFuVHJhaW4gPSB0cmFpbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpZihwbGFuVHJhaW4pIHtcclxuICAgICAgICAgIHJldHVybiBwbGFuVHJhaW47XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDmsqHmnInlj6/otK3kubDkvZnnpaggJHt0aGlzLlRSQUlOX0RBVEVbaV19fWApO1xyXG4gICAgICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoY2hhbGtge3llbGxvdyDmsqHmnInlj6/otK3kubDkvZnnpaggJHtvcmRlci5UUkFJTl9EQVRFfX1gKTtcclxuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgZXJyID0+IHtcclxuICAgICAgICAvLyBjb25zb2xlLmVycm9yKGNoYWxrYHt5ZWxsb3cgJHtlcnJ9fWApO1xyXG4gICAgICAgIHByb2Nlc3Muc3Rkb3V0LndyaXRlKGNoYWxrYHt5ZWxsb3cgJHtlcnJ9fWApO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgpO1xyXG4gICAgICB9KVxyXG4gICAgICAudGhlbigocGxhblRyYWluKT0+IHtcclxuICAgICAgICAgIHRoaXMucXVlcnkgPSBmYWxzZTtcclxuICAgICAgICAgIHRoaXMuc2pTbU9SZXFDaGVja1VzZXIubmV4dChwbGFuVHJhaW5bMF0pO1xyXG4gICAgICAgIH0sKCk9PiB7XHJcbiAgICAgICAgICBpID0gKGkrMSkldGhpcy5vcmRlcnMubGVuZ3RoO1xyXG4gICAgICAgICAgc2V0VGltZW91dCgoKT0+IHtcclxuICAgICAgICAgICAgdGhpcy5zalF1ZXJ5TGZUaWNrZXQubmV4dChpKTtcclxuICAgICAgICAgIH0sIDE1MDApO1xyXG4gICAgICAgICAgdGhpcy5xdWVyeSA9IHRydWU7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDEwIOmqjOivgeeZu+W9le+8jFBvc3RcclxuICAgIHRoaXMuc2pTbU9SZXFDaGVja1VzZXIuc3Vic2NyaWJlKCh0cmFpbjogc3RyaW5nKT0+IHtcclxuICAgICAgY29uc29sZS5sb2coXCJzdWJtaXQgb3JkZXIgcmVxdWVzdCBjaGVjayB1c2VyXCIpO1xyXG4gICAgICB0aGlzLmNoZWNrVXNlcigpLnRoZW4oKCk9PnRoaXMuc2pTbU9yZGVyUmVxLm5leHQodHJhaW4pLCBlcnJvciA9PiB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkNoZWNrIHVzZXIgZXJyb3IgXCIpO1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIC8qIFRPRE8gYWRkIHJlbG9naW4gbG9naWNcclxuICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICBzdGF0dXM6IHRydWUsXHJcbiAgICAgICAgICBodHRwc3RhdHVzOiAyMDAsXHJcbiAgICAgICAgICBkYXRhOiB7IGZsYWc6IGZhbHNlIH0sXHJcbiAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgKi9cclxuICAgICAgICB0aGlzLnNqU21PUmVxQ2hlY2tVc2VyLm5leHQodHJhaW4pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgMTEg6aKE5o+Q5Lqk6K6i5Y2V77yMUG9zdFxyXG4gICAgdGhpcy5zalNtT3JkZXJSZXEuc3Vic2NyaWJlKCh0cmFpbjogc3RyaW5nKT0+IHtcclxuICAgICAgY29uc29sZS5sb2coXCJzdWJtaXQgb3JkZXIgcmVxdWVzdFwiKTtcclxuICAgICAgdGhpcy5zdWJtaXRPcmRlclJlcXVlc3QodHJhaW4pLnRoZW4oKHgpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coXCJTdWJtaXQgT3JkZXIgUmVxdWVzdCBzdWNjZXNzIVwiKVxyXG4gICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dCgpO1xyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pTbU9yZGVyUmVxLm5leHQodHJhaW4pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxMiDmqKHmi5/ot7PovazpobXpnaJJbml0RGPvvIxQb3N0XHJcbiAgICB0aGlzLnNqQ1Bhc0luaXREYy5zdWJzY3JpYmUoKHRyYWluOiBzdHJpbmcpPT4ge1xyXG4gICAgICB0aGlzLmNvbmZpcm1QYXNzZW5nZXJJbml0RGMoKS50aGVuKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJjb25maXJtUGFzc2VuZ2VyIEluaXQgRGMgc3VjY2VzcyEgXCIrb3JkZXJSZXF1ZXN0LnRva2VuKTtcclxuICAgICAgICAvLyBjb25zb2xlLmxvZyhvcmRlclJlcXVlc3QudGlja2V0SW5mbyk7XHJcbiAgICAgICAgaWYodGhpcy5wYXNzZW5nZXJzKSB7XHJcbiAgICAgICAgICBvcmRlclJlcXVlc3QucGFzc2VuZ2VycyA9IHRoaXMucGFzc2VuZ2VycztcclxuICAgICAgICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgdGhpcy5zakdldFBhc3NlbmdlcnMubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IgPT0gdGhpcy5TWVNURU1fQlVTU1kpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQoKTtcclxuICAgICAgICB9ZWxzZSBpZihlcnJvciA9PSB0aGlzLlNZU1RFTV9NT1ZFRCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dCgpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkuY2F0Y2goZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDEzIOW4uOeUqOiBlOezu+S6uuehruWumu+8jFBvc3RcclxuICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXJSZXF1ZXN0LnRva2VuKS50aGVuKHBhc3NlbmdlcnM9PiB7XHJcbiAgICAgICAgdGhpcy5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcclxuICAgICAgICBvcmRlclJlcXVlc3QucGFzc2VuZ2VycyA9IHBhc3NlbmdlcnM7XHJcbiAgICAgICAgdGhpcy5zakNoZWNrT3JkZXJJbmZvLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvciArIFwiIFJldHJ5IGdldCBwYXNzZW5nZXJzXCIpO1xyXG4gICAgICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVycm9yPT4gY29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxNCDotK3npajkurrnoa7lrprvvIxQb3N0XHJcbiAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm8uc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMuY2hlY2tPcmRlckluZm8ob3JkZXJSZXF1ZXN0LnRva2VuLCBvcmRlclJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzKVxyXG4gICAgICAgIC50aGVuKG9yZGVySW5mbz0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKG9yZGVySW5mbyk7XHJcbiAgICAgICAgICAvLyBTdGVwIDE1IOWHhuWkh+i/m+WFpeaOkumYn++8jFBvc3RcclxuICAgICAgICAgIHRoaXMuZ2V0UXVldWVDb3VudChvcmRlclJlcXVlc3QudG9rZW4sIG9yZGVyUmVxdWVzdC5vcmRlclJlcXVlc3QsIG9yZGVyUmVxdWVzdC50aWNrZXRJbmZvKVxyXG4gICAgICAgICAgICAudGhlbih4PT4ge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKHgpO1xyXG4gICAgICAgICAgICAgIC8vIOiLpSBTdGVwIDE0IOS4reeahCBcImlmU2hvd1Bhc3NDb2RlXCIgPSBcIllcIu+8jOmCo+S5iOWkmuS6hui+k+WFpemqjOivgeeggei/meS4gOatpe+8jFBvc3RcclxuICAgICAgICAgICAgICBpZihvcmRlckluZm8uZGF0YS5pZlNob3dQYXNzQ29kZSA9PSBcIllcIikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zakdldFBhc3NDb2RlTmV3Lm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBTdGVwIDE3IOehruiupOi0reS5sO+8jFBvc3RcclxuICAgICAgICAgICAgICAgIHRoaXMuc2pDb25maXJtU2luZ2xlNFEubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNoZWNrT3JkZXJJbmZvLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqR2V0UGFzc0NvZGVOZXcuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgIC8vIFN0ZXAgMTYg5LmY5a6i5Lmw56Wo6aqM6K+B56CB77yMR2V0IFBPU1RcclxuICAgICAgdGhpcy5nZXRQYXNzQ29kZU5ldygpLnRoZW4oKCk9PiB0aGlzLmNoZWNrUmFuZENvZGVBbnN5bigpKVxyXG4gICAgICAgIC50aGVuKHg9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyh4KTtcclxuICAgICAgICAgIHRoaXMuc2pDb25maXJtU2luZ2xlNFEubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgIH0sZXJyb3I9PmNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pDb25maXJtU2luZ2xlNFEuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMuY29uZmlybVNpbmdsZUZvclF1ZXVlKG9yZGVyUmVxdWVzdC50b2tlbiwgb3JkZXJSZXF1ZXN0LnBhc3NlbmdlcnMuZGF0YS5ub3JtYWxfcGFzc2VuZ2Vycywgb3JkZXJSZXF1ZXN0LnRpY2tldEluZm8pXHJcbiAgICAgICAgLnRoZW4oeD0+IHtcclxuICAgICAgICAgIGlmKHguc3RhdHVzICYmIHguZGF0YS5zdWJtaXRTdGF0dXMpIHtcclxuICAgICAgICAgICAgLy8gU3RlcCAxOCDmn6Xor6LmjpLpmJ/nrYnlvoXml7bpl7TvvIFcclxuICAgICAgICAgICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIC8qKlxyXG4gICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgc3RhdHVzOiB0cnVlLFxyXG4gICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgICAgICBkYXRhOiB7IGVyck1zZzogJ+S9meelqOS4jei2s++8gScsIHN1Ym1pdFN0YXR1czogZmFsc2UgfSxcclxuICAgICAgICAgICAgICBtZXNzYWdlczogW10sXHJcbiAgICAgICAgICAgICAgdmFsaWRhdGVNZXNzYWdlczoge30gfVxyXG4gICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQgJHt4LmRhdGEuZXJyTXNnfX1gKTtcclxuICAgICAgICAgICAgLy8g6YeN5paw5byA5aeL5p+l6K+iXHJcbiAgICAgICAgICAgIHRoaXMuc2pRdWVyeUxmVGlja2V0Lm5leHQoMCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pDb25maXJtU2luZ2xlNFEubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucXVlcnlPcmRlcldhaXRUaW1lKG9yZGVyUmVxdWVzdC50b2tlbilcclxuICAgICAgICAudGhlbihvcmRlclF1ZXVlPT4ge1xyXG4gICAgICAgICAgaWYob3JkZXJRdWV1ZS5zdGF0dXMpIHtcclxuICAgICAgICAgICAgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAwIHx8IG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2BZb3VyIHRpY2tldCBvcmRlciBudW1iZXIgaXMge3JlZC5ib2xkICR7b3JkZXJRdWV1ZS5kYXRhLm9yZGVySWR9fWApO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0yKXtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcclxuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMyl7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJZb3VyIHRpY2tldCByZXF1ZXN0IGhhcyBiZWVuIGNhbmNlbGVkIVwiKTtcclxuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtNCl7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coXCJZb3VyIHRpY2tldCByZXF1ZXN0IGlzIGJlaW5nIHByb2Nlc3NlZCwgcGxlYXNlIHdhaXQgYSBtb21lbnQhXCIpO1xyXG4gICAgICAgICAgICAgIHNldFRpbWVvdXQoeD0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgICAgIH0sIDQwMDApO1xyXG4gICAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOaOkumYn+S6uuaVsO+8miR7b3JkZXJRdWV1ZS5kYXRhLndhaXRDb3VudH19IOmihOiuoeetieW+heaXtumXtO+8miR7cGFyc2VJbnQob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lIC8gMS41KX0g5YiG6ZKfYCk7XHJcbiAgICAgICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgfSwgNDAwMCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoeD0+IHtcclxuICAgICAgICAgICAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgICAgfSwgNDAwMCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsay5iZ0JsdWUoZXJyb3IrXCIgUmVDaGVjayBPcmRlciB3YWl0aW5nIHRpbWVcIikpO1xyXG4gICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgIH0sIDQwMDApO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGJ1aWxkTG9naW5GbG93KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zakxvZ2luSW5pdC5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMubG9naW5Jbml0KClcclxuICAgICAgICAudGhlbigoKT0+e1xyXG4gICAgICAgICAgdmFyIHRva2VucyA9IHRoaXMuY2hlY2tBdXRoZW50aWNhdGlvbih0aGlzLmNvb2tpZWphci5famFyLnRvSlNPTigpLmNvb2tpZXMpO1xyXG4gICAgICAgICAgaWYodG9rZW5zLnRrKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNqQXBwVG9rZW4ubmV4dCh0b2tlbnMudGspO1xyXG4gICAgICAgICAgfWVsc2UgaWYodG9rZW5zLnVhbXRrKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNqTmV3QXBwVG9rZW4ubmV4dCgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zakNhcHRjaGEuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmdldENhcHRjaGEoKS50aGVuKCgpPT4gdGhpcy5jaGVja0NhcHRjaGEoKSlcclxuICAgICAgICAudGhlbigoKT0+IHtcclxuICAgICAgICAgIC8vIOagoemqjOeggeaIkOWKn+WQjui/m+ihjOaOiOadg+iupOivgVxyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg6aqM6K+B56CB5qCh6aqM5oiQ5YqffWApO1xyXG4gICAgICAgICAgdGhpcy5zakxvZ2luLm5leHQoKTtcclxuICAgICAgICB9LCAoZXJyb3I6IGFueSk9PiB7XHJcbiAgICAgICAgICAvLyDmoKHpqozlpLHotKXvvIzph43mlrDmoKHpqoxcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDmoKHpqozlpLHotKXvvIzph43mlrDmoKHpqox9YCk7XHJcbiAgICAgICAgICB0aGlzLnNqQ2FwdGNoYS5uZXh0KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqTG9naW4uc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLnVzZXJBdXRoZW50aWNhdGUoKVxyXG4gICAgICAgIC50aGVuKCgpPT57XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDnmbvlvZXmiJDlip99YCk7XHJcbiAgICAgICAgICB0aGlzLnNqTmV3QXBwVG9rZW4ubmV4dCgpO1xyXG4gICAgICAgIH0sIChlcnJvcjogYW55KT0+e1xyXG4gICAgICAgICAgLypcclxuICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLlr4bnoIHovpPlhaXplJnor6/jgILlpoLmnpzovpPplJnmrKHmlbDotoXov4c05qyh77yM55So5oi35bCG6KKr6ZSB5a6a44CCXCIsXCJyZXN1bHRfY29kZVwiOjF9XHJcbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi6aqM6K+B56CB5qCh6aqM5aSx6LSlXCIsXCJyZXN1bHRfY29kZVwiOlwiNVwifVxyXG4gICAgICAgICAgKi9cclxuICAgICAgICAgIGlmKHR5cGVvZiBlcnJvci5yZXN1bHRfY29kZSA9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2pMb2dpbi5uZXh0KCk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIGlmKGVycm9yLnJlc3VsdF9jb2RlID09PSAxKSB7XHJcbiAgICAgICAgICAgICAgdGhyb3cgZXJyb3IucmVzdWx0X21lc3NhZ2U7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKGVycm9yLnJlc3VsdF9jb2RlID09PSA1KSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xyXG4gICAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgICAgICA7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqTmV3QXBwVG9rZW4uc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmdldE5ld0FwcFRva2VuKClcclxuICAgICAgICAudGhlbigobmV3YXBwdGs6IHN0cmluZyk9PiB0aGlzLnNqQXBwVG9rZW4ubmV4dChuZXdhcHB0ayksIChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pBcHBUb2tlbi5zdWJzY3JpYmUoKG5ld2FwcHRrOiBzdHJpbmcpPT4ge1xyXG4gICAgICB0aGlzLmdldEFwcFRva2VuKG5ld2FwcHRrKS50aGVuKCh4OiBzdHJpbmcpID0+IHtcclxuICAgICAgICB0aGlzLnNqTXlQYWdlLm5leHQoKTtcclxuICAgICAgfSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDojrflj5ZUb2tlbuWksei0pX1gKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgICAgaWYoZXJyb3IucmVzdWx0X2NvZGUgJiYgZXJyb3IucmVzdWx0X2NvZGUgPT09IDIpIHtcclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAvLyBUT0RPXHJcbiAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB0aGlzLnNqQXBwVG9rZW4ubmV4dChuZXdhcHB0ayksIDEwMDApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqTXlQYWdlLnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5nZXRNeTEyMzA2KClcclxuICAgICAgICAudGhlbigoKT0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOeZu+W9leaIkOWKn31gKTtcclxuICAgICAgICAgIHRoaXMuc2pMZlRpY2tldEluaXQubmV4dCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3VibWl0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zakxvZ2luSW5pdC5uZXh0KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDmn6Xor6LliJfovabkvZnnpajkv6Hmga9cclxuICAgKlxyXG4gICAqIEBwYXJhbSB0cmFpbkRhdGUg5LmY6L2m5pel5pyfXHJcbiAgICogQHBhcmFtIGZyb21TdGF0aW9uTmFtZSDlh7rlj5Hnq5lcclxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcclxuICAgKiBAcGFyYW0gdHJhaW5OYW1lcyDliJfovaZcclxuICAgKlxyXG4gICAqIEByZXR1cm4gUHJvbWlzZVxyXG4gICAqL1xyXG4gIHB1YmxpYyBxdWVyeUxlZnRUaWNrZXRzKHRyYWluRGF0ZTogc3RyaW5nLCBmcm9tU3RhdGlvbk5hbWU6IHN0cmluZywgdG9TdGF0aW9uTmFtZTogc3RyaW5nLCB0cmFpbk5hbWVzOiBBcnJheTxzdHJpbmc+fG51bGwpOiBQcm9taXNlPEFycmF5PGFueT4+IHtcclxuICAgIGlmKCF0cmFpbkRhdGUpIHtcclxuICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdyDor7fovpPlhaXkuZjovabml6XmnJ99YCk7XHJcbiAgICAgIHJldHVybjtcclxuICAgIH1cclxuICAgIHRoaXMuQkFDS19UUkFJTl9EQVRFID0gdHJhaW5EYXRlO1xyXG4gICAgaWYoIWZyb21TdGF0aW9uTmFtZSkge1xyXG4gICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOivt+i+k+WFpeWHuuWPkeermX1gKTtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgdGhpcy5GUk9NX1NUQVRJT05fTkFNRSA9IGZyb21TdGF0aW9uTmFtZTtcclxuICAgIGlmKCF0b1N0YXRpb25OYW1lKSB7XHJcbiAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cg6K+36L6T5YWl5Yiw6L6+56uZfWApO1xyXG4gICAgICByZXR1cm47XHJcbiAgICB9XHJcbiAgICB0aGlzLlRPX1NUQVRJT05fTkFNRSA9IHRvU3RhdGlvbk5hbWU7XHJcbiAgICB0aGlzLkZST01fU1RBVElPTiA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUoZnJvbVN0YXRpb25OYW1lKTtcclxuICAgIHRoaXMuVE9fU1RBVElPTiA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUodG9TdGF0aW9uTmFtZSk7XHJcblxyXG4gICAgdmFyIHN1YmplY3RMZWZ0VGlja2V0ID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHN1YmplY3RMZWZ0VGlja2V0LnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgICB0aGlzLnF1ZXJ5TGVmdFRpY2tldCh0cmFpbkRhdGUpLnRoZW4odHJhaW5zRGF0YSA9PiB7XHJcbiAgICAgICAgICBsZXQgdHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+PiA9IFtdO1xyXG5cclxuICAgICAgICAgIHRyYWluc0RhdGEucmVzdWx0LmZvckVhY2goKGVsZW1lbnQ6IHN0cmluZyk9PiB7XHJcbiAgICAgICAgICAgIGxldCB0cmFpbjogQXJyYXk8c3RyaW5nPiA9IGVsZW1lbnQuc3BsaXQoXCJ8XCIpO1xyXG4gICAgICAgICAgICB0cmFpbls0XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNF0pO1xyXG4gICAgICAgICAgICB0cmFpbls1XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNV0pO1xyXG4gICAgICAgICAgICB0cmFpbls2XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bNl0pO1xyXG4gICAgICAgICAgICB0cmFpbls3XSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bN10pO1xyXG4gICAgICAgICAgICB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJJU19USU1FX05PVF9CVVlcIiA/IFwi5YiX6L2m5YGc6L+QXCI6dHJhaW5bMTFdO1xyXG4gICAgICAgICAgICAvLyB0cmFpblsxMV0gPSB0cmFpblsxMV0gPT0gXCJOXCIgPyBcIuaXoOelqFwiOnRyYWluWzExXTtcclxuICAgICAgICAgICAgLy8gdHJhaW5bMTFdID0gdHJhaW5bMTFdID09IFwiWVwiID8gXCLmnInnpahcIjp0cmFpblsxMV07XHJcbiAgICAgICAgICAgIC8vIOWMuemFjei+k+WFpeeahOWIl+i9puWQjeensOeahOato+WImeihqOi+vuW8j+adoeS7tlxyXG4gICAgICAgICAgICBpZighdHJhaW5OYW1lcyB8fCB0cmFpbk5hbWVzLmZpbHRlcih0bj0+dHJhaW5bM10ubWF0Y2gobmV3IFJlZ0V4cCh0bikpICE9IG51bGwpLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICB0cmFpbnMucHVzaCh0cmFpbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgIHJlc29sdmUodHJhaW5zKTtcclxuICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyb3J9fWApO1xyXG4gICAgICAgICAgc3ViamVjdExlZnRUaWNrZXQubmV4dCgpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgICAgLmNhdGNoKGVycm9yPT5jb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICAgIH0sIGVycj0+Y29uc29sZS5lcnJvcihlcnIpKTtcclxuXHJcbiAgICAgIHN1YmplY3RMZWZ0VGlja2V0Lm5leHQoKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog5p+l6K+i5YiX6L2m5L2Z56Wo5L+h5oGvXHJcbiAgICpcclxuICAgKiBAcGFyYW0gdHJhaW5EYXRlIOS5mOi9puaXpeacn1xyXG4gICAqIEBwYXJhbSBmcm9tU3RhdGlvbk5hbWUg5Ye65Y+R56uZXHJcbiAgICogQHBhcmFtIHBhc3NTdGF0aW9uTmFtZSDpgJTnu4/nq5lcclxuICAgKiBAcGFyYW0gdG9TdGF0aW9uTmFtZSDliLDovr7nq5lcclxuICAgKlxyXG4gICAqIEByZXR1cm4gdm9pZFxyXG4gICAqL1xyXG4gIHB1YmxpYyBwYXNzU3RhdGlvblRpY2tldHModHJhaW5EYXRlOiBzdHJpbmcsIGZyb21TdGF0aW9uTmFtZTogc3RyaW5nLCBwYXNzU3RhdGlvbk5hbWU6IHN0cmluZywgdG9TdGF0aW9uTmFtZTogc3RyaW5nLCB0cmFpbk5hbWVzOiBzdHJpbmcpIHtcclxuICAgIGxldCBwbGFuVHJhaW5OYW1lczogQXJyYXk8c3RyaW5nPnxudWxsID0gKHRyYWluTmFtZXMgPyB0cmFpbk5hbWVzLnNwbGl0KCcsJyk6bnVsbCk7XHJcbiAgICB0aGlzLnF1ZXJ5TGVmdFRpY2tldHModHJhaW5EYXRlLCBmcm9tU3RhdGlvbk5hbWUsIHRvU3RhdGlvbk5hbWUsIHBsYW5UcmFpbk5hbWVzKVxyXG4gICAgICAudGhlbih0cmFpbnM9PiB7XHJcbiAgICAgICAgdHJhaW5zID0gdHJhaW5zLm1hcCh0cmFpbiA9PiB0cmFpblszXSk7XHJcbiAgICAgICAgdGhpcy5xdWVyeUxlZnRUaWNrZXRzKHRyYWluRGF0ZSwgZnJvbVN0YXRpb25OYW1lLCBwYXNzU3RhdGlvbk5hbWUsIHBsYW5UcmFpbk5hbWVzKVxyXG4gICAgICAgICAgLnRoZW4ocGFzc1RyYWlucz0+IHtcclxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHBhc3NUcmFpbnMuZmlsdGVyKHRyYWluID0+IHRyYWlucy5pbmNsdWRlcyh0cmFpblszXSkpO1xyXG4gICAgICAgICAgICByZXN1bHQgPSB0aGlzLnJlbmRlclRyYWluTGlzdFRpdGxlKHJlc3VsdCk7XHJcbiAgICAgICAgICAgIHRoaXMucmVuZGVyTGVmdFRpY2tldHMocmVzdWx0KTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOafpeivouWIl+i9puS9meelqOS/oeaBr1xyXG4gICAqXHJcbiAgICogQHBhcmFtIHRyYWluRGF0ZSDkuZjovabml6XmnJ9cclxuICAgKiBAcGFyYW0gZnJvbVN0YXRpb25OYW1lIOWHuuWPkeermVxyXG4gICAqIEBwYXJhbSB0b1N0YXRpb25OYW1lIOWIsOi+vuermVxyXG4gICAqIEBwYXJhbSB0cmFpbk5hbWVzIOWIl+i9plxyXG4gICAqXHJcbiAgICogQHJldHVybiB2b2lkXHJcbiAgICovXHJcbiAgcHVibGljIGxlZnRUaWNrZXRzKHRyYWluRGF0ZTogc3RyaW5nLCBmcm9tU3RhdGlvbk5hbWU6IHN0cmluZywgdG9TdGF0aW9uTmFtZTogc3RyaW5nLCB0cmFpbk5hbWVzOiBzdHJpbmcpIHtcclxuICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0cyh0cmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgKHRyYWluTmFtZXMgPyB0cmFpbk5hbWVzLnNwbGl0KCcsJyk6bnVsbCkpXHJcbiAgICAgIC50aGVuKHRyYWlucz0+IHtcclxuICAgICAgICB0cmFpbnMgPSB0aGlzLnJlbmRlclRyYWluTGlzdFRpdGxlKHRyYWlucyk7XHJcbiAgICAgICAgdGhpcy5yZW5kZXJMZWZ0VGlja2V0cyh0cmFpbnMpO1xyXG4gICAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyVHJhaW5MaXN0VGl0bGUodHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+Pik6IEFycmF5PEFycmF5PHN0cmluZz4+IHtcclxuICAgIHZhciB0aXRsZSA9IFsnJywgJycsICcnLCAn6L2m5qyhJywgJ+i1t+WniycsICfnu4jngrknLCAn5Ye65Y+RJywgJ+WIsOi+vicsICflh7rlj5EnLCAn5Yiw6L6+JywgJ+WOhuaXticsICcnLCAnJyxcclxuICAgICAgICAgICAgICAgICAn5pel5pyfJywgJycsICcnLCAnJywgJycsICcnLCAnJywgJycsICfpq5jnuqfova/ljacnLCAnJywgJ+i9r+WNpycsICfova/luqcnLCAn54m5562J5bqnJywgJ+aXoOW6pycsXHJcbiAgICAgICAgICAgICAgICAgJycsICfnoazljacnLCAn56Gs5bqnJywgJ+S6jOetieW6pycsICfkuIDnrYnluqcnLCAn5ZWG5Yqh5bqnJ107XHJcbiAgICB0aXRsZSA9IHRpdGxlLm1hcCh0PT5jaGFsa2B7Ymx1ZSAke3R9fWApO1xyXG5cclxuICAgIHRyYWlucy5mb3JFYWNoKCh0cmFpbiwgaW5kZXgpPT4ge1xyXG4gICAgICBpZihpbmRleCAlIDMwID09PSAwKSB7XHJcbiAgICAgICAgdHJhaW5zLnNwbGljZShpbmRleCwgMCwgdGl0bGUpO1xyXG4gICAgICB9XHJcbiAgICB9KVxyXG4gICAgcmV0dXJuIHRyYWlucztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcmVuZGVyTGVmdFRpY2tldHModHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+Pikge1xyXG4gICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkodHJhaW5zLCB7XHJcbiAgICAgIGNvbHVtblNwbGl0dGVyOiAnfCcsXHJcbiAgICAgIGNvbHVtbnM6IFtcIjNcIiwgXCI0XCIsIFwiNVwiLCBcIjZcIiwgXCI3XCIsIFwiOFwiLCBcIjlcIiwgXCIxMFwiLCBcIjExXCIsIFwiMjBcIiwgXCIyMVwiLCBcIjIyXCIsIFwiMjNcIiwgXCIyNFwiLCBcIjI1XCIsXHJcbiAgICAgICAgICAgICAgICBcIjI2XCIsIFwiMjdcIiwgXCIyOFwiLCBcIjI5XCIsIFwiMzBcIiwgXCIzMVwiLCBcIjMyXCJdXHJcbiAgICB9KVxyXG5cclxuICAgIGNvbnNvbGUubG9nKGNvbHVtbnMpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIG15T3JkZXJOb0NvbXBsZXRlUmVwb3J0KCkge1xyXG4gICAgdmFyIHN1YmplY3RPcmRlck5vQ29tcGxldGUgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICAgIHN1YmplY3RPcmRlck5vQ29tcGxldGUuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmluaXROb0NvbXBsZXRlKCkudGhlbigoKT0+IHtcclxuICAgICAgICB0aGlzLnF1ZXJ5TXlPcmRlck5vQ29tcGxldGUoKS50aGVuKHg9PiB7XHJcbiAgICAgICAgICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHgsIHtcclxuICAgICAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJyB8ICdcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcclxuICAgICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgICAgc2V0VGltZW91dCgoKT0+IHN1YmplY3RPcmRlck5vQ29tcGxldGUubmV4dCgpLCAxMDAwKVxyXG4gICAgICAgICAgfSk7XHJcbiAgICAgIH0sIGVycm9yPT4gY29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgc3ViamVjdE9yZGVyTm9Db21wbGV0ZS5uZXh0KCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbG9naW5Jbml0KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sb2dpbi9pbml0XCI7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmwsXHJcbiAgICAgIG1ldGhvZDogXCJHRVRcIixcclxuICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZTogb2JqZWN0LCByZWplY3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KSA9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHJldHVybiByZWplY3QoZXJyb3IudG9TdHJpbmcoKSk7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRDYXB0Y2hhKCk6IFByb21pc2Uge1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJsb2dpbl9zaXRlXCI6IFwiRVwiLFxyXG4gICAgICAgICAgXCJtb2R1bGVcIjogXCJsb2dpblwiLFxyXG4gICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCIsXHJcbiAgICAgICAgICBcIjAuMTcyMzE4NzI3MDMzODkwNjJcIjpcIlwiXHJcbiAgICAgIH07XHJcblxyXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KGRhdGEsIG51bGwsIG51bGwpXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWltYWdlP1wiK3BhcmFtO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcclxuICAgICAgICBpZihlcnJvcikge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShcImNhcHRjaGEuQk1QXCIpKS5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHF1ZXN0aW9uQ2FwdGNoYSgpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xyXG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcclxuICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dFxyXG4gICAgfSk7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZTogRnVuY3Rpb24sIHJlamVjdDogRnVuY3Rpb24pPT4ge1xyXG4gICAgICBybC5xdWVzdGlvbihjaGFsa2B7cmVkLmJvbGQg6K+36L6T5YWl6aqM6K+B56CBfTpgLCAocG9zaXRpb25TdHIpID0+IHtcclxuICAgICAgICBybC5jbG9zZSgpO1xyXG5cclxuICAgICAgICBpZih0eXBlb2YgcG9zaXRpb25TdHIgPT0gXCJzdHJpbmdcIikge1xyXG4gICAgICAgICAgbGV0IHBvc2l0aW9uczogQXJyYXk8c3RyaW5nPiA9IFtdO1xyXG4gICAgICAgICAgcG9zaXRpb25TdHIuc3BsaXQoJywnKS5mb3JFYWNoKGVsPT5wb3NpdGlvbnM9cG9zaXRpb25zLmNvbmNhdChlbC5zcGxpdCgnICcpKSk7XHJcbiAgICAgICAgICByZXNvbHZlKHBvc2l0aW9ucy5tYXAoKHBvc2l0aW9uOiBzdHJpbmcpPT4ge1xyXG4gICAgICAgICAgICBzd2l0Y2gocG9zaXRpb24pIHtcclxuICAgICAgICAgICAgICBjYXNlIFwiMVwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiNDAsNDVcIjtcclxuICAgICAgICAgICAgICBjYXNlIFwiMlwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMTEwLDQ1XCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjNcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjE4MCw0NVwiO1xyXG4gICAgICAgICAgICAgIGNhc2UgXCI0XCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIyNTAsNDVcIjtcclxuICAgICAgICAgICAgICBjYXNlIFwiNVwiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiNDAsMTEwXCI7XHJcbiAgICAgICAgICAgICAgY2FzZSBcIjZcIjpcclxuICAgICAgICAgICAgICAgIHJldHVybiBcIjExMCwxMTBcIjtcclxuICAgICAgICAgICAgICBjYXNlIFwiN1wiOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiMTgwLDExMFwiO1xyXG4gICAgICAgICAgICAgIGNhc2UgXCI4XCI6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIyNTAsMTEwXCI7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH0pLmpvaW4oJywnKSk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KFwi6L6T5YWl5qC85byP6ZSZ6K+vXCIpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2hlY2tDYXB0Y2hhKCk6IFByb21pc2Uge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L2NhcHRjaGEvY2FwdGNoYS1jaGVja1wiO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZTogRnVuY3Rpb24sIHJlamVjdDogRnVuY3Rpb24pID0+IHtcclxuICAgICAgdGhpcy5xdWVzdGlvbkNhcHRjaGEoKS50aGVuKHBvc2l0aW9ucz0+IHtcclxuICAgICAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgICAgXCJhbnN3ZXJcIjogcG9zaXRpb25zLFxyXG4gICAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXHJcbiAgICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiXHJcbiAgICAgICAgICB9O1xyXG5cclxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgICAgIHVybDogdXJsXHJcbiAgICAgICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgICAgICxmb3JtOiBkYXRhXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcclxuICAgICAgICAgIGlmKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSA0KSB7XHJcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlamVjdCgpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnZXJyb3I6ICcrIHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhyZXNwb25zZS50ZXh0KTtcclxuICAgICAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0sIGVycm9yPT57XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVzZXJBdXRoZW50aWNhdGUoKTogUHJvbWlzZSB7XHJcbiAgICAvLyDlj5HpgIHnmbvlvZXkv6Hmga9cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXHJcbiAgICAgICAgICAsXCJ1c2VybmFtZVwiOiB0aGlzLnVzZXJOYW1lXHJcbiAgICAgICAgICAsXCJwYXNzd29yZFwiOiB0aGlzLnVzZXJQYXNzd29yZFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9sb2dpblwiO1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgcmV0dXJuIHJlamVjdChlcnJvcik7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xyXG4gICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAyKSB7XHJcbiAgICAgICAgICAgIHRocm93IGJvZHkucmVzdWx0X21lc3NhZ2U7XHJcbiAgICAgICAgICB9ZWxzZSBpZihib2R5LnJlc3VsdF9jb2RlICE9IDApIHtcclxuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZXNvbHZlKGJvZHkudWFtdGspO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXROZXdBcHBUb2tlbigpOiBQcm9taXNlIHtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXHJcbiAgICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPXtcclxuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvYXV0aC91YW10a1wiXHJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5KTtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYm9keS5yZXN1bHRfbWVzc2FnZSk7XHJcbiAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShib2R5Lm5ld2FwcHRrKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZSlcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE15MTIzMDYoKTogUHJvbWlzZSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vaW5kZXgvaW5pdE15MTIzMDZcIlxyXG4gICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAgLG1ldGhvZDogXCJHRVRcIn0sXHJcbiAgICAgICAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKFwiR290IG15IDEyMzA2XCIpO1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrQXV0aGVudGljYXRpb24oY29va2llczogb2JqZWN0KSB7XHJcbiAgICB2YXIgdWFtdGsgPSBcIlwiLCB0ayA9IFwiXCI7XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInVhbXRrXCIpIHtcclxuICAgICAgICB1YW10ayA9IGNvb2tpZXNbaV0udmFsdWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidGtcIikge1xyXG4gICAgICAgIHRrID0gY29va2llc1tpXS52YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdWFtdGs6IHVhbXRrLFxyXG4gICAgICB0azogdGtcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKlxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0QXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZykge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcInRrXCI6IG5ld2FwcHRrXHJcbiAgICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vdWFtYXV0aGNsaWVudFwiXHJcbiAgICAgICxoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgNi4xOyBXT1c2NCkgQXBwbGVXZWJLaXQvNTM3LjE3IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzI0LjAuMTMxMi42MCBTYWZhcmkvNTM3LjE3XCJcclxuICAgICAgICAsXCJIb3N0XCI6IFwia3lmdy4xMjMwNi5jblwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxyXG4gICAgICAgICwnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcclxuICAgICAgfVxyXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xyXG4gICAgICAgICAgICByZXNvbHZlKGJvZHkuYXBwdGspO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZWplY3QoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpXHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsZWZ0VGlja2V0SW5pdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCI7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3QodXJsLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c1RleHQpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVyeUxlZnRUaWNrZXQodHJhaW5EYXRlKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgcXVlcnkgPSB7XHJcbiAgICAgIFwibGVmdFRpY2tldERUTy50cmFpbl9kYXRlXCI6IHRyYWluRGF0ZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLmZyb21fc3RhdGlvblwiOiB0aGlzLkZST01fU1RBVElPTlxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLnRvX3N0YXRpb25cIjogdGhpcy5UT19TVEFUSU9OXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvcXVlcnlaP1wiK3BhcmFtO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KHVybCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHtcclxuICAgICAgICAgIHJldHVybiByZWplY3QoZXJyb3IudG9TdHJpbmcoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoIWJvZHkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKGJvZHkuaW5kZXhPZihcIuivt+aCqOmHjeivleS4gOS4i1wiKSA+IDApIHtcclxuICAgICAgICAgICAgcmVqZWN0KFwi57O757uf57mB5b+ZIVwiKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoYm9keSkuZGF0YTtcclxuICAgICAgICAgICAgfWNhdGNoKGVycikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgY29uc29sZS5sb2cocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrVXNlcigpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vY2hlY2tVc2VyXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXHJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSlcclxuICAgICAgICAgIGlmKGJvZHkuZGF0YS5mbGFnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN1Ym1pdE9yZGVyUmVxdWVzdChzZWNyZXRTdHI6IHN0cmluZyk6IFByb21pc2U8b2JqZWN0PiAge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L3N1Ym1pdE9yZGVyUmVxdWVzdFwiO1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcInNlY3JldFN0clwiOiBxdWVyeXN0cmluZy51bmVzY2FwZShzZWNyZXRTdHIpXHJcbiAgICAgICxcInRyYWluX2RhdGVcIjogdGhpcy5UUkFJTl9EQVRFXHJcbiAgICAgICxcImJhY2tfdHJhaW5fZGF0ZVwiOiB0aGlzLkJBQ0tfVFJBSU5fREFURVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICAgICxcInF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lXCI6IHRoaXMuRlJPTV9TVEFUSU9OX05BTUVcclxuICAgICAgLFwicXVlcnlfdG9fc3RhdGlvbl9uYW1lXCI6IHRoaXMuVE9fU1RBVElPTl9OQU1FXHJcbiAgICAgICxcInVuZGVmaW5lZFwiOlwiXCJcclxuICAgIH07XHJcblxyXG4gICAgLy8gdXJsID0gdXJsICsgXCJzZWNyZXRTdHI9XCIrc2VjcmV0U3RyK1wiJnRyYWluX2RhdGU9MjAxOC0wMS0zMSZiYWNrX3RyYWluX2RhdGU9MjAxOC0wMS0zMCZ0b3VyX2ZsYWc9ZGMmcHVycG9zZV9jb2Rlcz1BRFVMVCZxdWVyeV9mcm9tX3N0YXRpb25fbmFtZT3kuIrmtbcmcXVlcnlfdG9fc3RhdGlvbl9uYW1lPeW+kOW3nuS4nCZ1bmRlZmluZWRcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxyXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICBpZihib2R5LnN0YXR1cykge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIC8vIGNvbnNvbGUuZXJyb3IoYm9keSk7XHJcbiAgICAgICAgICBpZihib2R5Lm1lc3NhZ2VzWzBdLmluZGV4T2YoJ+aCqOi/mOacieacquWkhOeQhueahOiuouWNlScpPi0xKSB7XHJcbiAgICAgICAgICAgIHRocm93IGNoYWxrYHtyZWQuYm9sZCDmgqjov5jmnInmnKrlpITnkIbnmoTorqLljZV9YDtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keS5tZXNzYWdlc1swXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVBhc3NlbmdlckluaXREYygpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgICAsXCJVcGdyYWRlLUluc2VjdXJlLVJlcXVlc3RzXCI6MVxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYoYm9keSkge1xyXG4gICAgICAgICAgICAvLyBHZXQgUmVwZWF0IFN1Ym1pdCBUb2tlblxyXG4gICAgICAgICAgICB2YXIgdG9rZW4gPSBib2R5Lm1hdGNoKC92YXIgZ2xvYmFsUmVwZWF0U3VibWl0VG9rZW4gPSAnKC4qPyknOy8pO1xyXG4gICAgICAgICAgICB2YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0gPSBib2R5Lm1hdGNoKC92YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm09KC4qPyk7Lyk7XHJcbiAgICAgICAgICAgIHZhciBvcmRlclJlcXVlc3REVE8gPSBib2R5Lm1hdGNoKC92YXIgb3JkZXJSZXF1ZXN0RFRPPSguKj8pOy8pO1xyXG4gICAgICAgICAgICBpZih0b2tlbikge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHtcclxuICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlblsxXVxyXG4gICAgICAgICAgICAgICAgLHRpY2tldEluZm86IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtJiZKU09OLnBhcnNlKHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxyXG4gICAgICAgICAgICAgICAgLG9yZGVyUmVxdWVzdDogb3JkZXJSZXF1ZXN0RFRPJiZKU09OLnBhcnNlKG9yZGVyUmVxdWVzdERUT1sxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2Vycyh0b2tlbjogc3RyaW5nKTogUHJvbWlzZTxvYmplY3Q+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8b2JqZWN0PigocmVzb2x2ZTogRnVuY3Rpb24sIHJlamVjdDogRnVuY3Rpb24pPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoSlNPTi5wYXJzZShib2R5KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgLyogc2VhdCB0eXBlXHJcbiAg4oCY6L2v5Y2n4oCZID0+IOKAmDTigJksXHJcbiAg4oCY5LqM562J5bqn4oCZID0+IOKAmE/igJksXHJcbiAg4oCY5LiA562J5bqn4oCZID0+IOKAmE3igJksXHJcbiAg4oCY56Gs5bqn4oCZID0+IOKAmDHigJksXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMpOiBzdHJpbmcge1xyXG4gICAgdmFyIHRpY2tldHMgPSBbXTtcclxuICAgIHBhc3NlbmdlcnMuZm9yRWFjaChwYXNzZW5nZXI9PiB7XHJcbiAgICAgIGlmKHRoaXMuUExBTl9QRVBPTEVTLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcclxuICAgICAgICAvL+W6p+S9jeexu+WeiywwLOelqOexu+WeiyjmiJDkurov5YS/56ulKSxuYW1lLOi6q+S7veexu+Weiyjouqvku73or4Ev5Yab5a6Y6K+BLi4uLiks6Lqr5Lu96K+BLOeUteivneWPt+eggSzkv53lrZjnirbmgIFcclxuICAgICAgICB2YXIgdGlja2V0ID0gLypwYXNzZW5nZXIuc2VhdF90eXBlKi8gXCJPXCIgK1xyXG4gICAgICAgICAgICAgICAgXCIsMCxcIiArXHJcbiAgICAgICAgICAgICAgICAvKmxpbWl0X3RpY2tldHNbYUFdLnRpY2tldF90eXBlKi9cIjFcIiArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF9ubyArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIChwYXNzZW5nZXIucGhvbmVfbm8gfHwgXCJcIiApICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgXCJOXCI7XHJcbiAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aWNrZXRzLmpvaW4oXCJfXCIpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMpOiBzdHJpbmcge1xyXG4gICAgdmFyIHRpY2tldHMgPSBbXTtcclxuICAgIHBhc3NlbmdlcnMuZm9yRWFjaChwYXNzZW5nZXI9PiB7XHJcbiAgICAgIGlmKHRoaXMuUExBTl9QRVBPTEVTLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcclxuICAgICAgICAvL25hbWUs6Lqr5Lu957G75Z6LLOi6q+S7veivgSwxX1xyXG4gICAgICAgIHZhciB0aWNrZXQgPVxyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgXCIxXCI7XHJcbiAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aWNrZXRzLmpvaW4oXCJfXCIpK1wiX1wiO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja09yZGVySW5mbyhzdWJtaXRUb2tlbiwgcGFzc2VuZ2Vycykge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NoZWNrT3JkZXJJbmZvXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiY2FuY2VsX2ZsYWdcIjogMlxyXG4gICAgICAsXCJiZWRfbGV2ZWxfb3JkZXJfbnVtXCI6IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCJcclxuICAgICAgLFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMpXHJcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcclxuICAgICAgLFwicmFuZENvZGVcIjogXCJcIlxyXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOjFcclxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiBzdWJtaXRUb2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmU6IEZ1bmN0aW9uLCByZWplY3Q6IEZ1bmN0aW9uKT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgICAvKlxyXG4gICAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgICAgICAgIHVybDogJy9sZWZ0VGlja2V0L2luaXQnLFxyXG4gICAgICAgICAgICAgICAgc3RhdHVzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgICAgICAgIG1lc3NhZ2VzOiBbICfns7vnu5/lv5nvvIzor7fnqI3lkI7ph43or5UnIF0sXHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAgICAqL1xyXG4gICAgICAgICAgICBpZihyZXN1bHQuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZWplY3QocmVzdWx0Lm1lc3NhZ2VzWzBdKVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRRdWV1ZUNvdW50KHRva2VuLCBvcmRlclJlcXVlc3REVE8sIHRpY2tldEluZm8pIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRRdWV1ZUNvdW50XCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJ0cmFpbl9kYXRlXCI6IG5ldyBEYXRlKG9yZGVyUmVxdWVzdERUTy50cmFpbl9kYXRlLnRpbWUpLnRvU3RyaW5nKClcclxuICAgICAgLFwidHJhaW5fbm9cIjogb3JkZXJSZXF1ZXN0RFRPLnRyYWluX25vXHJcbiAgICAgICxcInN0YXRpb25UcmFpbkNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLnN0YXRpb25fdHJhaW5fY29kZVxyXG4gICAgICAsXCJzZWF0VHlwZVwiOjFcclxuICAgICAgLFwiZnJvbVN0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8uZnJvbV9zdGF0aW9uX3RlbGVjb2RlXHJcbiAgICAgICxcInRvU3RhdGlvblRlbGVjb2RlXCI6IG9yZGVyUmVxdWVzdERUTy50b19zdGF0aW9uX3RlbGVjb2RlXHJcbiAgICAgICxcImxlZnRUaWNrZXRcIjogdGlja2V0SW5mby5xdWVyeUxlZnRUaWNrZXRSZXF1ZXN0RFRPLnlwSW5mb0RldGFpbFxyXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IFwiMDBcIlxyXG4gICAgICAsXCJ0cmFpbl9sb2NhdGlvblwiOiB0aWNrZXRJbmZvLnRyYWluX2xvY2F0aW9uXHJcbiAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgLypcclxuICAgICAgICAgICAgICB7IHZhbGlkYXRlTWVzc2FnZXNTaG93SWQ6ICdfdmFsaWRhdG9yTWVzc2FnZScsXHJcbiAgICAgICAgICAgICAgICBzdGF0dXM6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxyXG4gICAgICAgICAgICAgICAgbWVzc2FnZXM6IFsgJ+ezu+e7n+e5geW/me+8jOivt+eojeWQjumHjeivle+8gScgXSxcclxuICAgICAgICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cclxuICAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGxldCByZXN1bHQgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgICBpZihyZXN1bHQuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUocmVzdWx0KTtcclxuICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZWplY3QocmVzdWx0Lm1lc3NhZ2VzWzBdKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc0NvZGVOZXcoKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2dldFBhc3NDb2RlTmV3P21vZHVsZT1wYXNzZW5nZXImcmFuZD1yYW5kcCZcIitNYXRoLnJhbmRvbSgwLDEpO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUhPT0yMDApIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSkucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShcImNhcHRjaGEuQk1QXCIpKS5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrUmFuZENvZGVBbnN5bigpIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvY2hlY2tSYW5kQ29kZUFuc3luXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgcmFuZENvZGU6IFwiXCIsXHJcbiAgICAgIHJhbmQ6IFwicmFuZHBcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcclxuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgcmwucXVlc3Rpb24oJ1BsZWFzZSBpbnB1dCByYW5kY29kZTonLCAocG9zaXRpb25zKSA9PiB7XHJcbiAgICAgICAgcmwuY2xvc2UoKTtcclxuXHJcbiAgICAgICAgb3B0aW9ucy5mb3JtLnJhbmRDb2RlID0gcG9zaXRpb25zO1xyXG4gICAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgIH0pO1xyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVNpbmdsZUZvclF1ZXVlKHRva2VuLCBwYXNzZW5nZXJzLCB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NvbmZpcm1TaW5nbGVGb3JRdWV1ZVwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMpXHJcbiAgICAgICxcInJhbmRDb2RlXCI6XCJcIlxyXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnB1cnBvc2VfY29kZXNcclxuICAgICAgLFwia2V5X2NoZWNrX2lzQ2hhbmdlXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmtleV9jaGVja19pc0NoYW5nZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0U3RyXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmxlZnRUaWNrZXRTdHJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0udHJhaW5fbG9jYXRpb25cclxuICAgICAgLFwiY2hvb3NlX3NlYXRzXCI6IFwiXCJcclxuICAgICAgLFwic2VhdERldGFpbFR5cGVcIjogXCIwMDBcIlxyXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOiAxXHJcbiAgICAgICxcInJvb21UeXBlXCI6IFwiMDBcIlxyXG4gICAgICAsXCJkd0FsbFwiOiBcIk5cIlxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KVxyXG4gICAgfSlcclxuICB9XHJcblxyXG5cclxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbikge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcInJhbmRvbVwiOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxyXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxyXG4gICAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxRdWV1ZU5vQ29tcGxldGVNeU9yZGVyXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgdG91ckZsYWc6IFwiZGNcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXROb0NvbXBsZXRlKCkge1xyXG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCI7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpXHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpIHtcclxuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9xdWVyeU15T3JkZXJOb0NvbXBsZXRlXCI7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkuZGF0YS5vcmRlckRCTGlzdClcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keS5tZXNzYWdlcyk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG59XHJcbiJdfQ==
