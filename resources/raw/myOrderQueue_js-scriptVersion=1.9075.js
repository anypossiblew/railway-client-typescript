(function(a) {
    var b = true;
    jQuery.extend({
        sidebar_init: function() {
            var m = -1;
            var e = location.pathname.split("#")[0].split("?")[0];
            var h = a("#sidebar_menu").children();
            for (var f = 0, p = h.length; f < p; f++) {
                var c = ctx + h.eq(f).attr("url");
                if (c == e) {
                    m = f;
                    break
                }
                var l = h.eq(f).attr("otherUrl");
                if (l) {
                    var o = l.split(",");
                    for (var g = 0, n = o.length; g < n; g++) {
                        var d = ctx + o[g];
                        if (d == e) {
                            m = f;
                            break
                        }
                    }
                }
                if (m >= 0) {
                    break
                }
            }
            var i = a("dt,dd");
            i.hover(function() {
                a.removeAllClass();
                a(this).addClass("cur");
                a(".nav-label").css("top", a(this).position().top - 1).show();
                a(this).children("a").hover(function() {
                    a(this).addClass("cur-txt")
                }, function() {
                    a(this).removeClass("cur-txt")
                });
                a(this).prev().addClass("prev");
                b = false
            }, function() {
                a(this).removeClass("cur");
                a(this).prev().removeClass("prev");
                a(this).children("a").removeClass("cur-txt");
                a(".nav-label").hide();
                b = true
            });
            if (m >= 0) {
                a.setCur(i, m);
                a(".sidebar").mouseout(function() {
                    if (b) {
                        a.removeAllClass();
                        a.setCur(i, m)
                    }
                })
            } else {
                a.removeAllClass()
            }
        },
        setCur: function(g, e) {
            if (g && e && e < g.length) {
                var d = g[e];
                a(d).addClass("cur");
                a(d).children("a").addClass("cur-txt");
                if (e > 0) {
                    var f = e - 1;
                    var c = g[f];
                    a(c).addClass("prev")
                }
                a(".nav-label").css("top", a(d).position().top - 1).show()
            }
        },
        removeAllClass: function() {
            a("dl > .cur").removeClass("cur");
            a(".cur-txt").removeClass("cur-txt");
            a("dl > .prev").removeClass("prev");
            a(".nav-label").hide()
        }
    });
    a(document).ready(function() {
        a("dt[url],dd").click(function() {
            otsRedirect("post", ctx + a(this).attr("url"))
        });
        a.sidebar_init()
    })
}
)(jQuery);
function OrderQueueWaitTime(a, c, b) {
    this.tourFlag = a;
    this.waitMethod = c;
    this.finishMethod = b;
    this.dispTime = 1;
    this.nextRequestTime = 1;
    this.isFinished = false;
    this.waitObj
}
OrderQueueWaitTime.prototype.start = function() {
    var a = this;
    a.timerJob();
    window.setInterval(function() {
        a.timerJob()
    }, 3000)
}
;
OrderQueueWaitTime.prototype.timerJob = function() {
    if (this.isFinished) {
        return
    }
    if (this.dispTime <= 0) {
        this.isFinished = true;
        this.finishMethod(this.tourFlag, this.dispTime, this.waitObj);
        return
    }
    if (this.dispTime == this.nextRequestTime) {
        this.getWaitTime()
    }
    var a = this.dispTime;
    var c = "";
    var b = parseInt(a / 60);
    if (b >= 1) {
        c = b;
        a = a % 60
    } else {
        c = "1"
    }
    this.waitMethod(this.tourFlag, this.dispTime > 1 ? --this.dispTime : 1, c)
}
;
OrderQueueWaitTime.prototype.getWaitTime = function() {
    var a = this;
    $.ajax({
        url: ctx + "queryOrder/queryOrderWaitTime?random=" + new Date().getTime(),
        type: "post",
        data: {
            tourFlag: a.tourFlag
        },
        dataType: "json",
        success: function(e) {
            var b = e.data;
            var f = b.queueWaitTime;
            var c = b.status;
            if (b != null) {
                a.waitObj = b;
                if (f != -100 && c != 8) {
                    a.dispTime = f;
                    var g = parseInt(f / 1.5);
                    g = g > 60 ? 60 : g;
                    var d = f - g;
                    a.nextRequestTime = d <= 0 ? 1 : d
                }
            }
        },
        error: function(b, d, c) {
            return false
        }
    })
}
;
(function() {
    var h;
    $(document).ready(function() {
        i();
        g();
        f();
        b();
        k();
        e();
        if ($("#JB_BTN")[0]) {
            $("#JB_BTN").click(function() {
                $("#608_name").html(name);
                $("#608_card").html(card);
                $("#608_tel").html(tel);
                $("#ticketInfo").html(ticketInfo);
                dhtmlx.createWin({
                    winId: "608_complain",
                    closeWinId: ["608_complain_close", "608_complain_cancel"],
                    okId: "608_complain_ok",
                    okCallBack: function() {
                        var m = dhtmlx.modalbox({
                            targSrc: '<div><img src="' + ctx + 'resources/images/loading.gif"></img></div>',
                            callback: function() {}
                        });
                        $.ajax({
                            url: ctx + "confirmPassenger/report",
                            type: "post",
                            async: false,
                            success: function(n) {
                                dhtmlx.modalbox.hide(m);
                                if (n.data == "Y") {
                                    dhtmlx.alert({
                                        title: "提示",
                                        ok: messages["button.ok"],
                                        text: "举报成功",
                                        type: "alert-info"
                                    });
                                    $("#JB_BTN").remove()
                                } else {
                                    dhtmlx.alert({
                                        title: "提示",
                                        ok: messages["button.ok"],
                                        text: "举报失败",
                                        type: "alert-error"
                                    })
                                }
                            },
                            error: function(n, p, o) {
                                dhtmlx.modalbox.hide(m)
                            }
                        })
                    },
                    checkConfirm: function() {
                        return true
                    }
                });
                $("#608_complain").css("top", "200px")
            })
        }
    });
    function i() {
        $.sidebar_init(1)
    }
    function b() {
        if (!h) {
            h = new dhtmlXWindows();
            h.enableAutoViewport(true);
            h.setSkin("dhx_terrace");
            h.attachViewportTo("winVP");
            h.setImagePath(ctx + "resources/js/rich/windows/imgs/")
        }
    }
    function f() {
        $("#cancel_queue_button").on("click", function(m) {
            var n = h.createWindow("cancelOrder", 40, 30, 593, 240);
            n.clearIcon();
            n.denyResize();
            n.center();
            n.button("park").hide();
            n.button("minmax1").hide();
            n.hideHeader();
            n.setModal(true);
            n.attachObject("cancel_queue_order_id")
        })
    }
    function c() {
        if (h.isWindow("cancelOrder")) {
            h.window("cancelOrder").setModal(false);
            h.window("cancelOrder").hide()
        }
    }
    function g() {
        $("#cancel_queue_order_close").click(function() {
            c()
        });
        $("#cancel_queue_order_co").click(function() {
            c()
        });
        $("#cancel_queue_order_ok").click(function() {
            c();
            m()
        });
        function m() {
            var n = $("#tour_flag").val();
            $.ajax({
                url: ctx + "queryOrder/cancelQueueNoCompleteMyOrder",
                data: {
                    tourFlag: n
                },
                type: "post",
                success: function(o) {
                    if (o.status) {
                        if (o.data.existError == "Y") {
                            alertWarningMsgByTit_header("取消订单", "取消排队订单失败！")
                        } else {
                            alertWarningMsgByTit_header("取消订单", "取消排队订单成功！");
                            otsRedirect("post", ctx + "leftTicket/init")
                        }
                    }
                }
            })
        }
    }
    function e() {
        $("#anew_buy_ticket").click(function() {
            otsRedirect("post", ctx + "leftTicket/init")
        })
    }
    function k() {
        var n = $("#tour_flag").val();
        if (n == null) {
            return
        }
        var m = new OrderQueueWaitTime(n,j,l);
        m.start()
    }
    function j(p, n, o) {
        var m = document.getElementById("wait_time_minute");
        if (n <= 5) {
            m.innerHTML = "正在处理，请耐心等待"
        } else {
            if (n > 30 * 60) {
                m.innerHTML = "最新预估等待时间大于<span><strong>30</strong></span>分钟，请耐心等待"
            } else {
                m.innerHTML = "最新预估等待时间<span><strong>" + o + "</strong></span>分钟，请耐心等待"
            }
        }
    }
    function l(p, n, q) {
        var m = document.getElementById("wait_time_minute");
        if (n == 0 || n == -1) {
            otsRedirect("post", ctx + "/queryOrder/initNoComplete?random=" + new Date().getTime(), {})
        }
        if (n == -2) {
            var o = q.queueOrderMessage.message;
            otsRedirect("post", ctx + "queryOrder/queueBuyTicketFail", {
                trainDateString: $("#trainDateString").val(),
                startTimeString: $("#startTimeString").val(),
                endTimeString: $("#endTimeString").val(),
                stationTrainCode: $("#stationTrainCode").val(),
                fromStationName: $("#fromStationName").val(),
                toStationName: $("#toStationName").val(),
                errorMsgInfo: o
            });
            return
        }
        if (n == -3) {
            m.innerHTML = "已取消订单";
            $("#cacel_div").css("display", "none");
            return
        }
        if (n == -4) {
            if (q && q.queueWaitTime <= 0) {
                window.location.href = ctx + "/queryOrder/initNoComplete"
            } else {
                m.innerHTML = "正在处理中,请稍等。"
            }
            return
        }
    }
    function a(m) {
        dhtmlx.alert({
            title: messages["message.error"],
            ok: messages["button.ok"],
            text: m,
            type: "alert-error",
            callback: function() {}
        })
    }
    function d(m) {
        dhtmlx.alert({
            title: messages["message.info"],
            ok: messages["button.ok"],
            text: m,
            type: "alert-error",
            callback: function() {
                otsRedirect("post", ctx + "leftTicket/init")
            }
        })
    }
}
)();
var example_messages = {
    "leftTicketDTO.to_station": "发站",
    "leftTicketDTO.from_station": "到站",
    "leftTicketDTO.train_no": "车次",
    "leftTicketDTO.train_date": "出发日"
};
