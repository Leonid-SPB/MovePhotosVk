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
  PhotosPerPage: 10,
  PhotosPageRefreshDelay: 700,
  PageSlideDelay: 1400,
  PageSlideRepeatDelay: 350,
  MovePhotoDelay: 335,
  WallAlbumId: -7,
  ProfileAlbumId: -6,

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
  $goBtn: null,

  $showPrevBtn: null,
  $showNextBtn: null,
  $albumPageField: null,
  $reloadPageBtn: null,

  selectedPhotosEdit: null,
  $selToggleAllBtn: null,
  $selToggleVisibleBtn: null,

  revThumbSortChk: null,
  $thumbsContainer: null,

  busyFlag: true,
  goBtnLabelMove: "Переместить",
  goBtnLabelSave: "Сохранить",
  goBtnLabelCancel: "Отмена",

  albumsCache: {},
  albumData: {
    photosCount: 0,
    pagesCount: 0,
    albumInfo: null,
    dirty: false,
    pages: {},
    page: 0
  },

  pageRefreshTimer: null,
  pageSlideTimer: null,

  taskInfo: {
    abort: false,
  },

  init: function () {
    var self = AMApi;

    //assign variables for controls
    self.srcAlbumOwnerList = document.getElementById("Form1_SrcAlbumOwner");
    self.srcAlbumList = document.getElementById("Form1_SrcAlbumList");
    self.dstAlbumOwnerList = document.getElementById("Form1_DstAlbumOwner");
    self.dstAlbumList = document.getElementById("Form1_DstAlbumList");

    self.$progressBar = $("#Progressbar");
    self.$goBtn = $("#Form1_goBtn");

    self.$showPrevBtn = $("#Form1_ShowPrev");
    self.$showNextBtn = $("#Form1_ShowNext");
    self.$albumPageField = $("#Form1_albumPageField");
    self.$reloadPageBtn = $("#Form1_ReloadAlbumPage");

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
    self.$goBtn.click(self.onGoBtnClick);
    self.$goBtn.button("option", "label", self.goBtnLabelMove);
    self.$showNextBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(true);
    });
    self.$showPrevBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(false);
    });
    self.$reloadPageBtn.click(self.onReloadPageClick);
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
      self.albumsCache[Settings.vkUserId] = albums;
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

  displayWarn: function (warnMsg) {
    VkAppUtils.displayWarn(warnMsg, "NoteField", Settings.ErrorHideAfter);
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

    self.$goBtn.button(dstr);
    self.$selToggleAllBtn.button(dstr);
    self.$selToggleVisibleBtn.button(dstr);
    self.$reloadPageBtn.button(dstr);
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
      //put service albums to the beginning
      var index = null;
      if (albums[i].id == Settings.ProfileAlbumId) {
        continue;
      } else if (albums[i].id < 0) {
        index = 1;
      }
      var opt = new Option(albums[i].title, albums[i].id, false, false);
      $(opt).data("AMApi", albums[i]);
      self.srcAlbumList.add(opt, index);
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
      var index = null;
      if (albums[i].id == Settings.WallAlbumId) {
        index = 2;
      } else if (albums[i].id < 0) {
        continue;
      }
      var opt = new Option(albums[i].title, albums[i].id, false, false);
      self.dstAlbumList.add(opt, index);
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

      self.updateSrcAlbumsListBox(self.albumsCache[ownerId]);
      self.onSrcAlbumChanged();
    }

    if (ownerId in self.albumsCache) {
      doUpdate();
    } else {
      Utils.showSpinner();
      self.disableControls(1);
      VkAppUtils.queryAlbumList({
        owner_id: ownerId,
        need_system: 1
      }).done(function (albums) {
        self.albumsCache[ownerId] = albums;
        doUpdate();
      }).fail(self.onFatalError);
    }
  },

  onDstOwnerChanged: function () {
    var self = AMApi;

    var selIndex = self.dstAlbumOwnerList.selectedIndex;
    var ownerId = self.dstAlbumOwnerList.item(selIndex).value;

    function doUpdate() {
      self.updateDstAlbumsListBox(self.albumsCache[ownerId]);
      self.onDstAlbumChanged();
    }

    if (ownerId in self.albumsCache) {
      doUpdate();
    }
    /* else {
          Utils.showSpinner();
          self.disableControls(1);
          VkAppUtils.queryAlbumList({
            owner_id: ownerId,
            need_system: 1
          }).done(function (albums) {
            self.albumsCache[ownerId] = albums;
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
    self.albumData.dirty = false;
    self.updateAlbumPageField();

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

      self.updateAlbumPageField();
      self.showPhotosPage();
    }).fail(onFail);
  },

  onDstAlbumChanged: function () {
    var self = AMApi;

    var selIndex = self.dstAlbumList.selectedIndex;

    if (selIndex == 1) { //save album
      self.$goBtn.button("option", "label", self.goBtnLabelSave);
    } else {
      self.$goBtn.button("option", "label", self.goBtnLabelMove);
    }
  },

  updateAlbumPageField: function () {
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

    self.$albumPageField.text(shownStr);
  },

  showPhotosPage: function () {
    var self = AMApi;

    if (!self.albumData.albumInfo) {
      return;
    }

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

    //don't change page, refresh current
    if (self.albumData.dirty) {
      self.albumData.dirty = false;
      return false;
    }

    if (self.albumData.page < self.albumData.pagesCount - 1) {
      ++self.albumData.page;
      self.updateAlbumPageField();
      return true;
    }
    return false;
  },

  slidePrevPage: function () {
    var self = AMApi;

    //don't change page, refresh current
    if (self.albumData.dirty) {
      self.albumData.dirty = false;
      return false;
    }

    if (self.albumData.page > 0) {
      --self.albumData.page;
      self.updateAlbumPageField();
      return true;
    }
    return false;
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

  invalidateAlbumPageCache: function () {
    var self = AMApi;

    var prevPagePhotos = self.albumData.pages[self.albumData.page];
    var newPagePhotos$ = self.$thumbsContainer.ThumbsViewer("getThumbsData");

    if (prevPagePhotos.length != newPagePhotos$.length) {
      self.albumData.photosCount -= (prevPagePhotos.length - newPagePhotos$.length);
      self.albumData.pagesCount = Math.ceil(self.albumData.photosCount / Settings.PhotosPerPage);

      var photos = [];
      for (var i = 0; i < newPagePhotos$.length; ++i) {
        photos.push(newPagePhotos$[i].data.vk_img);
      }

      self.albumData.pages[self.albumData.page] = photos;
      self.albumData.page = Math.min(self.albumData.page, self.albumData.pagesCount);
      self.albumData.dirty = true;
    }
  },

  onGoBtnClick: function () {
    var self = AMApi;

    var dstSelIndex = self.dstAlbumList.selectedIndex;
    if (!dstSelIndex) { //dst album not selected
      self.displayWarn("Не выбран альбом, куда перемещать фотографии");
      return;
    }

    var srcSelIndex = self.srcAlbumList.selectedIndex;
    if (self.dstAlbumList.item(dstSelIndex).value == self.srcAlbumList.item(srcSelIndex).value) {
      self.displayWarn("Нельзя переместить фотографии в тот же самый альбом!");
      return;
    }

    var selThumbsCnt = self.$thumbsContainer.ThumbsViewer("getThumbsCount").selected;
    if (!selThumbsCnt) { //no images selected
      self.displayWarn("Не выбраны фотографии для перемещения/сохранения");
      return;
    }

    function onDone() {
      //rate request
    }

    function onAlways() {
      Utils.hideSpinner();
      self.disableControls(0);

      self.invalidateAlbumPageCache();

      //update button label
      self.onDstAlbumChanged();

      self.updSelectedNum();
      self.updateAlbumPageField();
    }

    var progress = 0;

    function onProgressMove($thumb) {
      self.$progressBar.progressbar("value", ++progress);
      self.$thumbsContainer.ThumbsViewer("removeThumb", $thumb);
      self.updSelectedNum();
    }

    function onProgressSave($thumb) {
      self.$progressBar.progressbar("value", ++progress);
      $thumb.removeClass("selected");
      self.updSelectedNum();
    }

    Utils.showSpinner();
    self.disableControls(1);

    //do action
    if (self.$goBtn.button("option", "label") == self.goBtnLabelSave) {
      //save

      //collect list of selected photos
      var $thumbLists = self.$thumbsContainer.ThumbsViewer("getThumbsData", true);

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", $thumbLists.length);
      self.$progressBar.progressbar("value", 0);

    } else if (self.$goBtn.button("option", "label") == self.goBtnLabelMove) {
      //move

      //collect list of selected photos
      var $thumbListm = self.$thumbsContainer.ThumbsViewer("getThumbsData", true);

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", $thumbListm.length);
      self.$progressBar.progressbar("value", 0);

      var ownSelIndex = self.srcAlbumOwnerList.selectedIndex;
      var ownerId = self.srcAlbumOwnerList.item(ownSelIndex).value;
      var aidSelIndex = self.dstAlbumList.selectedIndex;
      var albumID = self.dstAlbumList.item(aidSelIndex).value;
      self.taskInfo.abort = false;

      self.doMovePhotos(ownerId, albumID, $thumbListm, self.taskInfo).done(onDone).always(onAlways).progress(onProgressMove);
    } else {
      //abort task
      self.taskInfo.abort = true;
      return;
    }

    //enable "Cancel" button
    self.$goBtn.button("option", "label", self.goBtnLabelCancel);
    self.$goBtn.button("enable");

    //todo: hint for service albums, that move is irreversible
    //todo: turbo move using VK API exec
  },

  doSaveAlbum: function () {
    var self = AMApi;
    //todo: hint that there are alternative methods of for saving albums
  },

  doMovePhotos: function (ownerId, targetAid, $thumbList, abortFlagRef) {
    var self = AMApi;
    var d = $.Deferred();

    var trInProgress = 0;
    var errInfo = null;

    function movePhotoSingle() {
      //stop if no more images left or the task was aborted
      if (abortFlagRef.abort || !$thumbList.length) {
        if (trInProgress) {
          //some transactions have not finished yet, waiting...
          setTimeout(movePhotoSingle, Settings.MovePhotoDelay);
        } else {
          if (!errInfo) { //no errors
            d.resolve();
          } else { //error info is not empty, something happened
            d.reject(errInfo.error, errInfo.thumbInfo);
          }
        }

        return;
      }

      ++trInProgress;
      var thumbInfo = $thumbList.shift();
      VkApiWrapper.movePhoto({
        owner_id: ownerId,
        target_album_id: targetAid,
        photo_id: thumbInfo.data.vk_img.id
      }).done(function () {
        --trInProgress;
        //report progress (caller will remove photo from container and update progress bar)
        d.notify(thumbInfo.$thumb);
      }).fail(function (error) {
        --trInProgress;
        //cancell any further tasks and set error information
        abortFlagRef.abort = true;
        errInfo = {
          error: error,
          thumbInfo: thumbInfo
        };
      });

      setTimeout(movePhotoSingle, Settings.MovePhotoDelay);
    }

    movePhotoSingle();

    return d.promise();
  },

  onReloadPageClick: function () {
    var self = AMApi;

    if (self.albumData.page in self.albumData.pages) {
      delete self.albumData.pages[self.albumData.page];
    }
    self.albumData.dirty = false;
    self.showPhotosPage();
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
  $("#Form1_ReloadAlbumPage").button();
  $("#Form1_goBtn").button();

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
