(function() {
	var dhxWins;
	var arrive_time_str;
//	 var cancelOrderWindow;
	//这里可以定义页面的全局变量
	$(document).ready(function() {
		initOuterWindow();
		initMenu();
		queryNoCompleteOrder();
		queryNoByButton();
		bookTicket();
		operNoCompleteWindow();
		showInfoNoCompleteNoPay();
	});
	//显示第几个菜单 初始化菜单效果
	function initMenu(){
		//显示第几个菜单 初始化菜单效果
		$.sidebar_init(1);
	}
	//初始化弹出窗口
	function initOuterWindow() {
		if(!dhxWins) {
			dhxWins = new dhtmlXWindows();
			dhxWins.enableAutoViewport(true);
			dhxWins.setSkin("dhx_terrace");// 设置窗体的css样式
			dhxWins.attachViewportTo("winVP");
			dhxWins.setImagePath(ctx + "resources/js/rich/windows/imgs/");

		}
	}

	function getScrollTop() {
		if('pageYOffset' in window) {
			return window.pageYOffset;
		} else if (document.compatMode == 'BackCompat') {
			return document.body.scrollTop;
		} else {
			return document.documentElement.scrollTop;
		}
	}

	//取消订单
 cancelMyOrder =function(sequence_no,cancel_id) {
	    var x = $(window).width() / 2 - 250;
	    var y = getScrollTop() + ($(window).height()/2 - 120);
		var cancelOrderWindow= dhxWins.createWindow(cancel_id+"_Window", x, y, 593, 240);
	    cancelOrderWindow.clearIcon();// 清除窗口图标
	    cancelOrderWindow.denyResize();// 不允许窗口调整大小
//		cancelOrderWindow.center();// 居中
		cancelOrderWindow.button("park").hide();
		cancelOrderWindow.button("minmax1").hide();
		cancelOrderWindow.hideHeader();
		cancelOrderWindow.setModal(true);
		cancelOrderWindow.attachObject(cancel_id+"_id");
		$('#sequeue_no_hide').val(sequence_no);
		$('#operation_flag_hide').val(cancel_id);

	}


	//关闭window
	function closeWin(){
		var cancel_id=$('#operation_flag_hide').val();
		if(dhxWins.isWindow(cancel_id+"_Window")){
		 dhxWins.window(cancel_id+"_Window").setModal(false);
		 dhxWins.window(cancel_id+"_Window").hide();
		 }
	}
	//当支付失败后，用户查询未完成订单时，给用户的提示信息
	function showInfoNoCompleteNoPay(){
		if(null!=errorBusMsg&&""!=errorBusMsg&&'undefined'!=errorBusMsg){
			showErrorMsg('改签失败',errorBusMsg);
		}else if("N"==payFlag){
			showErrorMsg('未支付成功','订单未支付成功，请重新支付！');
		}
	}

	//关于window操作
	function operNoCompleteWindow(){
  //关于取消未完成订单
	$("#cancel_order_id").click(function(){
		closeWin();
	});
	$("#cancel_order_co").click(function(){
		closeWin();
	});
	$("#cancel_order_ok").click(function(){
		closeWin();
		submitCacelOk();

	});


	//关于取消未完成改签订单
	$("#cancel_resign_close").click(function(){
		closeWin();
	});
	$("#cancel_resign_co").click(function(){
		closeWin();
	});
	$("#cancel_resign_ok").click(function(){
		closeWin();
		submitCacelOk();

	});

	}
	//在取消窗口，点击确定按钮
	function submitCacelOk(){
		var cancel_id= $('#operation_flag_hide').val();
		var sequence_no=$('#sequeue_no_hide').val();
		var modalbox= loading();
		$.ajax({
			url : ctx + "queryOrder/cancelNoCompleteMyOrder",
			data:{"sequence_no":sequence_no,
				  "cancel_flag":cancel_id},
			type : "post",
			success : function(response) {
				dhtmlx.modalbox.hide(modalbox);
				if (response.status) {
				  if (response.data.existError == "Y"){
						  showErrorMsg("取消订单","取消订单失败！");
//						  alertWarningMsgByTit_header("取消订单","取消订单失败！");
					}else{
//						alertWarningMsgByTit_header("取消订单","取消订单成功！");
						  showInfoMsg("取消订单","取消订单成功！");
				    }
				  }
				}
      });

	}

	//车票预订
	function bookTicket(){
		$('#tain_code_yuding').on('click',function(e){
			otsRedirect("post",ctx+'leftTicket/init');
		});
	}
	//继续支付
	contiuePayNoCompleteOrder = function(sequence_no, pay_flag) {
		var modalbox= loading();
		$.ajax({
			url : ctx + "queryOrder/continuePayNoCompleteMyOrder",
			data : {
				"sequence_no" : sequence_no,
				"pay_flag" : pay_flag,
				"arrive_time_str" : arrive_time_str
			},
			type : "post",
			success : function(response) {
				dhtmlx.modalbox.hide(modalbox);
				if (response.status) {
					if (response.data.existError == "Y") {
//						alertWarningMsgByTit_header("继续支付",response.data.errorMsg);
						showErrorMsg("继续支付",response.data.errorMsg);
					} else {
						otsRedirect("post", ctx + "payOrder/init");
					}
				}
			}
		});

	}
	// 点击查询按钮
	function queryNoByButton(){
		//点击查询按钮
		$('#queryNoCompleteOrders').on('click', function(e) {
			queryNoCompleteOrder();
	     });
	}

	//查询未完成订单
	function queryNoCompleteOrder(){
		var modalbox= loading();
		$.ajax({
			url : ctx + "queryOrder/queryMyOrderNoComplete",
			type : "post",
			success : function(response) {
				dhtmlx.modalbox.hide(modalbox);
				if (response.status) {
					if(response.data==null||response.data==""){
						$('#orderinfobodyTable').css('display','none');
						$('#noticketlistid').css('display','block');
						return;
					}else{
						if(response.data.to_page == "cache"){
							var orderCacheDo=response.data.orderCacheDTO;
							//跳转到订单排队页面
							 otsRedirect("post", ctx + "queryOrder/initNoCompleteQueue");
						}else if(response.data.to_page == "db") {
							$("#noticeShow").html("1.席位已锁定，请在指定时间内完成网上支付。");
							//正常未完成订单
							var datas=response.data.orderDBList;
							$('#orderinfobodyTable').css('display','block');
							$('#noticketlistid').css('display','none');
							var tmpl = $("#queryOrderTemplate").html().replace("<!--", "").replace("-->", "")
							$.templates({
								leftTableTemplate : tmpl
							});
							$("#orderinfobodyTable").html($.render.leftTableTemplate(datas));
							if(response.data.orderDBList){
								arrive_time_str = '';
								var tickets = response.data.orderDBList[0].tickets;
								for(var k=0 ; k < tickets.length ; k++){
									arrive_time_str += tickets[k].stationTrainDTO.station_train_code+','+tickets[k].stationTrainDTO.arrive_time+';';
								}
							}
							//联程开发过程去掉双箭头
							/*if(datas&&datas[0]){
								if(datas[0]['from_station_name_page'].length>1){
									$("#orderinfobodyTable div[class='place'] b").removeClass('dc').addClass('wf');
								}
							}*/
							combineCell(5);
						}
						/**else if(response.data.to_page == "cache"){
							//异常未完成订单
                        	var datas=response.data.orderCacheDTO;
                        	$('#orderinfobodyTable').css('display','block');
							$('#noticketlistid').css('display','none');
							var tmpl = $("#queryNoCompleteCacheTemplate").html().replace("<!--", "").replace("-->", "")
							$.templates({
								leftTableTemplate : tmpl
							});
							$("#orderinfobodyTable").html($.render.leftTableTemplate(datas));
							combineCell(4);
                        }**/
					}

				}else{
					$('#orderinfobodyTable').css('display','none');
					$('#noticketlistid').css('display','block');
					return;
				}
			}
	});

	}

	//合并单元格
	function combineCell(num){
		  var tab = document.getElementById("orderTableItem");
	      var maxCol = 1, val, count, start;  //maxCol：合并单元格作用到多少列
	        count = 1;
	        val = "";
	        for(var i=0; i<tab.rows.length; i++){
	            if(val == tab.rows[i].cells[num].innerHTML){
	                count++;
	            }else{
	                if(count > 1){ //合并
	                    start = i - count;
	                    tab.rows[start].cells[num].rowSpan = count;
	                    for(var j=start+1; j<i; j++){
	                        tab.rows[j].cells[num].style.display = "none";
	                    }
	                    count = 1;
	                }
	                val = tab.rows[i].cells[num].innerHTML;
	            }
	       }
	        if(count > 1 ){ //合并，最后几行相同的情况下
	            start = i - count;
	            tab.rows[start].cells[num].rowSpan = count;
	            for(var j=start+1; j<i; j++){
	                tab.rows[j].cells[num].style.display = "none";
	            }
	    }}


	//显示错误信息
	function showErrorMsg(titles,msg){
				dhtmlx.alert({
				title : titles,
				ok : "确认",
				text : msg,
				type : 'alert-error',
				callback : function() {}
					});
	}

	//显示正确信息
	function showInfoMsg(titles,msg){
				dhtmlx.alert({
				title : titles,
				ok :  "确认",
				text : msg,
				type : 'alert-error',
				callback : function() {
					otsRedirect("post",ctx+'leftTicket/init');
				}
			});
	}
	//加载中
	function loading(){
		var modalbox = dhtmlx.modalbox({
			targSrc : '<div><img src="' + ctx + 'resources/images/loading.gif"></img></div>',
			callback : function() {
			}
		});
		return modalbox;
	}

})();



//当鼠标转动到超过两个乘客上时，会显示全部乘客姓名

function showTitlePassenerNames(sequenceNo,opera){
	if("over"==opera){
		$('#divshowname_'+sequenceNo).css('display','block');
	}else if("out"==opera)
		$('#divshowname_'+sequenceNo).css('display','none');
}
