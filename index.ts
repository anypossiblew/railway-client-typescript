
import {Account} from './src/Account';
import winston = require('winston');
import parseArgs = require('minimist');
const argv = parseArgs(process.argv.slice(2));

winston.level = 'info';

var account = new Account("XXXXXXXXXX", "***********") //账号信息
  .createOrder(["2018-02-26", "2018-02-27"] //发车日期
               ,"2018-02-25" //返程日期
               ,["徐州", "上海"] //出发,经过站,到达站
               ,["G129", "G1817", "G1227", "G1821", "G135", "G1825", "G137", "G1865", "G1251", "G1923", "G7295", "G43", "G141", "G1213", "G215", "G9471", "G145", "G225", "G1203", "G1969", "G1951", "G21", "G1935"] //车次
               ,["张三"] //乘车人姓名 ["张三", "李四"]
               ,["二等座"] // 座位等级
             )
  .createOrder(["2018-02-26"] //发车日期
               ,"2018-02-25" //返程日期
               ,["徐州", "宿州", "上海"] //出发到达站
               ,["G1804" ,"G370" ,"G1808" ,"G1914" ,"G1926" ,"G1972" ,"G1954"] //车次
               ,["张三"] //乘车人姓名 ["张三", "李四"]
               ,["二等座", "一等座"])
               ;

if(process.argv.length === 2) {
  account.submit();
}else {
  account[argv._[0]].call(account, argv._.splice(1), argv);
}
