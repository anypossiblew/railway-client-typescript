function aa(cr, cq) {
    $("#loginSubAsyn").unbind("click");
    $("#loginSubAsyn").click(function() {
        var cs = aU();
        if (is_uam_login == "Y") {
            if (if_show_pass_code_login == "Y" && !verifyRandCodeUAM($("#randCode")[0], cs)) {
                return
            }
            if (if_show_pass_code_login == "N" && typeof (cs) !== "boolean") {
                login_errorMsg(cs);
                return
            }
            $.ajax({
                url: passport_login,
                data: {
                    username: $("#username").val(),
                    password: $("#password").val(),
                    appid: passport_appId
                },
                dataType: "json",
                type: "POST",
                xhrFields: {
                    withCredentials: true
                },
                success: function(ct) {
                    if (ct.result_code == 0) {
                        $.ajax({
                            type: "POST",
                            url: passport_authuam,
                            async: false,
                            data: {
                                appid: passport_appId
                            },
                            dataType: "jsonp",
                            jsonp: "callback",
                            success: function(cu) {
                                if (cu.result_code == 0) {
                                    var cv = cu.newapptk || cu.apptk;
                                    $.ajax({
                                        type: "POST",
                                        async: false,
                                        url: ctx + passport_authclient,
                                        data: {
                                            tk: cv
                                        },
                                        datatype: "json",
                                        success: function(cw) {
                                            if (cw.result_code == 0) {
                                                bv();
                                                loginAsyn(cw.username);
                                                S(cr, cq)
                                            }
                                        },
                                        error: function() {}
                                    })
                                }
                            },
                            error: function() {}
                        })
                    } else {
                        if (if_show_pass_code_login == "Y") {
                            showSuc($("#randCode")[0]).hide()
                        } else {
                            login_errorMsg_hide()
                        }
                        if (if_show_pass_code_login == "Y") {
                            refreshImgUAM("login", "sjrand")
                        }
                        cc(ct.result_message)
                    }
                }
            })
        } else {
            if (if_show_pass_code_login == "Y" && !verifyRandCode($("#randCode")[0], cs)) {
                return
            }
            if (if_show_pass_code_login == "N" && typeof (cs) !== "boolean") {
                login_errorMsg(cs);
                return
            }
            $("#loginForm").ajaxSubmit({
                url: ctx + "login/loginUserAsyn?random=" + new Date().getTime(),
                type: "post",
                dataType: "json",
                async: false,
                success: function(ct) {
                    if (ct.data.status) {
                        if (ct.data.username != null) {
                            bv();
                            loginAsyn(ct.data.username);
                            if (ct.data.otherMsg != "") {
                                dhtmlx.alert({
                                    title: messages["message.error"],
                                    ok: messages["button.ok"],
                                    text: ct.data.otherMsg,
                                    type: "alert-error",
                                    callback: function() {
                                        if ("Y" == ct.data.notifysession) {
                                            dhtmlx.createWin({
                                                winId: "notifysession",
                                                closeWinId: ["close_notifysession"],
                                                okId: "goto_notifysession",
                                                okCallBack: function() {
                                                    S(cr, cq)
                                                }
                                            })
                                        } else {
                                            S(cr, cq)
                                        }
                                    }
                                })
                            } else {
                                if ("Y" == ct.data.notifysession) {
                                    dhtmlx.createWin({
                                        winId: "notifysession",
                                        closeWinId: ["close_notifysession"],
                                        okId: "goto_notifysession",
                                        okCallBack: function() {
                                            S(cr, cq)
                                        }
                                    })
                                } else {
                                    S(cr, cq)
                                }
                            }
                        }
                    } else {
                        if (ct.data.uamflag == "1") {
                            location.reload(true)
                        }
                        if (if_show_pass_code_login == "Y") {
                            showSuc($("#randCode")[0]).hide()
                        } else {
                            login_errorMsg_hide()
                        }
                        if (if_show_pass_code_login == "Y") {
                            refreshImg("login", "sjrand")
                        }
                        cc(ct.data.loginFail)
                    }
                }
            })
        }
    })
}
