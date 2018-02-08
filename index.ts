
import {Account} from './src/Account';

var account = new Account("XXXXXXXXXX", "***********") //账号信息
  .createOrder("2018-02-21", //发车日期
               "2018-02-25", //返程日期
               "徐州", "上海", //出发到达站
               ["G121" ,"G1915" ,"G459" ,"G127" ,"G1919" ,"G1955" ,"G129"], //车次
               ["张三"]); //乘车人姓名 ["张三", "李四"]

if(process.argv.length === 2) {
  account.submit();
}else if(process.argv.length === 3) {
  account[process.argv[2]]();
}
