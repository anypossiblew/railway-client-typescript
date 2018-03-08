
import { Account } from './src/Account';
import { Manager } from './src/Manager';
import winston = require('winston');
import parseArgs = require('minimist');
const argv = parseArgs(process.argv.slice(2));

winston.level = 'info';

let manager = new Manager('./application.yml');

if(process.argv.length === 2) {
  manager.start();
}else {
  let account = manager.getAccount(argv.a || argv.account) || manager.defaultAccount;
  if(argv._[0]) {
    account[argv._[0]].call(account, argv._.splice(1), argv);
  }else {
    account.submit();
  }
}
