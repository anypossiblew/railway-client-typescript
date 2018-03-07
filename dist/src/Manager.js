"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var yaml = require("js-yaml");
var winston = require("winston");
var Account_1 = require("./Account");
var Manager = /** @class */ (function () {
    function Manager(path) {
        try {
            var application = yaml.safeLoad(fs.readFileSync(path, 'utf8'));
            console.info(JSON.stringify(application));
            this.accounts = application.accounts;
        }
        catch (e) {
            winston.error(e);
        }
    }
    Manager.prototype.start = function () {
        this.accounts.forEach(function (accountInfo) {
            var account = new Account_1.Account(accountInfo.username, accountInfo.password);
            accountInfo.orders.forEach(function (order) {
                account.createOrder(order.trainDate //发车日期
                , order.backTrainDate //返程日期
                , [order.fromStationName, order.toStationName] //出发,经过站,到达站
                , order.trains //车次
                , order.planPepoles //乘车人姓名 ["张三", "李四"]
                , order.seatTypes // 座位等级
                );
            });
            account.submit();
        });
    };
    return Manager;
}());
exports.Manager = Manager;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9NYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsdUJBQTBCO0FBRTFCLDhCQUFpQztBQUNqQyxpQ0FBb0M7QUFFcEMscUNBQW9DO0FBR3BDO0lBRUUsaUJBQVksSUFBWTtRQUN0QixJQUFJLENBQUM7WUFDSCxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDL0QsT0FBTyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDMUMsSUFBSSxDQUFDLFFBQVEsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDO1FBQ3ZDLENBQUM7UUFBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ1gsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNuQixDQUFDO0lBQ0gsQ0FBQztJQUVNLHVCQUFLLEdBQVo7UUFDRSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxVQUFBLFdBQVc7WUFDL0IsSUFBSSxPQUFPLEdBQUcsSUFBSSxpQkFBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQ3RFLFdBQVcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLFVBQUEsS0FBSztnQkFDOUIsT0FBTyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU07a0JBQzVCLEtBQUssQ0FBQyxhQUFhLENBQUMsTUFBTTtrQkFDMUIsQ0FBQyxLQUFLLENBQUMsZUFBZSxFQUFFLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQyxZQUFZO2tCQUN6RCxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUk7a0JBQ2pCLEtBQUssQ0FBQyxXQUFXLENBQUMsb0JBQW9CO2tCQUN0QyxLQUFLLENBQUMsU0FBUyxDQUFDLE9BQU87aUJBQ3pCLENBQUM7WUFDZixDQUFDLENBQUMsQ0FBQztZQUVILE9BQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNuQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFDSCxjQUFDO0FBQUQsQ0E1QkEsQUE0QkMsSUFBQTtBQTVCWSwwQkFBTyIsImZpbGUiOiJzcmMvTWFuYWdlci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyA9IHJlcXVpcmUoJ2ZzJyk7XHJcbmltcG9ydCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xyXG5pbXBvcnQgeWFtbCA9IHJlcXVpcmUoJ2pzLXlhbWwnKTtcclxuaW1wb3J0IHdpbnN0b24gPSByZXF1aXJlKCd3aW5zdG9uJyk7XHJcblxyXG5pbXBvcnQgeyBBY2NvdW50IH0gZnJvbSAnLi9BY2NvdW50JztcclxuXHJcblxyXG5leHBvcnQgY2xhc3MgTWFuYWdlciB7XHJcbiAgcHVibGljIGFjY291bnRzOiBhbnk7XHJcbiAgY29uc3RydWN0b3IocGF0aDogc3RyaW5nKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICB2YXIgYXBwbGljYXRpb24gPSB5YW1sLnNhZmVMb2FkKGZzLnJlYWRGaWxlU3luYyhwYXRoLCAndXRmOCcpKTtcclxuICAgICAgY29uc29sZS5pbmZvKEpTT04uc3RyaW5naWZ5KGFwcGxpY2F0aW9uKSk7XHJcbiAgICAgIHRoaXMuYWNjb3VudHMgPSBhcHBsaWNhdGlvbi5hY2NvdW50cztcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgd2luc3Rvbi5lcnJvcihlKTtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHB1YmxpYyBzdGFydCgpIHtcclxuICAgIHRoaXMuYWNjb3VudHMuZm9yRWFjaChhY2NvdW50SW5mbyA9PiB7XHJcbiAgICAgIHZhciBhY2NvdW50ID0gbmV3IEFjY291bnQoYWNjb3VudEluZm8udXNlcm5hbWUsIGFjY291bnRJbmZvLnBhc3N3b3JkKTtcclxuICAgICAgYWNjb3VudEluZm8ub3JkZXJzLmZvckVhY2gob3JkZXIgPT4ge1xyXG4gICAgICAgIGFjY291bnQuY3JlYXRlT3JkZXIob3JkZXIudHJhaW5EYXRlIC8v5Y+R6L2m5pel5pyfXHJcbiAgICAgICAgICAgICAgICAgICAgICxvcmRlci5iYWNrVHJhaW5EYXRlIC8v6L+U56iL5pel5pyfXHJcbiAgICAgICAgICAgICAgICAgICAgICxbb3JkZXIuZnJvbVN0YXRpb25OYW1lLCBvcmRlci50b1N0YXRpb25OYW1lXSAvL+WHuuWPkSznu4/ov4fnq5ks5Yiw6L6+56uZXHJcbiAgICAgICAgICAgICAgICAgICAgICxvcmRlci50cmFpbnMgLy/ovabmrKFcclxuICAgICAgICAgICAgICAgICAgICAgLG9yZGVyLnBsYW5QZXBvbGVzIC8v5LmY6L2m5Lq65aeT5ZCNIFtcIuW8oOS4iVwiLCBcIuadjuWbm1wiXVxyXG4gICAgICAgICAgICAgICAgICAgICAsb3JkZXIuc2VhdFR5cGVzIC8vIOW6p+S9jeetiee6p1xyXG4gICAgICAgICAgICAgICAgICAgKTtcclxuICAgICAgfSk7XHJcbiAgICAgIFxyXG4gICAgICBhY2NvdW50LnN1Ym1pdCgpO1xyXG4gICAgfSk7XHJcbiAgfVxyXG59XHJcbiJdfQ==
