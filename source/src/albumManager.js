/** Copyright (c) 2013-2016 Leonid Azarenkov
	Licensed under the MIT license
*/

//requires VkApiWrapper, jQuery, highslide, spin.js
/* globals $, Utils, VkApiWrapper, VkAppUtils, VK*/

var Settings = {
  VkAppLocation: "https://vk.com/app3231070",
  GetPhotosChunksSz: 200,
  ErrorHideAfter: 6000,
  MaxTotalPhotos: 1000000,
  RateRequestDelay: 2000,
  BlinkDelay: 500,
  BlinkCount: 12,
  RedirectDelay: 3000,
  MaxGroupNameLen: 40,
  MaxFriendsList: 500,

  QueryUserFields: "first_name,last_name,screen_name,first_name_gen,last_name_gen",

  vkUserId: null,
  vkSid: null
};

//Initialize application
$(function () {
  Settings.vkUserId = Utils.sanitizeParameter(Utils.getParameterByName("viewer_id"));
  Settings.vkSid = Utils.sanitizeParameter(Utils.getParameterByName("sid"));

  VkAppUtils.validateApp(Settings.vkSid, Settings.VkAppLocation, Settings.RedirectDelay);

  $("#thumbs_container").ThumbsViewer({
    disableSel: true
  });
  $("#Progressbar").progressbar({
    value: 0
  });

  $("#Form1_SelToggleAll").button();
  $("#Form1_SelToggleVisible").button();
  $("#Form1_ShownPrev").button({
    icons: {
      primary: "ui-icon ui-icon-triangle-1-w"
    }
  });
  $("#Form1_ShownNext").button({
    icons: {
      primary: "ui-icon ui-icon-triangle-1-e"
    }
  });
  $("#movePhotosBtn").button();
  $("#movePhotosBtn").button("enable");

  $("#welcome_dialog").dialog({
    autoOpen: false,
    show: {
      effect: "fade",
      duration: 1500
    },
    hide: true,
    modal: false,
    width: 600,
    position: {
      my: "center center-150",
      at: "center center",
      of: window
    }
  }).parent().addClass("glow");

  $("#rateus_dialog").dialog({
    autoOpen: false,
    show: {
      effect: "fade",
      duration: 1500
    },
    hide: true,
    width: 600,
    position: {
      my: "center center-150",
      at: "center center",
      of: window
    },
    modal: false
  }).parent().addClass("glow");

  Utils.showSpinner();

  var d = $.Deferred();
  VK.init(
    function () {
      // API initialization succeeded
      VkApiWrapper.init({
        //errorHandler: RPApi.displayError
      });

      //preloader AD
      /*if (typeof VKAdman !== 'undefined') {
		var app_id = 3231070; //release: 3231070, beta: 3294304
		var a = new VKAdman();
		a.setupPreroll(app_id);
		admanStat(app_id, Settings.vkUserId);
      }*/

      VK.Widgets.Like("vk_like", {
        type: "button",
        height: 24
      }, 500);
      d.resolve();
    },
    function () {
      // API initialization failed
      VkAppUtils.displayError("Не удалось инициализировать VK JS API! Попробуйте перезагрузить приложение.", "globalErrorBox");
      d.reject();
    },
    '5.53'
  );

  //VK API init finished: query user data
  d.done(function () {
    //Utils.hideSpinner();
    //RPApi.init();
  });
});
