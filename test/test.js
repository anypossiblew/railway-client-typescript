// const request = require('request');
var chalk = require("chalk");
//
// function getAccount(id) {
//   return new Promise((resolve, reject)=> {
//     if(id === 1) {
//       resolve("account 1");
//     }else if(id === 2) {
//       reject("no account");
//     }else {
//       request("http://www.google.com", (error, response, body)=> {
//         reject(error);
//         // console.log(body);
//       })
//       // throw new Error("error account");
//     }
//   });
// }
//
// var i = 0;
//
// setInterval(function(){
//     process.stdout.write(chalk`{yellow.bold .}`);
//     if(i === 20) {
//       process.stdout.clearLine();
//       process.stdout.cursorTo(0);
//       i = 0;
//     }
//     i++;
// },500);
//
//
//
//
// getAccount(2).then(x=> {
//   process.stdout.write(x);
// }, error=>process.stdout.write(error));
// getAccount(2).then(x=> {
//   console.log(x);
// }).catch(error=>process.stdout.write(error));
//
// getAccount(3).then(x=> {
//   console.log(typeof x);
// }, error=>{
//   // error = {a: "b"};
//   console.error(error.toString());
//   return Promise.reject("xxxxx");
// })
// .then(x=> {
//
// }, error=> {
//   console.log(error)
// });
// getAccount(3).then(x=> {
//   console.log(x);
// }).catch(error=> console.error(error));
//
// getAccount(1).then(x=> {
//   console.log(x);
// });
//

const Rx = require("@reactivex/rxjs");

// const sj1 = new Rx.Subject();
// const sj2 = new Rx.Subject();
// const sj3 = new Rx.Subject();
// const sj4 = new Rx.Subject();
//
// function dataFlow(subject, sj2) {
//   let sj1 = new Rx.Subject();
//   subject.subscribe(sj1)
//   sj1.map(x=>x+" world")
//     .subscribe((x)=>sj2.next(x));
//   return sj2.map(x=>"==>"+x);
// }
//
// dataFlow(sj1, sj3).subscribe(val=>console.log("sj1: "+val));
// dataFlow(sj2, sj4).subscribe(val=>console.log("sj2: "+val));
//
// sj1.next('hi');
// sj2.next('hello');
// sj3.next('H W')
// sj3.next('H Wo')

// const sj1 = new Rx.ReplaySubject();
//
// sj1.mergeMap(()=>new Promise((resolve, reject)=>{
//   console.log('step 1');
//   reject();
// }))
// .retry(2)
// .mergeMap(()=>new Promise((resolve, reject)=>{
//   console.log('step 2');
//   reject();
// }))
// .retry(5)
// .subscribe(()=>console.log('done'));
//
// sj1.next();



// const sj1 = new Rx.ReplaySubject();
//
// sj1
// // .do((i)=> {
// //   throw 'error'+i
// // })
// .mergeMap(()=>new Promise((resolve, reject)=>{
//   console.log('step 1');
//   // reject('step1 error');
//   resolve('step1 resolve')
// }))
// // .retry(1)
// .retryWhen((errors)=>errors.delay(2000)) //Rx.Observable.of([1,2]).delay(3000))
// .mergeMap(()=>new Promise((resolve, reject)=>{
//   console.log('step 2');
//   reject('step2 error');
// }))
// .retry(2)
// .subscribe(()=>console.log('done'),err=>console.error(err));
//
// sj1.next(1);
// sj1.next(2);

// promise reject 不会终止 subject
// throw error 会终止 subject
// 两种都会被 error function 捕捉到

// Rx.Observable.timer(0, 2000)
//   .subscribe((t)=> {
//     console.log(t);
//   })

// var beeper = require('beeper');
//
// beeper(60*30*2);




// var winston = require('winston');
// winston.level = 'debug';
//
// winston.error('error');
// var order ={};
// process.stdout.write(chalk`没有可购买余票 {yellow ${order.fromStationName}} 到 {yellow ${order.toStationName}} ${order.passStationName?'到'+order.passStationName+' ':''}{yellow ${order.trainDate}}`);
// setTimeout(()=>{
//   process.stdout.clearLine();
//   process.stdout.cursorTo(0);
//   process.stdout.write(chalk`没有可购买余票 {yellow ${order.fromStationName}} 到 {yellow ${order.toStationName}}`);
// },2000)

// console.log('abc');
// process.stdout.clearLine();
// process.stdout.cursorTo(0);
// process.stdout.write('123');
// process.stdout.clearLine();
// process.stdout.cursorTo(0);


var exec = require('child_process').exec,
    child;

child = exec('captcha.BMP',
  function (error, stdout, stderr) {
    console.log('Image opened');
    if (error !== null) {
      console.log('exec error: ' + error);
    }
});
