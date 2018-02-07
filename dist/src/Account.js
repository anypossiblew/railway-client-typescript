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
        this.headers = {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17",
            "Host": "kyfw.12306.cn",
            "Origin": "https://kyfw.12306.cn",
            "Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/"
        };
        this.userName = name;
        this.userPassword = userPassword;
        this.setRequest();
    }
    Account.prototype.setRequest = function () {
        var fileStore = new FileCookieStore_1.FileCookieStore("./cookies/" + this.userName + ".json", { encrypt: false });
        fileStore.option = { encrypt: false };
        this.cookiejar = request.jar(fileStore);
        this.request = request.defaults({ jar: this.cookiejar });
    };
    Account.prototype.login = function () {
        var _this = this;
        var url = "https://kyfw.12306.cn/otn/login/init";
        var options = {
            url: url,
            method: "GET",
            headers: this.headers
        };
        return new Promise(function (resolve, reject) {
            _this.request(options, function (error, response, body) {
                //console.log(body);
                _this.checkAuthentication(_this.cookiejar._jar.toJSON().cookies).then(function (uamtk) { return uamtk; }, function (error) {
                    // 验证认证失败，重新认证
                    console.log(chalk(templateObject_1 || (templateObject_1 = __makeTemplateObject(["{yellow.bold \u9A8C\u8BC1\u8BA4\u8BC1\u5931\u8D25\uFF0C\u91CD\u65B0\u8BA4\u8BC1}"], ["{yellow.bold \u9A8C\u8BC1\u8BA4\u8BC1\u5931\u8D25\uFF0C\u91CD\u65B0\u8BA4\u8BC1}"]))));
                    return _this.captcha().then(function () { return _this.tryUserAuth(); }).then(function () { return _this.getNewAppToken(); }).then(function (newapptk) { return _this.tryGetAppToken(newapptk); });
                })
                    .then(function () { return _this.getMy12306(); })
                    .then(resolve, reject);
            });
        });
    };
    Account.prototype.captcha = function () {
        var _this = this;
        // Captcha
        var subjectCaptcha = new Rx.Subject();
        return new Promise(function (resolve, reject) {
            subjectCaptcha.subscribe(function (x) {
                _this.getCaptcha().then(function () { return _this.checkCaptcha(); })
                    .then(function () {
                    // 校验码成功后进行授权认证
                    console.log(chalk(templateObject_2 || (templateObject_2 = __makeTemplateObject(["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"], ["{green.bold \u9A8C\u8BC1\u7801\u6821\u9A8C\u6210\u529F}"]))));
                    resolve();
                }, function (error) {
                    // 校验失败，重新校验
                    console.log(chalk(templateObject_3 || (templateObject_3 = __makeTemplateObject(["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"], ["{yellow.bold \u6821\u9A8C\u5931\u8D25\uFF0C\u91CD\u65B0\u6821\u9A8C}"]))));
                    subjectCaptcha.next();
                });
            });
            subjectCaptcha.next();
        });
    };
    Account.prototype.tryUserAuth = function () {
        var _this = this;
        var subjectUserAuth = new Rx.Subject();
        return new Promise(function (resolve, reject) {
            subjectUserAuth.subscribe(function (x) {
                _this.userAuthenticate().then(function () { return resolve(); }, function (error) { return subjectUserAuth.next(); }).catch(function (error) { return console.error(error); });
            });
            subjectUserAuth.next();
        });
    };
    /**
     *
     */
    Account.prototype.tryGetAppToken = function (newapptk) {
        var _this = this;
        var subjectGetAppToken = new Rx.Subject();
        return new Promise(function (resolve, reject) {
            subjectGetAppToken.subscribe(function (newapptk) {
                _this.getAppToken(newapptk).then(function (x) {
                    resolve(x);
                }, function (error) {
                    console.log(chalk(templateObject_4 || (templateObject_4 = __makeTemplateObject(["{yellow.bold \u83B7\u53D6Token\u5931\u8D25\uFF0C", "}"], ["{yellow.bold \u83B7\u53D6Token\u5931\u8D25\uFF0C", "}"])), error));
                    setTimeout(function (x) { return subjectGetAppToken.next(newapptk); }, 1000);
                });
            });
            subjectGetAppToken.next(newapptk);
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
            rl.question(chalk(templateObject_5 || (templateObject_5 = __makeTemplateObject(["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"], ["{red.bold \u8BF7\u8F93\u5165\u9A8C\u8BC1\u7801}:"]))), function (positions) {
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
        var _this = this;
        var uamtk = "", tk = "";
        for (var i = 0; i < cookies.length; i++) {
            if (cookies[i].key == "uamtk") {
                uamtk = cookies[i].value;
            }
            if (cookies[i].key == "tk") {
                tk = cookies[i].value;
            }
        }
        if (tk) {
            return this.tryGetAppToken(tk);
        }
        else if (uamtk) {
            return this.getNewAppToken().then(function (newapptk) { return _this.tryGetAppToken(newapptk); });
        }
        return Promise.reject();
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
    return Account;
}());
exports.Account = Account;
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
