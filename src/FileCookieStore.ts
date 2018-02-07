import util = require('util');
import fs = require('fs');
import crypto = require('crypto');
import tough = require('tough-cookie');

export class FileCookieStore extends tough.MemoryCookieStore {
  public idx: object;
  public filePath: string;

  constructor(filePath: string, option: {encrypt: boolean, algorithm: string, password: string}) {
    super();

    this.idx = {}; // idx is memory cache
    this.filePath = filePath;
    option = option || {};
    option.encrypt = !(option.encrypt === false);
    if (option.encrypt) {
        option.algorithm = option.algorithm || 'aes-256-cbc';
        option.password = option.password || 'tough-cookie-store';
    }
    var self = this;
    this.loadFromFile(this.filePath, option, function (dataJson: any) {
        if (dataJson)
            self.idx = dataJson;
    });
  }

  public putCookie(cookie: tough.Cookie, cb: object): void {
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
  }

  public removeCookie(domain, path, key, cb): void {
      if (this.idx[domain] && this.idx[domain][path] && this.idx[domain][path][key]) {
          delete this.idx[domain][path][key];
      }
      this.saveToFile(this.filePath, this.idx, this.option, function () {
          cb(null);
      });
  }

  public removeCookies(domain, path, cb) {
      if (this.idx[domain]) {
          if (path) {
              delete this.idx[domain][path];
          } else {
              delete this.idx[domain];
          }
      }
      this.saveToFile(this.filePath, this.idx, this.option, function () {
          return cb(null);
      });
  }

  public getCookie(domain, path, key) {
      if (!this.idx[domain]) {
          return undefined;
      }
      if (!this.idx[domain][path]) {
          return undefined;
      }
      return this.idx[domain][path][key];
  }

  public flush() {
      this.saveToFile(this.filePath, this.idx, this.option);
  };

  public isEmpty() {
      return this.isEmptyObject(this.idx);
  }

  private isEmptyObject(obj) {
      for (var key in obj) {
          if (hasOwnProperty.call(obj, key)) {
              return false;
          }
      }
      return true;
  }

  private saveToFile(filePath, data, option, cb): void {
      var dataJson = JSON.stringify(data);
      if (option.encrypt) {
          var cipher = crypto.createCipher(option.algorithm, option.password);
          dataJson = cipher.update(dataJson, 'utf8', 'hex');
          dataJson += cipher.final('hex');
      }
      fs.writeFileSync(filePath, dataJson);
      if (typeof cb === 'function') cb();
  }

  private loadFromFile(filePath: string, option: object, cb: object): void {
      var data = fs.readFileSync(filePath, {encoding: 'utf8', flag: 'a+'});
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
  }
}
