/** Copyright (c) 2012-2017 Leonid Azarenkov
	Licensed under the MIT license
*/

/* globals $, Spinner, html_sanitize */

var Utils = {
  getParameterByName: function (name, rfr) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results;
    if (rfr) {
      results = regex.exec(document.referrer);
    } else {
      results = regex.exec(window.location.search);
    }
    if (results == null)
      return null;
    else
      return decodeURIComponent(results[1].replace(/\+/g, " "));
  },

  sanitizeParameter: function (str) {
    //fixme using real sanitizer
    if (str) {
      //keep only alpha-numeric characters and "._"
      return str.toString().replace(/[^0-9a-z_.\-]/gi, '');
    } else {
      return "";
    }

    /*var urlTransformer, nameIdClassTransformer;

    // customize if you need to filter URLs and/or ids/names/classes
    urlTransformer = nameIdClassTransformer = function (s) {
      return s;
    };
    return html_sanitize(str, urlTransformer, nameIdClassTransformer);*/
  },

  //replace protocol prefix to fix insecure http://<...> links
  fixHttpUrl: function (url) {
    return url.replace("https:", "").replace("http:", "");
  },

  //convert html string to text, truncate to maxLen if necessary
  //not safe to use on user input or untrusted data!
  html2Text: function (str, maxLen) {
    var str_ = $("<div>").html(str).text();
    if (str_.length > maxLen) {
      str_ = str_.substring(0, maxLen) + "...";
    }
    return str_;
  },

  date2Str: function (cD) {
    //add leading zero
    function lzn(num) {
      return (num < 10) ? "0" + num : "" + num;
    }

    return lzn(cD.getDate()) + "." + lzn(cD.getMonth() + 1) + "." + cD.getFullYear() + " " + lzn(cD.getHours()) + ":" + lzn(cD.getMinutes()) + ":" + lzn(cD.getSeconds());
  },

  //convert 2d array of arrays [[1 2],[3],[4 5]] to 1d array [1 2 3 4 5]
  array2d_to_1d(arr2d) {
    var arr1d = [];
    for (var i = 0; i < arr2d.length; i++) {
      arr1d = arr1d.concat(arr2d[i]);
    }
    return arr1d;
  },

  showSpinner: function (opts) {
    var defaults = {
      lines: 17,
      length: 26,
      width: 11,
      radius: 40,
      scale: 2.0,
      corners: 1,
      color: "rgb(42, 88, 133)",
      opacity: 1 / 4,
      rotate: 0,
      direction: 1,
      speed: 0.7,
      trail: 64,
      fps: 20,
      zIndex: 2e9,
      className: 'spinner',
      top: '50%',
      left: '50%',
      shadow: false,
      hwaccel: false,
      position: 'absolute'
    };
    var opts_ = {};

    $.extend(opts_, defaults, opts);
    $("body").spin(opts_);
  },

  hideSpinner: function () {
    $("body").spin(false);
  },

  blinkDiv: function (divId, blinks, delay) {
    var bclass = "blink_1";

    function toggleBlink(el, blinks, delay) {
      if (!blinks) {
        setTimeout(function () {
          el.removeClass(bclass);
        }, delay);
        return;
      }

      if (el.hasClass(bclass)) {
        el.removeClass(bclass);
      } else {
        el.addClass(bclass);
      }
      setTimeout(function () {
        toggleBlink(el, --blinks, delay);
      }, delay);
    }

    toggleBlink($("#" + divId), blinks, delay);
  }
};

var RateLimit = (function () {
  //by Matteo Agosti
  var RateLimit = function (maxOps, interval, allowBursts) {
    this._maxRate = allowBursts ? maxOps : maxOps / interval;
    this._interval = interval;
    this._allowBursts = allowBursts;

    this._numOps = 0;
    this._start = new Date().getTime();
    this._queue = [];
  };

  RateLimit.prototype.schedule = function (fn) {
    var that = this,
      rate = 0,
      now = new Date().getTime(),
      elapsed = now - this._start;

    if (elapsed > this._interval) {
      this._numOps = 0;
      this._start = now;
    }

    rate = this._numOps / (this._allowBursts ? 1 : elapsed);

    if (rate < this._maxRate) {
      if (this._queue.length === 0) {
        this._numOps++;
        fn();
      } else {
        if (fn) this._queue.push(fn);

        this._numOps++;
        this._queue.shift()();
      }
    } else {
      if (fn) this._queue.push(fn);

      setTimeout(function () {
        that.schedule();
      }, 1 / this._maxRate);
    }
  };

  return RateLimit;
})();
