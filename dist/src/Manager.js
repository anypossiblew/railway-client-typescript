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
            if (!application.accounts) {
                winston.error('Please config your 12306 account in application.yml!');
                return;
            }
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
        this.accounts = this.accountConfigs ?
            this.accountConfigs.map(function (accountInfo) {
                var account = new Account_1.Account(accountInfo.username, accountInfo.password, _this, { performance: application.performance });
                if (!_this.defaultAccount) {
                    _this.defaultAccount = account;
                }
                accountInfo.orders && accountInfo.orders.forEach(function (order) {
                    var trainDate = typeof order.trainDates == 'object' ? [order.trainDates.toJSON().slice(0, 10)] : order.trainDates.split(' ');
                    account.createOrder(trainDate //发车日期
                    , order.backTrainDate.toJSON().slice(0, 10) //返程日期
                    , order.stationNames.split(' ') //出发,经过站,到达站
                    , order.trains.split(' ') //车次
                    , order.pepoles.split(' ') //乘车人姓名 ["张三", "李四"]
                    , order.seatTypes.split(' ') // 座位等级
                    );
                });
                return account;
            }) : [];
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
            if (_this.accounts.length === 1) {
                _this.accounts[0].submit();
            }
            else {
                _this.accounts.forEach(function (account) {
                    winston.debug("account " + account.userName + " submit");
                    var ls = spawn(process.argv[0], ['dist/index.js', '-a', account.userName], { shell: true, detached: true, encoding: "gbk" });
                    // account.submit();
                });
            }
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

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9NYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsdUJBQTBCO0FBRTFCLDhCQUFpQztBQUN6QixJQUFBLHNDQUFLLENBQThCO0FBQzNDLGlDQUFvQztBQUNwQyw4Q0FBNkM7QUFFN0Msd0NBQXVDO0FBQ3ZDLHdDQUFzQztBQUV0QyxxQ0FBb0M7QUFJcEM7SUFRRSxpQkFBWSxJQUFZO1FBQXhCLGlCQXVDQztRQTFDTyxlQUFVLEdBQWtCLElBQUksaUJBQU8sRUFBUSxDQUFDO1FBQ2hELHNCQUFpQixHQUFvQixJQUFJLGlCQUFPLEVBQVUsQ0FBQztRQUdqRSxJQUFJLENBQUM7WUFDSCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDL0QsNkNBQTZDO1lBQzdDLEVBQUUsQ0FBQSxDQUFDLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pCLE9BQU8sQ0FBQyxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQztnQkFDdEUsTUFBTSxDQUFDO1lBQ1QsQ0FBQztZQUNELElBQUksQ0FBQyxjQUFjLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQztRQUM3QyxDQUFDO1FBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNYLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDbkIsQ0FBQztRQUVELElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQzthQUN4QyxTQUFTLENBQUMsVUFBQyxFQUFrQjtnQkFBakIsZ0JBQVEsRUFBRSxjQUFNO1lBQzNCLE9BQU8sQ0FBQyxLQUFLLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNqQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDaEIsUUFBUSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ3RCLENBQUMsQ0FBQyxDQUFDO1FBQ0wsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFFMUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7WUFDbkMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsVUFBQSxXQUFXO2dCQUNqQyxJQUFJLE9BQU8sR0FBRyxJQUFJLGlCQUFPLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsUUFBUSxFQUFFLEtBQUksRUFBRSxFQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsV0FBVyxFQUFDLENBQUMsQ0FBQztnQkFDcEgsRUFBRSxDQUFBLENBQUMsQ0FBQyxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQztvQkFDeEIsS0FBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUM7Z0JBQ2hDLENBQUM7Z0JBQ0QsV0FBVyxDQUFDLE1BQU0sSUFBSSxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFBLEtBQUs7b0JBQ3BELElBQUksU0FBUyxHQUFHLE9BQU8sS0FBSyxDQUFDLFVBQVUsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO29CQUM1SCxPQUFPLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxNQUFNO3NCQUN0QixLQUFLLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUMsRUFBRSxDQUFDLENBQUMsTUFBTTtzQkFDL0MsS0FBSyxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsWUFBWTtzQkFDMUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSTtzQkFDNUIsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsb0JBQW9CO3NCQUM3QyxLQUFLLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxPQUFPO3FCQUNwQyxDQUFDO2dCQUNmLENBQUMsQ0FBQyxDQUFDO2dCQUNILE1BQU0sQ0FBQyxPQUFPLENBQUM7WUFDbkIsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUNWLENBQUM7SUFFTSxnQ0FBYyxHQUFyQjtRQUFBLGlCQUlDO1FBSEMsTUFBTSxDQUFDLHVCQUFVLENBQUMsTUFBTSxDQUFDLFVBQUMsUUFBMEI7WUFDbEQsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRU0sb0NBQWtCLEdBQXpCO1FBQ0UsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztJQUMxQyxDQUFDO0lBRU0sdUJBQUssR0FBWjtRQUFBLGlCQW9CQztRQWxCQyx1QkFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxVQUFBLE9BQU87WUFDekMsT0FBQSxLQUFJLENBQUMsY0FBYyxFQUFFO2lCQUNsQixFQUFFLENBQUMsY0FBSSxPQUFBLE9BQU8sQ0FBQyxLQUFLLENBQUMsa0JBQWtCLENBQUMsRUFBakMsQ0FBaUMsQ0FBQztpQkFDekMsUUFBUSxDQUFDLGNBQUksT0FBQSxPQUFPLENBQUMsbUJBQW1CLEVBQUUsRUFBN0IsQ0FBNkIsQ0FBQztpQkFDM0MsRUFBRSxDQUFDLGNBQUksT0FBQSxLQUFJLENBQUMsa0JBQWtCLEVBQUUsRUFBekIsQ0FBeUIsQ0FBQztRQUhwQyxDQUdvQyxDQUNyQyxDQUNGO2FBQ0EsU0FBUyxDQUFDO1lBQ1QsRUFBRSxDQUFBLENBQUMsS0FBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDOUIsS0FBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM1QixDQUFDO1lBQUEsSUFBSSxDQUFDLENBQUM7Z0JBQ0wsS0FBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBQSxPQUFPO29CQUMzQixPQUFPLENBQUMsS0FBSyxDQUFDLGFBQVcsT0FBTyxDQUFDLFFBQVEsWUFBUyxDQUFDLENBQUM7b0JBQ3BELElBQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsZUFBZSxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBQyxDQUFDLENBQUM7b0JBQzdILG9CQUFvQjtnQkFDdEIsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO1FBQ0gsQ0FBQyxFQUFDLFVBQUEsR0FBRyxJQUFFLE9BQUEsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBaEIsQ0FBZ0IsQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFFTSw0QkFBVSxHQUFqQixVQUFrQixRQUFnQjtRQUNoQyxFQUFFLENBQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN4QixNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUMsQ0FBQyxDQUFDLENBQUM7UUFDM0MsQ0FBQztRQUFBLElBQUksQ0FBQyxDQUFDO1lBQ0wsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLFVBQUEsT0FBTztnQkFDN0IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDO1lBQ3RDLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztJQUNILENBQUM7SUFDSCxjQUFDO0FBQUQsQ0ExRkEsQUEwRkMsSUFBQTtBQTFGWSwwQkFBTyIsImZpbGUiOiJzcmMvTWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyA9IHJlcXVpcmUoJ2ZzJyk7XG5pbXBvcnQgcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcbmltcG9ydCB5YW1sID0gcmVxdWlyZSgnanMteWFtbCcpO1xuY29uc3QgeyBzcGF3biB9ID0gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpO1xuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XG5pbXBvcnQgeyBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcy9PYnNlcnZhYmxlJztcbmltcG9ydCB7IE9ic2VydmVyIH0gZnJvbSAncnhqcy9PYnNlcnZlcic7XG5pbXBvcnQgeyBTdWJqZWN0IH0gZnJvbSAncnhqcy9TdWJqZWN0JztcbmltcG9ydCAncnhqcy9hZGQvb2JzZXJ2YWJsZS9mb3JrSm9pbic7XG5cbmltcG9ydCB7IEFjY291bnQgfSBmcm9tICcuL0FjY291bnQnO1xuXG5cblxuZXhwb3J0IGNsYXNzIE1hbmFnZXIge1xuICBwcml2YXRlIGFjY291bnRDb25maWdzOiBhbnk7XG5cbiAgcHVibGljIGRlZmF1bHRBY2NvdW50PzogQWNjb3VudDtcbiAgcHVibGljIGFjY291bnRzOiBBcnJheTxBY2NvdW50PjtcbiAgcHJpdmF0ZSBjYXB0Y2hMb2NrOiBTdWJqZWN0PHZvaWQ+ID0gbmV3IFN1YmplY3Q8dm9pZD4oKTtcbiAgcHJpdmF0ZSBjYXB0Y2hMb2NrUmVsZWFzZTogU3ViamVjdDxzdHJpbmc+ID0gbmV3IFN1YmplY3Q8c3RyaW5nPigpO1xuXG4gIGNvbnN0cnVjdG9yKHBhdGg6IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICB2YXIgYXBwbGljYXRpb24gPSB5YW1sLnNhZmVMb2FkKGZzLnJlYWRGaWxlU3luYyhwYXRoLCAndXRmOCcpKTtcbiAgICAgIC8vIGNvbnNvbGUuaW5mbyhKU09OLnN0cmluZ2lmeShhcHBsaWNhdGlvbikpO1xuICAgICAgaWYoIWFwcGxpY2F0aW9uLmFjY291bnRzKSB7XG4gICAgICAgIHdpbnN0b24uZXJyb3IoJ1BsZWFzZSBjb25maWcgeW91ciAxMjMwNiBhY2NvdW50IGluIGFwcGxpY2F0aW9uLnltbCEnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5hY2NvdW50Q29uZmlncyA9IGFwcGxpY2F0aW9uLmFjY291bnRzO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHdpbnN0b24uZXJyb3IoZSk7XG4gICAgfVxuXG4gICAgdGhpcy5jYXB0Y2hMb2NrLnppcCh0aGlzLmNhcHRjaExvY2tSZWxlYXNlKVxuICAgICAgLnN1YnNjcmliZSgoW29ic2VydmVyLCBhbnN3ZXJdKT0+IHtcbiAgICAgICAgd2luc3Rvbi5kZWJ1ZygnY2FwdGNoYSBsb2NraW5nJyk7XG4gICAgICAgIG9ic2VydmVyLm5leHQoKTtcbiAgICAgICAgb2JzZXJ2ZXIuY29tcGxldGUoKTtcbiAgICAgIH0pO1xuICAgIHRoaXMucmVsZWFzZUNhcHRjaGFMb2NrKCk7XG5cbiAgICB0aGlzLmFjY291bnRzID0gdGhpcy5hY2NvdW50Q29uZmlncyA/XG4gICAgICB0aGlzLmFjY291bnRDb25maWdzLm1hcChhY2NvdW50SW5mbyA9PiB7XG4gICAgICAgIHZhciBhY2NvdW50ID0gbmV3IEFjY291bnQoYWNjb3VudEluZm8udXNlcm5hbWUsIGFjY291bnRJbmZvLnBhc3N3b3JkLCB0aGlzLCB7cGVyZm9ybWFuY2U6IGFwcGxpY2F0aW9uLnBlcmZvcm1hbmNlfSk7XG4gICAgICAgIGlmKCF0aGlzLmRlZmF1bHRBY2NvdW50KSB7XG4gICAgICAgICAgdGhpcy5kZWZhdWx0QWNjb3VudCA9IGFjY291bnQ7XG4gICAgICAgIH1cbiAgICAgICAgYWNjb3VudEluZm8ub3JkZXJzICYmIGFjY291bnRJbmZvLm9yZGVycy5mb3JFYWNoKG9yZGVyID0+IHtcbiAgICAgICAgICBsZXQgdHJhaW5EYXRlID0gdHlwZW9mIG9yZGVyLnRyYWluRGF0ZXMgPT0gJ29iamVjdCcgPyBbb3JkZXIudHJhaW5EYXRlcy50b0pTT04oKS5zbGljZSgwLDEwKV0gOiBvcmRlci50cmFpbkRhdGVzLnNwbGl0KCcgJyk7XG4gICAgICAgICAgYWNjb3VudC5jcmVhdGVPcmRlcih0cmFpbkRhdGUgLy/lj5Hovabml6XmnJ9cbiAgICAgICAgICAgICAgICAgICAgICAgLG9yZGVyLmJhY2tUcmFpbkRhdGUudG9KU09OKCkuc2xpY2UoMCwxMCkgLy/ov5TnqIvml6XmnJ9cbiAgICAgICAgICAgICAgICAgICAgICAgLG9yZGVyLnN0YXRpb25OYW1lcy5zcGxpdCgnICcpIC8v5Ye65Y+RLOe7j+i/h+ermSzliLDovr7nq5lcbiAgICAgICAgICAgICAgICAgICAgICAgLG9yZGVyLnRyYWlucy5zcGxpdCgnICcpIC8v6L2m5qyhXG4gICAgICAgICAgICAgICAgICAgICAgICxvcmRlci5wZXBvbGVzLnNwbGl0KCcgJykgLy/kuZjovabkurrlp5PlkI0gW1wi5byg5LiJXCIsIFwi5p2O5ZubXCJdXG4gICAgICAgICAgICAgICAgICAgICAgICxvcmRlci5zZWF0VHlwZXMuc3BsaXQoJyAnKSAvLyDluqfkvY3nrYnnuqdcbiAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gYWNjb3VudDtcbiAgICB9KSA6IFtdO1xuICB9XG5cbiAgcHVibGljIGdldENhcHRjaGFMb2NrKCk6IE9ic2VydmFibGU8c3RyaW5nPiB7XG4gICAgcmV0dXJuIE9ic2VydmFibGUuY3JlYXRlKChvYnNlcnZlcjogT2JzZXJ2ZXI8c3RyaW5nPikgPT4ge1xuICAgICAgdGhpcy5jYXB0Y2hMb2NrLm5leHQob2JzZXJ2ZXIpO1xuICAgIH0pO1xuICB9XG5cbiAgcHVibGljIHJlbGVhc2VDYXB0Y2hhTG9jaygpOiB2b2lkIHtcbiAgICB0aGlzLmNhcHRjaExvY2tSZWxlYXNlLm5leHQoJ3JlbGVhc2VkJyk7XG4gIH1cblxuICBwdWJsaWMgc3RhcnQoKSB7XG5cbiAgICBPYnNlcnZhYmxlLmZvcmtKb2luKHRoaXMuYWNjb3VudHMubWFwKGFjY291bnQ9PlxuICAgICAgICB0aGlzLmdldENhcHRjaGFMb2NrKClcbiAgICAgICAgICAuZG8oKCk9PndpbnN0b24uZGVidWcoJ2dvdCBjYXB0Y2hhIGxvY2snKSlcbiAgICAgICAgICAubWVyZ2VNYXAoKCk9PmFjY291bnQub2JzZXJ2YWJsZUxvZ2luSW5pdCgpKVxuICAgICAgICAgIC5kbygoKT0+dGhpcy5yZWxlYXNlQ2FwdGNoYUxvY2soKSlcbiAgICAgIClcbiAgICApXG4gICAgLnN1YnNjcmliZSgoKT0+IHtcbiAgICAgIGlmKHRoaXMuYWNjb3VudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHRoaXMuYWNjb3VudHNbMF0uc3VibWl0KCk7XG4gICAgICB9ZWxzZSB7XG4gICAgICAgIHRoaXMuYWNjb3VudHMuZm9yRWFjaChhY2NvdW50ID0+IHtcbiAgICAgICAgICB3aW5zdG9uLmRlYnVnKGBhY2NvdW50ICR7YWNjb3VudC51c2VyTmFtZX0gc3VibWl0YCk7XG4gICAgICAgICAgY29uc3QgbHMgPSBzcGF3bihwcm9jZXNzLmFyZ3ZbMF0sIFsnZGlzdC9pbmRleC5qcycsICctYScsIGFjY291bnQudXNlck5hbWVdLCB7c2hlbGw6IHRydWUsIGRldGFjaGVkOiB0cnVlLCBlbmNvZGluZzogXCJnYmtcIn0pO1xuICAgICAgICAgIC8vIGFjY291bnQuc3VibWl0KCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0sZXJyPT5jb25zb2xlLmxvZyhlcnIpKTtcbiAgfVxuXG4gIHB1YmxpYyBnZXRBY2NvdW50KHVzZXJOYW1lOiBzdHJpbmcpIHtcbiAgICBpZihOdW1iZXIodXNlck5hbWUpID4gMCkge1xuICAgICAgcmV0dXJuIHRoaXMuYWNjb3VudHNbTnVtYmVyKHVzZXJOYW1lKS0xXTtcbiAgICB9ZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5hY2NvdW50cy5maW5kKGFjY291bnQ9PiB7XG4gICAgICAgICAgcmV0dXJuIGFjY291bnQudXNlck5hbWUgPT0gdXNlck5hbWU7XG4gICAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19
