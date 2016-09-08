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

/* Album manager */
var AMApi = {
  srcAlbumOwnerList: null,
  srcAlbumList: null,
  dstAlbumOwnerList: null,
  dstAlbumList: null,

  $progressBar: null,
  $movePhotosBtn: null,

  $showPrevBtn: null,
  $showNextBtn: null,
  shownPhotosEdit: null,

  selectedPhotosEdit: null,
  $selToggleAllBtn: null,
  $selToggleVisibleBtn: null,

  revThumbSortChk: null,
  $thumbsContainer: null,

  busyFlag: true,
  progressStep: 0,
  progressPerc: 0,

  init: function () {
    var self = this;

    //assign variables for controls
    self.srcAlbumOwnerList = document.getElementById("Form1_SrcAlbumOwner");
    self.srcAlbumList = document.getElementById("Form1_SrcAlbumList");
    self.dstAlbumOwnerList = document.getElementById("Form1_DstAlbumOwner");
    self.dstAlbumList = document.getElementById("Form1_DstAlbumList");

    self.$progressBar = $("#Progressbar");
    self.$movePhotosBtn = $("#movePhotosBtn");

    self.$showPrevBtn = $("#Form1_ShowPrev");
    self.$showNextBtn = $("#Form1_ShowNext");
    self.shownPhotosEdit = document.getElementById("Form1_ShownFotos");

    self.selectedPhotosEdit = document.getElementById("Form1_SelectedPhotos");
    self.$selToggleAllBtn = $("#Form1_SelToggleAll");
    self.$selToggleVisibleBtn = $("#Form1_SelToggleVisible");

    self.revThumbSortChk = document.getElementById("Form1_RevThumbSort");
    self.$thumbsContainer = $("#thumbs_container");

    //assign event handlers

    self.disableControls(1);
    self.busyFlag = true;

    VkAppUtils.welcomeCheck().done(function () {
      //show spinner if still busy when dialog is closed
      if (self.busyFlag) {
        Utils.showSpinner();
      }
    });

    //Query data
  },

  disableControls: function (disable) {
    var self = this;
    var dval = 0;
    var dstr = "enable";
    if (disable) {
      dval = 1;
      dstr = "disable";
    }

    self.$movePhotosBtn.button(dstr);
    self.$selToggleAllBtn.button(dstr);
    self.$selToggleVisibleBtn.button(dstr);
    self.$showPrevBtn.button(dstr);
    self.$showNextBtn.button(dstr);
    self.revThumbSortChk.disabled = dval;
    self.srcAlbumOwnerList.disabled = dval;
    self.srcAlbumList.disabled = dval;
    self.dstAlbumList.disabled = dval;
  },
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
  $("#Form1_ShowPrev").button({
    text: false,
    icons: {
      primary: "ui-icon ui-icon-triangle-1-w" // Custom icon
    }
  }).removeClass('ui-corner-all');
  $("#Form1_ShowNext").button({
    text: false,
    icons: {
      primary: "ui-icon ui-icon-triangle-1-e" // Custom icon
    }
  }).removeClass('ui-corner-all');
  $("#movePhotosBtn").button();

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
        errorHandler: AMApi.displayError
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
    Utils.hideSpinner();
    AMApi.init();
  });
});
