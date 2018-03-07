submitOrderRequest = function(cr, cq) {
    $.ajax({
        type: "post",
        url: ctx + "login/checkUser",
        data: {},
        beforeSend: function(cs) {
            cs.setRequestHeader("If-Modified-Since", "0");
            cs.setRequestHeader("Cache-Control", "no-cache")
        },
        success: function(cs) {
            var cu;
            checkusermdId = cs.attributes;
            if (cs.data.flag) {
                if (train_tour_flag == "fc") {
                    cu = $("#back_train_date").val()
                } else {
                    cu = $("#train_date").val()
                }
                if (x == "0X00") {
                    var ct = false;
                    for (i = (studentComPerArr.length - 1); i >= 0; i = i - 2) {
                        if (C(studentComPerArr[i - 1]) <= C(cu) && C(studentComPerArr[i]) >= C(cu)) {
                            ct = true;
                            break
                        }
                    }
                    if (!ct) {
                        b("学生票的乘车时间为每年的暑假6月1日至9月30日、寒假12月1日至3月31日，目前不办理学生票业务。");
                        return
                    }
                }
                S(cr, cq)
            } else {
                bx();
                $("#floatTable").hide();
                a = $(window).scrollTop();
                aa(cr, cq)
            }
        }
    })
}

function S(cD, cw) {
    var cq = "";
    if ($("#dc").is(":checked")) {
        cq = "dc"
    } else {
        cq = "wc"
    }
    if (train_tour_flag == "fc") {
        cq = "fc";
        var ct = cw.split(":");
        var cs = $("#back_train_date").val() + "-" + ct[0] + "-" + ct[1] + "-00";
        try {
            if (roundReferTime) {
                if (C(roundReferTime) >= C(cs)) {
                    b("您预订的往程车票到站时间为" + C(roundReferTime).format("yyyy年MM月dd日 hh时mm分") + "，返回日期不能早于此时间");
                    return
                }
            }
        } catch (cy) {}
    }
    if (train_tour_flag == "gc") {
        cq = "gc"
    }
    if ("undefined" == typeof (submitForm)) {
        var cu = "secretStr=" + cD + "&train_date=" + $("#train_date").val() + "&back_train_date=" + $("#back_train_date").val() + "&tour_flag=" + cq + "&purpose_codes=" + ck() + "&query_from_station_name=" + $("#fromStationText").val() + "&query_to_station_name=" + $("#toStationText").val() + "&" + cB
    } else {
        var cr = submitForm();
        var cC = cr.split(":::");
        var cx = cC[0].split(",-,")[0];
        var cA = cC[0].split(",-,")[1];
        var cv = cC[1].split(",-,")[0];
        var cz = cC[1].split(",-,")[1];
        var cu = escape(cx) + "=" + escape(cA) + "&" + cv + "=" + cz + "&secretStr=" + cD + "&train_date=" + $("#train_date").val() + "&back_train_date=" + $("#back_train_date").val() + "&tour_flag=" + cq + "&purpose_codes=" + ck() + "&query_from_station_name=" + $("#fromStationText").val() + "&query_to_station_name=" + $("#toStationText").val() + "&" + cB
    }
    var cB = checkusermdId != undefined ? "&_json_att=" + encodeURIComponent(checkusermdId) : "";
    $.ajax({
        type: "post",
        url: ctx + "leftTicket/submitOrderRequest",
        data: cu,
        async: false,
        success: function(cE) {
            if (cE.status) {
                if (cE.data == "Y") {
                    dhtmlx.alert({
                        title: "温馨提示",
                        ok: "确定",
                        text: "您选择的列车距开车时间很近了，请确保有足够的时间抵达车站，并办理换取纸质车票、安全检查、实名制验证及检票等手续，以免耽误您的旅行。",
                        type: "alert-warn",
                        callback: function() {
                            aW(cq, train_tour_flag)
                        }
                    })
                } else {
                    aW(cq, train_tour_flag)
                }
            }
        }
    })
}
