"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// import readline = require("readline");
var Account_1 = require("./src/Account");
new Account_1.Account("anypossiblew", "String0int").login().then(function (x) { return console.log(x); }, function (error) { return console.error(error); });
