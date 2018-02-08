"use strict";
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
        var fileStore = new FileCookieStore_1.FileCookieStore("./cookies/" + this.userName + ".json", { encrypt: false });
        fileStore.option = { encrypt: false };
        this.cookiejar = request.jar(fileStore);
        this.request = request.defaults({ jar: this.cookiejar });
    };
    Account.prototype.createOrder = function (trainDate, backTrainDate, fromStationName, toStationName, planTrains, planPepoles) {
        this.TRAIN_DATE = trainDate;
        this.BACK_TRAIN_DATE = backTrainDate;
        this.FROM_STATION_NAME = fromStationName;
        this.TO_STATION_NAME = toStationName;
        this.PLAN_TRAINS = planTrains;
        this.PLAN_PEPOLES = planPepoles;
        this.FROM_STATION = this.stations.getStationCode(fromStationName);
        this.TO_STATION = this.stations.getStationCode(toStationName);
        return this;
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
                .then(function () { return _this.sjQueryLfTicket.next(); }, function (error) {
                console.error(error);
            });
        });
        // 查询火车余票
        this.sjQueryLfTicket.subscribe(function () {
            _this.queryLeftTicket().then(function (trainsData) {
                //console.log(trainsData);
                var trains = trainsData.result;
                //console.log("查询到火车数量 "+trains.length);
                var planTrain, that = _this;
                trains.forEach(function (train) {
                    train = train.split("|");
                    if (train[30] == "有" || (train[30] > 0 && train[30] != "无" && train[30] != "0")) {
                        console.log(train[3]);
                        if (that.PLAN_TRAINS.includes(train[3])) {
                            planTrain = train;
                        }
                    }
                });
                if (planTrain) {
                    _this.sjSmOReqCheckUser.next(planTrain[0]);
                }
                else {
                    console.log(chalk(templateObject_2 || (templateObject_2 = __makeTemplateObject(["{yellow \u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968\uFF0C\u91CD\u65B0\u67E5\u8BE2}"], ["{yellow \u6CA1\u6709\u53EF\u8D2D\u4E70\u4F59\u7968\uFF0C\u91CD\u65B0\u67E5\u8BE2}"]))));
                    setTimeout(function () {
                        _this.sjQueryLfTicket.next();
                    }, 1500);
                }
            }, function (err) {
                console.error(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{yellow ", "}"], ["{yellow ", "}"])), err));
                setTimeout(function () {
                    _this.sjQueryLfTicket.next();
                }, 1500);
            });
        });
        // Step 10 验证登录，Post
        this.sjSmOReqCheckUser.subscribe(function (train) {
            console.log("submit order request check user");
            _this.checkUser().then(function () { return _this.sjSmOrderReq.next(train); }, function (error) {
                console.error("Check user error " + error);
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
                _this.sjGetPassengers.next(orderRequest);
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
                    console.log(x);
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
                        console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["Your ticket order number is {red.bold ", "}"], ["Your ticket order number is {red.bold ", "}"])), orderQueue.data.orderId));
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
                        console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"], ["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
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
                console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
                _this.sjLogin.next();
            }, function (error) {
                // 校验失败，重新校验
                console.log(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"]))));
                _this.sjCaptcha.next();
            });
        });
        this.sjLogin.subscribe(function () {
            _this.userAuthenticate()
                .then(function () { return _this.sjNewAppToken.next(); }, function (error) { return _this.sjLogin.next(); }) // TODO this.sjCaptcha.next();
                .catch(function (error) { return console.error(error); });
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
                console.log(chalk(templateObject_8 || (templateObject_8 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25\uFF0C", "}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25\uFF0C", "}"])), error));
                // TODO
                setTimeout(function (x) { return _this.sjAppToken.next(newapptk); }, 1000);
            });
        });
        this.sjMyPage.subscribe(function () {
            _this.getMy12306()
                .then(function () {
                console.log(chalk(templateObject_9 || (templateObject_9 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
                _this.sjLfTicketInit.next();
            });
        });
    };
    Account.prototype.submit = function () {
        this.sjLoginInit.next();
    };
    Account.prototype.leftTicketReport = function () {
        var _this = this;
        var subjectLeftTicket = new Rx.Subject();
        subjectLeftTicket.subscribe(function () {
            _this.queryLeftTicket().then(function (trainsData) {
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
                console.error(chalk(templateObject_10 || (templateObject_10 = __makeTemplateObject(["{yellow.bold ", "}"], ["{yellow.bold ", "}"])), error));
                subjectLeftTicket.next();
            })
                .catch(function (error) { return console.error(error); });
        });
        subjectLeftTicket.next();
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
            rl.question(chalk(templateObject_11 || (templateObject_11 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positions) {
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
    Account.prototype.queryLeftTicket = function () {
        var _this = this;
        var query = {
            "leftTicketDTO.train_date": this.TRAIN_DATE,
            "leftTicketDTO.from_station": this.FROM_STATION,
            "leftTicketDTO.to_station": this.TO_STATION,
            "purpose_codes": "ADULT"
        };
        var param = querystring.stringify(query);
        var url = "https://kyfw.12306.cn/otn/leftTicket/queryZ?" + param;
        return new Promise(function (resolve, reject) {
            _this.request(url, function (error, response, body) {
                if (error)
                    throw error;
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
    return Account;
}());
exports.Account = Account;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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Q0FBQyxDQUFDLENBQUM7d0JBQzVCLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO29CQUNuQyxDQUFDO29CQUNELE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3RCLENBQUM7Z0JBQ0QsTUFBTSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNqQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUNILGNBQUM7QUFBRCxDQWxtQ0EsQUFrbUNDLElBQUE7QUFsbUNZLDBCQUFPIiwiZmlsZSI6InNyYy9BY2NvdW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHtGaWxlQ29va2llU3RvcmV9IGZyb20gJy4vRmlsZUNvb2tpZVN0b3JlJztcclxuaW1wb3J0IHtTdGF0aW9ufSBmcm9tICcuL1N0YXRpb24nO1xyXG5pbXBvcnQgcmVxdWVzdCA9IHJlcXVpcmUoJ3JlcXVlc3QnKTtcclxuaW1wb3J0IHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcclxuaW1wb3J0IGZzID0gcmVxdWlyZSgnZnMnKTtcclxuaW1wb3J0IHJlYWRsaW5lID0gcmVxdWlyZSgncmVhZGxpbmUnKTtcclxuaW1wb3J0IHByb2Nlc3MgPSByZXF1aXJlKCdwcm9jZXNzJyk7XHJcbmltcG9ydCBSeCA9IHJlcXVpcmUoJ0ByZWFjdGl2ZXgvcnhqcycpO1xyXG5pbXBvcnQgY2hhbGsgPSByZXF1aXJlKCdjaGFsaycpO1xyXG5pbXBvcnQgY29sdW1uaWZ5ID0gcmVxdWlyZSgnY29sdW1uaWZ5Jyk7XHJcblxyXG5leHBvcnQgY2xhc3MgQWNjb3VudCB7XHJcbiAgcHVibGljIHVzZXJOYW1lIDogc3RyaW5nO1xyXG4gIHB1YmxpYyB1c2VyUGFzc3dvcmQgOiBzdHJpbmc7XHJcbiAgcHVibGljIFRSQUlOX0RBVEU6IHN0cmluZztcclxuICBwdWJsaWMgQkFDS19UUkFJTl9EQVRFOiBzdHJpbmc7XHJcbiAgcHVibGljIFBMQU5fVFJBSU5TOiBBcnJheTxzdHJpbmc+O1xyXG4gIHB1YmxpYyBQTEFOX1BFUE9MRVM6IEFycmF5PHN0cmluZz47XHJcbiAgcHVibGljIEZST01fU1RBVElPTjogc3RyaW5nO1xyXG4gIHB1YmxpYyBUT19TVEFUSU9OOiBzdHJpbmc7XHJcbiAgcHVibGljIEZST01fU1RBVElPTl9OQU1FOiBzdHJpbmc7XHJcbiAgcHVibGljIFRPX1NUQVRJT05fTkFNRTogc3RyaW5nO1xyXG5cclxuICBwcml2YXRlIHN0YXRpb25zOiBTdGF0aW9uID0gbmV3IFN0YXRpb24oKTtcclxuXHJcbiAgcHJpdmF0ZSBTWVNURU1fQlVTU1kgPSBcIlN5c3RlbSBpcyBidXNzeVwiO1xyXG4gIHByaXZhdGUgU1lTVEVNX01PVkVEID0gXCJNb3ZlZCBUZW1wb3JhcmlseVwiO1xyXG5cclxuICBwcml2YXRlIHJlcXVlc3Q6IHJlcXVlc3QuUmVxdWVzdEFQSTxhbnksIGFueSwgYW55PjtcclxuICBwcml2YXRlIGNvb2tpZWphcjogYW55O1xyXG4gIHB1YmxpYyBoZWFkZXJzOiBvYmplY3QgPSB7XHJcbiAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOFwiXHJcbiAgICAsXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgNi4xOyBXT1c2NCkgQXBwbGVXZWJLaXQvNTM3LjE3IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzI0LjAuMTMxMi42MCBTYWZhcmkvNTM3LjE3XCJcclxuICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcclxuICAgICxcIk9yaWdpblwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jblwiXHJcbiAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzcG9ydD9yZWRpcmVjdD0vb3RuL1wiXHJcbiAgfTtcclxuXHJcbiAgY29uc3RydWN0b3IobmFtZTogc3RyaW5nLCB1c2VyUGFzc3dvcmQ6IHN0cmluZykge1xyXG4gICAgdGhpcy51c2VyTmFtZSA9IG5hbWU7XHJcbiAgICB0aGlzLnVzZXJQYXNzd29yZCA9IHVzZXJQYXNzd29yZDtcclxuXHJcbiAgICB0aGlzLnNldFJlcXVlc3QoKTtcclxuICAgIHRoaXMuYnVpbGRMb2dpbkZsb3coKTtcclxuICAgIHRoaXMuYnVpbGRPcmRlckZsb3coKTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqIOajgOafpee9kee7nOW8guW4uFxyXG4gICAqL1xyXG4gIHByaXZhdGUgaXNTeXN0ZW1CdXNzeShib2R5OiBzdHJpbmcpOiBib29sZWFuIHtcclxuICAgIHJldHVybiBib2R5LmluZGV4T2YoXCLnvZHnu5zlj6/og73lrZjlnKjpl67popjvvIzor7fmgqjph43or5XkuIDkuItcIikgPiAwO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHNldFJlcXVlc3QoKSB7XHJcbiAgICB2YXIgZmlsZVN0b3JlID0gbmV3IEZpbGVDb29raWVTdG9yZShcIi4vY29va2llcy9cIit0aGlzLnVzZXJOYW1lK1wiLmpzb25cIiwge2VuY3J5cHQ6IGZhbHNlfSk7XHJcbiAgICBmaWxlU3RvcmUub3B0aW9uID0ge2VuY3J5cHQ6IGZhbHNlfTtcclxuXHJcbiAgICB0aGlzLmNvb2tpZWphciA9IHJlcXVlc3QuamFyKGZpbGVTdG9yZSk7XHJcblxyXG4gICAgdGhpcy5yZXF1ZXN0ID0gcmVxdWVzdC5kZWZhdWx0cyh7amFyOiB0aGlzLmNvb2tpZWphcn0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGNyZWF0ZU9yZGVyKHRyYWluRGF0ZTogc3RyaW5nLCBiYWNrVHJhaW5EYXRlOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgIGZyb21TdGF0aW9uTmFtZTogc3RyaW5nLCB0b1N0YXRpb25OYW1lOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgIHBsYW5UcmFpbnM6IEFycmF5PHN0cmluZz4sIHBsYW5QZXBvbGVzOiBBcnJheTxzdHJpbmc+KTogdGhpcyB7XHJcbiAgICB0aGlzLlRSQUlOX0RBVEUgPSB0cmFpbkRhdGU7XHJcbiAgICB0aGlzLkJBQ0tfVFJBSU5fREFURSA9IGJhY2tUcmFpbkRhdGU7XHJcbiAgICB0aGlzLkZST01fU1RBVElPTl9OQU1FID0gZnJvbVN0YXRpb25OYW1lO1xyXG4gICAgdGhpcy5UT19TVEFUSU9OX05BTUUgPSB0b1N0YXRpb25OYW1lO1xyXG4gICAgdGhpcy5QTEFOX1RSQUlOUyA9IHBsYW5UcmFpbnM7XHJcbiAgICB0aGlzLlBMQU5fUEVQT0xFUyA9IHBsYW5QZXBvbGVzO1xyXG4gICAgdGhpcy5GUk9NX1NUQVRJT04gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKGZyb21TdGF0aW9uTmFtZSk7XHJcbiAgICB0aGlzLlRPX1NUQVRJT04gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25Db2RlKHRvU3RhdGlvbk5hbWUpO1xyXG4gICAgcmV0dXJuIHRoaXM7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY2FuY2VsT3JkZXJRdWV1ZSgpIHtcclxuICAgIHRoaXMuY2FuY2VsUXVldWVOb0NvbXBsZXRlT3JkZXIoKVxyXG4gICAgICAudGhlbih4PT4ge1xyXG4gICAgICAgIGlmKHguc3RhdHVzICYmIHguZGF0YS5leGlzdEVycm9yID09ICdOJykge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg5o6S6Zif6K6i5Y2V5bey5Y+W5raIfWApO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoeCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9LCBlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICB9XHJcblxyXG4gIC8vIExvZ2luIGluaXRcclxuICBwcml2YXRlIHNqTG9naW5Jbml0ICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIC8vIENoZWNrIENhcHRjaGFcclxuICBwcml2YXRlIHNqQ2FwdGNoYSAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIC8vIExvZ2luXHJcbiAgcHJpdmF0ZSBzakxvZ2luICAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAvLyBHZXQgbmV3IGFwcCB0b2tlblxyXG4gIHByaXZhdGUgc2pOZXdBcHBUb2tlbiA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgLy8gR2V0IGFwcCB0b2tlblxyXG4gIHByaXZhdGUgc2pBcHBUb2tlbiAgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICAvLyBHZXQgbXkgbWFpbiBwYWdlXHJcbiAgcHJpdmF0ZSBzak15UGFnZSAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuXHJcbiAgcHJpdmF0ZSBzakxmVGlja2V0SW5pdCAgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqUXVlcnlMZlRpY2tldCAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pTbU9SZXFDaGVja1VzZXIgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHNqU21PcmRlclJlcSAgICAgICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBzakNQYXNJbml0RGMgICAgICAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgc2pHZXRQYXNzZW5nZXJzICAgICA9IG5ldyBSeC5TdWJqZWN0PG9iamVjdD4oKTtcclxuICBwcml2YXRlIHNqQ2hlY2tPcmRlckluZm8gICAgPSBuZXcgUnguU3ViamVjdDxvYmplY3Q+KCk7XHJcbiAgcHJpdmF0ZSBzakdldFF1ZXVlQ291bnQgICAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqR2V0UGFzc0NvZGVOZXcgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pDb25maXJtU2luZ2xlNFEgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzalF1ZXJ5T3JkZXJXYWl0VCAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuXHJcbiAgcHJpdmF0ZSBidWlsZE9yZGVyRmxvdygpIHtcclxuICAgIC8vIOWIneWni+WMluafpeivoueBq+i9puS9meelqOmhtemdolxyXG4gICAgdGhpcy5zakxmVGlja2V0SW5pdC5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMubGVmdFRpY2tldEluaXQoKVxyXG4gICAgICAgIC50aGVuKCgpPT50aGlzLnNqUXVlcnlMZlRpY2tldC5uZXh0KCksIChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8g5p+l6K+i54Gr6L2m5L2Z56WoXHJcbiAgICB0aGlzLnNqUXVlcnlMZlRpY2tldC5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0KCkudGhlbih0cmFpbnNEYXRhID0+IHtcclxuICAgICAgICAvL2NvbnNvbGUubG9nKHRyYWluc0RhdGEpO1xyXG4gICAgICAgIHZhciB0cmFpbnMgPSB0cmFpbnNEYXRhLnJlc3VsdDtcclxuXHJcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIuafpeivouWIsOeBq+i9puaVsOmHjyBcIit0cmFpbnMubGVuZ3RoKTtcclxuICAgICAgICB2YXIgcGxhblRyYWluLCB0aGF0ID0gdGhpcztcclxuICAgICAgICB0cmFpbnMuZm9yRWFjaChmdW5jdGlvbih0cmFpbikge1xyXG4gICAgICAgICAgdHJhaW4gPSB0cmFpbi5zcGxpdChcInxcIik7XHJcblxyXG4gICAgICAgICAgaWYodHJhaW5bMzBdID09IFwi5pyJXCIgfHwgKHRyYWluWzMwXSA+IDAgJiYgdHJhaW5bMzBdICE9IFwi5pegXCIgJiYgdHJhaW5bMzBdICE9IFwiMFwiKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyh0cmFpblszXSk7XHJcbiAgICAgICAgICAgIGlmKHRoYXQuUExBTl9UUkFJTlMuaW5jbHVkZXModHJhaW5bM10pKSB7XHJcbiAgICAgICAgICAgICAgcGxhblRyYWluID0gdHJhaW47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYocGxhblRyYWluKSB7XHJcbiAgICAgICAgICB0aGlzLnNqU21PUmVxQ2hlY2tVc2VyLm5leHQocGxhblRyYWluWzBdKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93IOayoeacieWPr+i0reS5sOS9meelqO+8jOmHjeaWsOafpeivon1gKTtcclxuICAgICAgICAgIHNldFRpbWVvdXQoKCk9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuc2pRdWVyeUxmVGlja2V0Lm5leHQoKTtcclxuICAgICAgICAgIH0sIDE1MDApO1xyXG4gICAgICAgIH1cclxuICAgICAgfSwgZXJyID0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGNoYWxrYHt5ZWxsb3cgJHtlcnJ9fWApO1xyXG4gICAgICAgIHNldFRpbWVvdXQoKCk9PiB7XHJcbiAgICAgICAgICB0aGlzLnNqUXVlcnlMZlRpY2tldC5uZXh0KCk7XHJcbiAgICAgICAgfSwgMTUwMCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxMCDpqozor4HnmbvlvZXvvIxQb3N0XHJcbiAgICB0aGlzLnNqU21PUmVxQ2hlY2tVc2VyLnN1YnNjcmliZSgodHJhaW46IHN0cmluZyk9PiB7XHJcbiAgICAgIGNvbnNvbGUubG9nKFwic3VibWl0IG9yZGVyIHJlcXVlc3QgY2hlY2sgdXNlclwiKTtcclxuICAgICAgdGhpcy5jaGVja1VzZXIoKS50aGVuKCgpPT50aGlzLnNqU21PcmRlclJlcS5uZXh0KHRyYWluKSwgZXJyb3IgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJDaGVjayB1c2VyIGVycm9yIFwiICsgZXJyb3IpO1xyXG4gICAgICAgIHRoaXMuc2pTbU9SZXFDaGVja1VzZXIubmV4dCh0cmFpbik7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxMSDpooTmj5DkuqTorqLljZXvvIxQb3N0XHJcbiAgICB0aGlzLnNqU21PcmRlclJlcS5zdWJzY3JpYmUoKHRyYWluOiBzdHJpbmcpPT4ge1xyXG4gICAgICBjb25zb2xlLmxvZyhcInN1Ym1pdCBvcmRlciByZXF1ZXN0XCIpO1xyXG4gICAgICB0aGlzLnN1Ym1pdE9yZGVyUmVxdWVzdCh0cmFpbikudGhlbigoeCk9PiB7XHJcbiAgICAgICAgY29uc29sZS5sb2coXCJTdWJtaXQgT3JkZXIgUmVxdWVzdCBzdWNjZXNzIVwiKVxyXG4gICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQoKTtcclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgY29uc29sZS5lcnJvcihcIlN1Ym1pdE9yZGVyUmVxdWVzdCBlcnJvciBcIiArIGVycm9yKTtcclxuICAgICAgICB0aGlzLnNqU21PcmRlclJlcS5uZXh0KHRyYWluKTtcclxuICAgICAgfSlcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgMTIg5qih5ouf6Lez6L2s6aG16Z2iSW5pdERj77yMUG9zdFxyXG4gICAgdGhpcy5zakNQYXNJbml0RGMuc3Vic2NyaWJlKCh0cmFpbjogc3RyaW5nKT0+IHtcclxuICAgICAgdGhpcy5jb25maXJtUGFzc2VuZ2VySW5pdERjKCkudGhlbigob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiY29uZmlybVBhc3NlbmdlciBJbml0IERjIHN1Y2Nlc3MhIFwiK29yZGVyUmVxdWVzdC50b2tlbik7XHJcbiAgICAgICAgLy8gY29uc29sZS5sb2cob3JkZXJSZXF1ZXN0LnRpY2tldEluZm8pO1xyXG4gICAgICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IgPT0gdGhpcy5TWVNURU1fQlVTU1kpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQoKTtcclxuICAgICAgICB9ZWxzZSBpZihlcnJvciA9PSB0aGlzLlNZU1RFTV9NT1ZFRCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNQYXNJbml0RGMubmV4dCgpO1xyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSkuY2F0Y2goZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDEzIOW4uOeUqOiBlOezu+S6uuehruWumu+8jFBvc3RcclxuICAgIHRoaXMuc2pHZXRQYXNzZW5nZXJzLnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICB0aGlzLmdldFBhc3NlbmdlcnMob3JkZXJSZXF1ZXN0LnRva2VuKS50aGVuKHBhc3NlbmdlcnM9PiB7XHJcbiAgICAgICAgb3JkZXJSZXF1ZXN0LnBhc3NlbmdlcnMgPSBwYXNzZW5nZXJzO1xyXG4gICAgICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IgKyBcIiBSZXRyeSBnZXQgcGFzc2VuZ2Vyc1wiKTtcclxuICAgICAgICB0aGlzLnNqR2V0UGFzc2VuZ2Vycy5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5jYXRjaChlcnJvcj0+IGNvbnNvbGUuZXJyb3IoZXJyb3IpKTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgMTQg6LSt56Wo5Lq656Gu5a6a77yMUG9zdFxyXG4gICAgdGhpcy5zakNoZWNrT3JkZXJJbmZvLnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICB0aGlzLmNoZWNrT3JkZXJJbmZvKG9yZGVyUmVxdWVzdC50b2tlbiwgb3JkZXJSZXF1ZXN0LnBhc3NlbmdlcnMuZGF0YS5ub3JtYWxfcGFzc2VuZ2VycylcclxuICAgICAgICAudGhlbihvcmRlckluZm89PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlckluZm8pO1xyXG4gICAgICAgICAgLy8gU3RlcCAxNSDlh4blpIfov5vlhaXmjpLpmJ/vvIxQb3N0XHJcbiAgICAgICAgICB0aGlzLmdldFF1ZXVlQ291bnQob3JkZXJSZXF1ZXN0LnRva2VuLCBvcmRlclJlcXVlc3Qub3JkZXJSZXF1ZXN0LCBvcmRlclJlcXVlc3QudGlja2V0SW5mbylcclxuICAgICAgICAgICAgLnRoZW4oeD0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyh4KTtcclxuICAgICAgICAgICAgICAvLyDoi6UgU3RlcCAxNCDkuK3nmoQgXCJpZlNob3dQYXNzQ29kZVwiID0gXCJZXCLvvIzpgqPkuYjlpJrkuobovpPlhaXpqozor4HnoIHov5nkuIDmraXvvIxQb3N0XHJcbiAgICAgICAgICAgICAgaWYob3JkZXJJbmZvLmRhdGEuaWZTaG93UGFzc0NvZGUgPT0gXCJZXCIpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2pHZXRQYXNzQ29kZU5ldy5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgICAgLy8gU3RlcCAxNyDnoa7orqTotK3kubDvvIxQb3N0XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgfSk7XHJcbiAgICAgICAgfSwgZXJyb3I9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zakdldFBhc3NDb2RlTmV3LnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICAvLyBTdGVwIDE2IOS5mOWuouS5sOelqOmqjOivgeegge+8jEdldCBQT1NUXHJcbiAgICAgIHRoaXMuZ2V0UGFzc0NvZGVOZXcoKS50aGVuKCgpPT4gdGhpcy5jaGVja1JhbmRDb2RlQW5zeW4oKSlcclxuICAgICAgICAudGhlbih4PT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coeCk7XHJcbiAgICAgICAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICB9LGVycm9yPT5jb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICB0aGlzLmNvbmZpcm1TaW5nbGVGb3JRdWV1ZShvcmRlclJlcXVlc3QudG9rZW4sIG9yZGVyUmVxdWVzdC5wYXNzZW5nZXJzLmRhdGEubm9ybWFsX3Bhc3NlbmdlcnMsIG9yZGVyUmVxdWVzdC50aWNrZXRJbmZvKVxyXG4gICAgICAgIC50aGVuKHg9PntcclxuICAgICAgICAgIGlmKHguc3RhdHVzICYmIHguZGF0YS5zdWJtaXRTdGF0dXMpIHtcclxuICAgICAgICAgICAgLy8gU3RlcCAxOCDmn6Xor6LmjpLpmJ/nrYnlvoXml7bpl7TvvIFcclxuICAgICAgICAgICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHgpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICB0aGlzLnNqQ29uZmlybVNpbmdsZTRRLm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULnN1YnNjcmliZSgob3JkZXJSZXF1ZXN0OiBvYmplY3QpPT4ge1xyXG4gICAgICB0aGlzLnF1ZXJ5T3JkZXJXYWl0VGltZShvcmRlclJlcXVlc3QudG9rZW4pXHJcbiAgICAgICAgLnRoZW4ob3JkZXJRdWV1ZT0+IHtcclxuICAgICAgICAgIGlmKG9yZGVyUXVldWUuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gMCB8fCBvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coY2hhbGtgWW91ciB0aWNrZXQgb3JkZXIgbnVtYmVyIGlzIHtyZWQuYm9sZCAke29yZGVyUXVldWUuZGF0YS5vcmRlcklkfX1gKTtcclxuICAgICAgICAgICAgfWVsc2UgaWYob3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMil7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2cob3JkZXJRdWV1ZSk7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTMpe1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiWW91ciB0aWNrZXQgcmVxdWVzdCBoYXMgYmVlbiBjYW5jZWxlZCFcIik7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTQpe1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKFwiWW91ciB0aWNrZXQgcmVxdWVzdCBpcyBiZWluZyBwcm9jZXNzZWQsIHBsZWFzZSB3YWl0IGEgbW9tZW50IVwiKTtcclxuICAgICAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgICAgICB9LCA0MDAwKTtcclxuICAgICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDmjpLpmJ/kurrmlbDvvJoke29yZGVyUXVldWUuZGF0YS53YWl0Q291bnR9fSDpooTorqHnrYnlvoXml7bpl7TvvJoke3BhcnNlSW50KG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSAvIDEuNSl9IOWIhumSn2ApO1xyXG4gICAgICAgICAgICAgIHNldFRpbWVvdXQoeD0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgICAgIH0sIDQwMDApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKG9yZGVyUXVldWUpO1xyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB7XHJcbiAgICAgICAgICAgICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgIH0sIDQwMDApO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGsuYmdCbHVlKGVycm9yK1wiIFJlQ2hlY2sgT3JkZXIgd2FpdGluZyB0aW1lXCIpKTtcclxuICAgICAgICAgIHNldFRpbWVvdXQoeD0+IHtcclxuICAgICAgICAgICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICB9LCA0MDAwKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBidWlsZExvZ2luRmxvdygpOiB2b2lkIHtcclxuICAgIHRoaXMuc2pMb2dpbkluaXQuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmxvZ2luSW5pdCgpXHJcbiAgICAgICAgLnRoZW4oKCk9PntcclxuICAgICAgICAgIHZhciB0b2tlbnMgPSB0aGlzLmNoZWNrQXV0aGVudGljYXRpb24odGhpcy5jb29raWVqYXIuX2phci50b0pTT04oKS5jb29raWVzKTtcclxuICAgICAgICAgIGlmKHRva2Vucy50aykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zakFwcFRva2VuLm5leHQodG9rZW5zLnRrKTtcclxuICAgICAgICAgIH1lbHNlIGlmKHRva2Vucy51YW10aykge1xyXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5zak5ld0FwcFRva2VuLm5leHQoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9KVxyXG4gICAgICAgIC5jYXRjaCgoZXJyb3I6IGFueSk9PiB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pDYXB0Y2hhLnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5nZXRDYXB0Y2hhKCkudGhlbigoKT0+IHRoaXMuY2hlY2tDYXB0Y2hhKCkpXHJcbiAgICAgICAgLnRoZW4oKCk9PiB7XHJcbiAgICAgICAgICAvLyDmoKHpqoznoIHmiJDlip/lkI7ov5vooYzmjojmnYPorqTor4FcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHtncmVlbi5ib2xkIOmqjOivgeeggeagoemqjOaIkOWKn31gKTtcclxuICAgICAgICAgIHRoaXMuc2pMb2dpbi5uZXh0KCk7XHJcbiAgICAgICAgfSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgICAgLy8g5qCh6aqM5aSx6LSl77yM6YeN5paw5qCh6aqMXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg5qCh6aqM5aSx6LSl77yM6YeN5paw5qCh6aqMfWApO1xyXG4gICAgICAgICAgdGhpcy5zakNhcHRjaGEubmV4dCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zakxvZ2luLnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy51c2VyQXV0aGVudGljYXRlKClcclxuICAgICAgICAudGhlbigoKT0+dGhpcy5zak5ld0FwcFRva2VuLm5leHQoKSwgKGVycm9yOiBhbnkpPT50aGlzLnNqTG9naW4ubmV4dCgpKSAvLyBUT0RPIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpPT5jb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqTmV3QXBwVG9rZW4uc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmdldE5ld0FwcFRva2VuKClcclxuICAgICAgICAudGhlbigobmV3YXBwdGs6IHN0cmluZyk9PiB0aGlzLnNqQXBwVG9rZW4ubmV4dChuZXdhcHB0ayksIChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pBcHBUb2tlbi5zdWJzY3JpYmUoKG5ld2FwcHRrOiBzdHJpbmcpPT4ge1xyXG4gICAgICB0aGlzLmdldEFwcFRva2VuKG5ld2FwcHRrKS50aGVuKCh4OiBzdHJpbmcpID0+IHtcclxuICAgICAgICB0aGlzLnNqTXlQYWdlLm5leHQoKTtcclxuICAgICAgfSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYHt5ZWxsb3cuYm9sZCDojrflj5ZUb2tlbuWksei0pe+8jCR7ZXJyb3J9fWApO1xyXG4gICAgICAgIC8vIFRPRE9cclxuICAgICAgICBzZXRUaW1lb3V0KHg9PiB0aGlzLnNqQXBwVG9rZW4ubmV4dChuZXdhcHB0ayksIDEwMDApO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pNeVBhZ2Uuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmdldE15MTIzMDYoKVxyXG4gICAgICAgIC50aGVuKCgpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg55m75b2V5oiQ5YqffWApO1xyXG4gICAgICAgICAgdGhpcy5zakxmVGlja2V0SW5pdC5uZXh0KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdWJtaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLnNqTG9naW5Jbml0Lm5leHQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBsZWZ0VGlja2V0UmVwb3J0KCkge1xyXG4gICAgdmFyIHN1YmplY3RMZWZ0VGlja2V0ID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuXHJcbiAgICBzdWJqZWN0TGVmdFRpY2tldC5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMucXVlcnlMZWZ0VGlja2V0KCkudGhlbih0cmFpbnNEYXRhID0+IHtcclxuICAgICAgICBsZXQgdHJhaW5zOiBBcnJheTxBcnJheTxzdHJpbmc+PiA9IFtdO1xyXG4gICAgICAgIHZhciB0aXRsZSA9IFsn6L2m5qyhJywgJ+WHuuWPkScsICfliLDovr4nLCAn5Ye65Y+RJywgJ+WIsOi+vicsICfljobml7YnLCAn5Y+v5LmwJywgJ+mrmOe6p+i9r+WNpycsICcnLCAn6L2v5Y2nJywgJ+i9r+W6pycsICfnibnnrYnluqcnLCAn5peg5bqnJywgJycsICfnoazljacnLCAn56Gs5bqnJywgJ+S6jOetieW6pycsICfkuIDnrYnluqcnLCAn5ZWG5Yqh5bqnJ107XHJcbiAgICAgICAgdHJhaW5zLnB1c2godGl0bGUpO1xyXG4gICAgICAgIHRyYWluc0RhdGEucmVzdWx0LmZvckVhY2goKGVsZW1lbnQ6IHN0cmluZyk9PiB7XHJcbiAgICAgICAgICBsZXQgdHJhaW46IEFycmF5PHN0cmluZz4gPSBlbGVtZW50LnNwbGl0KFwifFwiKTtcclxuICAgICAgICAgIHRyYWluLnNwbGljZSgwLCAzKTtcclxuICAgICAgICAgIHRyYWluLnNwbGljZSgxLCAyKTtcclxuICAgICAgICAgIHRyYWluLnNwbGljZSg3LCA5KTtcclxuICAgICAgICAgIHRyYWluLnNwbGljZSgxOSwgNCk7XHJcbiAgICAgICAgICB0cmFpblsxXSA9IHRoaXMuc3RhdGlvbnMuZ2V0U3RhdGlvbk5hbWUodHJhaW5bMV0pO1xyXG4gICAgICAgICAgdHJhaW5bMl0gPSB0aGlzLnN0YXRpb25zLmdldFN0YXRpb25OYW1lKHRyYWluWzJdKTtcclxuICAgICAgICAgIHRyYWlucy5wdXNoKHRyYWluKTtcclxuICAgICAgICAgIGlmKHRyYWlucy5sZW5ndGggJSAzMCA9PT0gMCkge1xyXG4gICAgICAgICAgICB0cmFpbnMucHVzaCh0aXRsZSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHZhciBjb2x1bW5zID0gY29sdW1uaWZ5KHRyYWlucywge1xyXG4gICAgICAgICAgY29sdW1uU3BsaXR0ZXI6ICcgfCAnXHJcbiAgICAgICAgfSlcclxuXHJcbiAgICAgICAgY29uc29sZS5sb2coY29sdW1ucyk7XHJcbiAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoY2hhbGtge3llbGxvdy5ib2xkICR7ZXJyb3J9fWApO1xyXG4gICAgICAgIHN1YmplY3RMZWZ0VGlja2V0Lm5leHQoKTtcclxuICAgICAgfSlcclxuICAgICAgLmNhdGNoKGVycm9yPT5jb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICBzdWJqZWN0TGVmdFRpY2tldC5uZXh0KCk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgbG9naW5Jbml0KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sb2dpbi9pbml0XCI7XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmwsXHJcbiAgICAgIG1ldGhvZDogXCJHRVRcIixcclxuICAgICAgaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZTogb2JqZWN0LCByZWplY3Q6IG9iamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KSA9PiB7XHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldENhcHRjaGEoKTogUHJvbWlzZSB7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXHJcbiAgICAgICAgICBcIm1vZHVsZVwiOiBcImxvZ2luXCIsXHJcbiAgICAgICAgICBcInJhbmRcIjogXCJzanJhbmRcIixcclxuICAgICAgICAgIFwiMC4xNzIzMTg3MjcwMzM4OTA2MlwiOlwiXCJcclxuICAgICAgfTtcclxuXHJcbiAgICB2YXIgcGFyYW0gPSBxdWVyeXN0cmluZy5zdHJpbmdpZnkoZGF0YSwgbnVsbCwgbnVsbClcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC9jYXB0Y2hhL2NhcHRjaGEtaW1hZ2U/XCIrcGFyYW07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSkgPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIHJlamVjdChlcnJvcik7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KS5waXBlKGZzLmNyZWF0ZVdyaXRlU3RyZWFtKFwiY2FwdGNoYS5CTVBcIikpLm9uKCdjbG9zZScsIGZ1bmN0aW9uKCl7XHJcbiAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2hlY2tDYXB0Y2hhKCk6IFByb21pc2Uge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L2NhcHRjaGEvY2FwdGNoYS1jaGVja1wiO1xyXG5cclxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcclxuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIHJsLnF1ZXN0aW9uKGNoYWxrYHtyZWQuYm9sZCDor7fovpPlhaXpqozor4HnoIF9OmAsIChwb3NpdGlvbnMpID0+IHtcclxuICAgICAgICBybC5jbG9zZSgpO1xyXG5cclxuICAgICAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgICAgXCJhbnN3ZXJcIjogcG9zaXRpb25zLFxyXG4gICAgICAgICAgICBcImxvZ2luX3NpdGVcIjogXCJFXCIsXHJcbiAgICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiXHJcbiAgICAgICAgICB9O1xyXG5cclxuICAgICAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgICAgIHVybDogdXJsXHJcbiAgICAgICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgICAgICxmb3JtOiBkYXRhXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcclxuICAgICAgICAgIGlmKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSA0KSB7XHJcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlamVjdCgpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnZXJyb3I6ICcrIHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhyZXNwb25zZS50ZXh0KTtcclxuICAgICAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHVzZXJBdXRoZW50aWNhdGUoKTogUHJvbWlzZSB7XHJcbiAgICAvLyDlj5HpgIHnmbvlvZXkv6Hmga9cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXHJcbiAgICAgICAgICAsXCJ1c2VybmFtZVwiOiB0aGlzLnVzZXJOYW1lXHJcbiAgICAgICAgICAsXCJwYXNzd29yZFwiOiB0aGlzLnVzZXJQYXNzd29yZFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9sb2dpblwiO1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgcmV0dXJuIHJlamVjdChlcnJvcik7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xyXG4gICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAyKSB7XHJcbiAgICAgICAgICAgIHRocm93IGJvZHkucmVzdWx0X21lc3NhZ2U7XHJcbiAgICAgICAgICB9ZWxzZSBpZihib2R5LnJlc3VsdF9jb2RlICE9IDApIHtcclxuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZXNvbHZlKGJvZHkudWFtdGspO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZSk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXROZXdBcHBUb2tlbigpOiBQcm9taXNlIHtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgXCJhcHBpZFwiOiBcIm90blwiXHJcbiAgICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPXtcclxuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9wYXNzcG9ydC93ZWIvYXV0aC91YW10a1wiXHJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAvLyBjb25zb2xlLmxvZyhib2R5KTtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYm9keS5yZXN1bHRfbWVzc2FnZSk7XHJcbiAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDApIHtcclxuICAgICAgICAgICAgcmVzb2x2ZShib2R5Lm5ld2FwcHRrKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZSlcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE15MTIzMDYoKTogUHJvbWlzZSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vaW5kZXgvaW5pdE15MTIzMDZcIlxyXG4gICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAgLG1ldGhvZDogXCJHRVRcIn0sXHJcbiAgICAgICAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKFwiR290IG15IDEyMzA2XCIpO1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrQXV0aGVudGljYXRpb24oY29va2llczogb2JqZWN0KSB7XHJcbiAgICB2YXIgdWFtdGsgPSBcIlwiLCB0ayA9IFwiXCI7XHJcbiAgICBmb3IodmFyIGkgPSAwOyBpIDwgY29va2llcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICBpZihjb29raWVzW2ldLmtleSA9PSBcInVhbXRrXCIpIHtcclxuICAgICAgICB1YW10ayA9IGNvb2tpZXNbaV0udmFsdWU7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidGtcIikge1xyXG4gICAgICAgIHRrID0gY29va2llc1tpXS52YWx1ZTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIHtcclxuICAgICAgdWFtdGs6IHVhbXRrLFxyXG4gICAgICB0azogdGtcclxuICAgIH07XHJcbiAgfVxyXG5cclxuICAvKipcclxuICAgKlxyXG4gICAqL1xyXG4gIHByaXZhdGUgZ2V0QXBwVG9rZW4obmV3YXBwdGs6IHN0cmluZykge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcInRrXCI6IG5ld2FwcHRrXHJcbiAgICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vdWFtYXV0aGNsaWVudFwiXHJcbiAgICAgICxoZWFkZXJzOiB7XHJcbiAgICAgICAgXCJVc2VyLUFnZW50XCI6IFwiTW96aWxsYS81LjAgKFdpbmRvd3MgTlQgNi4xOyBXT1c2NCkgQXBwbGVXZWJLaXQvNTM3LjE3IChLSFRNTCwgbGlrZSBHZWNrbykgQ2hyb21lLzI0LjAuMTMxMi42MCBTYWZhcmkvNTM3LjE3XCJcclxuICAgICAgICAsXCJIb3N0XCI6IFwia3lmdy4xMjMwNi5jblwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc3BvcnQ/cmVkaXJlY3Q9L290bi9cIlxyXG4gICAgICAgICwnY29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcclxuICAgICAgfVxyXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xyXG4gICAgICAgICAgICByZXNvbHZlKGJvZHkuYXBwdGspO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZWplY3QoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpXHJcbiAgICAgICAgfVxyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBsZWZ0VGlja2V0SW5pdCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCI7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3QodXJsLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgcmV0dXJuIHJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c1RleHQpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBxdWVyeUxlZnRUaWNrZXQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgcXVlcnkgPSB7XHJcbiAgICAgIFwibGVmdFRpY2tldERUTy50cmFpbl9kYXRlXCI6IHRoaXMuVFJBSU5fREFURVxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLmZyb21fc3RhdGlvblwiOiB0aGlzLkZST01fU1RBVElPTlxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLnRvX3N0YXRpb25cIjogdGhpcy5UT19TVEFUSU9OXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvcXVlcnlaP1wiK3BhcmFtO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KHVybCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoIWJvZHkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKGJvZHkuaW5kZXhPZihcIuivt+aCqOmHjeivleS4gOS4i1wiKSA+IDApIHtcclxuICAgICAgICAgICAgcmVqZWN0KFwi57O757uf57mB5b+ZIVwiKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoYm9keSkuZGF0YTtcclxuICAgICAgICAgICAgfWNhdGNoKGVycikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgY29uc29sZS5sb2cocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrVXNlcigpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vY2hlY2tVc2VyXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXHJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSlcclxuICAgICAgICAgIGlmKGJvZHkuZGF0YS5mbGFnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN1Ym1pdE9yZGVyUmVxdWVzdChzZWNyZXRTdHI6IHN0cmluZyk6IFByb21pc2U8b2JqZWN0PiAge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L3N1Ym1pdE9yZGVyUmVxdWVzdFwiO1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcInNlY3JldFN0clwiOiBxdWVyeXN0cmluZy51bmVzY2FwZShzZWNyZXRTdHIpXHJcbiAgICAgICxcInRyYWluX2RhdGVcIjogdGhpcy5UUkFJTl9EQVRFXHJcbiAgICAgICxcImJhY2tfdHJhaW5fZGF0ZVwiOiB0aGlzLkJBQ0tfVFJBSU5fREFURVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICAgICxcInF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lXCI6IHRoaXMuRlJPTV9TVEFUSU9OX05BTUVcclxuICAgICAgLFwicXVlcnlfdG9fc3RhdGlvbl9uYW1lXCI6IHRoaXMuVE9fU1RBVElPTl9OQU1FXHJcbiAgICAgICxcInVuZGVmaW5lZFwiOlwiXCJcclxuICAgIH07XHJcblxyXG4gICAgLy8gdXJsID0gdXJsICsgXCJzZWNyZXRTdHI9XCIrc2VjcmV0U3RyK1wiJnRyYWluX2RhdGU9MjAxOC0wMS0zMSZiYWNrX3RyYWluX2RhdGU9MjAxOC0wMS0zMCZ0b3VyX2ZsYWc9ZGMmcHVycG9zZV9jb2Rlcz1BRFVMVCZxdWVyeV9mcm9tX3N0YXRpb25fbmFtZT3kuIrmtbcmcXVlcnlfdG9fc3RhdGlvbl9uYW1lPeW+kOW3nuS4nCZ1bmRlZmluZWRcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJJZi1Nb2RpZmllZC1TaW5jZVwiOiBcIjBcIlxyXG4gICAgICAgICxcIkNhY2hlLUNvbnRyb2xcIjogXCJuby1jYWNoZVwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICBpZihib2R5LnN0YXR1cykge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keS5tZXNzYWdlc1swXSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVBhc3NlbmdlckluaXREYygpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICB9O1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIkNvbnRlbnQtVHlwZVwiOiBcImFwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZFwiXHJcbiAgICAgICAgLFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbGVmdFRpY2tldC9pbml0XCJcclxuICAgICAgICAsXCJVcGdyYWRlLUluc2VjdXJlLVJlcXVlc3RzXCI6MVxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYoYm9keSkge1xyXG4gICAgICAgICAgICAvLyBHZXQgUmVwZWF0IFN1Ym1pdCBUb2tlblxyXG4gICAgICAgICAgICB2YXIgdG9rZW4gPSBib2R5Lm1hdGNoKC92YXIgZ2xvYmFsUmVwZWF0U3VibWl0VG9rZW4gPSAnKC4qPyknOy8pO1xyXG4gICAgICAgICAgICB2YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0gPSBib2R5Lm1hdGNoKC92YXIgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm09KC4qPyk7Lyk7XHJcbiAgICAgICAgICAgIHZhciBvcmRlclJlcXVlc3REVE8gPSBib2R5Lm1hdGNoKC92YXIgb3JkZXJSZXF1ZXN0RFRPPSguKj8pOy8pO1xyXG4gICAgICAgICAgICBpZih0b2tlbikge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKHtcclxuICAgICAgICAgICAgICAgIHRva2VuOiB0b2tlblsxXVxyXG4gICAgICAgICAgICAgICAgLHRpY2tldEluZm86IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtJiZKU09OLnBhcnNlKHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxyXG4gICAgICAgICAgICAgICAgLG9yZGVyUmVxdWVzdDogb3JkZXJSZXF1ZXN0RFRPJiZKU09OLnBhcnNlKG9yZGVyUmVxdWVzdERUT1sxXS5yZXBsYWNlKC8nL2csIFwiXFxcIlwiKSlcclxuICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc2VuZ2Vycyh0b2tlbjogc3RyaW5nKTogUHJvbWlzZSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UGFzc2VuZ2VyRFRPc1wiO1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoSlNPTi5wYXJzZShib2R5KSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgLyogc2VhdCB0eXBlXHJcbiAg4oCY6L2v5Y2n4oCZID0+IOKAmDTigJksXHJcbiAg4oCY5LqM562J5bqn4oCZID0+IOKAmE/igJksXHJcbiAg4oCY5LiA562J5bqn4oCZID0+IOKAmE3igJksXHJcbiAg4oCY56Gs5bqn4oCZID0+IOKAmDHigJksXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMpOiBzdHJpbmcge1xyXG4gICAgdmFyIHRpY2tldHMgPSBbXTtcclxuICAgIHBhc3NlbmdlcnMuZm9yRWFjaChwYXNzZW5nZXI9PiB7XHJcbiAgICAgIGlmKHRoaXMuUExBTl9QRVBPTEVTLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcclxuICAgICAgICAvL+W6p+S9jeexu+WeiywwLOelqOexu+WeiyjmiJDkurov5YS/56ulKSxuYW1lLOi6q+S7veexu+Weiyjouqvku73or4Ev5Yab5a6Y6K+BLi4uLiks6Lqr5Lu96K+BLOeUteivneWPt+eggSzkv53lrZjnirbmgIFcclxuICAgICAgICB2YXIgdGlja2V0ID0gLypwYXNzZW5nZXIuc2VhdF90eXBlKi8gXCJPXCIgK1xyXG4gICAgICAgICAgICAgICAgXCIsMCxcIiArXHJcbiAgICAgICAgICAgICAgICAvKmxpbWl0X3RpY2tldHNbYUFdLnRpY2tldF90eXBlKi9cIjFcIiArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfdHlwZV9jb2RlICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF9ubyArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIChwYXNzZW5nZXIucGhvbmVfbm8gfHwgXCJcIiApICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgXCJOXCI7XHJcbiAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aWNrZXRzLmpvaW4oXCJfXCIpO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMpOiBzdHJpbmcge1xyXG4gICAgdmFyIHRpY2tldHMgPSBbXTtcclxuICAgIHBhc3NlbmdlcnMuZm9yRWFjaChwYXNzZW5nZXI9PiB7XHJcbiAgICAgIGlmKHRoaXMuUExBTl9QRVBPTEVTLmluY2x1ZGVzKHBhc3Nlbmdlci5wYXNzZW5nZXJfbmFtZSkpIHtcclxuICAgICAgICAvL25hbWUs6Lqr5Lu957G75Z6LLOi6q+S7veivgSwxX1xyXG4gICAgICAgIHZhciB0aWNrZXQgPVxyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgXCIxXCI7XHJcbiAgICAgICAgdGlja2V0cy5wdXNoKHRpY2tldCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiB0aWNrZXRzLmpvaW4oXCJfXCIpK1wiX1wiO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja09yZGVySW5mbyhzdWJtaXRUb2tlbiwgcGFzc2VuZ2Vycykge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NoZWNrT3JkZXJJbmZvXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiY2FuY2VsX2ZsYWdcIjogMlxyXG4gICAgICAsXCJiZWRfbGV2ZWxfb3JkZXJfbnVtXCI6IFwiMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwXCJcclxuICAgICAgLFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMpXHJcbiAgICAgICxcInRvdXJfZmxhZ1wiOiBcImRjXCJcclxuICAgICAgLFwicmFuZENvZGVcIjogXCJcIlxyXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOjFcclxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiBzdWJtaXRUb2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFF1ZXVlQ291bnQodG9rZW4sIG9yZGVyUmVxdWVzdERUTywgdGlja2V0SW5mbykge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2dldFF1ZXVlQ291bnRcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcInRyYWluX2RhdGVcIjogbmV3IERhdGUob3JkZXJSZXF1ZXN0RFRPLnRyYWluX2RhdGUudGltZSkudG9TdHJpbmcoKVxyXG4gICAgICAsXCJ0cmFpbl9ub1wiOiBvcmRlclJlcXVlc3REVE8udHJhaW5fbm9cclxuICAgICAgLFwic3RhdGlvblRyYWluQ29kZVwiOiBvcmRlclJlcXVlc3REVE8uc3RhdGlvbl90cmFpbl9jb2RlXHJcbiAgICAgICxcInNlYXRUeXBlXCI6MVxyXG4gICAgICAsXCJmcm9tU3RhdGlvblRlbGVjb2RlXCI6IG9yZGVyUmVxdWVzdERUTy5mcm9tX3N0YXRpb25fdGVsZWNvZGVcclxuICAgICAgLFwidG9TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLnRvX3N0YXRpb25fdGVsZWNvZGVcclxuICAgICAgLFwibGVmdFRpY2tldFwiOiB0aWNrZXRJbmZvLnF1ZXJ5TGVmdFRpY2tldFJlcXVlc3REVE8ueXBJbmZvRGV0YWlsXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCIwMFwiXHJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm8udHJhaW5fbG9jYXRpb25cclxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldFBhc3NDb2RlTmV3KCkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzY29kZU5ldy9nZXRQYXNzQ29kZU5ldz9tb2R1bGU9cGFzc2VuZ2VyJnJhbmQ9cmFuZHAmXCIrTWF0aC5yYW5kb20oMCwxKTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlIT09MjAwKSByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcclxuICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja1JhbmRDb2RlQW5zeW4oKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2NoZWNrUmFuZENvZGVBbnN5blwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIHJhbmRDb2RlOiBcIlwiLFxyXG4gICAgICByYW5kOiBcInJhbmRwXCJcclxuICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICBjb25zdCBybCA9IHJlYWRsaW5lLmNyZWF0ZUludGVyZmFjZSh7XHJcbiAgICAgIGlucHV0OiBwcm9jZXNzLnN0ZGluLFxyXG4gICAgICBvdXRwdXQ6IHByb2Nlc3Muc3Rkb3V0XHJcbiAgICB9KTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHJsLnF1ZXN0aW9uKCdQbGVhc2UgaW5wdXQgcmFuZGNvZGU6JywgKHBvc2l0aW9ucykgPT4ge1xyXG4gICAgICAgIHJsLmNsb3NlKCk7XHJcblxyXG4gICAgICAgIG9wdGlvbnMuZm9ybS5yYW5kQ29kZSA9IHBvc2l0aW9ucztcclxuICAgICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgICB9KVxyXG4gICAgICB9KTtcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNvbmZpcm1TaW5nbGVGb3JRdWV1ZSh0b2tlbiwgcGFzc2VuZ2VycywgdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0pIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9jb25maXJtU2luZ2xlRm9yUXVldWVcIjtcclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcInBhc3NlbmdlclRpY2tldFN0clwiOiB0aGlzLmdldFBhc3NlbmdlclRpY2tldHMocGFzc2VuZ2VycylcclxuICAgICAgLFwib2xkUGFzc2VuZ2VyU3RyXCI6IHRoaXMuZ2V0T2xkUGFzc2VuZ2VycyhwYXNzZW5nZXJzKVxyXG4gICAgICAsXCJyYW5kQ29kZVwiOlwiXCJcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5wdXJwb3NlX2NvZGVzXHJcbiAgICAgICxcImtleV9jaGVja19pc0NoYW5nZVwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5rZXlfY2hlY2tfaXNDaGFuZ2VcclxuICAgICAgLFwibGVmdFRpY2tldFN0clwiOiB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybS5sZWZ0VGlja2V0U3RyXHJcbiAgICAgICxcInRyYWluX2xvY2F0aW9uXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnRyYWluX2xvY2F0aW9uXHJcbiAgICAgICxcImNob29zZV9zZWF0c1wiOiBcIlwiXHJcbiAgICAgICxcInNlYXREZXRhaWxUeXBlXCI6IFwiMDAwXCJcclxuICAgICAgLFwid2hhdHNTZWxlY3RcIjogMVxyXG4gICAgICAsXCJyb29tVHlwZVwiOiBcIjAwXCJcclxuICAgICAgLFwiZHdBbGxcIjogXCJOXCJcclxuICAgICAgLFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSlcclxuICAgIH0pXHJcbiAgfVxyXG5cclxuXHJcbiAgcHJpdmF0ZSBxdWVyeU9yZGVyV2FpdFRpbWUodG9rZW4pIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9xdWVyeU9yZGVyV2FpdFRpbWVcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiB7XHJcbiAgICAgICAgXCJyYW5kb21cIjogbmV3IERhdGUoKS5nZXRUaW1lKClcclxuICAgICAgICAsXCJ0b3VyRmxhZ1wiOiBcImRjXCJcclxuICAgICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAgICxcIlJFUEVBVF9TVUJNSVRfVE9LRU5cIjogdG9rZW5cclxuICAgICAgfVxyXG4gICAgICAsanNvbjogdHJ1ZVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKHRoaXMuaXNTeXN0ZW1CdXNzeShib2R5KSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHRoaXMuU1lTVEVNX0JVU1NZKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiByZWplY3QoYm9keSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2FuY2VsUXVldWVOb0NvbXBsZXRlT3JkZXIoKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3F1ZXJ5T3JkZXIvY2FuY2VsUXVldWVOb0NvbXBsZXRlTXlPcmRlclwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIHRvdXJGbGFnOiBcImRjXCJcclxuICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgICAsanNvbjogdHJ1ZVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG4iXX0=
