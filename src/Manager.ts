import fs = require('fs');
import path = require('path');
import yaml = require('js-yaml');
const { spawn } = require('child_process');
import winston = require('winston');
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import { Subject } from 'rxjs/Subject';
import 'rxjs/add/observable/forkJoin';

import { Account } from './Account';



export class Manager {
  private accountConfigs: any;

  public defaultAccount?: Account;
  public accounts: Array<Account>;
  private captchLock: Subject<void> = new Subject<void>();
  private captchLockRelease: Subject<string> = new Subject<string>();

  constructor(path: string) {
    try {
      var application = yaml.safeLoad(fs.readFileSync(path, 'utf8'));
      console.info(JSON.stringify(application));
      this.accountConfigs = application.accounts;
    } catch (e) {
      winston.error(e);
    }

    this.captchLock.zip(this.captchLockRelease)
      .subscribe(([observer, answer])=> {
        winston.debug('captcha locking');
        observer.next();
        observer.complete();
      });
    this.releaseCaptchaLock();

    this.accounts =
      this.accountConfigs.map(accountInfo => {
        var account = new Account(accountInfo.username, accountInfo.password, this, {performance: application.performance});
        if(!this.defaultAccount) {
          this.defaultAccount = account;
        }
        accountInfo.orders.forEach(order => {
          account.createOrder(order.trainDates.split(' ') //发车日期
                       ,order.backTrainDate.toJSON().slice(0,10) //返程日期
                       ,order.stationNames.split(' ') //出发,经过站,到达站
                       ,order.trains.split(' ') //车次
                       ,order.pepoles.split(' ') //乘车人姓名 ["张三", "李四"]
                       ,order.seatTypes.split(' ') // 座位等级
                     );
        });
        return account;
    });
  }

  public getCaptchaLock(): Observable<string> {
    return Observable.create((observer: Observer<string>) => {
      this.captchLock.next(observer);
    });
  }

  public releaseCaptchaLock(): void {
    this.captchLockRelease.next('released');
  }

  public start() {

    Observable.forkJoin(this.accounts.map(account=>
        this.getCaptchaLock()
          .do(()=>winston.debug('got captcha lock'))
          .mergeMap(()=>account.observableLoginInit())
          .do(()=>this.releaseCaptchaLock())
      )
    )
    .subscribe(()=> {
      this.accounts.forEach(account => {
        winston.debug(`account ${account.userName} submit`);
        const ls = spawn(process.argv[0], ['dist/index.js', '-a', account.userName], {shell: true, detached: true, encoding: "gbk"});
        // account.submit();
      });
    },err=>console.log(err));
  }

  public getAccount(userName: string) {
    if(Number(userName) > 0) {
      return this.accounts[Number(userName)-1];
    }else {
      return this.accounts.find(account=> {
          return account.userName == userName;
        });
    }
  }
}
