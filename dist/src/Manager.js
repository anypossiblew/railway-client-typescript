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
            console.info(JSON.stringify(application));
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
                var account = new Account_1.Account(accountInfo.username, accountInfo.password, _this, { performance: application.performance });
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,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QUFHLENBQUMsR0FBRyxDQUFDLEVBQWhCLENBQWdCLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBRU0sNEJBQVUsR0FBakIsVUFBa0IsUUFBZ0I7UUFDaEMsRUFBRSxDQUFBLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEIsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFBQSxJQUFJLENBQUMsQ0FBQztZQUNMLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxVQUFBLE9BQU87Z0JBQzdCLE1BQU0sQ0FBQyxPQUFPLENBQUMsUUFBUSxJQUFJLFFBQVEsQ0FBQztZQUN0QyxDQUFDLENBQUMsQ0FBQztRQUNQLENBQUM7SUFDSCxDQUFDO0lBQ0gsY0FBQztBQUFELENBakZBLEFBaUZDLElBQUE7QUFqRlksMEJBQU8iLCJmaWxlIjoic3JjL01hbmFnZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgZnMgPSByZXF1aXJlKCdmcycpO1xyXG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcclxuaW1wb3J0IHlhbWwgPSByZXF1aXJlKCdqcy15YW1sJyk7XHJcbmNvbnN0IHsgc3Bhd24gfSA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcclxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XHJcbmltcG9ydCB7IE9ic2VydmFibGUgfSBmcm9tICdyeGpzL09ic2VydmFibGUnO1xyXG5pbXBvcnQgeyBPYnNlcnZlciB9IGZyb20gJ3J4anMvT2JzZXJ2ZXInO1xyXG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSAncnhqcy9TdWJqZWN0JztcclxuaW1wb3J0ICdyeGpzL2FkZC9vYnNlcnZhYmxlL2ZvcmtKb2luJztcclxuXHJcbmltcG9ydCB7IEFjY291bnQgfSBmcm9tICcuL0FjY291bnQnO1xyXG5cclxuXHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlciB7XHJcbiAgcHJpdmF0ZSBhY2NvdW50Q29uZmlnczogYW55O1xyXG5cclxuICBwdWJsaWMgZGVmYXVsdEFjY291bnQ/OiBBY2NvdW50O1xyXG4gIHB1YmxpYyBhY2NvdW50czogQXJyYXk8QWNjb3VudD47XHJcbiAgcHJpdmF0ZSBjYXB0Y2hMb2NrOiBTdWJqZWN0PHZvaWQ+ID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcclxuICBwcml2YXRlIGNhcHRjaExvY2tSZWxlYXNlOiBTdWJqZWN0PHN0cmluZz4gPSBuZXcgU3ViamVjdDxzdHJpbmc+KCk7XHJcblxyXG4gIGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZykge1xyXG4gICAgdHJ5IHtcclxuICAgICAgdmFyIGFwcGxpY2F0aW9uID0geWFtbC5zYWZlTG9hZChmcy5yZWFkRmlsZVN5bmMocGF0aCwgJ3V0ZjgnKSk7XHJcbiAgICAgIGNvbnNvbGUuaW5mbyhKU09OLnN0cmluZ2lmeShhcHBsaWNhdGlvbikpO1xyXG4gICAgICB0aGlzLmFjY291bnRDb25maWdzID0gYXBwbGljYXRpb24uYWNjb3VudHM7XHJcbiAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgIHdpbnN0b24uZXJyb3IoZSk7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5jYXB0Y2hMb2NrLnppcCh0aGlzLmNhcHRjaExvY2tSZWxlYXNlKVxyXG4gICAgICAuc3Vic2NyaWJlKChbb2JzZXJ2ZXIsIGFuc3dlcl0pPT4ge1xyXG4gICAgICAgIHdpbnN0b24uZGVidWcoJ2NhcHRjaGEgbG9ja2luZycpO1xyXG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcclxuICAgICAgICBvYnNlcnZlci5jb21wbGV0ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIHRoaXMucmVsZWFzZUNhcHRjaGFMb2NrKCk7XHJcblxyXG4gICAgdGhpcy5hY2NvdW50cyA9XHJcbiAgICAgIHRoaXMuYWNjb3VudENvbmZpZ3MubWFwKGFjY291bnRJbmZvID0+IHtcclxuICAgICAgICB2YXIgYWNjb3VudCA9IG5ldyBBY2NvdW50KGFjY291bnRJbmZvLnVzZXJuYW1lLCBhY2NvdW50SW5mby5wYXNzd29yZCwgdGhpcywge3BlcmZvcm1hbmNlOiBhcHBsaWNhdGlvbi5wZXJmb3JtYW5jZX0pO1xyXG4gICAgICAgIGlmKCF0aGlzLmRlZmF1bHRBY2NvdW50KSB7XHJcbiAgICAgICAgICB0aGlzLmRlZmF1bHRBY2NvdW50ID0gYWNjb3VudDtcclxuICAgICAgICB9XHJcbiAgICAgICAgYWNjb3VudEluZm8ub3JkZXJzLmZvckVhY2gob3JkZXIgPT4ge1xyXG4gICAgICAgICAgYWNjb3VudC5jcmVhdGVPcmRlcihvcmRlci50cmFpbkRhdGVzLnNwbGl0KCcgJykgLy/lj5Hovabml6XmnJ9cclxuICAgICAgICAgICAgICAgICAgICAgICAsb3JkZXIuYmFja1RyYWluRGF0ZS50b0pTT04oKS5zbGljZSgwLDEwKSAvL+i/lOeoi+aXpeacn1xyXG4gICAgICAgICAgICAgICAgICAgICAgICxvcmRlci5zdGF0aW9uTmFtZXMuc3BsaXQoJyAnKSAvL+WHuuWPkSznu4/ov4fnq5ks5Yiw6L6+56uZXHJcbiAgICAgICAgICAgICAgICAgICAgICAgLG9yZGVyLnRyYWlucy5zcGxpdCgnICcpIC8v6L2m5qyhXHJcbiAgICAgICAgICAgICAgICAgICAgICAgLG9yZGVyLnBlcG9sZXMuc3BsaXQoJyAnKSAvL+S5mOi9puS6uuWnk+WQjSBbXCLlvKDkuIlcIiwgXCLmnY7lm5tcIl1cclxuICAgICAgICAgICAgICAgICAgICAgICAsb3JkZXIuc2VhdFR5cGVzLnNwbGl0KCcgJykgLy8g5bqn5L2N562J57qnXHJcbiAgICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIGFjY291bnQ7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyBnZXRDYXB0Y2hhTG9jaygpOiBPYnNlcnZhYmxlPHN0cmluZz4ge1xyXG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8c3RyaW5nPikgPT4ge1xyXG4gICAgICB0aGlzLmNhcHRjaExvY2submV4dChvYnNlcnZlcik7XHJcbiAgICB9KTtcclxuICB9XHJcblxyXG4gIHB1YmxpYyByZWxlYXNlQ2FwdGNoYUxvY2soKTogdm9pZCB7XHJcbiAgICB0aGlzLmNhcHRjaExvY2tSZWxlYXNlLm5leHQoJ3JlbGVhc2VkJyk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgc3RhcnQoKSB7XHJcblxyXG4gICAgT2JzZXJ2YWJsZS5mb3JrSm9pbih0aGlzLmFjY291bnRzLm1hcChhY2NvdW50PT5cclxuICAgICAgICB0aGlzLmdldENhcHRjaGFMb2NrKClcclxuICAgICAgICAgIC5kbygoKT0+d2luc3Rvbi5kZWJ1ZygnZ290IGNhcHRjaGEgbG9jaycpKVxyXG4gICAgICAgICAgLm1lcmdlTWFwKCgpPT5hY2NvdW50Lm9ic2VydmFibGVMb2dpbkluaXQoKSlcclxuICAgICAgICAgIC5kbygoKT0+dGhpcy5yZWxlYXNlQ2FwdGNoYUxvY2soKSlcclxuICAgICAgKVxyXG4gICAgKVxyXG4gICAgLnN1YnNjcmliZSgoKT0+IHtcclxuICAgICAgdGhpcy5hY2NvdW50cy5mb3JFYWNoKGFjY291bnQgPT4ge1xyXG4gICAgICAgIHdpbnN0b24uZGVidWcoYGFjY291bnQgJHthY2NvdW50LnVzZXJOYW1lfSBzdWJtaXRgKTtcclxuICAgICAgICBjb25zdCBscyA9IHNwYXduKHByb2Nlc3MuYXJndlswXSwgWydkaXN0L2luZGV4LmpzJywgJy1hJywgYWNjb3VudC51c2VyTmFtZV0sIHtzaGVsbDogdHJ1ZSwgZGV0YWNoZWQ6IHRydWUsIGVuY29kaW5nOiBcImdia1wifSk7XHJcbiAgICAgICAgLy8gYWNjb3VudC5zdWJtaXQoKTtcclxuICAgICAgfSk7XHJcbiAgICB9LGVycj0+Y29uc29sZS5sb2coZXJyKSk7XHJcbiAgfVxyXG5cclxuICBwdWJsaWMgZ2V0QWNjb3VudCh1c2VyTmFtZTogc3RyaW5nKSB7XHJcbiAgICBpZihOdW1iZXIodXNlck5hbWUpID4gMCkge1xyXG4gICAgICByZXR1cm4gdGhpcy5hY2NvdW50c1tOdW1iZXIodXNlck5hbWUpLTFdO1xyXG4gICAgfWVsc2Uge1xyXG4gICAgICByZXR1cm4gdGhpcy5hY2NvdW50cy5maW5kKGFjY291bnQ9PiB7XHJcbiAgICAgICAgICByZXR1cm4gYWNjb3VudC51c2VyTmFtZSA9PSB1c2VyTmFtZTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuICB9XHJcbn1cclxuIl19
