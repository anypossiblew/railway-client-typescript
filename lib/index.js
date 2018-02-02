"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
}
Object.defineProperty(exports, "__esModule", { value: true });
// import readline = require("readline");
var process = __importStar(require("process"));
var readline = __importStar(require("readline"));
var jQuery = __importStar(require("jquery"));
console.log(typeof jQuery);
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.question('Please type your name:', function (username) {
    rl.close();
    console.log("Welcome " + username + "!");
});
