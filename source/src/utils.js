/** Copyright (c) 2012-2016 Leonid Azarenkov
	Licensed under the MIT license
*/

//requires jQuery, spin.js
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
      return str.toString().replace(/[^0-9a-z_.]/gi, '');
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
