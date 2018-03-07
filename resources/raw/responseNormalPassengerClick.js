var responseNormalPassengerClick = function(aB) {
    var aF = "";
    aF = $(aB).attr("id");
    if (aB.checked) {
        if (S(limit_tickets)) {
            return
        }
        var aE = c(limit_tickets);
        if (aE >= init_limit_ticket_num) {
            aB.checked = false;
            k("提示", "最多只能购买" + init_limit_ticket_num + "张车票");
            return
        }
        var aJ = ay[aF.split("_")[1]];
        var aC = b(aJ.passenger_type);
        var aG = new Z(aF,"","",aC,"",aJ.passenger_name,aJ.passenger_id_type_code,aJ.passenger_id_type_name,aJ.passenger_id_no,aJ.mobile_no,"",ticketInfoForPassengerForm.tour_flag,true,aJ.passenger_type,false);
        if (!B(aG)) {
            k("提示", "对不起，现登录用户证件类型不是二代身份证，不能为证件类型为二代身份证的乘车人 <span style='color:black;font-size:30px'><i>" + aG.name + "</i></span> 代购车票");
            aB.checked = false;
            return
        }
        var az = L(aG);
        if (az == "0") {
            limit_tickets.push(aG)
        } else {
            if (az == "1") {
                if (!$.whatsSelect(false)) {
                    return
                }
                k("提示", "请从常用联系人中选择学生旅客");
                aB.checked = false;
                return
            } else {
                if (az == "2") {
                    if (!$.whatsSelect(false)) {
                        return
                    }
                    k("提示", "请从常用联系人中选择学生旅客");
                    aB.checked = false;
                    return
                }
            }
        }
        if (ticket_seat_codeMap[aG.ticket_type].length < 1) {
            k("提示", "很抱歉，" + ticket_submit_order.ticket_type_name[aG.ticket_type] + "余票不足！")
        }
        d.push($(aB).attr("id"));
        $(aB).next().removeClass().addClass("colorA");
        var aH = false;
        if (aJ.passenger_type == "3") {
            if (!IsStudentDate) {
                k("提示", "学生票的乘车时间为每年的暑假6月1日至9月30日、寒假12月1日至3月31日，目前不办理学生票业务。");
                aG.ticket_type = "1";
                aG.seatTypes = ticket_seat_codeMap["1"]
            }
        }
        if ((aJ.passenger_type == "2" || aJ.passenger_type == "3" || aJ.passenger_type == "4") && aG.ticket_type != "1") {
            aH = true;
            var aA = "您是要购买";
            if (aJ.passenger_type == "2") {
                aA = aA + "儿童票吗（随同成人旅行身高1.2～1.5米的儿童，应当购买儿童票；超过1.5米时应买全价票。每一成人旅客可免费携带一名身高不足1.2米的儿童，超过一名时，超过的人数应买儿童票，详见购买儿童票有关规定。如不符合相关规定，请点击“取消”。）？<br/>儿童未办理居民身份证的，建议使用同行成年人身份信息购票，否则须凭儿童本人有效身份证件原件及订单号在车站人工窗口换取纸质车票。"
            } else {
                if (aJ.passenger_type == "3") {
                    aA = aA + "学生票吗（凭购票时所使用的有效身份证件原件和附有学生火车票优惠卡的有效学生证原件换票乘车，详见购买学生票有关规定。如不符合相关规定，请点击“取消”。）？"
                } else {
                    if (aJ.passenger_type == "4") {
                        aA = aA + "残军票吗（须凭购票时所使用的有效身份证件原件和有效的“中华人民共和国残疾军人证”、“中华人民共和国伤残人民警察证”原件换票乘车，详见购买残疾军人优待票有关规定。如不符合相关规定，请点击“取消”。）？"
                    }
                }
            }
            $("#dialog_xsertcj_msg").html(aA);
            dhtmlx.createWin({
                winId: "dialog_xsertcj",
                closeWinId: ["dialog_xsertcj_close", "dialog_xsertcj_cancel"],
                okId: "dialog_xsertcj_ok",
                callback: function() {
                    aG.ticket_type = "1";
                    aG.seatTypes = ticket_seat_codeMap["1"];
                    renderTickInfo(limit_tickets, false)
                },
                okCallBack: function() {
                    renderTickInfo(limit_tickets, false)
                }
            })
        }
        if (!aH) {
            renderTickInfo(limit_tickets, false)
        }
    } else {
        $(aB).next().removeClass();
        for (var aD = 0; aD < d.length; aD++) {
            if (d[aD] == $(aB).attr("id")) {
                d.splice(aD, 1);
                break
            }
        }
        for (var aD = 0; aD < limit_tickets.length; aD++) {
            var aI = limit_tickets[aD].only_id;
            if (aI == aF) {
                limit_tickets.splice(aD, 1);
                if (limit_tickets.length < 1) {
                    G("0")
                }
            }
        }
        renderTickInfo(limit_tickets, false)
    }
    f()
}
