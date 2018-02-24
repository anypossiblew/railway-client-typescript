
import {Account} from './src/Account';
import winston = require('winston');

winston.level = 'debug';

var account = new Account("XXXXXXXXXX", "***********") //账号信息
  .createOrder(["2018-02-24", "2018-02-25"] //发车日期
               ,"2018-02-25" //返程日期
               ,["徐州", "宿州", "上海"] //出发,经过站,到达站
               ,["G149"] //车次
               ,["张三"]
               ,["二等座", "一等座"]) //乘车人姓名 ["张三", "李四"]
  .createOrder(["2018-02-24"] //发车日期
               ,"2018-02-25" //返程日期
               ,["徐州"，"上海"] //出发到达站
               ,["G1804"
               ,"G370"
               ,"G1808"
               ,"G1914"
               ,"G1926"
               ,"G1972"
               ,"G1954"] //车次
               ,["张三"] //乘车人姓名 ["张三", "李四"]
               ,["二等座", "一等座"])
               ;

if(process.argv.length === 2) {
  account.submit();
}else {
  account[process.argv[2]].apply(account, process.argv.splice(3));
}
