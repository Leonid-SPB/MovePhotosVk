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
  PhotosPerPage: 100,
  PhotosPageRefreshDelay: 700,
  PageSlideDelay: 1400,
  PageSlideRepeatDelay: 350,

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
  albumData: {
    photosCount: 0,
    pagesCount: 0,
    albumInfo: null,
    pages: {},
    page: 0
  },

  pageRefreshTimer: null,
  pageSlideTimer: null,

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
    self.shownPhotosEdit = document.getElementById("Form1_ShownPhotosEdit");

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
    self.$showNextBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(true);
    });
    self.$showPrevBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(false);
    });
    self.$selToggleAllBtn.click(self.onSelToggleAll);
    self.$selToggleVisibleBtn.click(self.onSelToggleVisible);
    $(self.revThumbSortChk).click(self.onRevThumbSortChkClick);

    self.$thumbsContainer.on("click.AMApi", ".ThumbsViewer-thumb_block", function (event, parent) {
      self.$thumbsContainer.ThumbsViewer("selectToggle", $(this));
      AMApi.updSelectedNum();
    });

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
      extended: 1,
      filter: "moder"
    }).done(function (groups) {
      //filter banned/inactive groups
      groups = VkAppUtils.filterGroupList(groups.items);

      //populate group list select
      for (var i = 0; i < groups.length; i++) {
        var opt = new Option(groups[i].title, -groups[i].id, false, false);
        self.srcAlbumOwnerList.add(opt, null);
        opt = new Option(groups[i].title, -groups[i].id, false, false);
        self.dstAlbumOwnerList.add(opt, null);
      }
    }).fail(self.onFatalError);

    //query albums
    var d2 = VkAppUtils.queryAlbumList({
      owner_id: Settings.vkUserId,
      need_system: 1
    }).done(function (albums) {
      self.albumCache[Settings.vkUserId] = albums;
      self.onSrcOwnerChanged();
    }).fail(self.onFatalError);

    //when all info collected
    $.when(d1, d2).done(function () {
      //init done, enable controls, hide spinner
      self.busyFlag = false;
      Utils.hideSpinner();
      self.disableControls(0);
      return;
    }).fail(function () {
      //initialization failed, disable controls, hide spinner
      self.busyFlag = false;
      Utils.hideSpinner();
      self.disableControls(1);
    });
  },

  displayError: function (errMsg) {
    //use global displayError(msg, errorBoxId)
    VkAppUtils.displayError(errMsg, "globalErrorBox", Settings.ErrorHideAfter);
  },

  onFatalError: function (error) {
    var self = AMApi;

    if ("error_msg" in error) {
      VkAppUtils.displayError(error.error_msg + "<br />Попробуйте перезагрузить приложение.", "globalErrorBox");
    } else {
      VkAppUtils.displayError("Неизвестная ошибка, попробуйте перезагрузить приложение.", "globalErrorBox");
    }
    self.disableControls(1);
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

    for (i = 0; i < albums.length; i++) {
      if (!albums[i].size) {
        continue;
      }
      var opt = new Option(albums[i].title, albums[i].id, false, false);
      $(opt).data("AMApi", albums[i]);
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
    for (i = 0; i < albums.length; i++) {
      var opt = new Option(albums[i].title, albums[i].id, false, false);
      self.dstAlbumList.add(opt, null);
    }
  },

  onSrcOwnerChanged: function () {
    var self = AMApi;

    var selIndex = self.srcAlbumOwnerList.selectedIndex;
    var ownerId = self.srcAlbumOwnerList.item(selIndex).value;

    function doUpdate() {
      //synchronize with srcAlbumOwner as it is disabled
      self.dstAlbumOwnerList.selectedIndex = selIndex;
      self.onDstOwnerChanged();

      self.updateSrcAlbumsListBox(self.albumCache[ownerId]);
      self.onSrcAlbumChanged();
    }

    if (ownerId in self.albumCache) {
      doUpdate();
    } else {
      Utils.showSpinner();
      self.disableControls(1);
      VkAppUtils.queryAlbumList({
        owner_id: ownerId,
        need_system: 1
      }).done(function (albums) {
        self.albumCache[ownerId] = albums;
        doUpdate();
      }).fail(self.onFatalError);
    }
  },

  onDstOwnerChanged: function () {
    var self = AMApi;

    var selIndex = self.dstAlbumOwnerList.selectedIndex;
    var ownerId = self.dstAlbumOwnerList.item(selIndex).value;

    function doUpdate() {
      self.updateDstAlbumsListBox(self.albumCache[ownerId]);
      self.onDstAlbumChanged();
    }

    if (ownerId in self.albumCache) {
      doUpdate();
    }
    /* else {
          Utils.showSpinner();
          self.disableControls(1);
          VkAppUtils.queryAlbumList({
            owner_id: ownerId,
            need_system: 1
          }).done(function (albums) {
            self.albumCache[ownerId] = albums;
            doUpdate();
          }).fail(self.onFatalError);
        }*/
  },

  onSrcAlbumChanged: function () {
    var self = AMApi;

    self.$thumbsContainer.ThumbsViewer("empty");
    self.updSelectedNum();

    //clean album data
    self.albumData.photosCount = 0;
    self.albumData.pagesCount = 0;
    self.albumData.albumInfo = null;
    self.albumData.pages = {};
    self.albumData.page = 0;
    self.updateShownPhotosEdit();

    var selIndex = self.srcAlbumList.selectedIndex;
    var ownSelIndex = self.srcAlbumOwnerList.selectedIndex;
    var ownerId = self.srcAlbumOwnerList.item(ownSelIndex).value;
    var albumId = self.srcAlbumList.item(selIndex).value;

    if (!selIndex) { //not selected
      Utils.hideSpinner();
      self.disableControls(0);
      return;
    }

    function onFail() {
      Utils.hideSpinner();
      self.disableControls(0);
      self.srcAlbumList.selectedIndex = 0;
    }

    //update album data
    Utils.showSpinner();
    self.disableControls(1);

    VkAppUtils.queryAlbumPhotos(ownerId, albumId, 0, Settings.PhotosPerPage).done(function (photos, count) {
      self.albumData.photosCount = count;
      self.albumData.pagesCount = Math.ceil(count / Settings.PhotosPerPage);
      self.albumData.pages[0] = photos;
      self.albumData.albumInfo = $(self.srcAlbumList.item(selIndex)).data("AMApi");

      self.updateShownPhotosEdit();
      self.showPhotosPage();
    }).fail(onFail);
  },

  onDstAlbumChanged: function () {
    var self = AMApi;

    var selIndex = self.dstAlbumList.selectedIndex;

    var ownSelIndex = self.dstAlbumOwnerList.selectedIndex;
    var ownerId = self.dstAlbumOwnerList.item(ownSelIndex).value;

    if (selIndex == 1) { //save album
      self.$movePhotosBtn.button("option", "label", "Сохранить");
    } else {
      self.$movePhotosBtn.button("option", "label", "Переместить");
    }
  },

  updateShownPhotosEdit: function () {
    var self = AMApi;
    /*var shownFrom = self.albumData.page * Settings.PhotosPerPage;
    var shownTo = Math.min((self.albumData.page + 1) * Settings.PhotosPerPage, self.albumData.photosCount);
    var shownStr = shownFrom + " - " + shownTo + "/" + self.albumData.photosCount;*/
    var shownStr;
    if (self.albumData.pagesCount) {
      shownStr = (self.albumData.page + 1) + "/" + self.albumData.pagesCount;
    } else {
      shownStr = "-/-";
    }

    self.shownPhotosEdit.value = shownStr;
  },

  refreshPhotosPage: function () {
    var self = AMApi;

    //cancell previously schedulled refresh
    if (self.pageRefreshTimer) {
      clearTimeout(self.pageRefreshTimer);
      self.pageRefreshTimer = null;
    }

    //schedule/reschedule refreshRating()
    self.pageRefreshTimer = setTimeout(function () {
      self.pageRefreshTimer = null;
      self.showPhotosPage();
    }, Settings.PhotosPageRefreshDelay);
  },

  showPhotosPage: function () {
    var self = AMApi;

    function showThumbs() {
      self.$thumbsContainer.ThumbsViewer("empty");

      var albumMap = {};
      albumMap[self.albumData.albumInfo.id] = self.albumData.albumInfo.title;

      self.$thumbsContainer.ThumbsViewer("updateAlbumMap", albumMap);
      self.$thumbsContainer.ThumbsViewer("addThumbList", self.albumData.pages[self.albumData.page]).done(function () {
        self.updSelectedNum();
        Utils.hideSpinner();
        self.disableControls(0);
      });
    }

    Utils.showSpinner();
    self.disableControls(1);

    //check if photos were downloaded for the current page
    if (self.albumData.page in self.albumData.pages) {
      showThumbs();
    } else {
      //download images for the current page

      var ownSelIndex = self.srcAlbumOwnerList.selectedIndex;
      var ownerId = self.srcAlbumOwnerList.item(ownSelIndex).value;
      var offset = self.albumData.page * Settings.PhotosPerPage;

      VkAppUtils.queryAlbumPhotos(ownerId, self.albumData.albumInfo.id, offset, Settings.PhotosPerPage).done(function (photos, count) {
        self.albumData.pages[self.albumData.page] = photos;
        showThumbs();
      }).fail(self.onFatalError);
    }
  },

  rebuildAlbumPageCache: function () {

  },

  onSlideBtnDown: function (slideNext) {
    var self = AMApi;

    if (self.pageSlideTimer) {
      clearTimeout(self.pageSlideTimer);
      self.pageSlideTimer = null;
    }

    var slideFn = slideNext ? self.slideNextPage : self.slidePrevPage;

    function slide() {
      if (slideFn.call(self)) {
        self.pageSlideTimer = setTimeout(function () {
          slide();
        }, Settings.PageSlideRepeatDelay);
      } else {
        self.pageSlideTimer = null;
      }
    }

    if (slideFn.call(self)) {
      self.pageSlideTimer = setTimeout(function () {
        slide();
      }, Settings.PageSlideDelay);
    }
  },

  onSlideBtnUp: function () {
    var self = AMApi;

    if (self.pageSlideTimer) {
      clearTimeout(self.pageSlideTimer);
      self.pageSlideTimer = null;
    }

    self.refreshPhotosPage();
  },

  slideNextPage: function () {
    var self = AMApi;

    //todo: don't update imemdiately, schedule update
    if (self.albumData.page < self.albumData.pagesCount - 1) {
      ++self.albumData.page;
      self.updateShownPhotosEdit();
      return true;
    }
    return false;
  },

  slidePrevPage: function () {
    var self = AMApi;

    //todo: don't update imemdiately, schedule update
    if (self.albumData.page > 0) {
      --self.albumData.page;
      self.updateShownPhotosEdit();
      return true;
    }
    return false;
  },

  onMovePhotosBtnClick: function () {
    var self = AMApi;

    //invalidate/rebuild album pages
    //query new photo count, if it matches with records -> rebuild
    //if not - invalidate

    //todo: hint for service albums, that move is irreversible

    //todo: turbo move using VK API exec
  },

  saveAlbum: function () {
    //todo: hint that there are alternative methods of for saving albums
  },

  onRevThumbSortChkClick: function () {
    var self = AMApi;
    self.$thumbsContainer.ThumbsViewer("reorder", self.revThumbSortChk.checked);
  },

  onSelToggleAll: function () {
    var self = AMApi;
    self.$thumbsContainer.ThumbsViewer("selectToggleAll");
    self.updSelectedNum();
  },

  onSelToggleVisible: function () {
    var self = AMApi;
    self.$thumbsContainer.ThumbsViewer("selectToggleVisible");
    self.updSelectedNum();
  },

  updSelectedNum: function () {
    var self = AMApi;
    var cnt = self.$thumbsContainer.ThumbsViewer("getThumbsCount");
    this.selectedPhotosEdit.value = cnt.selected + "/" + cnt.total;
  }
};

//Initialize application
$(function () {
  Settings.vkUserId = Utils.sanitizeParameter(Utils.getParameterByName("viewer_id"));
  Settings.vkSid = Utils.sanitizeParameter(Utils.getParameterByName("sid"));

  VkAppUtils.validateApp(Settings.vkSid, Settings.VkAppLocation, Settings.RedirectDelay);

  $("#thumbs_container").ThumbsViewer({
    disableSel: false
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
