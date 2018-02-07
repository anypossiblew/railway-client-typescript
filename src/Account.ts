import {FileCookieStore} from './FileCookieStore';
import request = require('request');
import querystring = require('querystring');
import fs = require('fs');
import readline = require('readline');
import process = require('process');
import Rx = require('@reactivex/rxjs');
import chalk = require('chalk');

export class Account {
  public userName : string;
  public userPassword : string;
  private request: request.RequestAPI<any, any, any>;
  private cookiejar: any;
  public headers: object = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    ,"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17"
    ,"Host": "kyfw.12306.cn"
    ,"Origin": "https://kyfw.12306.cn"
    ,"Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/"
  };

  constructor(name: string, userPassword: string) {
    this.userName = name;
    this.userPassword = userPassword;

    this.setRequest();
  }

  public setRequest() {
    var fileStore = new FileCookieStore("./cookies/"+this.userName+".json", {encrypt: false});
    fileStore.option = {encrypt: false};

    this.cookiejar = request.jar(fileStore);

    this.request = request.defaults({jar: this.cookiejar});
  }

  public login(): Promise {
    var url = "https://kyfw.12306.cn/otn/login/init";
    var options = {
      url: url,
      method: "GET",
      headers: this.headers
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body) => {
        //console.log(body);
        this.checkAuthentication(this.cookiejar._jar.toJSON().cookies).then(uamtk=> uamtk, error=> {
            // 验证认证失败，重新认证
            console.log(chalk`{yellow.bold 验证认证失败，重新认证}`);
            return this.captcha().then(()=>this.tryUserAuth()).then(()=>this.getNewAppToken()).then((newapptk)=>this.tryGetAppToken(newapptk));
          })
          .then(()=>this.getMy12306())
          .then(resolve, reject);
      });
    });
  }

  private captcha(): Promise {
    // Captcha
    let subjectCaptcha = new Rx.Subject();

    return new Promise((resolve, reject)=> {
      subjectCaptcha.subscribe(x=> {
        this.getCaptcha().then(()=> this.checkCaptcha())
          .then(()=> {
            // 校验码成功后进行授权认证
            console.log(chalk`{green.bold 验证码校验成功}`);
            resolve();
          }, error=> {
            // 校验失败，重新校验
            console.log(chalk`{yellow.bold 校验失败，重新校验}`);
            subjectCaptcha.next();
          });
      });

      subjectCaptcha.next();
    });
  }

  private tryUserAuth(): Promise {
    let subjectUserAuth = new Rx.Subject();
    return new Promise((resolve, reject)=> {
      subjectUserAuth.subscribe(x=> {
        this.userAuthenticate().then(()=>resolve(), error=>subjectUserAuth.next()).catch(error=>console.error(error));
      })
      subjectUserAuth.next();
    });
  }

  /**
   *
   */
  private tryGetAppToken(newapptk: string): Promise {
    var subjectGetAppToken = new Rx.Subject();

    return new Promise((resolve, reject) => {
      subjectGetAppToken.subscribe(newapptk => {
        this.getAppToken(newapptk).then(x => {
          resolve(x);
        }, error=> {
          console.log(chalk`{yellow.bold 获取Token失败，${error}}`);
          setTimeout(x=> subjectGetAppToken.next(newapptk), 1000);
        });
      });

      subjectGetAppToken.next(newapptk);
    });
  }

  private getCaptcha(): Promise {

    var data = {
          "login_site": "E",
          "module": "login",
          "rand": "sjrand",
          "0.17231872703389062":""
      };

    var param = querystring.stringify(data, null, null)
    var url = "https://kyfw.12306.cn/passport/captcha/captcha-image?"+param;
    var options = {
      url: url
      ,headers: this.headers
    };

    return new Promise((resolve, reject) => {
      this.request(options, (error, response, body) => {
        if(error) {
          console.error(error);
          reject(error);
        }
      }).pipe(fs.createWriteStream("captcha.BMP")).on('close', function(){
        resolve();
      });
    });

  }

  private checkCaptcha(): Promise {
    var url = "https://kyfw.12306.cn/passport/captcha/captcha-check";

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve, reject) => {
      rl.question(chalk`{red.bold 请输入验证码}:`, (positions) => {
        rl.close();

        var data = {
            "answer": positions,
            "login_site": "E",
            "rand": "sjrand"
          };

        var options = {
          url: url
          ,headers: this.headers
          ,method: 'POST'
          ,form: data
        };

        this.request(options, (error, response, body) => {
          if(error) {
            console.error(error);
          }
          if(response.statusCode === 200) {
            body = JSON.parse(body);
            console.log(body.result_message);
            if(body.result_code == 4) {
              resolve();
            }
            reject();
          }else {
            console.log('error: '+ response.statusCode);
            console.log(response.text);
            reject();
          }
        });
      });
    });
  }

  private userAuthenticate(): Promise {
    // 发送登录信息
    var data = {
          "appid": "otn"
          ,"username": this.userName
          ,"password": this.userPassword
        };

    var url = "https://kyfw.12306.cn/passport/web/login";

    var options = {
      url: url
      ,headers: this.headers
      ,method: 'POST'
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) return reject(error);

        if(response.statusCode === 200) {
          console.log(body);
          body = JSON.parse(body);
          console.log(body.result_message);
          if(body.result_code == 2) {
            throw body.result_message;
          }else if(body.result_code != 0) {
            reject(body);
          }else {
            resolve(body.uamtk);
          }
        }else {
          reject(response);
        }
      });
    });
  }

  private getNewAppToken(): Promise {
    var data = {
          "appid": "otn"
      };

    var options ={
      url: "https://kyfw.12306.cn/passport/web/auth/uamtk"
      ,headers: this.headers
      ,method: 'POST'
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          // console.log(body);
          body = JSON.parse(body);
          console.log(body.result_message);
          if(body.result_code == 0) {
            resolve(body.newapptk);
          }else {
            reject(body);
          }
        }else {
          reject(response)
        }
      });
    });
  }

  private getMy12306(): Promise {
    return new Promise((resolve, reject)=> {
      this.request({
        url: "https://kyfw.12306.cn/otn/index/initMy12306"
       ,headers: this.headers
       ,method: "GET"},
       (error, response, body)=> {
        if(response.statusCode === 200) {
          console.log("Got my 12306");
          return resolve();
        }
        reject();
      });
    });
  }

  private checkAuthentication(cookies: object) {
    var uamtk = "", tk = "";
    for(var i = 0; i < cookies.length; i++) {
      if(cookies[i].key == "uamtk") {
        uamtk = cookies[i].value;
      }

      if(cookies[i].key == "tk") {
        tk = cookies[i].value;
      }
    }

    if(tk) {
      return this.tryGetAppToken(tk);
    }else if(uamtk) {
      return this.getNewAppToken().then((newapptk)=>this.tryGetAppToken(newapptk));
    }
    return Promise.reject();
  }

  /**
   *
   */
  private getAppToken(newapptk: string) {
    var data = {
          "tk": newapptk
      };
    var options = {
      url: "https://kyfw.12306.cn/otn/uamauthclient"
      ,headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.17 (KHTML, like Gecko) Chrome/24.0.1312.60 Safari/537.17"
        ,"Host": "kyfw.12306.cn"
        ,"Referer": "https://kyfw.12306.cn/otn/passport?redirect=/otn/"
        ,'content-type': 'application/x-www-form-urlencoded'
      }
      ,method: 'POST'
      ,form: data
    };

    return new Promise((resolve, reject)=> {
      this.request(options, (error, response, body)=> {
        if(error) throw error;

        if(response.statusCode === 200) {
          // console.log(body);
          body = JSON.parse(body);
          console.log(body.result_message);
          if(body.result_code == 0) {
            resolve(body.apptk);
          }else {
            reject(body);
          }
        }else {
          reject(response.statusCode)
        }
      });
    });
  }

}
