// import readline = require("readline");
import * as process from 'process';
import * as readline from 'readline';
import * as jQuery from 'jquery';

console.log(typeof jQuery)

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Please type your name:', (username) => {
  rl.close();

  console.log("Welcome "+username+"!");
});
