var uampassport = {};
(function() {
  $(document).ready(function() {
    var a = $.ajax;
    var e = d()["redirect"] || passport_okPage;
    var c = d()["isFromExtened"];
    uampassport.checkLogin = function() {
      var f = $.cookie("tk");
      if (f == null || f == undefined || f == "") {
        a({
          type: "POST",
          url: passport_authuam,
          data: {
            appid: passport_appId
          },
          xhrFields: {
            withCredentials: true
          },
          dataType: "json",
          success: function(g) {
            if (g.result_code == "0") {
              var h = g.newapptk || g.apptk;
              uampassport.uampassport(h)
            } else {
              if (c == 1) {
                window.location.href = e;
                return
              }
              window.location.href = ctx + passport_loginPage
            }
          },
          error: function() {}
        })
      } else {
        uampassport.uampassport(f)
      }
    };
    uampassport.uampassport = function(f) {
      a({
        type: "POST",
        url: ctx + passport_authclient,
        data: {
          tk: f
        },
        datatype: "json",
        success: function(g) {
          if (g.result_code == 0) {
            window.location.href = e
          } else {
            if (c == 1) {
              window.location.href = e;
              return
            }
            window.location.href = ctx + passport_loginPage
          }
        },
        error: function() {}
      })
    };

    function d() {
      var j = [],
        h;
      var f = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
      for (var g = 0; g < f.length; g++) {
        h = f[g].split("=");
        j.push(h[0]);
        j[h[0]] = h[1]
      }
      return j
    }

    function b(h) {
      var g = document.cookie.indexOf(h);
      var f = document.cookie.indexOf(";", g);
      return g == -1 ? "" : unescape(document.cookie.substring(g + h.length + 1, (f > g ? f : document.cookie.length)))
    }
  })
})();
