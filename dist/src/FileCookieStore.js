"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var crypto = require("crypto");
var tough = require("tough-cookie");
var FileCookieStore = /** @class */ (function (_super) {
    __extends(FileCookieStore, _super);
    function FileCookieStore(filePath, option) {
        var _this = _super.call(this) || this;
        _this.idx = {}; // idx is memory cache
        _this.filePath = filePath;
        option = option || {};
        option.encrypt = !(option.encrypt === false);
        if (option.encrypt) {
            option.algorithm = option.algorithm || 'aes-256-cbc';
            option.password = option.password || 'tough-cookie-store';
        }
        var self = _this;
        _this.loadFromFile(_this.filePath, option, function (dataJson) {
            if (dataJson)
                self.idx = dataJson;
        });
        return _this;
    }
    FileCookieStore.prototype.putCookie = function (cookie, cb) {
        if (!this.idx[cookie.domain]) {
            this.idx[cookie.domain] = {};
        }
        if (!this.idx[cookie.domain][cookie.path]) {
            this.idx[cookie.domain][cookie.path] = {};
        }
        this.idx[cookie.domain][cookie.path][cookie.key] = cookie;
        this.saveToFile(this.filePath, this.idx, this.option, function () {
            cb(null);
        });
    };
    FileCookieStore.prototype.removeCookie = function (domain, path, key, cb) {
        if (this.idx[domain] && this.idx[domain][path] && this.idx[domain][path][key]) {
            delete this.idx[domain][path][key];
        }
        this.saveToFile(this.filePath, this.idx, this.option, function () {
            cb(null);
        });
    };
    FileCookieStore.prototype.removeCookies = function (domain, path, cb) {
        if (this.idx[domain]) {
            if (path) {
                delete this.idx[domain][path];
            }
            else {
                delete this.idx[domain];
            }
        }
        this.saveToFile(this.filePath, this.idx, this.option, function () {
            return cb(null);
        });
    };
    FileCookieStore.prototype.getCookie = function (domain, path, key) {
        if (!this.idx[domain]) {
            return undefined;
        }
        if (!this.idx[domain][path]) {
            return undefined;
        }
        return this.idx[domain][path][key];
    };
    FileCookieStore.prototype.flush = function () {
        this.saveToFile(this.filePath, this.idx, this.option);
    };
    ;
    FileCookieStore.prototype.isEmpty = function () {
        return this.isEmptyObject(this.idx);
    };
    FileCookieStore.prototype.isEmptyObject = function (obj) {
        for (var key in obj) {
            if (hasOwnProperty.call(obj, key)) {
                return false;
            }
        }
        return true;
    };
    FileCookieStore.prototype.saveToFile = function (filePath, data, option, cb) {
        var dataJson = JSON.stringify(data);
        if (option.encrypt) {
            var cipher = crypto.createCipher(option.algorithm, option.password);
            dataJson = cipher.update(dataJson, 'utf8', 'hex');
            dataJson += cipher.final('hex');
        }
        fs.writeFileSync(filePath, dataJson);
        if (typeof cb === 'function')
            cb();
    };
    FileCookieStore.prototype.loadFromFile = function (filePath, option, cb) {
        var data = fs.readFileSync(filePath, { encoding: 'utf8', flag: 'a+' });
        if (option.encrypt && data) {
            var decipher = crypto.createDecipher(option.algorithm, option.password);
            data = decipher.update(data, 'hex', 'utf8');
            data += decipher.final('utf8');
        }
        var dataJson = data ? JSON.parse(data) : null;
        for (var domainName in dataJson) {
            for (var pathName in dataJson[domainName]) {
                for (var cookieName in dataJson[domainName][pathName]) {
                    dataJson[domainName][pathName][cookieName] = tough.fromJSON(JSON.stringify(dataJson[domainName][pathName][cookieName]));
                }
            }
        }
        cb(dataJson);
    };
    return FileCookieStore;
}(tough.MemoryCookieStore));
exports.FileCookieStore = FileCookieStore;
