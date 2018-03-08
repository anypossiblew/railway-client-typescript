"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var yaml = require("js-yaml");
var spawn = require('child_process').spawn;
var winston = require("winston");
var Observable_1 = require("rxjs/Observable");
var Subject_1 = require("rxjs/Subject");
require("rxjs/add/observable/forkJoin");
var Account_1 = require("./Account");
var Manager = /** @class */ (function () {
    function Manager(path) {
        var _this = this;
        this.captchLock = new Subject_1.Subject();
        this.captchLockRelease = new Subject_1.Subject();
        try {
            var application = yaml.safeLoad(fs.readFileSync(path, 'utf8'));
            // console.info(JSON.stringify(application));
            this.accountConfigs = application.accounts;
        }
        catch (e) {
            winston.error(e);
        }
        this.captchLock.zip(this.captchLockRelease)
            .subscribe(function (_a) {
            var observer = _a[0], answer = _a[1];
            winston.debug('captcha locking');
            observer.next();
            observer.complete();
        });
        this.releaseCaptchaLock();
        this.accounts =
            this.accountConfigs.map(function (accountInfo) {
                var account = new Account_1.Account(accountInfo.username, accountInfo.password, _this);
                if (!_this.defaultAccount) {
                    _this.defaultAccount = account;
                }
                accountInfo.orders.forEach(function (order) {
                    account.createOrder(order.trainDates.split(' ') //发车日期
                    , order.backTrainDate.toJSON().slice(0, 10) //返程日期
                    , order.stationNames.split(' ') //出发,经过站,到达站
                    , order.trains.split(' ') //车次
                    , order.pepoles.split(' ') //乘车人姓名 ["张三", "李四"]
                    , order.seatTypes.split(' ') // 座位等级
                    );
                });
                return account;
            });
    }
    Manager.prototype.getCaptchaLock = function () {
        var _this = this;
        return Observable_1.Observable.create(function (observer) {
            _this.captchLock.next(observer);
        });
    };
    Manager.prototype.releaseCaptchaLock = function () {
        this.captchLockRelease.next('released');
    };
    Manager.prototype.start = function () {
        var _this = this;
        Observable_1.Observable.forkJoin(this.accounts.map(function (account) {
            return _this.getCaptchaLock()
                .do(function () { return winston.debug('got captcha lock'); })
                .mergeMap(function () { return account.observableLoginInit(); })
                .do(function () { return _this.releaseCaptchaLock(); });
        }))
            .subscribe(function () {
            _this.accounts.forEach(function (account) {
                winston.debug("account " + account.userName + " submit");
                var ls = spawn(process.argv[0], ['dist/index.js', '-a', account.userName], { shell: true, detached: true, encoding: "gbk" });
                // account.submit();
            });
        }, function (err) { return console.log(err); });
    };
    Manager.prototype.getAccount = function (userName) {
        if (Number(userName) > 0) {
            return this.accounts[Number(userName) - 1];
        }
        else {
            return this.accounts.find(function (account) {
                return account.userName == userName;
            });
        }
    };
    return Manager;
}());
exports.Manager = Manager;

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFBLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEIsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFBQSxJQUFJLENBQUMsQ0FBQztZQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFBLE9BQU87Z0JBQzdCLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQztZQUN0QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7SUFDSCxDQUFDO0lBQ0gsY0FBQztBQUFELENBaEZBLEFBZ0ZDLElBQUE7QUFoRlksMEJBQU8iLCJmaWxlIjoic3JjL01hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xyXG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcclxuaW1wb3J0IHlhbWwgPSByZXF1aXJlKCdqcy15YW1sJyk7XHJcbmNvbnN0IHsgc3Bhd24gfSA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcclxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XHJcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzL09ic2VydmFibGUnO1xyXG5pbXBvcnQgeyBPYnNlcnZlciB9IGZyb20gJ3J4anMvT2JzZXJ2ZXInO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSAncnhqcy9TdWJqZWN0JztcclxuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2ZvcmtKb2luJztcclxuXHJcbmltcG9ydCB7IEFjY291bnQgfSBmcm9tICcuL0FjY291bnQnO1xyXG5cclxuXHJcbmV4cG9ydCBjbGFzcyBNYW5hZ2VyIHtcclxuICBwcml2YXRlIGFjY291bnRDb25maWdzOiBhbnk7XHJcbiAgcHVibGljIGRlZmF1bHRBY2NvdW50PzogQWNjb3VudDtcclxuICBwdWJsaWMgYWNjb3VudHM6IEFycmF5PEFjY291bnQ+O1xyXG4gIHByaXZhdGUgY2FwdGNoTG9jazogU3ViamVjdDx2b2lkPiA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XHJcbiAgcHJpdmF0ZSBjYXB0Y2hMb2NrUmVsZWFzZTogU3ViamVjdDxzdHJpbmc+ID0gbmV3IFN1YmplY3Q8c3RyaW5nPigpO1xyXG5cclxuICBjb25zdHJ1Y3RvcihwYXRoOiBzdHJpbmcpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIHZhciBhcHBsaWNhdGlvbiA9IHlhbWwuc2FmZUxvYWQoZnMucmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4JykpO1xyXG4gICAgICAvLyBjb25zb2xlLmluZm8oSlNPTi5zdHJpbmdpZnkoYXBwbGljYXRpb24pKTtcclxuICAgICAgdGhpcy5hY2NvdW50Q29uZmlncyA9IGFwcGxpY2F0aW9uLmFjY291bnRzO1xyXG4gICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICB3aW5zdG9uLmVycm9yKGUpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMuY2FwdGNoTG9jay56aXAodGhpcy5jYXB0Y2hMb2NrUmVsZWFzZSlcclxuICAgICAgLnN1YnNjcmliZSgoW29ic2VydmVyLCBhbnN3ZXJdKT0+IHtcclxuICAgICAgICB3aW5zdG9uLmRlYnVnKCdjYXB0Y2hhIGxvY2tpbmcnKTtcclxuICAgICAgICBvYnNlcnZlci5uZXh0KCk7XHJcbiAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcclxuICAgICAgfSk7XHJcbiAgICB0aGlzLnJlbGVhc2VDYXB0Y2hhTG9jaygpO1xyXG5cclxuICAgIHRoaXMuYWNjb3VudHMgPVxyXG4gICAgICB0aGlzLmFjY291bnRDb25maWdzLm1hcChhY2NvdW50SW5mbyA9PiB7XHJcbiAgICAgICAgdmFyIGFjY291bnQgPSBuZXcgQWNjb3VudChhY2NvdW50SW5mby51c2VybmFtZSwgYWNjb3VudEluZm8ucGFzc3dvcmQsIHRoaXMpO1xyXG4gICAgICAgIGlmKCF0aGlzLmRlZmF1bHRBY2NvdW50KSB7XHJcbiAgICAgICAgICB0aGlzLmRlZmF1bHRBY2NvdW50ID0gYWNjb3VudDtcclxuICAgICAgICB9XHJcbiAgICAgICAgYWNjb3VudEluZm8ub3JkZXJzLmZvckVhY2gob3JkZXIgPT4ge1xyXG4gICAgICAgICAgYWNjb3VudC5jcmVhdGVPcmRlcihvcmRlci50cmFpbkRhdGVzLnNwbGl0KCcgJykgLy/lj5Hovabml6XmnJ9cclxuICAgICAgICAgICAgICAgICAgICAgICAsb3JkZXIuYmFja1RyYWluRGF0ZS50b0pTT04oKS5zbGljZSgwLDEwKSAvL+i/lOeoi+aXpeacn1xyXG4gICAgICAgICAgICAgICAgICAgICAgICxvcmRlci5zdGF0aW9uTmFtZS5zcGxpdCgnICcpIC8v5Ye65Y+RLOe7j+i/h+ermSzliLDovr7nq5lcclxuICAgICAgICAgICAgICAgICAgICAgICAsb3JkZXIudHJhaW5zLnNwbGl0KCcgJykgLy/ovabmrKFcclxuICAgICAgICAgICAgICAgICAgICAgICAsb3JkZXIucGVwb2xlcy5zcGxpdCgnICcpIC8v5LmY6L2m5Lq65aeT5ZCNIFtcIuW8oOS4iVwiLCBcIuadjuWbm1wiXVxyXG4gICAgICAgICAgICAgICAgICAgICAgICxvcmRlci5zZWF0VHlwZXMuc3BsaXQoJyAnKSAvLyDluqfkvY3nrYnnuqdcclxuICAgICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gYWNjb3VudDtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIGdldENhcHRjaGFMb2NrKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XHJcbiAgICByZXR1cm4gT2JzZXJ2YWJsZS5jcmVhdGUoKG9ic2VydmVyOiBPYnNlcnZlcjxzdHJpbmc+KSA9PiB7XHJcbiAgICAgIHRoaXMuY2FwdGNoTG9jay5uZXh0KG9ic2VydmVyKTtcclxuICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcHVibGljIHJlbGVhc2VDYXB0Y2hhTG9jaygpOiB2b2lkIHtcclxuICAgIHRoaXMuY2FwdGNoTG9ja1JlbGVhc2UubmV4dCgncmVsZWFzZWQnKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGFydCgpIHtcclxuXHJcbiAgICBPYnNlcnZhYmxlLmZvcmtKb2luKHRoaXMuYWNjb3VudHMubWFwKGFjY291bnQ9PlxyXG4gICAgICAgIHRoaXMuZ2V0Q2FwdGNoYUxvY2soKVxyXG4gICAgICAgICAgLmRvKCgpPT53aW5zdG9uLmRlYnVnKCdnb3QgY2FwdGNoYSBsb2NrJykpXHJcbiAgICAgICAgICAubWVyZ2VNYXAoKCk9PmFjY291bnQub2JzZXJ2YWJsZUxvZ2luSW5pdCgpKVxyXG4gICAgICAgICAgLmRvKCgpPT50aGlzLnJlbGVhc2VDYXB0Y2hhTG9jaygpKVxyXG4gICAgICApXHJcbiAgICApXHJcbiAgICAuc3Vic2NyaWJlKCgpPT4ge1xyXG4gICAgICB0aGlzLmFjY291bnRzLmZvckVhY2goYWNjb3VudCA9PiB7XHJcbiAgICAgICAgd2luc3Rvbi5kZWJ1ZyhgYWNjb3VudCAke2FjY291bnQudXNlck5hbWV9IHN1Ym1pdGApO1xyXG4gICAgICAgIGNvbnN0IGxzID0gc3Bhd24ocHJvY2Vzcy5hcmd2WzBdLCBbJ2Rpc3QvaW5kZXguanMnLCAnLWEnLCBhY2NvdW50LnVzZXJOYW1lXSwge3NoZWxsOiB0cnVlLCBkZXRhY2hlZDogdHJ1ZSwgZW5jb2Rpbmc6IFwiZ2JrXCJ9KTtcclxuICAgICAgICAvLyBhY2NvdW50LnN1Ym1pdCgpO1xyXG4gICAgICB9KTtcclxuICAgIH0sZXJyPT5jb25zb2xlLmxvZyhlcnIpKTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXRBY2NvdW50KHVzZXJOYW1lOiBzdHJpbmcpIHtcclxuICAgIGlmKE51bWJlcih1c2VyTmFtZSkgPiAwKSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmFjY291bnRzW051bWJlcih1c2VyTmFtZSktMV07XHJcbiAgICB9ZWxzZSB7XHJcbiAgICAgIHJldHVybiB0aGlzLmFjY291bnRzLmZpbmQoYWNjb3VudD0+IHtcclxuICAgICAgICAgIHJldHVybiBhY2NvdW50LnVzZXJOYW1lID09IHVzZXJOYW1lO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=
