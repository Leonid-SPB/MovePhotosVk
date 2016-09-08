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
  MaxOptionLength: 40,
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

  albumCache: {},

  init: function () {
    var self = AMApi;

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

    self.srcAlbumOwnerList.item(0).value = Settings.vkUserId;
    self.dstAlbumOwnerList.item(0).value = Settings.vkUserId;

    //assign event handlers
    $(self.srcAlbumOwnerList).change(self.onSrcOwnerChanged);
    $(self.srcAlbumList).change(self.onSrcAlbumChanged);
    $(self.dstAlbumList).change(self.onDstAlbumChanged);
    self.$movePhotosBtn.click(self.onMovePhotosBtnClick);
    self.$showNextBtn.click(self.onShowNextBtnClick);
    self.$showPrevBtn.click(self.onShowPrevBtnClick);
    self.$selToggleAllBtn.click(self.onSelToggleAll);
    self.$selToggleVisibleBtn.click(self.onSelToggleVisible);
    $(self.revThumbSortChk).click(self.onRevThumbSortChkClick);

    //
    self.disableControls(1);
    self.busyFlag = true;

    VkAppUtils.welcomeCheck().done(function () {
      //show spinner if still busy when dialog is closed
      if (self.busyFlag) {
        Utils.showSpinner();
      }
    });

    //Query data

    //query groups
    var d1 = VkApiWrapper.queryUserGroups({
      user_id: Settings.vkUserId,
      count: Settings.MaxFriendsList,
      extended: 1
    }).done(function (groups) {
      //filter banned/inactive groups
      groups = VkAppUtils.filterGroupList(groups.items);

      //populate group list select
      for (var i = 0; i < groups.length; i++) {
        var opt = new Option(groups[i].title, -groups[i].id, false, false);
        self.srcAlbumOwnerList.add(opt, null);
        self.dstAlbumOwnerList.add(opt, null);
      }
    });

    //query albums
    var d2 = VkAppUtils.queryAlbumList({
      owner_id: Settings.vkUserId,
      need_system: 1
    }).done(function (albums) {
      self.albumCache[Settings.vkUserId] = albums;
      self.onSrcOwnerChanged();
      self.onDstOwnerChanged();
    });

    //onFail handler!!!
  },

  displayError: function (errMsg) {
    //use global displayError(msg, errorBoxId)
    VkAppUtils.displayError(errMsg, "globalErrorBox", Settings.ErrorHideAfter);
  },

  onFatalError: function (error) {
    var self = AMApi;

    if (error_msg in error) {
      VkAppUtils.displayError(error.error_msg + ". Попробуйте перезагрузить приложение.", "globalErrorBox");
    } else {
      VkAppUtils.displayError("Неизвестная ошибка, попробуйте перезагрузить приложение.", "globalErrorBox");
    }
    self.disableControls(1);
  },

  updateSrcAlbumsListBox: function (albums) {
    var self = AMApi;
    self.srcAlbumList.selectedIndex = 0;

    //remove old options, skip "not selected" option
    for (var i = self.srcAlbumList.length - 1; i >= 1; --i) {
      self.srcAlbumList.remove(i);
    }

    /*//my albums, add service albums
    if (selfOwn) {
      var opt1 = new Option("Сохраненные фотографии", -15, false, false);
      $(opt1).addClass("italic_bold");
      self.srcAlbumList.add(opt1, null);
    }*/

    for (var i = 0; i < albums.length; i++) {
      if (!albums[i].size) {
        continue;
      }
      var opt = new Option(albums[i].title, albums[i].id, false, false);
      self.srcAlbumList.add(opt, null);
    }
  },

  updateDstAlbumsListBox: function (albums) {
    var self = AMApi;
    self.dstAlbumList.selectedIndex = 0;

    //remove old options
    //i >= 2 to skip "not selected" and "save locally" options
    for (var i = self.dstAlbumList.length - 1; i >= 2; --i) {
      self.dstAlbumList.remove(i);
    }

    //add new options
    for (var i = 0; i < albums.length; i++) {
      var opt = new Option(albums[i].title, albums[i].id, false, false);
      self.dstAlbumList.add(opt, null);
    }
  },

  disableControls: function (disable) {
    var self = AMApi;
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

  onSrcOwnerChanged: function () {
    var self = AMApi;

    var selIndex = self.srcAlbumOwnerList.selectedIndex;
    var ownerId = self.srcAlbumOwnerList.item(selIndex).value;

    function doUpdate() {
      self.updateSrcAlbumsListBox.call(self, self.albumCache[ownerId]);
      self.onSrcAlbumChanged();

      //synchronize with srcAlbumOwner as it is disabled
      self.dstAlbumOwnerList.selectedIndex = selIndex;
      self.onDstOwnerChanged();
    }

    if (ownerId in self.albumCache) {
      doUpdate();
    } else {
      VkAppUtils.queryAlbumList({
        owner_id: ownerId,
        need_system: 1
      }).done(function (albums) {
        self.albumCache[ownerId] = albums;
        doUpdate();
      }).fail(self.onFatalError);
    }
  },

  onSrcAlbumChanged: function () {
    var self = AMApi;

  },

  onDstOwnerChanged: function () {
    var self = AMApi;
  },

  onDstAlbumChanged: function () {
    var self = AMApi;
  },

  onShowPrevBtnClick: function () {
    var self = AMApi;
  },

  onShowNextBtnClick: function () {
    var self = AMApi;
  },

  onMovePhotosBtnClick: function () {
    var self = AMApi;
  },

  onRevThumbSortChkClick: function () {
    var self = AMApi;
  },

  onSelToggleAll: function () {
    var self = AMApi;
  },

  onSelToggleVisible: function () {
    var self = AMApi;
  }
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
