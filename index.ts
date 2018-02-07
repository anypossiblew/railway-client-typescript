// import readline = require("readline");
import {Account} from './src/Account';

new Account("anypossiblew", "String0int").login().then(x=>console.log(x), error=>console.error(error));
