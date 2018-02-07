"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var FileCookieStore_1 = require("./FileCookieStore");
var request = require("request");
var querystring = require("querystring");
var fs = require("fs");
var readline = require("readline");
var process = require("process");
var Rx = require("@reactivex/rxjs");
var chalk = require("chalk");
var Account = /** @class */ (function () {
    function Account(name, userPassword) {
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
    Account.prototype.createOrder = function (trainDate, backTrainDate, planTrains, planPepoles) {
        this.TRAIN_DATE = trainDate;
        this.BACK_TRAIN_DATE = backTrainDate;
        this.PLAN_TRAINS = planTrains;
        this.PLAN_PEPOLES = planPepoles;
        return this;
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
                console.log("查询到火车数量 " + trains.length);
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
            }, function (err) {
                console.error(err);
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
                        console.log(chalk(templateObject_1 || (templateObject_1 = __makeTemplateObject(["Your ticket order number is {red.bold ", "}"], ["Your ticket order number is {red.bold ", "}"])), orderQueue.data.orderId));
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
                        console.log(chalk(templateObject_2 || (templateObject_2 = __makeTemplateObject(["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"], ["{yellow.bold \u6392\u961F\u4EBA\u6570\uFF1A", "} \u9884\u8BA1\u7B49\u5F85\u65F6\u95F4\uFF1A", " \u5206\u949F"])), orderQueue.data.waitCount, parseInt(orderQueue.data.waitTime / 1.5)));
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
                console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
                _this.sjLogin.next();
            }, function (error) {
                // 校验失败，重新校验
                console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"]))));
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
                console.log(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25\uFF0C", "}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25\uFF0C", "}"])), error));
                setTimeout(function (x) { return _this.sjAppToken.next(newapptk); }, 1000);
            });
        });
        this.sjMyPage.subscribe(function () {
            _this.getMy12306()
                .then(function () {
                console.log(chalk(templateObject_6 || (templateObject_6 = __makeTemplateObject(["{green.bold \u767B\u5F55\u6210\u529F}"], ["{green.bold \u767B\u5F55\u6210\u529F}"]))));
                _this.sjLfTicketInit.next();
            });
        });
    };
    Account.prototype.submit = function () {
        this.sjLoginInit.next();
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
            rl.question(chalk(templateObject_7 || (templateObject_7 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positions) {
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
            "leftTicketDTO.from_station": "SHH",
            "leftTicketDTO.to_station": "UUH",
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
            "query_from_station_name": "上海",
            "query_to_station_name": "徐州东",
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
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFPLENBQUMsY0FBYyxDQUFDLElBQUksUUFBUSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDM0csTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDdkIsQ0FBQztvQkFDRCxFQUFFLENBQUEsQ0FBQyxLQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDNUIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7b0JBQ25DLENBQUM7b0JBQ0QsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDdEIsQ0FBQztnQkFDRCxNQUFNLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2pDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQ0gsY0FBQztBQUFELENBamlDQSxBQWlpQ0MsSUFBQTtBQWppQ1ksMEJBQU8iLCJmaWxlIjoic3JjL0FjY291bnQuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0ZpbGVDb29raWVTdG9yZX0gZnJvbSAnLi9GaWxlQ29va2llU3RvcmUnO1xyXG5pbXBvcnQgcmVxdWVzdCA9IHJlcXVpcmUoJ3JlcXVlc3QnKTtcclxuaW1wb3J0IHF1ZXJ5c3RyaW5nID0gcmVxdWlyZSgncXVlcnlzdHJpbmcnKTtcclxuaW1wb3J0IGZzID0gcmVxdWlyZSgnZnMnKTtcclxuaW1wb3J0IHJlYWRsaW5lID0gcmVxdWlyZSgncmVhZGxpbmUnKTtcclxuaW1wb3J0IHByb2Nlc3MgPSByZXF1aXJlKCdwcm9jZXNzJyk7XHJcbmltcG9ydCBSeCA9IHJlcXVpcmUoJ0ByZWFjdGl2ZXgvcnhqcycpO1xyXG5pbXBvcnQgY2hhbGsgPSByZXF1aXJlKCdjaGFsaycpO1xyXG5cclxuZXhwb3J0IGNsYXNzIEFjY291bnQge1xyXG4gIHB1YmxpYyB1c2VyTmFtZSA6IHN0cmluZztcclxuICBwdWJsaWMgdXNlclBhc3N3b3JkIDogc3RyaW5nO1xyXG4gIHB1YmxpYyBUUkFJTl9EQVRFOiBzdHJpbmc7XHJcbiAgcHVibGljIEJBQ0tfVFJBSU5fREFURTogc3RyaW5nO1xyXG4gIHB1YmxpYyBQTEFOX1RSQUlOUzogQXJyYXk8c3RyaW5nPjtcclxuICBwdWJsaWMgUExBTl9QRVBPTEVTOiBBcnJheTxzdHJpbmc+O1xyXG5cclxuICBwcml2YXRlIFNZU1RFTV9CVVNTWSA9IFwiU3lzdGVtIGlzIGJ1c3N5XCI7XHJcbiAgcHJpdmF0ZSBTWVNURU1fTU9WRUQgPSBcIk1vdmVkIFRlbXBvcmFyaWx5XCI7XHJcblxyXG4gIHByaXZhdGUgcmVxdWVzdDogcmVxdWVzdC5SZXF1ZXN0QVBJPGFueSwgYW55LCBhbnk+O1xyXG4gIHByaXZhdGUgY29va2llamFyOiBhbnk7XHJcbiAgcHVibGljIGhlYWRlcnM6IG9iamVjdCA9IHtcclxuICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04XCJcclxuICAgICxcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxyXG4gICAgLFwiSG9zdFwiOiBcImt5ZncuMTIzMDYuY25cIlxyXG4gICAgLFwiT3JpZ2luXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuXCJcclxuICAgICxcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Nwb3J0P3JlZGlyZWN0PS9vdG4vXCJcclxuICB9O1xyXG5cclxuICBjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIHVzZXJQYXNzd29yZDogc3RyaW5nKSB7XHJcbiAgICB0aGlzLnVzZXJOYW1lID0gbmFtZTtcclxuICAgIHRoaXMudXNlclBhc3N3b3JkID0gdXNlclBhc3N3b3JkO1xyXG5cclxuICAgIHRoaXMuc2V0UmVxdWVzdCgpO1xyXG4gICAgdGhpcy5idWlsZExvZ2luRmxvdygpO1xyXG4gICAgdGhpcy5idWlsZE9yZGVyRmxvdygpO1xyXG4gIH1cclxuXHJcbiAgLyoqXHJcbiAgICog5qOA5p+l572R57uc5byC5bi4XHJcbiAgICovXHJcbiAgcHJpdmF0ZSBpc1N5c3RlbUJ1c3N5KGJvZHk6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgcmV0dXJuIGJvZHkuaW5kZXhPZihcIue9kee7nOWPr+iDveWtmOWcqOmXrumimO+8jOivt+aCqOmHjeivleS4gOS4i1wiKSA+IDA7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc2V0UmVxdWVzdCgpIHtcclxuICAgIHZhciBmaWxlU3RvcmUgPSBuZXcgRmlsZUNvb2tpZVN0b3JlKFwiLi9jb29raWVzL1wiK3RoaXMudXNlck5hbWUrXCIuanNvblwiLCB7ZW5jcnlwdDogZmFsc2V9KTtcclxuICAgIGZpbGVTdG9yZS5vcHRpb24gPSB7ZW5jcnlwdDogZmFsc2V9O1xyXG5cclxuICAgIHRoaXMuY29va2llamFyID0gcmVxdWVzdC5qYXIoZmlsZVN0b3JlKTtcclxuXHJcbiAgICB0aGlzLnJlcXVlc3QgPSByZXF1ZXN0LmRlZmF1bHRzKHtqYXI6IHRoaXMuY29va2llamFyfSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgY3JlYXRlT3JkZXIodHJhaW5EYXRlOiBzdHJpbmcsIGJhY2tUcmFpbkRhdGU6IHN0cmluZywgcGxhblRyYWluczogQXJyYXk8c3RyaW5nPiwgcGxhblBlcG9sZXM6IEFycmF5PHN0cmluZz4pOiB0aGlzIHtcclxuICAgIHRoaXMuVFJBSU5fREFURSA9IHRyYWluRGF0ZTtcclxuICAgIHRoaXMuQkFDS19UUkFJTl9EQVRFID0gYmFja1RyYWluRGF0ZTtcclxuICAgIHRoaXMuUExBTl9UUkFJTlMgPSBwbGFuVHJhaW5zO1xyXG4gICAgdGhpcy5QTEFOX1BFUE9MRVMgPSBwbGFuUGVwb2xlcztcclxuICAgIHJldHVybiB0aGlzO1xyXG4gIH1cclxuXHJcbiAgLy8gTG9naW4gaW5pdFxyXG4gIHByaXZhdGUgc2pMb2dpbkluaXQgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgLy8gQ2hlY2sgQ2FwdGNoYVxyXG4gIHByaXZhdGUgc2pDYXB0Y2hhICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgLy8gTG9naW5cclxuICBwcml2YXRlIHNqTG9naW4gICAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIC8vIEdldCBuZXcgYXBwIHRva2VuXHJcbiAgcHJpdmF0ZSBzak5ld0FwcFRva2VuID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICAvLyBHZXQgYXBwIHRva2VuXHJcbiAgcHJpdmF0ZSBzakFwcFRva2VuICAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xyXG4gIC8vIEdldCBteSBtYWluIHBhZ2VcclxuICBwcml2YXRlIHNqTXlQYWdlICAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICBwcml2YXRlIHNqTGZUaWNrZXRJbml0ICAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pRdWVyeUxmVGlja2V0ICAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzalNtT1JlcUNoZWNrVXNlciAgID0gbmV3IFJ4LlN1YmplY3Q8c3RyaW5nPigpO1xyXG4gIHByaXZhdGUgc2pTbU9yZGVyUmVxICAgICAgICA9IG5ldyBSeC5TdWJqZWN0PHN0cmluZz4oKTtcclxuICBwcml2YXRlIHNqQ1Bhc0luaXREYyAgICAgICAgPSBuZXcgUnguU3ViamVjdDxzdHJpbmc+KCk7XHJcbiAgcHJpdmF0ZSBzakdldFBhc3NlbmdlcnMgICAgID0gbmV3IFJ4LlN1YmplY3Q8b2JqZWN0PigpO1xyXG4gIHByaXZhdGUgc2pDaGVja09yZGVySW5mbyAgICA9IG5ldyBSeC5TdWJqZWN0PG9iamVjdD4oKTtcclxuICBwcml2YXRlIHNqR2V0UXVldWVDb3VudCAgICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG4gIHByaXZhdGUgc2pHZXRQYXNzQ29kZU5ldyAgICA9IG5ldyBSeC5TdWJqZWN0KCk7XHJcbiAgcHJpdmF0ZSBzakNvbmZpcm1TaW5nbGU0USAgID0gbmV3IFJ4LlN1YmplY3QoKTtcclxuICBwcml2YXRlIHNqUXVlcnlPcmRlcldhaXRUICAgPSBuZXcgUnguU3ViamVjdCgpO1xyXG5cclxuICBwcml2YXRlIGJ1aWxkT3JkZXJGbG93KCkge1xyXG4gICAgLy8g5Yid5aeL5YyW5p+l6K+i54Gr6L2m5L2Z56Wo6aG16Z2iXHJcbiAgICB0aGlzLnNqTGZUaWNrZXRJbml0LnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5sZWZ0VGlja2V0SW5pdCgpXHJcbiAgICAgICAgLnRoZW4oKCk9PnRoaXMuc2pRdWVyeUxmVGlja2V0Lm5leHQoKSwgKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyDmn6Xor6LngavovabkvZnnpahcclxuICAgIHRoaXMuc2pRdWVyeUxmVGlja2V0LnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5xdWVyeUxlZnRUaWNrZXQoKS50aGVuKHRyYWluc0RhdGEgPT4ge1xyXG4gICAgICAgIC8vY29uc29sZS5sb2codHJhaW5zRGF0YSk7XHJcbiAgICAgICAgdmFyIHRyYWlucyA9IHRyYWluc0RhdGEucmVzdWx0O1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhcIuafpeivouWIsOeBq+i9puaVsOmHjyBcIit0cmFpbnMubGVuZ3RoKTtcclxuICAgICAgICB2YXIgcGxhblRyYWluLCB0aGF0ID0gdGhpcztcclxuICAgICAgICB0cmFpbnMuZm9yRWFjaChmdW5jdGlvbih0cmFpbikge1xyXG4gICAgICAgICAgdHJhaW4gPSB0cmFpbi5zcGxpdChcInxcIik7XHJcblxyXG4gICAgICAgICAgaWYodHJhaW5bMzBdID09IFwi5pyJXCIgfHwgKHRyYWluWzMwXSA+IDAgJiYgdHJhaW5bMzBdICE9IFwi5pegXCIgJiYgdHJhaW5bMzBdICE9IFwiMFwiKSkge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyh0cmFpblszXSk7XHJcbiAgICAgICAgICAgIGlmKHRoYXQuUExBTl9UUkFJTlMuaW5jbHVkZXModHJhaW5bM10pKSB7XHJcbiAgICAgICAgICAgICAgcGxhblRyYWluID0gdHJhaW47XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYocGxhblRyYWluKSB7XHJcbiAgICAgICAgICB0aGlzLnNqU21PUmVxQ2hlY2tVc2VyLm5leHQocGxhblRyYWluWzBdKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICB9LCBlcnIgPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcclxuICAgICAgICBzZXRUaW1lb3V0KCgpPT4ge1xyXG4gICAgICAgICAgdGhpcy5zalF1ZXJ5TGZUaWNrZXQubmV4dCgpO1xyXG4gICAgICAgIH0sIDE1MDApO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgMTAg6aqM6K+B55m75b2V77yMUG9zdFxyXG4gICAgdGhpcy5zalNtT1JlcUNoZWNrVXNlci5zdWJzY3JpYmUoKHRyYWluOiBzdHJpbmcpPT4ge1xyXG4gICAgICBjb25zb2xlLmxvZyhcInN1Ym1pdCBvcmRlciByZXF1ZXN0IGNoZWNrIHVzZXJcIik7XHJcbiAgICAgIHRoaXMuY2hlY2tVc2VyKCkudGhlbigoKT0+dGhpcy5zalNtT3JkZXJSZXEubmV4dCh0cmFpbiksIGVycm9yID0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKFwiQ2hlY2sgdXNlciBlcnJvciBcIiArIGVycm9yKTtcclxuICAgICAgICB0aGlzLnNqU21PUmVxQ2hlY2tVc2VyLm5leHQodHJhaW4pO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIC8vIFN0ZXAgMTEg6aKE5o+Q5Lqk6K6i5Y2V77yMUG9zdFxyXG4gICAgdGhpcy5zalNtT3JkZXJSZXEuc3Vic2NyaWJlKCh0cmFpbjogc3RyaW5nKT0+IHtcclxuICAgICAgY29uc29sZS5sb2coXCJzdWJtaXQgb3JkZXIgcmVxdWVzdFwiKTtcclxuICAgICAgdGhpcy5zdWJtaXRPcmRlclJlcXVlc3QodHJhaW4pLnRoZW4oKHgpPT4ge1xyXG4gICAgICAgIGNvbnNvbGUubG9nKFwiU3VibWl0IE9yZGVyIFJlcXVlc3Qgc3VjY2VzcyFcIilcclxuICAgICAgICB0aGlzLnNqQ1Bhc0luaXREYy5uZXh0KCk7XHJcbiAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJTdWJtaXRPcmRlclJlcXVlc3QgZXJyb3IgXCIgKyBlcnJvcik7XHJcbiAgICAgICAgdGhpcy5zalNtT3JkZXJSZXEubmV4dCh0cmFpbik7XHJcbiAgICAgIH0pXHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDEyIOaooeaLn+i3s+i9rOmhtemdokluaXREY++8jFBvc3RcclxuICAgIHRoaXMuc2pDUGFzSW5pdERjLnN1YnNjcmliZSgodHJhaW46IHN0cmluZyk9PiB7XHJcbiAgICAgIHRoaXMuY29uZmlybVBhc3NlbmdlckluaXREYygpLnRoZW4oKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhcImNvbmZpcm1QYXNzZW5nZXIgSW5pdCBEYyBzdWNjZXNzISBcIitvcmRlclJlcXVlc3QudG9rZW4pO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKG9yZGVyUmVxdWVzdC50aWNrZXRJbmZvKTtcclxuICAgICAgICB0aGlzLnNqR2V0UGFzc2VuZ2Vycy5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgIGlmKGVycm9yID09IHRoaXMuU1lTVEVNX0JVU1NZKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhlcnJvcik7XHJcbiAgICAgICAgICB0aGlzLnNqQ1Bhc0luaXREYy5uZXh0KCk7XHJcbiAgICAgICAgfWVsc2UgaWYoZXJyb3IgPT0gdGhpcy5TWVNURU1fTU9WRUQpIHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGVycm9yKTtcclxuICAgICAgICAgIHRoaXMuc2pDUGFzSW5pdERjLm5leHQoKTtcclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pLmNhdGNoKGVycm9yPT4gY29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgLy8gU3RlcCAxMyDluLjnlKjogZTns7vkurrnoa7lrprvvIxQb3N0XHJcbiAgICB0aGlzLnNqR2V0UGFzc2VuZ2Vycy5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5nZXRQYXNzZW5nZXJzKG9yZGVyUmVxdWVzdC50b2tlbikudGhlbihwYXNzZW5nZXJzPT4ge1xyXG4gICAgICAgIG9yZGVyUmVxdWVzdC5wYXNzZW5nZXJzID0gcGFzc2VuZ2VycztcclxuICAgICAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm8ubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yICsgXCIgUmV0cnkgZ2V0IHBhc3NlbmdlcnNcIik7XHJcbiAgICAgICAgdGhpcy5zakdldFBhc3NlbmdlcnMubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICB9KVxyXG4gICAgICAuY2F0Y2goZXJyb3I9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICAvLyBTdGVwIDE0IOi0reelqOS6uuehruWumu+8jFBvc3RcclxuICAgIHRoaXMuc2pDaGVja09yZGVySW5mby5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5jaGVja09yZGVySW5mbyhvcmRlclJlcXVlc3QudG9rZW4sIG9yZGVyUmVxdWVzdC5wYXNzZW5nZXJzLmRhdGEubm9ybWFsX3Bhc3NlbmdlcnMpXHJcbiAgICAgICAgLnRoZW4ob3JkZXJJbmZvPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2cob3JkZXJJbmZvKTtcclxuICAgICAgICAgIC8vIFN0ZXAgMTUg5YeG5aSH6L+b5YWl5o6S6Zif77yMUG9zdFxyXG4gICAgICAgICAgdGhpcy5nZXRRdWV1ZUNvdW50KG9yZGVyUmVxdWVzdC50b2tlbiwgb3JkZXJSZXF1ZXN0Lm9yZGVyUmVxdWVzdCwgb3JkZXJSZXF1ZXN0LnRpY2tldEluZm8pXHJcbiAgICAgICAgICAgIC50aGVuKHg9PiB7XHJcbiAgICAgICAgICAgICAgY29uc29sZS5sb2coeCk7XHJcbiAgICAgICAgICAgICAgLy8g6IulIFN0ZXAgMTQg5Lit55qEIFwiaWZTaG93UGFzc0NvZGVcIiA9IFwiWVwi77yM6YKj5LmI5aSa5LqG6L6T5YWl6aqM6K+B56CB6L+Z5LiA5q2l77yMUG9zdFxyXG4gICAgICAgICAgICAgIGlmKG9yZGVySW5mby5kYXRhLmlmU2hvd1Bhc3NDb2RlID09IFwiWVwiKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNqR2V0UGFzc0NvZGVOZXcubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIFN0ZXAgMTcg56Gu6K6k6LSt5Lmw77yMUG9zdFxyXG4gICAgICAgICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcclxuICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sIGVycm9yPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICB0aGlzLnNqQ2hlY2tPcmRlckluZm8ubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pHZXRQYXNzQ29kZU5ldy5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgLy8gU3RlcCAxNiDkuZjlrqLkubDnpajpqozor4HnoIHvvIxHZXQgUE9TVFxyXG4gICAgICB0aGlzLmdldFBhc3NDb2RlTmV3KCkudGhlbigoKT0+IHRoaXMuY2hlY2tSYW5kQ29kZUFuc3luKCkpXHJcbiAgICAgICAgLnRoZW4oeD0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKHgpO1xyXG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgfSxlcnJvcj0+Y29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5jb25maXJtU2luZ2xlRm9yUXVldWUob3JkZXJSZXF1ZXN0LnRva2VuLCBvcmRlclJlcXVlc3QucGFzc2VuZ2Vycy5kYXRhLm5vcm1hbF9wYXNzZW5nZXJzLCBvcmRlclJlcXVlc3QudGlja2V0SW5mbylcclxuICAgICAgICAudGhlbih4PT57XHJcbiAgICAgICAgICBpZih4LnN0YXR1cyAmJiB4LmRhdGEuc3VibWl0U3RhdHVzKSB7XHJcbiAgICAgICAgICAgIC8vIFN0ZXAgMTgg5p+l6K+i5o6S6Zif562J5b6F5pe26Ze077yBXHJcbiAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyh4KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgdGhpcy5zakNvbmZpcm1TaW5nbGU0US5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5zdWJzY3JpYmUoKG9yZGVyUmVxdWVzdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5xdWVyeU9yZGVyV2FpdFRpbWUob3JkZXJSZXF1ZXN0LnRva2VuKVxyXG4gICAgICAgIC50aGVuKG9yZGVyUXVldWU9PiB7XHJcbiAgICAgICAgICBpZihvcmRlclF1ZXVlLnN0YXR1cykge1xyXG4gICAgICAgICAgICBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IDAgfHwgb3JkZXJRdWV1ZS5kYXRhLndhaXRUaW1lID09PSAtMSkge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrYFlvdXIgdGlja2V0IG9yZGVyIG51bWJlciBpcyB7cmVkLmJvbGQgJHtvcmRlclF1ZXVlLmRhdGEub3JkZXJJZH19YCk7XHJcbiAgICAgICAgICAgIH1lbHNlIGlmKG9yZGVyUXVldWUuZGF0YS53YWl0VGltZSA9PT0gLTIpe1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKG9yZGVyUXVldWUpO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC0zKXtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIllvdXIgdGlja2V0IHJlcXVlc3QgaGFzIGJlZW4gY2FuY2VsZWQhXCIpO1xyXG4gICAgICAgICAgICB9ZWxzZSBpZihvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgPT09IC00KXtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhcIllvdXIgdGlja2V0IHJlcXVlc3QgaXMgYmVpbmcgcHJvY2Vzc2VkLCBwbGVhc2Ugd2FpdCBhIG1vbWVudCFcIik7XHJcbiAgICAgICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zalF1ZXJ5T3JkZXJXYWl0VC5uZXh0KG9yZGVyUmVxdWVzdCk7XHJcbiAgICAgICAgICAgICAgfSwgNDAwMCk7XHJcbiAgICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg5o6S6Zif5Lq65pWw77yaJHtvcmRlclF1ZXVlLmRhdGEud2FpdENvdW50fX0g6aKE6K6h562J5b6F5pe26Ze077yaJHtwYXJzZUludChvcmRlclF1ZXVlLmRhdGEud2FpdFRpbWUgLyAxLjUpfSDliIbpkp9gKTtcclxuICAgICAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNqUXVlcnlPcmRlcldhaXRULm5leHQob3JkZXJSZXF1ZXN0KTtcclxuICAgICAgICAgICAgICB9LCA0MDAwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhvcmRlclF1ZXVlKTtcclxuICAgICAgICAgICAgc2V0VGltZW91dCh4PT4ge1xyXG4gICAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgICB9LCA0MDAwKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9LCBlcnJvcj0+IHtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGNoYWxrLmJnQmx1ZShlcnJvcitcIiBSZUNoZWNrIE9yZGVyIHdhaXRpbmcgdGltZVwiKSk7XHJcbiAgICAgICAgICBzZXRUaW1lb3V0KHg9PiB7XHJcbiAgICAgICAgICAgIHRoaXMuc2pRdWVyeU9yZGVyV2FpdFQubmV4dChvcmRlclJlcXVlc3QpO1xyXG4gICAgICAgICAgfSwgNDAwMCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgYnVpbGRMb2dpbkZsb3coKTogdm9pZCB7XHJcbiAgICB0aGlzLnNqTG9naW5Jbml0LnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5sb2dpbkluaXQoKVxyXG4gICAgICAgIC50aGVuKCgpPT57XHJcbiAgICAgICAgICB2YXIgdG9rZW5zID0gdGhpcy5jaGVja0F1dGhlbnRpY2F0aW9uKHRoaXMuY29va2llamFyLl9qYXIudG9KU09OKCkuY29va2llcyk7XHJcbiAgICAgICAgICBpZih0b2tlbnMudGspIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2pBcHBUb2tlbi5uZXh0KHRva2Vucy50ayk7XHJcbiAgICAgICAgICB9ZWxzZSBpZih0b2tlbnMudWFtdGspIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2pOZXdBcHBUb2tlbi5uZXh0KCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICB0aGlzLnNqQ2FwdGNoYS5uZXh0KCk7XHJcbiAgICAgICAgfSlcclxuICAgICAgICAuY2F0Y2goKGVycm9yOiBhbnkpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqQ2FwdGNoYS5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMuZ2V0Q2FwdGNoYSgpLnRoZW4oKCk9PiB0aGlzLmNoZWNrQ2FwdGNoYSgpKVxyXG4gICAgICAgIC50aGVuKCgpPT4ge1xyXG4gICAgICAgICAgLy8g5qCh6aqM56CB5oiQ5Yqf5ZCO6L+b6KGM5o6I5p2D6K6k6K+BXHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7Z3JlZW4uYm9sZCDpqozor4HnoIHmoKHpqozmiJDlip99YCk7XHJcbiAgICAgICAgICB0aGlzLnNqTG9naW4ubmV4dCgpO1xyXG4gICAgICAgIH0sIChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICAgIC8vIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjFxyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge3llbGxvdy5ib2xkIOagoemqjOWksei0pe+8jOmHjeaWsOagoemqjH1gKTtcclxuICAgICAgICAgIHRoaXMuc2pDYXB0Y2hhLm5leHQoKTtcclxuICAgICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pMb2dpbi5zdWJzY3JpYmUoKCk9PiB7XHJcbiAgICAgIHRoaXMudXNlckF1dGhlbnRpY2F0ZSgpXHJcbiAgICAgICAgLnRoZW4oKCk9PnRoaXMuc2pOZXdBcHBUb2tlbi5uZXh0KCksIChlcnJvcjogYW55KT0+dGhpcy5zakxvZ2luLm5leHQoKSkgLy8gVE9ETyB0aGlzLnNqQ2FwdGNoYS5uZXh0KCk7XHJcbiAgICAgICAgLmNhdGNoKChlcnJvcjogYW55KT0+Y29uc29sZS5lcnJvcihlcnJvcikpO1xyXG4gICAgfSk7XHJcblxyXG4gICAgdGhpcy5zak5ld0FwcFRva2VuLnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5nZXROZXdBcHBUb2tlbigpXHJcbiAgICAgICAgLnRoZW4oKG5ld2FwcHRrOiBzdHJpbmcpPT4gdGhpcy5zakFwcFRva2VuLm5leHQobmV3YXBwdGspLCAoZXJyb3I6IGFueSk9PiB7XHJcbiAgICAgICAgICB0aGlzLnNqQ2FwdGNoYS5uZXh0KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgICB0aGlzLnNqQXBwVG9rZW4uc3Vic2NyaWJlKChuZXdhcHB0azogc3RyaW5nKT0+IHtcclxuICAgICAgdGhpcy5nZXRBcHBUb2tlbihuZXdhcHB0aykudGhlbigoeDogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgdGhpcy5zak15UGFnZS5uZXh0KCk7XHJcbiAgICAgIH0sIChlcnJvcjogYW55KT0+IHtcclxuICAgICAgICBjb25zb2xlLmxvZyhjaGFsa2B7eWVsbG93LmJvbGQg6I635Y+WVG9rZW7lpLHotKXvvIwke2Vycm9yfX1gKTtcclxuICAgICAgICBzZXRUaW1lb3V0KHg9PiB0aGlzLnNqQXBwVG9rZW4ubmV4dChuZXdhcHB0ayksIDEwMDApO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICAgIHRoaXMuc2pNeVBhZ2Uuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmdldE15MTIzMDYoKVxyXG4gICAgICAgIC50aGVuKCgpPT4ge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coY2hhbGtge2dyZWVuLmJvbGQg55m75b2V5oiQ5YqffWApO1xyXG4gICAgICAgICAgdGhpcy5zakxmVGlja2V0SW5pdC5uZXh0KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdWJtaXQoKTogdm9pZCB7XHJcbiAgICB0aGlzLnNqTG9naW5Jbml0Lm5leHQoKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBsb2dpbkluaXQoKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xvZ2luL2luaXRcIjtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybCxcclxuICAgICAgbWV0aG9kOiBcIkdFVFwiLFxyXG4gICAgICBoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlOiBvYmplY3QsIHJlamVjdDogb2JqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpID0+IHtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0Q2FwdGNoYSgpOiBQcm9taXNlIHtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcclxuICAgICAgICAgIFwibW9kdWxlXCI6IFwibG9naW5cIixcclxuICAgICAgICAgIFwicmFuZFwiOiBcInNqcmFuZFwiLFxyXG4gICAgICAgICAgXCIwLjE3MjMxODcyNzAzMzg5MDYyXCI6XCJcIlxyXG4gICAgICB9O1xyXG5cclxuICAgIHZhciBwYXJhbSA9IHF1ZXJ5c3RyaW5nLnN0cmluZ2lmeShkYXRhLCBudWxsLCBudWxsKVxyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L2NhcHRjaGEvY2FwdGNoYS1pbWFnZT9cIitwYXJhbTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KSA9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHtcclxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyb3IpO1xyXG4gICAgICAgICAgcmVqZWN0KGVycm9yKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pLnBpcGUoZnMuY3JlYXRlV3JpdGVTdHJlYW0oXCJjYXB0Y2hhLkJNUFwiKSkub24oJ2Nsb3NlJywgZnVuY3Rpb24oKXtcclxuICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcblxyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjaGVja0NhcHRjaGEoKTogUHJvbWlzZSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvY2FwdGNoYS9jYXB0Y2hhLWNoZWNrXCI7XHJcblxyXG4gICAgY29uc3QgcmwgPSByZWFkbGluZS5jcmVhdGVJbnRlcmZhY2Uoe1xyXG4gICAgICBpbnB1dDogcHJvY2Vzcy5zdGRpbixcclxuICAgICAgb3V0cHV0OiBwcm9jZXNzLnN0ZG91dFxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgcmwucXVlc3Rpb24oY2hhbGtge3JlZC5ib2xkIOivt+i+k+WFpemqjOivgeeggX06YCwgKHBvc2l0aW9ucykgPT4ge1xyXG4gICAgICAgIHJsLmNsb3NlKCk7XHJcblxyXG4gICAgICAgIHZhciBkYXRhID0ge1xyXG4gICAgICAgICAgICBcImFuc3dlclwiOiBwb3NpdGlvbnMsXHJcbiAgICAgICAgICAgIFwibG9naW5fc2l0ZVwiOiBcIkVcIixcclxuICAgICAgICAgICAgXCJyYW5kXCI6IFwic2pyYW5kXCJcclxuICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICAgICAgdXJsOiB1cmxcclxuICAgICAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAgICAgLGZvcm06IGRhdGFcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSkgPT4ge1xyXG4gICAgICAgICAgaWYoZXJyb3IpIHtcclxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihlcnJvcik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xyXG4gICAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDQpIHtcclxuICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgcmVqZWN0KCk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdlcnJvcjogJysgcmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKHJlc3BvbnNlLnRleHQpO1xyXG4gICAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgdXNlckF1dGhlbnRpY2F0ZSgpOiBQcm9taXNlIHtcclxuICAgIC8vIOWPkemAgeeZu+W9leS/oeaBr1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcclxuICAgICAgICAgICxcInVzZXJuYW1lXCI6IHRoaXMudXNlck5hbWVcclxuICAgICAgICAgICxcInBhc3N3b3JkXCI6IHRoaXMudXNlclBhc3N3b3JkXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vcGFzc3BvcnQvd2ViL2xvZ2luXCI7XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxoZWFkZXJzOiB0aGlzLmhlYWRlcnNcclxuICAgICAgLG1ldGhvZDogJ1BPU1QnXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSByZXR1cm4gcmVqZWN0KGVycm9yKTtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhib2R5KTtcclxuICAgICAgICAgIGJvZHkgPSBKU09OLnBhcnNlKGJvZHkpO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYm9keS5yZXN1bHRfbWVzc2FnZSk7XHJcbiAgICAgICAgICBpZihib2R5LnJlc3VsdF9jb2RlID09IDIpIHtcclxuICAgICAgICAgICAgdGhyb3cgYm9keS5yZXN1bHRfbWVzc2FnZTtcclxuICAgICAgICAgIH1lbHNlIGlmKGJvZHkucmVzdWx0X2NvZGUgIT0gMCkge1xyXG4gICAgICAgICAgICByZWplY3QoYm9keSk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIHJlc29sdmUoYm9keS51YW10ayk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE5ld0FwcFRva2VuKCk6IFByb21pc2Uge1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgICAgICBcImFwcGlkXCI6IFwib3RuXCJcclxuICAgICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9e1xyXG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL3Bhc3Nwb3J0L3dlYi9hdXRoL3VhbXRrXCJcclxuICAgICAgLGhlYWRlcnM6IHRoaXMuaGVhZGVyc1xyXG4gICAgICAsbWV0aG9kOiAnUE9TVCdcclxuICAgICAgLGZvcm06IGRhdGFcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG5cclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhib2R5LnJlc3VsdF9tZXNzYWdlKTtcclxuICAgICAgICAgIGlmKGJvZHkucmVzdWx0X2NvZGUgPT0gMCkge1xyXG4gICAgICAgICAgICByZXNvbHZlKGJvZHkubmV3YXBwdGspO1xyXG4gICAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgICByZWplY3QoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlKVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0TXkxMjMwNigpOiBQcm9taXNlIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KHtcclxuICAgICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9pbmRleC9pbml0TXkxMjMwNlwiXHJcbiAgICAgICAsaGVhZGVyczogdGhpcy5oZWFkZXJzXHJcbiAgICAgICAsbWV0aG9kOiBcIkdFVFwifSxcclxuICAgICAgIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgY29uc29sZS5sb2coXCJHb3QgbXkgMTIzMDZcIik7XHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY2hlY2tBdXRoZW50aWNhdGlvbihjb29raWVzOiBvYmplY3QpIHtcclxuICAgIHZhciB1YW10ayA9IFwiXCIsIHRrID0gXCJcIjtcclxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjb29raWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgIGlmKGNvb2tpZXNbaV0ua2V5ID09IFwidWFtdGtcIikge1xyXG4gICAgICAgIHVhbXRrID0gY29va2llc1tpXS52YWx1ZTtcclxuICAgICAgfVxyXG5cclxuICAgICAgaWYoY29va2llc1tpXS5rZXkgPT0gXCJ0a1wiKSB7XHJcbiAgICAgICAgdGsgPSBjb29raWVzW2ldLnZhbHVlO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4ge1xyXG4gICAgICB1YW10azogdWFtdGssXHJcbiAgICAgIHRrOiB0a1xyXG4gICAgfTtcclxuICB9XHJcblxyXG4gIC8qKlxyXG4gICAqXHJcbiAgICovXHJcbiAgcHJpdmF0ZSBnZXRBcHBUb2tlbihuZXdhcHB0azogc3RyaW5nKSB7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgICAgIFwidGtcIjogbmV3YXBwdGtcclxuICAgICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi91YW1hdXRoY2xpZW50XCJcclxuICAgICAgLGhlYWRlcnM6IHtcclxuICAgICAgICBcIlVzZXItQWdlbnRcIjogXCJNb3ppbGxhLzUuMCAoV2luZG93cyBOVCA2LjE7IFdPVzY0KSBBcHBsZVdlYktpdC81MzcuMTcgKEtIVE1MLCBsaWtlIEdlY2tvKSBDaHJvbWUvMjQuMC4xMzEyLjYwIFNhZmFyaS81MzcuMTdcIlxyXG4gICAgICAgICxcIkhvc3RcIjogXCJreWZ3LjEyMzA2LmNuXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9wYXNzcG9ydD9yZWRpcmVjdD0vb3RuL1wiXHJcbiAgICAgICAgLCdjb250ZW50LXR5cGUnOiAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkJ1xyXG4gICAgICB9XHJcbiAgICAgICxtZXRob2Q6ICdQT1NUJ1xyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgLy8gY29uc29sZS5sb2coYm9keSk7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkucmVzdWx0X21lc3NhZ2UpO1xyXG4gICAgICAgICAgaWYoYm9keS5yZXN1bHRfY29kZSA9PSAwKSB7XHJcbiAgICAgICAgICAgIHJlc29sdmUoYm9keS5hcHB0ayk7XHJcbiAgICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICAgIHJlamVjdChib2R5KTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9ZWxzZSB7XHJcbiAgICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzQ29kZSlcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxlZnRUaWNrZXRJbml0KCk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIjtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdCh1cmwsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzVGV4dCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHF1ZXJ5TGVmdFRpY2tldCgpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciBxdWVyeSA9IHtcclxuICAgICAgXCJsZWZ0VGlja2V0RFRPLnRyYWluX2RhdGVcIjogdGhpcy5UUkFJTl9EQVRFXHJcbiAgICAgICxcImxlZnRUaWNrZXREVE8uZnJvbV9zdGF0aW9uXCI6XCJTSEhcIlxyXG4gICAgICAsXCJsZWZ0VGlja2V0RFRPLnRvX3N0YXRpb25cIjpcIlVVSFwiXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICB9XHJcblxyXG4gICAgdmFyIHBhcmFtID0gcXVlcnlzdHJpbmcuc3RyaW5naWZ5KHF1ZXJ5KTtcclxuXHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2xlZnRUaWNrZXQvcXVlcnlaP1wiK3BhcmFtO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KHVybCwgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICAgIC8vIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoIWJvZHkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChyZXNwb25zZS5zdGF0dXNDb2RlKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmKGJvZHkuaW5kZXhPZihcIuivt+aCqOmHjeivleS4gOS4i1wiKSA+IDApIHtcclxuICAgICAgICAgICAgcmVqZWN0KFwi57O757uf57mB5b+ZIVwiKTtcclxuICAgICAgICAgIH1lbHNlIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICB2YXIgZGF0YSA9IEpTT04ucGFyc2UoYm9keSkuZGF0YTtcclxuICAgICAgICAgICAgfWNhdGNoKGVycikge1xyXG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKGJvZHkpO1xyXG4gICAgICAgICAgICAgIHJlamVjdChlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJlc29sdmUoZGF0YSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfWVsc2Uge1xyXG4gICAgICAgICAgY29uc29sZS5sb2cocmVzcG9uc2Uuc3RhdHVzQ29kZSk7XHJcbiAgICAgICAgICByZWplY3QoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrVXNlcigpOiBQcm9taXNlPHZvaWQ+IHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vbG9naW4vY2hlY2tVc2VyXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgIH07XHJcblxyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXHJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSlcclxuICAgICAgICAgIGlmKGJvZHkuZGF0YS5mbGFnKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIHN1Ym1pdE9yZGVyUmVxdWVzdChzZWNyZXRTdHI6IHN0cmluZyk6IFByb21pc2U8b2JqZWN0PiAge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L3N1Ym1pdE9yZGVyUmVxdWVzdFwiO1xyXG5cclxuICAgIHZhciBkYXRhID0ge1xyXG4gICAgICBcInNlY3JldFN0clwiOiBxdWVyeXN0cmluZy51bmVzY2FwZShzZWNyZXRTdHIpXHJcbiAgICAgICxcInRyYWluX2RhdGVcIjogdGhpcy5UUkFJTl9EQVRFXHJcbiAgICAgICxcImJhY2tfdHJhaW5fZGF0ZVwiOiB0aGlzLkJBQ0tfVFJBSU5fREFURVxyXG4gICAgICAsXCJ0b3VyX2ZsYWdcIjogXCJkY1wiXHJcbiAgICAgICxcInB1cnBvc2VfY29kZXNcIjogXCJBRFVMVFwiXHJcbiAgICAgICxcInF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lXCI6IFwi5LiK5rW3XCJcclxuICAgICAgLFwicXVlcnlfdG9fc3RhdGlvbl9uYW1lXCI6IFwi5b6Q5bee5LicXCJcclxuICAgICAgLFwidW5kZWZpbmVkXCI6XCJcIlxyXG4gICAgfTtcclxuXHJcbiAgICAvLyB1cmwgPSB1cmwgKyBcInNlY3JldFN0cj1cIitzZWNyZXRTdHIrXCImdHJhaW5fZGF0ZT0yMDE4LTAxLTMxJmJhY2tfdHJhaW5fZGF0ZT0yMDE4LTAxLTMwJnRvdXJfZmxhZz1kYyZwdXJwb3NlX2NvZGVzPUFEVUxUJnF1ZXJ5X2Zyb21fc3RhdGlvbl9uYW1lPeS4iua1tyZxdWVyeV90b19zdGF0aW9uX25hbWU95b6Q5bee5LicJnVuZGVmaW5lZFwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIklmLU1vZGlmaWVkLVNpbmNlXCI6IFwiMFwiXHJcbiAgICAgICAgLFwiQ2FjaGUtQ29udHJvbFwiOiBcIm5vLWNhY2hlXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KTtcclxuICAgICAgICAgIGlmKGJvZHkuc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5Lm1lc3NhZ2VzWzBdKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c0NvZGUpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjb25maXJtUGFzc2VuZ2VySW5pdERjKCk6IFByb21pc2Uge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgIH07XHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkXCJcclxuICAgICAgICAsXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9sZWZ0VGlja2V0L2luaXRcIlxyXG4gICAgICAgICxcIlVwZ3JhZGUtSW5zZWN1cmUtUmVxdWVzdHNcIjoxXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZihib2R5KSB7XHJcbiAgICAgICAgICAgIC8vIEdldCBSZXBlYXQgU3VibWl0IFRva2VuXHJcbiAgICAgICAgICAgIHZhciB0b2tlbiA9IGJvZHkubWF0Y2goL3ZhciBnbG9iYWxSZXBlYXRTdWJtaXRUb2tlbiA9ICcoLio/KSc7Lyk7XHJcbiAgICAgICAgICAgIHZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSA9IGJvZHkubWF0Y2goL3ZhciB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybT0oLio/KTsvKTtcclxuICAgICAgICAgICAgdmFyIG9yZGVyUmVxdWVzdERUTyA9IGJvZHkubWF0Y2goL3ZhciBvcmRlclJlcXVlc3REVE89KC4qPyk7Lyk7XHJcbiAgICAgICAgICAgIGlmKHRva2VuKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoe1xyXG4gICAgICAgICAgICAgICAgdG9rZW46IHRva2VuWzFdXHJcbiAgICAgICAgICAgICAgICAsdGlja2V0SW5mbzogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0mJkpTT04ucGFyc2UodGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm1bMV0ucmVwbGFjZSgvJy9nLCBcIlxcXCJcIikpXHJcbiAgICAgICAgICAgICAgICAsb3JkZXJSZXF1ZXN0OiBvcmRlclJlcXVlc3REVE8mJkpTT04ucGFyc2Uob3JkZXJSZXF1ZXN0RFRPWzFdLnJlcGxhY2UoLycvZywgXCJcXFwiXCIpKVxyXG4gICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KHRoaXMuU1lTVEVNX0JVU1NZKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBnZXRQYXNzZW5nZXJzKHRva2VuOiBzdHJpbmcpOiBQcm9taXNlIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9nZXRQYXNzZW5nZXJEVE9zXCI7XHJcblxyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwiX2pzb25fYXR0XCI6IFwiXCJcclxuICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgfTtcclxuXHJcbiAgICB2YXIgb3B0aW9ucyA9IHtcclxuICAgICAgdXJsOiB1cmxcclxuICAgICAgLG1ldGhvZDogXCJQT1NUXCJcclxuICAgICAgLGhlYWRlcnM6IE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5oZWFkZXJzKSwge1xyXG4gICAgICAgIFwiUmVmZXJlclwiOiBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vY29uZmlybVBhc3Nlbmdlci9pbml0RGNcIlxyXG4gICAgICB9KVxyXG4gICAgICAsZm9ybTogZGF0YVxyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCk9PiB7XHJcbiAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICBpZihlcnJvcikgdGhyb3cgZXJyb3I7XHJcblxyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUgPT09IDIwMCkge1xyXG4gICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKGJvZHkpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICAvKiBzZWF0IHR5cGVcclxuICDigJjova/ljafigJkgPT4g4oCYNOKAmSxcclxuICDigJjkuoznrYnluqfigJkgPT4g4oCYT+KAmSxcclxuICDigJjkuIDnrYnluqfigJkgPT4g4oCYTeKAmSxcclxuICDigJjnoazluqfigJkgPT4g4oCYMeKAmSxcclxuICAgKi9cclxuICBwcml2YXRlIGdldFBhc3NlbmdlclRpY2tldHMocGFzc2VuZ2Vycyk6IHN0cmluZyB7XHJcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xyXG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcclxuICAgICAgaWYodGhpcy5QTEFOX1BFUE9MRVMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xyXG4gICAgICAgIC8v5bqn5L2N57G75Z6LLDAs56Wo57G75Z6LKOaIkOS6ui/lhL/nq6UpLG5hbWUs6Lqr5Lu957G75Z6LKOi6q+S7veivgS/lhpvlrpjor4EuLi4uKSzouqvku73or4Es55S16K+d5Y+356CBLOS/neWtmOeKtuaAgVxyXG4gICAgICAgIHZhciB0aWNrZXQgPSAvKnBhc3Nlbmdlci5zZWF0X3R5cGUqLyBcIk9cIiArXHJcbiAgICAgICAgICAgICAgICBcIiwwLFwiICtcclxuICAgICAgICAgICAgICAgIC8qbGltaXRfdGlja2V0c1thQV0udGlja2V0X3R5cGUqL1wiMVwiICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgcGFzc2VuZ2VyLnBhc3Nlbmdlcl9pZF90eXBlX2NvZGUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX25vICsgXCIsXCIgK1xyXG4gICAgICAgICAgICAgICAgKHBhc3Nlbmdlci5waG9uZV9ubyB8fCBcIlwiICkgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBcIk5cIjtcclxuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIik7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2Vycyk6IHN0cmluZyB7XHJcbiAgICB2YXIgdGlja2V0cyA9IFtdO1xyXG4gICAgcGFzc2VuZ2Vycy5mb3JFYWNoKHBhc3Nlbmdlcj0+IHtcclxuICAgICAgaWYodGhpcy5QTEFOX1BFUE9MRVMuaW5jbHVkZXMocGFzc2VuZ2VyLnBhc3Nlbmdlcl9uYW1lKSkge1xyXG4gICAgICAgIC8vbmFtZSzouqvku73nsbvlnoss6Lqr5Lu96K+BLDFfXHJcbiAgICAgICAgdmFyIHRpY2tldCA9XHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX25hbWUgKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBwYXNzZW5nZXIucGFzc2VuZ2VyX2lkX3R5cGVfY29kZSArIFwiLFwiICtcclxuICAgICAgICAgICAgICAgIHBhc3Nlbmdlci5wYXNzZW5nZXJfaWRfbm8gKyBcIixcIiArXHJcbiAgICAgICAgICAgICAgICBcIjFcIjtcclxuICAgICAgICB0aWNrZXRzLnB1c2godGlja2V0KTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcblxyXG4gICAgcmV0dXJuIHRpY2tldHMuam9pbihcIl9cIikrXCJfXCI7XHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrT3JkZXJJbmZvKHN1Ym1pdFRva2VuLCBwYXNzZW5nZXJzKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvY2hlY2tPcmRlckluZm9cIjtcclxuXHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgXCJjYW5jZWxfZmxhZ1wiOiAyXHJcbiAgICAgICxcImJlZF9sZXZlbF9vcmRlcl9udW1cIjogXCIwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDBcIlxyXG4gICAgICAsXCJwYXNzZW5nZXJUaWNrZXRTdHJcIjogdGhpcy5nZXRQYXNzZW5nZXJUaWNrZXRzKHBhc3NlbmdlcnMpXHJcbiAgICAgICxcIm9sZFBhc3NlbmdlclN0clwiOiB0aGlzLmdldE9sZFBhc3NlbmdlcnMocGFzc2VuZ2VycylcclxuICAgICAgLFwidG91cl9mbGFnXCI6IFwiZGNcIlxyXG4gICAgICAsXCJyYW5kQ29kZVwiOiBcIlwiXHJcbiAgICAgICxcIndoYXRzU2VsZWN0XCI6MVxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHN1Ym1pdFRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG5cclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UXVldWVDb3VudCh0b2tlbiwgb3JkZXJSZXF1ZXN0RFRPLCB0aWNrZXRJbmZvKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvZ2V0UXVldWVDb3VudFwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwidHJhaW5fZGF0ZVwiOiBuZXcgRGF0ZShvcmRlclJlcXVlc3REVE8udHJhaW5fZGF0ZS50aW1lKS50b1N0cmluZygpXHJcbiAgICAgICxcInRyYWluX25vXCI6IG9yZGVyUmVxdWVzdERUTy50cmFpbl9ub1xyXG4gICAgICAsXCJzdGF0aW9uVHJhaW5Db2RlXCI6IG9yZGVyUmVxdWVzdERUTy5zdGF0aW9uX3RyYWluX2NvZGVcclxuICAgICAgLFwic2VhdFR5cGVcIjoxXHJcbiAgICAgICxcImZyb21TdGF0aW9uVGVsZWNvZGVcIjogb3JkZXJSZXF1ZXN0RFRPLmZyb21fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJ0b1N0YXRpb25UZWxlY29kZVwiOiBvcmRlclJlcXVlc3REVE8udG9fc3RhdGlvbl90ZWxlY29kZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0XCI6IHRpY2tldEluZm8ucXVlcnlMZWZ0VGlja2V0UmVxdWVzdERUTy55cEluZm9EZXRhaWxcclxuICAgICAgLFwicHVycG9zZV9jb2Rlc1wiOiBcIjAwXCJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mby50cmFpbl9sb2NhdGlvblxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KVxyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgZ2V0UGFzc0NvZGVOZXcoKSB7XHJcbiAgICB2YXIgdXJsID0gXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL3Bhc3Njb2RlTmV3L2dldFBhc3NDb2RlTmV3P21vZHVsZT1wYXNzZW5nZXImcmFuZD1yYW5kcCZcIitNYXRoLnJhbmRvbSgwLDEpO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpPT4ge1xyXG4gICAgICB0aGlzLnJlcXVlc3Qob3B0aW9ucywgKGVycm9yLCByZXNwb25zZSwgYm9keSk9PiB7XHJcbiAgICAgICAgaWYoZXJyb3IpIHRocm93IGVycm9yO1xyXG4gICAgICAgIGlmKHJlc3BvbnNlLnN0YXR1c0NvZGUhPT0yMDApIHJlamVjdChyZXNwb25zZS5zdGF0dXNNZXNzYWdlKTtcclxuICAgICAgfSkucGlwZShmcy5jcmVhdGVXcml0ZVN0cmVhbShcImNhcHRjaGEuQk1QXCIpKS5vbignY2xvc2UnLCBmdW5jdGlvbigpe1xyXG4gICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9KTtcclxuXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGNoZWNrUmFuZENvZGVBbnN5bigpIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcGFzc2NvZGVOZXcvY2hlY2tSYW5kQ29kZUFuc3luXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgcmFuZENvZGU6IFwiXCIsXHJcbiAgICAgIHJhbmQ6IFwicmFuZHBcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIGNvbnN0IHJsID0gcmVhZGxpbmUuY3JlYXRlSW50ZXJmYWNlKHtcclxuICAgICAgaW5wdXQ6IHByb2Nlc3Muc3RkaW4sXHJcbiAgICAgIG91dHB1dDogcHJvY2Vzcy5zdGRvdXRcclxuICAgIH0pO1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgcmwucXVlc3Rpb24oJ1BsZWFzZSBpbnB1dCByYW5kY29kZTonLCAocG9zaXRpb25zKSA9PiB7XHJcbiAgICAgICAgcmwuY2xvc2UoKTtcclxuXHJcbiAgICAgICAgb3B0aW9ucy5mb3JtLnJhbmRDb2RlID0gcG9zaXRpb25zO1xyXG4gICAgICAgIHRoaXMucmVxdWVzdChvcHRpb25zLCAoZXJyb3IsIHJlc3BvbnNlLCBib2R5KT0+IHtcclxuICAgICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgICAgaWYoKHJlc3BvbnNlLmhlYWRlcnNbXCJjb250ZW50LXR5cGVcIl0gfHwgcmVzcG9uc2UuaGVhZGVyc1tcIkNvbnRlbnQtVHlwZVwiXSkuaW5kZXhPZihcImFwcGxpY2F0aW9uL2pzb25cIikgPiAtMSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICAgIH0pXHJcbiAgICAgIH0pO1xyXG4gICAgfSlcclxuICB9XHJcblxyXG4gIHByaXZhdGUgY29uZmlybVNpbmdsZUZvclF1ZXVlKHRva2VuLCBwYXNzZW5nZXJzLCB0aWNrZXRJbmZvRm9yUGFzc2VuZ2VyRm9ybSkge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2NvbmZpcm1TaW5nbGVGb3JRdWV1ZVwiO1xyXG4gICAgdmFyIGRhdGEgPSB7XHJcbiAgICAgIFwicGFzc2VuZ2VyVGlja2V0U3RyXCI6IHRoaXMuZ2V0UGFzc2VuZ2VyVGlja2V0cyhwYXNzZW5nZXJzKVxyXG4gICAgICAsXCJvbGRQYXNzZW5nZXJTdHJcIjogdGhpcy5nZXRPbGRQYXNzZW5nZXJzKHBhc3NlbmdlcnMpXHJcbiAgICAgICxcInJhbmRDb2RlXCI6XCJcIlxyXG4gICAgICAsXCJwdXJwb3NlX2NvZGVzXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLnB1cnBvc2VfY29kZXNcclxuICAgICAgLFwia2V5X2NoZWNrX2lzQ2hhbmdlXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmtleV9jaGVja19pc0NoYW5nZVxyXG4gICAgICAsXCJsZWZ0VGlja2V0U3RyXCI6IHRpY2tldEluZm9Gb3JQYXNzZW5nZXJGb3JtLmxlZnRUaWNrZXRTdHJcclxuICAgICAgLFwidHJhaW5fbG9jYXRpb25cIjogdGlja2V0SW5mb0ZvclBhc3NlbmdlckZvcm0udHJhaW5fbG9jYXRpb25cclxuICAgICAgLFwiY2hvb3NlX3NlYXRzXCI6IFwiXCJcclxuICAgICAgLFwic2VhdERldGFpbFR5cGVcIjogXCIwMDBcIlxyXG4gICAgICAsXCJ3aGF0c1NlbGVjdFwiOiAxXHJcbiAgICAgICxcInJvb21UeXBlXCI6IFwiMDBcIlxyXG4gICAgICAsXCJkd0FsbFwiOiBcIk5cIlxyXG4gICAgICAsXCJfanNvbl9hdHRcIjogXCJcIlxyXG4gICAgICAsXCJSRVBFQVRfU1VCTUlUX1RPS0VOXCI6IHRva2VuXHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2UoYm9keSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KVxyXG4gICAgfSlcclxuICB9XHJcblxyXG5cclxuICBwcml2YXRlIHF1ZXJ5T3JkZXJXYWl0VGltZSh0b2tlbikge1xyXG4gICAgdmFyIHVybCA9IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL3F1ZXJ5T3JkZXJXYWl0VGltZVwiO1xyXG4gICAgdmFyIG9wdGlvbnMgPSB7XHJcbiAgICAgIHVybDogdXJsXHJcbiAgICAgICxtZXRob2Q6IFwiUE9TVFwiXHJcbiAgICAgICxoZWFkZXJzOiBPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuaGVhZGVycyksIHtcclxuICAgICAgICBcIlJlZmVyZXJcIjogXCJodHRwczovL2t5ZncuMTIzMDYuY24vb3RuL2NvbmZpcm1QYXNzZW5nZXIvaW5pdERjXCJcclxuICAgICAgfSlcclxuICAgICAgLGZvcm06IHtcclxuICAgICAgICBcInJhbmRvbVwiOiBuZXcgRGF0ZSgpLmdldFRpbWUoKVxyXG4gICAgICAgICxcInRvdXJGbGFnXCI6IFwiZGNcIlxyXG4gICAgICAgICxcIl9qc29uX2F0dFwiOiBcIlwiXHJcbiAgICAgICAgLFwiUkVQRUFUX1NVQk1JVF9UT0tFTlwiOiB0b2tlblxyXG4gICAgICB9XHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuXHJcbiAgICAgICAgaWYocmVzcG9uc2Uuc3RhdHVzQ29kZSA9PT0gMjAwKSB7XHJcbiAgICAgICAgICBpZigocmVzcG9uc2UuaGVhZGVyc1tcImNvbnRlbnQtdHlwZVwiXSB8fCByZXNwb25zZS5oZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdKS5pbmRleE9mKFwiYXBwbGljYXRpb24vanNvblwiKSA+IC0xKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKGJvZHkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgaWYodGhpcy5pc1N5c3RlbUJ1c3N5KGJvZHkpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QodGhpcy5TWVNURU1fQlVTU1kpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuIHJlamVjdChib2R5KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmVqZWN0KHJlc3BvbnNlLnN0YXR1c01lc3NhZ2UpO1xyXG4gICAgICB9KTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBjYW5jZWxRdWV1ZU5vQ29tcGxldGVPcmRlcigpIHtcclxuICAgIHZhciB1cmwgPSBcImh0dHBzOi8va3lmdy4xMjMwNi5jbi9vdG4vcXVlcnlPcmRlci9jYW5jZWxRdWV1ZU5vQ29tcGxldGVNeU9yZGVyXCI7XHJcbiAgICB2YXIgZGF0YSA9IHtcclxuICAgICAgdG91ckZsYWc6IFwiZGNcIlxyXG4gICAgfTtcclxuICAgIHZhciBvcHRpb25zID0ge1xyXG4gICAgICB1cmw6IHVybFxyXG4gICAgICAsbWV0aG9kOiBcIlBPU1RcIlxyXG4gICAgICAsaGVhZGVyczogT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LCB0aGlzLmhlYWRlcnMpLCB7XHJcbiAgICAgICAgXCJSZWZlcmVyXCI6IFwiaHR0cHM6Ly9reWZ3LjEyMzA2LmNuL290bi9jb25maXJtUGFzc2VuZ2VyL2luaXREY1wiXHJcbiAgICAgIH0pXHJcbiAgICAgICxmb3JtOiBkYXRhXHJcbiAgICAgICxqc29uOiB0cnVlXHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KT0+IHtcclxuICAgICAgdGhpcy5yZXF1ZXN0KG9wdGlvbnMsIChlcnJvciwgcmVzcG9uc2UsIGJvZHkpPT4ge1xyXG4gICAgICAgIGlmKGVycm9yKSB0aHJvdyBlcnJvcjtcclxuICAgICAgICBpZihyZXNwb25zZS5zdGF0dXNDb2RlID09PSAyMDApIHtcclxuICAgICAgICAgIGlmKChyZXNwb25zZS5oZWFkZXJzW1wiY29udGVudC10eXBlXCJdIHx8IHJlc3BvbnNlLmhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0pLmluZGV4T2YoXCJhcHBsaWNhdGlvbi9qc29uXCIpID4gLTEpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoYm9keSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBpZih0aGlzLmlzU3lzdGVtQnVzc3koYm9keSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdCh0aGlzLlNZU1RFTV9CVVNTWSk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gcmVqZWN0KGJvZHkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZWplY3QocmVzcG9uc2Uuc3RhdHVzTWVzc2FnZSk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==
