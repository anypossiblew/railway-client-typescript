import fs = require('fs');
import path = require('path');
import yaml = require('js-yaml');
import winston = require('winston');

import { Account } from './Account';


export class Manager {
  public accounts: any;
  constructor(path: string) {
    try {
      var application = yaml.safeLoad(fs.readFileSync(path, 'utf8'));
      console.info(JSON.stringify(application));
      this.accounts = application.accounts;
    } catch (e) {
      winston.error(e);
    }
  }

  public start() {
    this.accounts.forEach(accountInfo => {
      var account = new Account(accountInfo.username, accountInfo.password);
      accountInfo.orders.forEach(order => {
        account.createOrder(order.trainDate //发车日期
                     ,order.backTrainDate //返程日期
                     ,[order.fromStationName, order.toStationName] //出发,经过站,到达站
                     ,order.trains //车次
                     ,order.planPepoles //乘车人姓名 ["张三", "李四"]
                     ,order.seatTypes // 座位等级
                   );
      });
      
      account.submit();
    });
  }
}
