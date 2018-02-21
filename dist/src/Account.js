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
                .then(function () { return _this.sjNewAppToken.next(); }, function (error) {
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
                console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25}"]))));
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
                console.log(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
                _this.sjLfTicketInit.next();
            });
        });
    };
    Account.prototype.submit = function () {
        this.sjLoginInit.next();
    };
    Account.prototype.queryLeftTickets = function (trainDate, fromStationName, toStationName, bypassStationName) {
        var _this = this;
        this.BACK_TRAIN_DATE = trainDate;
        this.FROM_STATION_NAME = fromStationName;
        this.TO_STATION_NAME = toStationName;
        this.FROM_STATION = this.stations.getStationCode(fromStationName);
        this.TO_STATION = this.stations.getStationCode(toStationName);
        var subjectLeftTicket = new Rx.Subject();
        subjectLeftTicket.subscribe(function () {
            _this.queryLeftTicket(trainDate).then(function (trainsData) {
                var trains = [];
                var title = ['车次', '出发', '到达', '出发', '到达', '历时', '可买', '高级软卧', '', '软卧', '软座', '特等座', '无座', '', '硬卧', '硬座', '二等座', '一等座', '商务座'];
                trains.push(title);
                trainsData.result.forEach(function (element) {
                    var train = element.split("|");
                    // train.splice(0, 3);
                    // train.splice(1, 2);
                    // train.splice(7, 9);
                    // train.splice(19, 4);
                    // train[1] = this.stations.getStationName(train[1]);
                    // train[2] = this.stations.getStationName(train[2]);
                    trains.push(train);
                    if (trains.length % 30 === 0) {
                        trains.push(title);
                    }
                });
                var columns = columnify(trains, {
                    columnSplitter: ' | '
                });
                console.log(columns);
            }, function (error) {
                console.error(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), error));
                subjectLeftTicket.next();
            })
                .catch(function (error) { return console.error(error); });
        });
        subjectLeftTicket.next();
    };
    Account.prototype.leftTicketReport = function () {
        var _this = this;
        this.setOrder(this.orders[0]);
        var subjectLeftTicket = new Rx.Subject();
        subjectLeftTicket.subscribe(function () {
            _this.queryLeftTicket(_this.TRAIN_DATE).then(function (trainsData) {
                var trains = [];
                var title = ['车次', '出发', '到达', '出发', '到达', '历时', '可买', '高级软卧', '', '软卧', '软座', '特等座', '无座', '', '硬卧', '硬座', '二等座', '一等座', '商务座'];
                trains.push(title);
                trainsData.result.forEach(function (element) {
                    var train = element.split("|");
                    train.splice(0, 3);
                    train.splice(1, 2);
                    train.splice(7, 9);
                    train.splice(19, 4);
                    train[1] = _this.stations.getStationName(train[1]);
                    train[2] = _this.stations.getStationName(train[2]);
                    trains.push(train);
                    if (trains.length % 30 === 0) {
                        trains.push(title);
                    }
                });
                var columns = columnify(trains, {
                    columnSplitter: ' | '
                });
                console.log(columns);
            }, function (error) {
                console.error(chalk(templateObject_12 || (templateObject_12 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), error));
                subjectLeftTicket.next();
            })
                .catch(function (error) { return console.error(error); });
        });
        subjectLeftTicket.next();
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
    Account.prototype.checkCaptcha = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/passport/captcha/captcha-check";
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        return new Promise(function (resolve, reject) {
            rl.question(chalk(templateObject_13 || (templateObject_13 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positions) {
                rl.close();
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
                        console.log(body.result_message);
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
                    console.log(body);
                    body = JSON.parse(body);
                    console.log(body.result_message);
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
                        throw chalk(templateObject_14 || (templateObject_14 = __makeTemplateObject(["{red.bold \u60A8\u8FD8\u6709\u672A\u5904\u7406\u7684\u8BA2\u5355}"], ["{red.bold \u60A8\u8FD8\u6709\u672A\u5904\u7406\u7684\u8BA2\u5355}"])));
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
                        return resolve(JSON.parse(body));
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
                        return resolve(JSON.parse(body));
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
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUMsQ0FBQyxDQUFDO3dCQUNmLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQTtvQkFDdkMsQ0FBQztvQkFDRCxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDL0IsQ0FBQztnQkFBQSxJQUFJLENBQUMsQ0FBQztvQkFDTCxNQUFNLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2dCQUM5QixDQUFDO1lBQ0gsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFSCxjQUFDO0FBQUQsQ0EzekNBLEFBMnpDQyxJQUFBO0FBM3pDWSwwQkFBTyIsImZpbGUiOiJzcmMvQWNjb3VudC5qcyIsInNvdXJjZXNDb250ZW50IjpbIiAvLyBodHRwczovL3d3dy5sYW5pbmRleC5jb20vMTIzMDYlRTglQjQlQUQlRTclQTUlQTglRTYlQjUlODElRTclQTglOEIlRTUlODUlQTglRTglQTclQTMlRTYlOUUlOTAvXHJcblxyXG5pbXBvcnQge0ZpbGVDb29raWVTdG9yZX0gZnJvbSAnLi9GaWxlQ29va2llU3RvcmUnO1xyXG5pbXBvcnQge1N0YXRpb259IGZyb20gJy4vU3RhdGlvbic7XHJcbmltcG9ydCByZXF1ZXN0ID0gcmVxdWlyZSgncmVxdWVzdCcpO1xyXG5pbXBvcnQgcXVlcnlzdHJpbmcgPSByZXF1aXJlKCdxdWVyeXN0cmluZycpO1xyXG5pbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xyXG5pbXBvcnQgcmVhZGxpbmUgPSByZXF1aXJlKCdyZWFkbGluZScpO1xyXG5pbXBvcnQgcHJvY2VzcyA9IHJlcXVpcmUoJ3Byb2Nlc3MnKTtcclxuaW1wb3J0IFJ4ID0gcmVxdWlyZSgnQHJlYWN0aXZleC9yeGpzJyk7XHJcbmltcG9ydCBjaGFsayA9IHJlcXVpcmUoJ2NoYWxrJyk7XHJcbmltcG9ydCBjb2x1bW5pZnkgPSByZXF1aXJlKCdjb2x1bW5pZnknKTtcclxuXHJcbmV4cG9ydCBjbGFzcyBBY2NvdW50IHtcclxuICBwdWJsaWMgdXNlck5hbWUgOiBzdHJpbmc7XHJcbiAgcHVibGljIHVzZXJQYXNzd29yZCA6IHN0cmluZztcclxuICBwdWJsaWMgVFJBSU5fREFURTogc3RyaW5nO1xyXG4gIHB1YmxpYyBCQUNLX1RSQUlOX0RBVEU6IHN0cmluZztcclxuICBwdWJsaWMgUExBTl9UUkFJTlM6IEFycmF5PHN0cmluZz47XHJcbiAgcHVibGljIFBMQU5fUEVQT0xFUzogQXJyYXk8c3RyaW5nPjtcclxuICBwdWJsaWMgRlJPTV9TVEFUSU9OOiBzdHJpbmc7XHJcbiAgcHVibGljIFRPX1NUQVRJT046IHN0cmluZztcclxuICBwdWJsaWMgRlJPTV9TVEFUSU9OX05BTUU6IHN0cmluZztcclxuICBwdWJsaWMgVE9fU1RBVElPTl9OQU1FOiBzdHJpbmc7XHJcblxyXG4gIHByaXZhdGUgc3RhdGlvbnM6IFN0YXRpb24gPSBuZXcgU3RhdGlvbigpO1xyXG4gIHByaXZhdGUgcGFzc2VuZ2Vyczogb2JqZWN0O1xyXG5cclxuICBwcml2YXRlIFNZU1RFTV9CVVNTWSA9IFwiU3lzdGVtIGlzIGJ1c3N5XCI7XHJcbiAgcHJpdmF0ZSBTWVNURU1fTU9WRUQgPSBcIk1vdmVkIFRlbXBvcmFyaWx5XCI7XHJcblxyXG4gIHByaXZhdGUgcmVxdWVzdDogcmVxdWVzdC5SZXF1ZXN0QVBJPGFueSwgYW55LCBhbnk+O1xyXG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XHJcbiAgcHVibGljIGhlYWRlcnM6IG9iamVjdCA9IHtcclxuICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCJcclxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxyXG4gICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxyXG4gICAgLFwiT3JpZ2luXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuXCJcclxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcclxuICB9O1xyXG5cclxuICBwcml2YXRlIHF1ZXJ5ID0gZmFsc2U7XHJcblxyXG4gIHByaXZhdGUgb3JkZXJzOiBBcnJheTxvYmplY3Q+ID0gW107XHJcblxyXG4gIGNvbnN0cnVjdG9yKG5hbWU6IHN0cmluZywgdXNlclBhc3N3b3JkOiBzdHJpbmcpIHtcclxuICAgIHRoaXMudXNlck5hbWUgPSBuYW1lO1xyXG4gICAgdGhpcy51c2VyUGFzc3dvcmQgPSB1c2VyUGFzc3dvcmQ7XHJcblxyXG4gICAgdGhpcy5zZXRSZXF1ZXN0KCk7XHJcbiAgICB0aGlzLmJ1aWxkTG9naW5GbG93KCk7XHJcbiAgICB0aGlzLmJ1aWxkT3JkZXJGbG93KCk7XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKiDmo4Dmn6XnvZHnu5zlvILluLhcclxuICAgKi9cclxuICBwcml2YXRlIGlzU3lzdGVtQnVzc3koYm9keTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICByZXR1cm4gYm9keS5pbmRleE9mKFwi572R57uc5Y+v6IO95a2Y5Zyo6Zeu6aKY77yM6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMDtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzZXRSZXF1ZXN0KCkge1xyXG4gICAgbGV0IGNvb2tpZUZpbGVOYW1lOiBzdHJpbmcgPSBcIi4vY29va2llcy9cIit0aGlzLnVzZXJOYW1lK1wiLmpzb25cIjtcclxuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKGNvb2tpZUZpbGVOYW1lLCB7ZW5jcnlwdDogZmFsc2V9KTtcclxuICAgIGZpbGVTdG9yZS5vcHRpb24gPSB7ZW5jcnlwdDogZmFsc2V9O1xyXG5cclxuICAgIHRoaXMuY29va2llamFyID0gcmVxdWVzdC5qYXIoZmlsZVN0b3JlKTtcclxuXHJcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY3JlYXRlT3JkZXIodHJhaW5EYXRlczogc3RyaW5nLCBiYWNrVHJhaW5EYXRlOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgIGZyb21TdGF0aW9uTmFtZTogc3RyaW5nLCB0b1N0YXRpb25OYW1lOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgIHBsYW5UcmFpbnM6IEFycmF5PHN0cmluZz4sIHBsYW5QZXBvbGVzOiBBcnJheTxzdHJpbmc+KTogdGhpcyB7XHJcblxyXG4gICAgLy8gaWYodHlwZW9mIHRyYWluRGF0ZSA9PSBcIm9iamVjdFwiICYmIHRyYWluRGF0ZS5jb25zdHJ1Y3Rvci5uYW1lID09IFwiQXJyYXlcIikge1xyXG4gICAgLy9cclxuICAgIC8vIH1cclxuICAgIHRyYWluRGF0ZXMuZm9yRWFjaCh0cmFpbkRhdGU9PiB7XHJcbiAgICAgIHRoaXMub3JkZXJzLnB1c2goe1xyXG4gICAgICAgIFRSQUlOX0RBVEU6IHRyYWluRGF0ZVxyXG4gICAgICAgICxCQUNLX1RSQUlOX0RBVEU6IGJhY2tUcmFpbkRhdGVcclxuICAgICAgICAsRlJPTV9TVEFUSU9OX05BTUU6IGZyb21TdGF0aW9uTmFtZTtcclxuICAgICAgICAsVE9fU1RBVElPTl9OQU1FOiB0b1N0YXRpb25OYW1lO1xyXG4gICAgICAgICxQTEFOX1RSQUlOUzogcGxhblRyYWlucztcclxuICAgICAgICAsUExBTl9QRVBPTEVTOiBwbGFuUGVwb2xlcztcclxuICAgICAgICAsRlJPTV9TVEFUSU9OOiB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKGZyb21TdGF0aW9uTmFtZSk7XHJcbiAgICAgICAgLFRPX1NUQVRJT046IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbkNvZGUodG9TdGF0aW9uTmFtZSk7XHJcbiAgICAgIH0pXHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gdGhpcztcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2V0T3JkZXIob3JkZXIpIHtcclxuICAgIHRoaXMuVFJBSU5fREFURSA9IG9yZGVyLlRSQUlOX0RBVEU7XHJcbiAgICB0aGlzLkJBQ0tfVFJBSU5fREFURSA9IG9yZGVyLkJBQ0tfVFJBSU5fREFURTtcclxuICAgIHRoaXMuRlJPTV9TVEFUSU9OX05BTUUgPSBvcmRlci5GUk9NX1NUQVRJT05fTkFNRTtcclxuICAgIHRoaXMuVE9fU1RBVElPTl9OQU1FID0gb3JkZXIuVE9fU1RBVElPTl9OQU1FO1xyXG4gICAgdGhpcy5QTEFOX1RSQUlOUyA9IG9yZGVyLlBMQU5fVFJBSU5TO1xyXG4gICAgdGhpcy5QTEFOX1BFUE9MRVMgPSBvcmRlci5QTEFOX1BFUE9MRVM7XHJcbiAgICB0aGlzLkZST01fU1RBVElPTiA9IG9yZGVyLkZST01fU1RBVElPTjtcclxuICAgIHRoaXMuVE9fU1RBVElPTiA9IG9yZGVyLlRPX1NUQVRJT047XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY2FuY2VsT3JkZXJRdWV1ZSgpIHtcclxuICAgIHRoaXMuY2FuY2VsUXVldWVOb0NvbXBsZXRlT3JkZXIoKVxyXG4gICAgICAudGhlbih4PT4ge1xyXG4gICAgICAgIGlmKHguc3RhdHVzICYmIHguZGF0YS5leGlzdEVycm9yID09ICdOJykge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg5o6S6Zif6K6i5Y2V5bey5Y+W5raIfWApO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoeCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICB9XHJcblxyXG4gIC8vIExvZ2luIGluaXRcclxuICBwcml2YXRlIHNqTG9naW5Jbml0ICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIC8vIENoZWNrIENhcHRjaGFcclxuICBwcml2YXRlIHNqQ2FwdGNoYSAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIC8vIExvZ2luXHJcbiAgcHJpdmF0ZSBzakxvZ2luICAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAvLyBHZXQgbmV3IGFwcCB0b2tlblxyXG4gIHByaXZhdGUgc2pOZXdBcHBUb2tlbiA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgLy8gR2V0IGFwcCB0b2tlblxyXG4gIHByaXZhdGUgc2pBcHBUb2tlbiAgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICAvLyBHZXQgbXkgbWFpbiBwYWdlXHJcbiAgcHJpdmF0ZSBzak15UGFnZSAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuXHJcbiAgcHJpdmF0ZSBzakxmVGlja2V0SW5pdCAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqUXVlcnlMZlRpY2tldCAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pTbU9SZXFDaGVja1VzZXIgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHNqU21PcmRlclJlcSAgICAgICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBzakNQYXNJbml0RGMgICAgICAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgc2pHZXRQYXNzZW5nZXJzICAgICA9IG5ldyBSeC5TdWJqZWN0PG9iamVjdD4oKTtcclxuICBwcml2YXRlIHNqQ2hlY2tPcmRlckluZm8gICAgPSBuZXcgUnguU3ViamVjdDxvYmplY3Q+KCk7XHJcbiAgcHJpdmF0ZSBzakdldFF1ZXVlQ291bnQgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqR2V0UGFzc0NvZGVOZXcgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pDb25maXJtU2luZ2xlNFEgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzalF1ZXJ5T3JkZXJXYWl0VCAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuXHJcbiAgcHJpdmF0ZSBidWlsZE9yZGVyRmxvdygpIHtcclxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxyXG4gICAgdGhpcy5zakxmVGlja2V0SW5pdC5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMubGVmdFRpY2tldEluaXQoKVxyXG4gICAgICAgIC50aGVuKCgpPT50aGlzLnNqUXVlcnlMZlRpY2tldC5uZXh0KDApLCAoZXJyb3I6IGFueSk9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIOafpeivoueBq+i9puS9meelqFxyXG4gICAgdGhpcy5zalF1ZXJ5TGZUaWNrZXQuc3Vic2NyaWJlKChpKT0+IHtcclxuXHJcbiAgICAgIGxldCBvcmRlciA9IHRoaXMub3JkZXJzW2ldO1xyXG4gICAgICB0aGlzLnNldE9yZGVyKG9yZGVyKTtcclxuXHJcbiAgICAgIGlmKHRoaXMucXVlcnkpIHtcclxuICAgICAgICBwcm9jZXNzLnN0ZG91dC5jbGVhckxpbmUoKTtcclxuICAgICAgICBwcm9jZXNzLnN0ZG91dC5jdXJzb3JUbygwKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgdGhpcy5xdWVyeUxlZnRUaWNrZXQob3JkZXIuVFJBSU5fREFURSkudGhlbih0cmFpbnNEYXRhID0+IHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKHRyYWluc0RhdGEpO1xyXG4gICAgICAgIHZhciB0cmFpbnMgPSB0cmFpbnNEYXRhLnJlc3VsdDtcclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIuafpeivouWIsOeBq+i9puaVsOmHjyBcIit0cmFpbnMubGVuZ3RoKTtcclxuICAgICAgICB2YXIgcGxhblRyYWluLCB0aGF0ID0gdGhpcztcclxuICAgICAgICB0cmFpbnMuZm9yRWFjaChmdW5jdGlvbih0cmFpbikge1xyXG4gICAgICAgICAgdHJhaW4gPSB0cmFpbi5zcGxpdChcInxcIik7XHJcblxyXG4gICAgICAgICAgaWYodHJhaW5bMzBdID09IFwi5pyJXCIgfHwgKHRyYWluWzMwXSA+IDAgJiYgdHJhaW5bMzBdICE9IFwi5pegXCIgJiYgdHJhaW5bMzBdICE9IFwiMFwiKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlci5UUkFJTl9EQVRFK1wiL1wiK3RyYWluWzNdK1wiL1wiK3RyYWluWzMwXSk7XHJcbiAgICAgICAgICAgIGlmKG9yZGVyLlBMQU5fVFJBSU5TLmluY2x1ZGVzKHRyYWluWzNdKSkge1xyXG4gICAgICAgICAgICAgIHBsYW5UcmFpbiA9IHRyYWluO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGlmKHBsYW5UcmFpbikge1xyXG4gICAgICAgICAgcmV0dXJuIHBsYW5UcmFpbjtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOayoeacieWPr+i0reS5sOS9meelqCAke3RoaXMuVFJBSU5fREFURVtpXX19YCk7XHJcbiAgICAgICAgICBwcm9jZXNzLnN0ZG91dC53cml0ZShjaGFsa2B7eWVsbG93IOayoeacieWPr+i0reS5sOS9meelqCAke29yZGVyLlRSQUlOX0RBVEV9fWApO1xyXG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBlcnIgPT4ge1xyXG4gICAgICAgIC8vIGNvbnNvbGUuZXJyb3IoY2hhbGtge3llbGxvdyAke2Vycn19YCk7XHJcbiAgICAgICAgcHJvY2Vzcy5zdGRvdXQud3JpdGUoY2hhbGtge3llbGxvdyAke2Vycn19YCk7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC50aGVuKChwbGFuVHJhaW4pPT4ge1xyXG4gICAgICAgICAgdGhpcy5xdWVyeSA9IGZhbHNlO1xyXG4gICAgICAgICAgdGhpcy5zalNtT1JlcUNoZWNrVXNlci5uZXh0KHBsYW5UcmFpblswXSk7XHJcbiAgICAgICAgfSwoKT0+IHtcclxuICAgICAgICAgIGkgPSAoaSsxKSV0aGlzLm9yZGVycy5sZW5ndGg7XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpPT4ge1xyXG4gICAgICAgICAgICB0aGlzLnNqUXVlcnlMZlRpY2tldC5uZXh0KGkpO1xyXG4gICAgICAgICAgfSwgMTUwMCk7XHJcbiAgICAgICAgICB0aGlzLnF1ZXJ5ID0gdHJ1ZTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgMTAg6aqM6K+B55m75b2V77yMUG9zdFxyXG4gICAgdGhpcy5zalNtT1JlcUNoZWNrVXNlci5zdWJzY3JpYmUoKHRyYWluOiBzdHJpbmcpPT4ge1xyXG4gICAgICBjb25zb2xlLmxvZyhcInN1Ym1pdCBvcmRlciByZXF1ZXN0IGNoZWNrIHVzZXJcIik7XHJcbiAgICAgIHRoaXMuY2hlY2tVc2VyKCkudGhlbigoKT0+dGhpcy5zalNtT3JkZXJSZXEubmV4dCh0cmFpbiksIGVycm9yID0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiQ2hlY2sgdXNlciBlcnJvciBcIik7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgLyogVE9ETyBhZGQgcmVsb2dpbiBsb2dpY1xyXG4gICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgIHN0YXR1czogdHJ1ZSxcclxuICAgICAgICAgIGh0dHBzdGF0dXM6IDIwMCxcclxuICAgICAgICAgIGRhdGE6IHsgZmxhZzogZmFsc2UgfSxcclxuICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcclxuICAgICAgICAgIHZhbGlkYXRlTWVzc2FnZXM6IHt9IH1cclxuICAgICAgICAqL1xyXG4gICAgICAgIHRoaXMuc2pTbU9SZXFDaGVja1VzZXIubmV4dCh0cmFpbik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxMSDpooTmj5DkuqTorqLljZXvvIxQb3N0XHJcbiAgICB0aGlzLnNqU21PcmRlclJlcS5zdWJzY3JpYmUoKHRyYWluOiBzdHJpbmcpPT4ge1xyXG4gICAgICBjb25zb2xlLmxvZyhcInN1Ym1pdCBvcmRlciByZXF1ZXN0XCIpO1xyXG4gICAgICB0aGlzLnN1Ym1pdE9yZGVyUmVxdWVzdCh0cmFpbikudGhlbigoeCk9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhcIlN1Ym1pdCBPcmRlciBSZXF1ZXN0IHN1Y2Nlc3MhXCIpXHJcbiAgICAgICAgICB0aGlzLnNqQ1Bhc0luaXREYy5uZXh0KCk7XHJcbiAgICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKFwiU3VibWl0T3JkZXJSZXF1ZXN0IGVycm9yIFwiICsgZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zalNtT3JkZXJSZXEubmV4dCh0cmFpbik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDEyIOaooeaLn+i3s+i9rOmhtemdokluaXREY++8jFBvc3RcclxuICAgIHRoaXMuc2pDUGFzSW5pdERjLnN1YnNjcmliZSgodHJhaW46IHN0cmluZyk9PiB7XHJcbiAgICAgIHRoaXMuY29uZmlybVBhc3NlbmdlckluaXREYygpLnRoZW4oKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcImNvbmZpcm1QYXNzZW5nZXIgSW5pdCBEYyBzdWNjZXNzISBcIitvcmRlclJlcXVlc3QudG9rZW4pO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKG9yZGVyUmVxdWVzdC50aWNrZXRJbmZvKTtcclxuICAgICAgICBpZih0aGlzLnBhc3NlbmdlcnMpIHtcclxuICAgICAgICAgIG9yZGVyUmVxdWVzdC5wYXNzZW5nZXJzID0gdGhpcy5wYXNzZW5nZXJzO1xyXG4gICAgICAgICAgdGhpcy5zakNoZWNrT3JkZXJJbmZvLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICB0aGlzLnNqR2V0UGFzc2VuZ2Vycy5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICBpZihlcnJvciA9PSB0aGlzLlNZU1RFTV9CVVNTWSkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dCgpO1xyXG4gICAgICAgIH1lbHNlIGlmKGVycm9yID09IHRoaXMuU1lTVEVNX01PVkVEKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgICAgICB0aGlzLnNqQ1Bhc0luaXREYy5uZXh0KCk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KS5jYXRjaChlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgMTMg5bi455So6IGU57O75Lq656Gu5a6a77yMUG9zdFxyXG4gICAgdGhpcy5zakdldFBhc3NlbmdlcnMuc3Vic2NyaWJlKChvcmRlclJlcXVlc3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMuZ2V0UGFzc2VuZ2VycyhvcmRlclJlcXVlc3QudG9rZW4pLnRoZW4ocGFzc2VuZ2Vycz0+IHtcclxuICAgICAgICB0aGlzLnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xyXG4gICAgICAgIG9yZGVyUmVxdWVzdC5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcclxuICAgICAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm8ubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yICsgXCIgUmV0cnkgZ2V0IHBhc3NlbmdlcnNcIik7XHJcbiAgICAgICAgdGhpcy5zakdldFBhc3NlbmdlcnMubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDE0IOi0reelqOS6uuehruWumu+8jFBvc3RcclxuICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5jaGVja09yZGVySW5mbyhvcmRlclJlcXVlc3QudG9rZW4sIG9yZGVyUmVxdWVzdC5wYXNzZW5nZXJzLmRhdGEubm9ybWFsX3Bhc3NlbmdlcnMpXHJcbiAgICAgICAgLnRoZW4ob3JkZXJJbmZvPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2cob3JkZXJJbmZvKTtcclxuICAgICAgICAgIC8vIFN0ZXAgMTUg5YeG5aSH6L+b5YWl5o6S6Zif77yMUG9zdFxyXG4gICAgICAgICAgdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyUmVxdWVzdC50b2tlbiwgb3JkZXJSZXF1ZXN0Lm9yZGVyUmVxdWVzdCwgb3JkZXJSZXF1ZXN0LnRpY2tldEluZm8pXHJcbiAgICAgICAgICAgIC50aGVuKHg9PiB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coeCk7XHJcbiAgICAgICAgICAgICAgLy8g6IulIFN0ZXAgMTQg5Lit55qEIFwiaWZTaG93UGFzc0NvZGVcIiA9IFwiWVwi77yM6YKj5LmI5aSa5LqG6L6T5YWl6aqM6K+B56CB6L+Z5LiA5q2l77yMUG9zdFxyXG4gICAgICAgICAgICAgIGlmKG9yZGVySW5mby5kYXRhLmlmU2hvd1Bhc3NDb2RlID09IFwiWVwiKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNqR2V0UGFzc0NvZGVOZXcubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIFN0ZXAgMTcg56Gu6K6k6LSt5Lmw77yMUG9zdFxyXG4gICAgICAgICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm8ubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pHZXRQYXNzQ29kZU5ldy5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgLy8gU3RlcCAxNiDkuZjlrqLkubDnpajpqozor4HnoIHvvIxHZXQgUE9TVFxyXG4gICAgICB0aGlzLmdldFBhc3NDb2RlTmV3KCkudGhlbigoKT0+IHRoaXMuY2hlY2tSYW5kQ29kZUFuc3luKCkpXHJcbiAgICAgICAgLnRoZW4oeD0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKHgpO1xyXG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgfSxlcnJvcj0+Y29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5jb25maXJtU2luZ2xlRm9yUXVldWUob3JkZXJSZXF1ZXN0LnRva2VuLCBvcmRlclJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlclJlcXVlc3QudGlja2V0SW5mbylcclxuICAgICAgICAudGhlbih4PT4ge1xyXG4gICAgICAgICAgaWYoeC5zdGF0dXMgJiYgeC5kYXRhLnN1Ym1pdFN0YXR1cykge1xyXG4gICAgICAgICAgICAvLyBTdGVwIDE4IOafpeivouaOkumYn+etieW+heaXtumXtO+8gVxyXG4gICAgICAgICAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgLyoqXHJcbiAgICAgICAgICAgIHsgdmFsaWRhdGVNZXNzYWdlc1Nob3dJZDogJ192YWxpZGF0b3JNZXNzYWdlJyxcclxuICAgICAgICAgICAgICBzdGF0dXM6IHRydWUsXHJcbiAgICAgICAgICAgICAgaHR0cHN0YXR1czogMjAwLFxyXG4gICAgICAgICAgICAgIGRhdGE6IHsgZXJyTXNnOiAn5L2Z56Wo5LiN6Laz77yBJywgc3VibWl0U3RhdHVzOiBmYWxzZSB9LFxyXG4gICAgICAgICAgICAgIG1lc3NhZ2VzOiBbXSxcclxuICAgICAgICAgICAgICB2YWxpZGF0ZU1lc3NhZ2VzOiB7fSB9XHJcbiAgICAgICAgICAgICovXHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCAke3guZGF0YS5lcnJNc2d9fWApO1xyXG4gICAgICAgICAgICAvLyDph43mlrDlvIDlp4vmn6Xor6JcclxuICAgICAgICAgICAgdGhpcy5zalF1ZXJ5TGZUaWNrZXQubmV4dCgwKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5xdWVyeU9yZGVyV2FpdFRpbWUob3JkZXJSZXF1ZXN0LnRva2VuKVxyXG4gICAgICAgIC50aGVuKG9yZGVyUXVldWU9PiB7XHJcbiAgICAgICAgICBpZihvcmRlclF1ZXVlLnN0YXR1cykge1xyXG4gICAgICAgICAgICBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IDAgfHwgb3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMSkge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYFlvdXIgdGlja2V0IG9yZGVyIG51bWJlciBpcyB7cmVkLmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEub3JkZXJJZH19YCk7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTIpe1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKG9yZGVyUXVldWUpO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0zKXtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIllvdXIgdGlja2V0IHJlcXVlc3QgaGFzIGJlZW4gY2FuY2VsZWQhXCIpO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC00KXtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIllvdXIgdGlja2V0IHJlcXVlc3QgaXMgYmVpbmcgcHJvY2Vzc2VkLCBwbGVhc2Ugd2FpdCBhIG1vbWVudCFcIik7XHJcbiAgICAgICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgfSwgNDAwMCk7XHJcbiAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg5o6S6Zif5Lq65pWw77yaJHtvcmRlclF1ZXVlLmRhdGEud2FpdENvdW50fX0g6aKE6K6h562J5b6F5pe26Ze077yaJHtwYXJzZUludChvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgLyAxLjUpfSDliIbpkp9gKTtcclxuICAgICAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgICAgICB9LCA0MDAwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcclxuICAgICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgICB9LCA0MDAwKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrLmJnQmx1ZShlcnJvcitcIiBSZUNoZWNrIE9yZGVyIHdhaXRpbmcgdGltZVwiKSk7XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgfSwgNDAwMCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRMb2dpbkZsb3coKTogdm9pZCB7XHJcbiAgICB0aGlzLnNqTG9naW5Jbml0LnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5sb2dpbkluaXQoKVxyXG4gICAgICAgIC50aGVuKCgpPT57XHJcbiAgICAgICAgICB2YXIgdG9rZW5zID0gdGhpcy5jaGVja0F1dGhlbnRpY2F0aW9uKHRoaXMuY29va2llamFyLl9qYXIudG9KU09OKCkuY29va2llcyk7XHJcbiAgICAgICAgICBpZih0b2tlbnMudGspIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2pBcHBUb2tlbi5uZXh0KHRva2Vucy50ayk7XHJcbiAgICAgICAgICB9ZWxzZSBpZih0b2tlbnMudWFtdGspIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2pOZXdBcHBUb2tlbi5uZXh0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICB0aGlzLnNqQ2FwdGNoYS5uZXh0KCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqQ2FwdGNoYS5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMuZ2V0Q2FwdGNoYSgpLnRoZW4oKCk9PiB0aGlzLmNoZWNrQ2FwdGNoYSgpKVxyXG4gICAgICAgIC50aGVuKCgpPT4ge1xyXG4gICAgICAgICAgLy8g5qCh6aqM56CB5oiQ5Yqf5ZCO6L+b6KGM5o6I5p2D6K6k6K+BXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDpqozor4HnoIHmoKHpqozmiJDlip99YCk7XHJcbiAgICAgICAgICB0aGlzLnNqTG9naW4ubmV4dCgpO1xyXG4gICAgICAgIH0sIChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICAgIC8vIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjFxyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjH1gKTtcclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pMb2dpbi5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMudXNlckF1dGhlbnRpY2F0ZSgpXHJcbiAgICAgICAgLnRoZW4oKCk9PnRoaXMuc2pOZXdBcHBUb2tlbi5uZXh0KCksIChlcnJvcjogYW55KT0+e1xyXG4gICAgICAgICAgLypcclxuICAgICAgICAgIHtcInJlc3VsdF9tZXNzYWdlXCI6XCLlr4bnoIHovpPlhaXplJnor6/jgILlpoLmnpzovpPplJnmrKHmlbDotoXov4c05qyh77yM55So5oi35bCG6KKr6ZSB5a6a44CCXCIsXCJyZXN1bHRfY29kZVwiOjF9XHJcbiAgICAgICAgICB7XCJyZXN1bHRfbWVzc2FnZVwiOlwi6aqM6K+B56CB5qCh6aqM5aSx6LSlXCIsXCJyZXN1bHRfY29kZVwiOlwiNVwifVxyXG4gICAgICAgICAgKi9cclxuICAgICAgICAgIGlmKHR5cGVvZiBlcnJvci5yZXN1bHRfY29kZSA9PSBcInVuZGVmaW5lZFwiKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2pMb2dpbi5uZXh0KCk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIGlmKGVycm9yLnJlc3VsdF9jb2RlID09PSAxKSB7XHJcbiAgICAgICAgICAgICAgdGhyb3cgZXJyb3IucmVzdWx0X21lc3NhZ2U7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKGVycm9yLnJlc3VsdF9jb2RlID09PSA1KSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xyXG4gICAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSlcclxuICAgICAgICA7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqTmV3QXBwVG9rZW4uc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmdldE5ld0FwcFRva2VuKClcclxuICAgICAgICAudGhlbigobmV3YXBwdGs6IHN0cmluZyk9PiB0aGlzLnNqQXBwVG9rZW4ubmV4dChuZXdhcHB0ayksIChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pBcHBUb2tlbi5zdWJzY3JpYmUoKG5ld2FwcHRrOiBzdHJpbmcpPT4ge1xyXG4gICAgICB0aGlzLmdldEFwcFRva2VuKG5ld2FwcHRrKS50aGVuKCh4OiBzdHJpbmcpID0+IHtcclxuICAgICAgICB0aGlzLnNqTXlQYWdlLm5leHQoKTtcclxuICAgICAgfSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDojrflj5ZUb2tlbuWksei0pX1gKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgICAgaWYoZXJyb3IucmVzdWx0X2NvZGUgJiYgZXJyb3IucmVzdWx0X2NvZGUgPT09IDIpIHtcclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAvLyBUT0RPXHJcbiAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB0aGlzLnNqQXBwVG9rZW4ubmV4dChuZXdhcHB0ayksIDEwMDApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqTXlQYWdlLnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5nZXRNeTEyMzA2KClcclxuICAgICAgICAudGhlbigoKT0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOeZu+W9leaIkOWKn31gKTtcclxuICAgICAgICAgIHRoaXMuc2pMZlRpY2tldEluaXQubmV4dCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3VibWl0KCk6IHZvaWQge1xyXG4gICAgdGhpcy5zakxvZ2luSW5pdC5uZXh0KCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgcXVlcnlMZWZ0VGlja2V0cyh0cmFpbkRhdGUsIGZyb21TdGF0aW9uTmFtZSwgdG9TdGF0aW9uTmFtZSwgYnlwYXNzU3RhdGlvbk5hbWUpIHtcclxuICAgIHRoaXMuQkFDS19UUkFJTl9EQVRFID0gdHJhaW5EYXRlO1xyXG4gICAgdGhpcy5GUk9NX1NUQVRJT05fTkFNRSA9IGZyb21TdGF0aW9uTmFtZTtcclxuICAgIHRoaXMuVE9fU1RBVElPTl9OQU1FID0gdG9TdGF0aW9uTmFtZTtcclxuICAgIHRoaXMuRlJPTV9TVEFUSU9OID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZShmcm9tU3RhdGlvbk5hbWUpO1xyXG4gICAgdGhpcy5UT19TVEFUSU9OID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uQ29kZSh0b1N0YXRpb25OYW1lKTtcclxuXHJcbiAgICB2YXIgc3ViamVjdExlZnRUaWNrZXQgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICAgIHN1YmplY3RMZWZ0VGlja2V0LnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5xdWVyeUxlZnRUaWNrZXQodHJhaW5EYXRlKS50aGVuKHRyYWluc0RhdGEgPT4ge1xyXG4gICAgICAgIGxldCB0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW107XHJcbiAgICAgICAgdmFyIHRpdGxlID0gWyfovabmrKEnLCAn5Ye65Y+RJywgJ+WIsOi+vicsICflh7rlj5EnLCAn5Yiw6L6+JywgJ+WOhuaXticsICflj6/kubAnLCAn6auY57qn6L2v5Y2nJywgJycsICfova/ljacnLCAn6L2v5bqnJywgJ+eJueetieW6pycsICfml6DluqcnLCAnJywgJ+ehrOWNpycsICfnoazluqcnLCAn5LqM562J5bqnJywgJ+S4gOetieW6pycsICfllYbliqHluqcnXTtcclxuICAgICAgICB0cmFpbnMucHVzaCh0aXRsZSk7XHJcbiAgICAgICAgdHJhaW5zRGF0YS5yZXN1bHQuZm9yRWFjaCgoZWxlbWVudDogc3RyaW5nKT0+IHtcclxuICAgICAgICAgIGxldCB0cmFpbjogQXJyYXk8c3RyaW5nPiA9IGVsZW1lbnQuc3BsaXQoXCJ8XCIpO1xyXG4gICAgICAgICAgLy8gdHJhaW4uc3BsaWNlKDAsIDMpO1xyXG4gICAgICAgICAgLy8gdHJhaW4uc3BsaWNlKDEsIDIpO1xyXG4gICAgICAgICAgLy8gdHJhaW4uc3BsaWNlKDcsIDkpO1xyXG4gICAgICAgICAgLy8gdHJhaW4uc3BsaWNlKDE5LCA0KTtcclxuICAgICAgICAgIC8vIHRyYWluWzFdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpblsxXSk7XHJcbiAgICAgICAgICAvLyB0cmFpblsyXSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bMl0pO1xyXG4gICAgICAgICAgdHJhaW5zLnB1c2godHJhaW4pO1xyXG4gICAgICAgICAgaWYodHJhaW5zLmxlbmd0aCAlIDMwID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRyYWlucy5wdXNoKHRpdGxlKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkodHJhaW5zLCB7XHJcbiAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJyB8ICdcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7eWVsbG93LmJvbGQgJHtlcnJvcn19YCk7XHJcbiAgICAgICAgc3ViamVjdExlZnRUaWNrZXQubmV4dCgpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3I9PmNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHN1YmplY3RMZWZ0VGlja2V0Lm5leHQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBsZWZ0VGlja2V0UmVwb3J0KCkge1xyXG4gICAgdGhpcy5zZXRPcmRlcih0aGlzLm9yZGVyc1swXSk7XHJcbiAgICB2YXIgc3ViamVjdExlZnRUaWNrZXQgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICAgIHN1YmplY3RMZWZ0VGlja2V0LnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5xdWVyeUxlZnRUaWNrZXQodGhpcy5UUkFJTl9EQVRFKS50aGVuKHRyYWluc0RhdGEgPT4ge1xyXG4gICAgICAgIGxldCB0cmFpbnM6IEFycmF5PEFycmF5PHN0cmluZz4+ID0gW107XHJcbiAgICAgICAgdmFyIHRpdGxlID0gWyfovabmrKEnLCAn5Ye65Y+RJywgJ+WIsOi+vicsICflh7rlj5EnLCAn5Yiw6L6+JywgJ+WOhuaXticsICflj6/kubAnLCAn6auY57qn6L2v5Y2nJywgJycsICfova/ljacnLCAn6L2v5bqnJywgJ+eJueetieW6pycsICfml6DluqcnLCAnJywgJ+ehrOWNpycsICfnoazluqcnLCAn5LqM562J5bqnJywgJ+S4gOetieW6pycsICfllYbliqHluqcnXTtcclxuICAgICAgICB0cmFpbnMucHVzaCh0aXRsZSk7XHJcbiAgICAgICAgdHJhaW5zRGF0YS5yZXN1bHQuZm9yRWFjaCgoZWxlbWVudDogc3RyaW5nKT0+IHtcclxuICAgICAgICAgIGxldCB0cmFpbjogQXJyYXk8c3RyaW5nPiA9IGVsZW1lbnQuc3BsaXQoXCJ8XCIpO1xyXG4gICAgICAgICAgdHJhaW4uc3BsaWNlKDAsIDMpO1xyXG4gICAgICAgICAgdHJhaW4uc3BsaWNlKDEsIDIpO1xyXG4gICAgICAgICAgdHJhaW4uc3BsaWNlKDcsIDkpO1xyXG4gICAgICAgICAgdHJhaW4uc3BsaWNlKDE5LCA0KTtcclxuICAgICAgICAgIHRyYWluWzFdID0gdGhpcy5zdGF0aW9ucy5nZXRTdGF0aW9uTmFtZSh0cmFpblsxXSk7XHJcbiAgICAgICAgICB0cmFpblsyXSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bMl0pO1xyXG4gICAgICAgICAgdHJhaW5zLnB1c2godHJhaW4pO1xyXG4gICAgICAgICAgaWYodHJhaW5zLmxlbmd0aCAlIDMwID09PSAwKSB7XHJcbiAgICAgICAgICAgIHRyYWlucy5wdXNoKHRpdGxlKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgdmFyIGNvbHVtbnMgPSBjb2x1bW5pZnkodHJhaW5zLCB7XHJcbiAgICAgICAgICBjb2x1bW5TcGxpdHRlcjogJyB8ICdcclxuICAgICAgICB9KVxyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhjb2x1bW5zKTtcclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihjaGFsa2B7eWVsbG93LmJvbGQgJHtlcnJvcn19YCk7XHJcbiAgICAgICAgc3ViamVjdExlZnRUaWNrZXQubmV4dCgpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3I9PmNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHN1YmplY3RMZWZ0VGlja2V0Lm5leHQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBteU9yZGVyTm9Db21wbGV0ZVJlcG9ydCgpIHtcclxuICAgIHZhciBzdWJqZWN0T3JkZXJOb0NvbXBsZXRlID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuXHJcbiAgICBzdWJqZWN0T3JkZXJOb0NvbXBsZXRlLnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5pbml0Tm9Db21wbGV0ZSgpLnRoZW4oKCk9PiB7XHJcbiAgICAgICAgdGhpcy5xdWVyeU15T3JkZXJOb0NvbXBsZXRlKCkudGhlbih4PT4ge1xyXG4gICAgICAgICAgICB2YXIgY29sdW1ucyA9IGNvbHVtbmlmeSh4LCB7XHJcbiAgICAgICAgICAgICAgY29sdW1uU3BsaXR0ZXI6ICcgfCAnXHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgY29uc29sZS5sb2coY29sdW1ucyk7XHJcbiAgICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCk9PiBzdWJqZWN0T3JkZXJOb0NvbXBsZXRlLm5leHQoKSwgMTAwMClcclxuICAgICAgICAgIH0pO1xyXG4gICAgICB9LCBlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIHN1YmplY3RPcmRlck5vQ29tcGxldGUubmV4dCgpO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGxvZ2luSW5pdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vaW5pdFwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsLFxyXG4gICAgICBtZXRob2Q6IFwiR0VUXCIsXHJcbiAgICAgIGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmU6IG9iamVjdCwgcmVqZWN0OiBvYmplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSkgPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSByZXR1cm4gcmVqZWN0KGVycm9yLnRvU3RyaW5nKCkpO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q2FwdGNoYSgpOiBQcm9taXNlIHtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcclxuICAgICAgICAgIFwibW9kdWxlXCI6IFwibG9naW5cIixcclxuICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiLFxyXG4gICAgICAgICAgXCIwLjE3MjMxODcyNzAzMzg5MDYyXCI6XCJcIlxyXG4gICAgICB9O1xyXG5cclxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShkYXRhLCBudWxsLCBudWxsKVxyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L2NhcHRjaGEvY2FwdGNoYS1pbWFnZT9cIitwYXJhbTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KSA9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcclxuICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja0NhcHRjaGEoKTogUHJvbWlzZSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWNoZWNrXCI7XHJcblxyXG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xyXG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcclxuICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgcmwucXVlc3Rpb24oY2hhbGtge3JlZC5ib2xkIOivt+i+k+WFpemqjOivgeeggX06YCwgKHBvc2l0aW9ucykgPT4ge1xyXG4gICAgICAgIHJsLmNsb3NlKCk7XHJcblxyXG4gICAgICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgICBcImFuc3dlclwiOiBwb3NpdGlvbnMsXHJcbiAgICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcclxuICAgICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCJcclxuICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICAgICAgdXJsOiB1cmxcclxuICAgICAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAgICAgLGZvcm06IGRhdGFcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSkgPT4ge1xyXG4gICAgICAgICAgaWYoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xyXG4gICAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDQpIHtcclxuICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdlcnJvcjogJysgcmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlLnRleHQpO1xyXG4gICAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdXNlckF1dGhlbnRpY2F0ZSgpOiBQcm9taXNlIHtcclxuICAgIC8vIOWPkemAgeeZu+W9leS/oeaBr1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcclxuICAgICAgICAgICxcInVzZXJuYW1lXCI6IHRoaXMudXNlck5hbWVcclxuICAgICAgICAgICxcInBhc3N3b3JkXCI6IHRoaXMudXNlclBhc3N3b3JkXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2xvZ2luXCI7XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSByZXR1cm4gcmVqZWN0KGVycm9yKTtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhib2R5KTtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYm9keS5yZXN1bHRfbWVzc2FnZSk7XHJcbiAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDIpIHtcclxuICAgICAgICAgICAgdGhyb3cgYm9keS5yZXN1bHRfbWVzc2FnZTtcclxuICAgICAgICAgIH1lbHNlIGlmKGJvZHkucmVzdWx0X2NvZGUgIT0gMCkge1xyXG4gICAgICAgICAgICByZWplY3QoYm9keSk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIHJlc29sdmUoYm9keS51YW10ayk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE5ld0FwcFRva2VuKCk6IFByb21pc2Uge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcclxuICAgICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9e1xyXG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9hdXRoL3VhbXRrXCJcclxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xyXG4gICAgICAgICAgICByZXNvbHZlKGJvZHkubmV3YXBwdGspO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZWplY3QoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TXkxMjMwNigpOiBQcm9taXNlIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KHtcclxuICAgICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9pbmRleC9pbml0TXkxMjMwNlwiXHJcbiAgICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICAsbWV0aG9kOiBcIkdFVFwifSxcclxuICAgICAgIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coXCJHb3QgbXkgMTIzMDZcIik7XHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2hlY2tBdXRoZW50aWNhdGlvbihjb29raWVzOiBvYmplY3QpIHtcclxuICAgIHZhciB1YW10ayA9IFwiXCIsIHRrID0gXCJcIjtcclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb29raWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidWFtdGtcIikge1xyXG4gICAgICAgIHVhbXRrID0gY29va2llc1tpXS52YWx1ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYoY29va2llc1tpXS5rZXkgPT0gXCJ0a1wiKSB7XHJcbiAgICAgICAgdGsgPSBjb29raWVzW2ldLnZhbHVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB1YW10azogdWFtdGssXHJcbiAgICAgIHRrOiB0a1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRBcHBUb2tlbihuZXdhcHB0azogc3RyaW5nKSB7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwidGtcIjogbmV3YXBwdGtcclxuICAgICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi91YW1hdXRoY2xpZW50XCJcclxuICAgICAgLGhlYWRlcnM6IHtcclxuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxyXG4gICAgICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzcG9ydD9yZWRpcmVjdD0vb3RuL1wiXHJcbiAgICAgICAgLCdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJ1xyXG4gICAgICB9XHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xyXG4gICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XHJcbiAgICAgICAgICAgIHJlc29sdmUoYm9keS5hcHB0ayk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIHJlamVjdChib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSlcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxlZnRUaWNrZXRJbml0KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIjtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdCh1cmwsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzVGV4dCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHF1ZXJ5TGVmdFRpY2tldCh0cmFpbkRhdGUpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciBxdWVyeSA9IHtcclxuICAgICAgXCJsZWZ0VGlja2V0RFRPLnRyYWluX2RhdGVcIjogdHJhaW5EYXRlXHJcbiAgICAgICxcImxlZnRUaWNrZXREVE8uZnJvbV9zdGF0aW9uXCI6IHRoaXMuRlJPTV9TVEFUSU9OXHJcbiAgICAgICxcImxlZnRUaWNrZXREVE8udG9fc3RhdGlvblwiOiB0aGlzLlRPX1NUQVRJT05cclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIkFEVUxUXCJcclxuICAgIH1cclxuXHJcbiAgICB2YXIgcGFyYW0gPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkocXVlcnkpO1xyXG5cclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9xdWVyeVo/XCIrcGFyYW07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3QodXJsLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikge1xyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnJvci50b1N0cmluZygpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2cocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZighYm9keSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYoYm9keS5pbmRleE9mKFwi6K+35oKo6YeN6K+V5LiA5LiLXCIpID4gMCkge1xyXG4gICAgICAgICAgICByZWplY3QoXCLns7vnu5/nuYHlv5khXCIpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIHZhciBkYXRhID0gSlNPTi5wYXJzZShib2R5KS5kYXRhO1xyXG4gICAgICAgICAgICB9Y2F0Y2goZXJyKSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICAgICAgcmVqZWN0KGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmVzb2x2ZShkYXRhKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgICAgIHJlamVjdCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2hlY2tVc2VyKCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sb2dpbi9jaGVja1VzZXJcIjtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiSWYtTW9kaWZpZWQtU2luY2VcIjogXCIwXCJcclxuICAgICAgICAsXCJDYWNoZS1Db250cm9sXCI6IFwibm8tY2FjaGVcIlxyXG4gICAgICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvaW5pdFwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KVxyXG4gICAgICAgICAgaWYoYm9keS5kYXRhLmZsYWcpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc3VibWl0T3JkZXJSZXF1ZXN0KHNlY3JldFN0cjogc3RyaW5nKTogUHJvbWlzZTxvYmplY3Q+ICB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvc3VibWl0T3JkZXJSZXF1ZXN0XCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwic2VjcmV0U3RyXCI6IHF1ZXJ5c3RyaW5nLnVuZXNjYXBlKHNlY3JldFN0cilcclxuICAgICAgLFwidHJhaW5fZGF0ZVwiOiB0aGlzLlRSQUlOX0RBVEVcclxuICAgICAgLFwiYmFja190cmFpbl9kYXRlXCI6IHRoaXMuQkFDS19UUkFJTl9EQVRFXHJcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIkFEVUxUXCJcclxuICAgICAgLFwicXVlcnlfZnJvbV9zdGF0aW9uX25hbWVcIjogdGhpcy5GUk9NX1NUQVRJT05fTkFNRVxyXG4gICAgICAsXCJxdWVyeV90b19zdGF0aW9uX25hbWVcIjogdGhpcy5UT19TVEFUSU9OX05BTUVcclxuICAgICAgLFwidW5kZWZpbmVkXCI6XCJcIlxyXG4gICAgfTtcclxuXHJcbiAgICAvLyB1cmwgPSB1cmwgKyBcInNlY3JldFN0cj1cIitzZWNyZXRTdHIrXCImdHJhaW5fZGF0ZT0yMDE4LTAxLTMxJmJhY2tfdHJhaW5fZGF0ZT0yMDE4LTAxLTMwJnRvdXJfZmxhZz1kYyZwdXJwb3NlX2NvZGVzPUFEVUxUJnF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lPeS4iua1tyZxdWVyeV90b19zdGF0aW9uX25hbWU95b6Q5bee5LicJnVuZGVmaW5lZFwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXHJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgLy8gY29uc29sZS5lcnJvcihib2R5KTtcclxuICAgICAgICAgIGlmKGJvZHkubWVzc2FnZXNbMF0uaW5kZXhPZign5oKo6L+Y5pyJ5pyq5aSE55CG55qE6K6i5Y2VJyk+LTEpIHtcclxuICAgICAgICAgICAgdGhyb3cgY2hhbGtge3JlZC5ib2xkIOaCqOi/mOacieacquWkhOeQhueahOiuouWNlX1gO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5Lm1lc3NhZ2VzWzBdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb25maXJtUGFzc2VuZ2VySW5pdERjKCk6IFByb21pc2Uge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICAgICxcIlVwZ3JhZGUtSW5zZWN1cmUtUmVxdWVzdHNcIjoxXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZihib2R5KSB7XHJcbiAgICAgICAgICAgIC8vIEdldCBSZXBlYXQgU3VibWl0IFRva2VuXHJcbiAgICAgICAgICAgIHZhciB0b2tlbiA9IGJvZHkubWF0Y2goL3ZhciBnbG9iYWxSZXBlYXRTdWJtaXRUb2tlbiA9ICcoLio/KSc7Lyk7XHJcbiAgICAgICAgICAgIHZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSA9IGJvZHkubWF0Y2goL3ZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybT0oLio/KTsvKTtcclxuICAgICAgICAgICAgdmFyIG9yZGVyUmVxdWVzdERUTyA9IGJvZHkubWF0Y2goL3ZhciBvcmRlclJlcXVlc3REVE89KC4qPyk7Lyk7XHJcbiAgICAgICAgICAgIGlmKHRva2VuKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoe1xyXG4gICAgICAgICAgICAgICAgdG9rZW46IHRva2VuWzFdXHJcbiAgICAgICAgICAgICAgICAsdGlja2V0SW5mbzogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0mJkpTT04ucGFyc2UodGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm1bMV0ucmVwbGFjZSgvJy9nLCBcIlxcXCJcIikpXHJcbiAgICAgICAgICAgICAgICAsb3JkZXJSZXF1ZXN0OiBvcmRlclJlcXVlc3REVE8mJkpTT04ucGFyc2Uob3JkZXJSZXF1ZXN0RFRPWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHRoaXMuU1lTVEVNX0JVU1NZKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJzKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICAvKiBzZWF0IHR5cGVcclxuICDigJjova/ljafigJkgPT4g4oCYNOKAmSxcclxuICDigJjkuoznrYnluqfigJkgPT4g4oCYT+KAmSxcclxuICDigJjkuIDnrYnluqfigJkgPT4g4oCYTeKAmSxcclxuICDigJjnoazluqfigJkgPT4g4oCYMeKAmSxcclxuICAgKi9cclxuICBwcml2YXRlIGdldFBhc3NlbmdlclRpY2tldHMocGFzc2VuZ2Vycyk6IHN0cmluZyB7XHJcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xyXG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcclxuICAgICAgaWYodGhpcy5QTEFOX1BFUE9MRVMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xyXG4gICAgICAgIC8v5bqn5L2N57G75Z6LLDAs56Wo57G75Z6LKOaIkOS6ui/lhL/nq6UpLG5hbWUs6Lqr5Lu957G75Z6LKOi6q+S7veivgS/lhpvlrpjor4EuLi4uKSzouqvku73or4Es55S16K+d5Y+356CBLOS/neWtmOeKtuaAgVxyXG4gICAgICAgIHZhciB0aWNrZXQgPSAvKnBhc3Nlbmdlci5zZWF0X3R5cGUqLyBcIk9cIiArXHJcbiAgICAgICAgICAgICAgICBcIiwwLFwiICtcclxuICAgICAgICAgICAgICAgIC8qbGltaXRfdGlja2V0c1thQV0udGlja2V0X3R5cGUqL1wiMVwiICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgKHBhc3Nlbmdlci5waG9uZV9ubyB8fCBcIlwiICkgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBcIk5cIjtcclxuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2Vycyk6IHN0cmluZyB7XHJcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xyXG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcclxuICAgICAgaWYodGhpcy5QTEFOX1BFUE9MRVMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xyXG4gICAgICAgIC8vbmFtZSzouqvku73nsbvlnoss6Lqr5Lu96K+BLDFfXHJcbiAgICAgICAgdmFyIHRpY2tldCA9XHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBcIjFcIjtcclxuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBwYXNzZW5nZXJzKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvY2hlY2tPcmRlckluZm9cIjtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJjYW5jZWxfZmxhZ1wiOiAyXHJcbiAgICAgICxcImJlZF9sZXZlbF9vcmRlcl9udW1cIjogXCIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBcIlxyXG4gICAgICAsXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMpXHJcbiAgICAgICxcIm9sZFBhc3NlbmdlclN0clwiOiB0aGlzLmdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycylcclxuICAgICAgLFwidG91cl9mbGFnXCI6IFwiZGNcIlxyXG4gICAgICAsXCJyYW5kQ29kZVwiOiBcIlwiXHJcbiAgICAgICxcIndoYXRzU2VsZWN0XCI6MVxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHN1Ym1pdFRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UXVldWVDb3VudCh0b2tlbiwgb3JkZXJSZXF1ZXN0RFRPLCB0aWNrZXRJbmZvKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UXVldWVDb3VudFwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwidHJhaW5fZGF0ZVwiOiBuZXcgRGF0ZShvcmRlclJlcXVlc3REVE8udHJhaW5fZGF0ZS50aW1lKS50b1N0cmluZygpXHJcbiAgICAgICxcInRyYWluX25vXCI6IG9yZGVyUmVxdWVzdERUTy50cmFpbl9ub1xyXG4gICAgICAsXCJzdGF0aW9uVHJhaW5Db2RlXCI6IG9yZGVyUmVxdWVzdERUTy5zdGF0aW9uX3RyYWluX2NvZGVcclxuICAgICAgLFwic2VhdFR5cGVcIjoxXHJcbiAgICAgICxcImZyb21TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLmZyb21fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0XCI6IHRpY2tldEluZm8ucXVlcnlMZWZ0VGlja2V0UmVxdWVzdERUTy55cEluZm9EZXRhaWxcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIjAwXCJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc0NvZGVOZXcoKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2dldFBhc3NDb2RlTmV3P21vZHVsZT1wYXNzZW5nZXImcmFuZD1yYW5kcCZcIitNYXRoLnJhbmRvbSgwLDEpO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUhPT0yMDApIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSkucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShcImNhcHRjaGEuQk1QXCIpKS5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrUmFuZENvZGVBbnN5bigpIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvY2hlY2tSYW5kQ29kZUFuc3luXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgcmFuZENvZGU6IFwiXCIsXHJcbiAgICAgIHJhbmQ6IFwicmFuZHBcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcclxuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgcmwucXVlc3Rpb24oJ1BsZWFzZSBpbnB1dCByYW5kY29kZTonLCAocG9zaXRpb25zKSA9PiB7XHJcbiAgICAgICAgcmwuY2xvc2UoKTtcclxuXHJcbiAgICAgICAgb3B0aW9ucy5mb3JtLnJhbmRDb2RlID0gcG9zaXRpb25zO1xyXG4gICAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgIH0pO1xyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVNpbmdsZUZvclF1ZXVlKHRva2VuLCBwYXNzZW5nZXJzLCB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NvbmZpcm1TaW5nbGVGb3JRdWV1ZVwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMpXHJcbiAgICAgICxcInJhbmRDb2RlXCI6XCJcIlxyXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnB1cnBvc2VfY29kZXNcclxuICAgICAgLFwia2V5X2NoZWNrX2lzQ2hhbmdlXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmtleV9jaGVja19pc0NoYW5nZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0U3RyXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmxlZnRUaWNrZXRTdHJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0udHJhaW5fbG9jYXRpb25cclxuICAgICAgLFwiY2hvb3NlX3NlYXRzXCI6IFwiXCJcclxuICAgICAgLFwic2VhdERldGFpbFR5cGVcIjogXCIwMDBcIlxyXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOiAxXHJcbiAgICAgICxcInJvb21UeXBlXCI6IFwiMDBcIlxyXG4gICAgICAsXCJkd0FsbFwiOiBcIk5cIlxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KVxyXG4gICAgfSlcclxuICB9XHJcblxyXG5cclxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbikge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcInJhbmRvbVwiOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxyXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxyXG4gICAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxRdWV1ZU5vQ29tcGxldGVNeU9yZGVyXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgdG91ckZsYWc6IFwiZGNcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGluaXROb0NvbXBsZXRlKCkge1xyXG4gICAgbGV0IHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9xdWVyeU9yZGVyL2luaXROb0NvbXBsZXRlXCI7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpXHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgcXVlcnlNeU9yZGVyTm9Db21wbGV0ZSgpIHtcclxuICAgIGxldCB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9xdWVyeU15T3JkZXJOb0NvbXBsZXRlXCI7XHJcbiAgICBsZXQgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9pbml0Tm9Db21wbGV0ZVwiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkuZGF0YS5vcmRlckRCTGlzdClcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keS5tZXNzYWdlcyk7XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG59XHJcbiJdfQ==
