/** Copyright (c) 2013-2016 Leonid Azarenkov
	Licensed under the MIT license
*/

//requires VkApiWrapper, jQuery, highslide, spin.js
/* globals $, Utils, VkApiWrapper, VkAppUtils, VK, VKAdman, admanStat, simi, loadImage */

var Settings = {
  VkAppLocation: "https://vk.com/movephotos3",

  GetPhotosChunksSz: 200,
  MaxTotalPhotos: 1000000,
  MaxAlbumPhotos: 10000,

  RedirectDelay: 3000,
  RateRequestDelay: 1000,
  ErrorHideAfter: 6000,
  NoteHideAfter: 30000,
  BlinkDelay: 500,
  BlinkCount: 12,
  SavedAlbumTipTimes: 3,

  PhotosPageRefreshDelay: 700,
  PageSlideDelay: 1400,
  PageSlideRepeatDelay: 350,
  MovePhotoDelay: 335,
  SavePhotoDelay: 100,

  MaxGroupNameLen: 40,
  MaxOptionLength: 40,
  MaxFriendsList: 500,
  PhotosPerPage: 500,

  WallAlbumId: -7,
  ProfileAlbumId: -6,
  SavedAlbumId: -15,

  LoadImgRetries: 3,
  LoadImgSldownThresh: 10,
  LoadImgDelay: 25,

  QueryUserFields: "first_name,last_name,screen_name,first_name_gen,last_name_gen",

  vkUserId: null,
  vkSid: null
};

/* Album manager */
var AMApi = {
  srcAlbumOwnerList: null,
  srcAlbumList: null,
  srcAlbumSizeEdit: null,
  dstAlbumOwnerList: null,
  dstAlbumList: null,
  dstAlbumSizeEdit: null,

  $progressBar: null,
  $goBtn: null,

  $showPrevBtn: null,
  $showNextBtn: null,
  $albumPageField: null,
  $reloadPageBtn: null,
  $createAlbumBtn: null,

  selectedPhotosEdit: null,
  $selToggleAllBtn: null,
  $selToggleVisibleBtn: null,

  $dupSearchBtn: null,

  revThumbSortChk: null,
  $thumbsContainer: null,

  busyFlag: true,
  goBtnLabelMove: "Переместить",
  goBtnLabelSave: "Сохранить",
  goBtnLabelCancel: "Отмена",

  albumMap: {},
  albumsCache: {},
  albumData: {
    photosCount: 0,
    pagesCount: 0,
    albumId: null,
    dirty: false,
    pages: {},
    page: 0
  },
  duplicatesCache: [],

  pageRefreshTimer: null,
  pageSlideTimer: null,

  saveTipDisplayed: false,
  saveTipDisplayedKey: "saveTipDisplayed",
  savedAlbumTipDisplayed: 0,
  savedAlbumTipDisplayedKey: "savedAlbumTipDisplayed",

  duplicatesAlbumName: "duplicates",
  duplicatesAlbumIndex: 1,

  taskInfo: {
    abort: false,
  },

  init: function () {
    var self = AMApi;

    //assign variables for controls
    self.srcAlbumOwnerList = document.getElementById("Form1_SrcAlbumOwner");
    self.srcAlbumList = document.getElementById("Form1_SrcAlbumList");
    self.srcAlbumSizeEdit = document.getElementById("Form1_SrcAlbumSize");
    self.dstAlbumOwnerList = document.getElementById("Form1_DstAlbumOwner");
    self.dstAlbumList = document.getElementById("Form1_DstAlbumList");
    self.dstAlbumSizeEdit = document.getElementById("Form1_DstAlbumSize");

    self.$progressBar = $("#Progressbar");
    self.$goBtn = $("#Form1_goBtn");

    self.$showPrevBtn = $("#Form1_ShowPrev");
    self.$showNextBtn = $("#Form1_ShowNext");
    self.$albumPageField = $("#Form1_albumPageField");
    self.$reloadPageBtn = $("#Form1_ReloadAlbumPage");
    self.$createAlbumBtn = $("#Form1_CreateAlbum");
    self.$dupSearchBtn = $("#Form1_DupSearch");

    self.selectedPhotosEdit = document.getElementById("Form1_SelectedPhotos");
    self.$selToggleAllBtn = $("#Form1_SelToggleAll");
    self.$selToggleVisibleBtn = $("#Form1_SelToggleVisible");

    self.revThumbSortChk = document.getElementById("Form1_RevThumbSort");
    self.$thumbsContainer = $("#ThumbsViewer");

    self.srcAlbumOwnerList.item(0).value = Settings.vkUserId;
    self.dstAlbumOwnerList.item(0).value = Settings.vkUserId;

    //assign event handlers
    $(self.srcAlbumOwnerList).change(self.onSrcOwnerChanged);
    $(self.dstAlbumOwnerList).change(self.onDstOwnerChanged);
    $(self.srcAlbumList).change(self.onSrcAlbumChanged);
    $(self.dstAlbumList).change(self.onDstAlbumChanged);
    self.$goBtn.click(self.onGoBtnClick);
    self.$dupSearchBtn.click(self.onDupSearchBtnClick);
    self.$goBtn.button("option", "label", self.goBtnLabelMove);
    self.$showNextBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(true);
    });
    self.$showPrevBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(false);
    });
    self.$reloadPageBtn.click(self.onReloadPageClick);
    self.$createAlbumBtn.click(self.onCreateAlbumClick);
    self.$selToggleAllBtn.click(self.onSelToggleAll);
    self.$selToggleVisibleBtn.click(self.onSelToggleVisible);
    $(self.revThumbSortChk).click(self.onRevThumbSortChkClick);

    self.$thumbsContainer.on("click.AMApi", ".ThumbsViewer-thumb", function (event, parent) {
      self.$thumbsContainer.ThumbsViewer("selectToggle", $(this));
      AMApi.updSelectedNum();
    });

    $("#createAlbumDialog").dialog({
      autoOpen: false,
      //height: 400,
      width: 450,
      modal: true,
      buttons: {
        "Создать": function () {
          self.doCreateAlbum();
        },
        "Отмена": function () {
          $("#createAlbumDialog").dialog("close");
        }
      },
      close: function () {
        $("#createAlbumDialog-tips").text("Введите название нового альбома, описание опционально");
        $("#createAlbumDialog").find("form")[0].reset();
        $("#createAlbumDialog-name").removeClass("ui-state-error");
        $("#createAlbumDialog-description").removeClass("ui-state-error");
      }
    });
    $("#createAlbumDialog").find("form").on("submit", function (event) {
      event.preventDefault();
      self.doCreateAlbum();
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

    //query notifications info
    VkApiWrapper.storageGet(self.saveTipDisplayedKey + "," + self.savedAlbumTipDisplayedKey).done(function (data) {
      if (data[self.savedAlbumTipDisplayedKey]) {
        self.savedAlbumTipDisplayed = +data[self.savedAlbumTipDisplayedKey];
      }
      if (data[self.saveTipDisplayedKey]) {
        self.saveTipDisplayed = true;
      }
    });

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
    }).fail(function () {
      //initialization failed, disable controls, hide spinner
      self.busyFlag = false;
      Utils.hideSpinner();
      self.disableControls(1);
    });
  },

  displayError: function (errMsg) {
    //use global displayError(msg, errorBoxId)
    VkAppUtils.displayError(errMsg, "GlobalErrorBox", Settings.ErrorHideAfter);
  },

  displayWarn: function (warnMsg) {
    VkAppUtils.displayWarn(warnMsg, "GlobalErrorBox", Settings.ErrorHideAfter);
  },

  displayNote: function (noteMsg, hideDelay) {
    if (!hideDelay && (hideDelay !== 0)) {
      VkAppUtils.displayNote(noteMsg, "NoteBox", Settings.NoteHideAfter);
    } else {
      VkAppUtils.displayNote(noteMsg, "NoteBox", hideDelay);
    }

  },

  onFatalError: function (error) {
    var self = AMApi;

    if ("error_msg" in error) {
      VkAppUtils.displayError(error.error_msg + "<br />Попробуйте перезагрузить приложение.", "GlobalErrorBox");
    } else {
      VkAppUtils.displayError("Неизвестная ошибка, попробуйте перезагрузить приложение.", "GlobalErrorBox");
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
    self.$reloadPageBtn.button("disable"); //always disable
    self.$showPrevBtn.button(dstr);
    self.$showNextBtn.button(dstr);
    self.$createAlbumBtn.button(dstr);
    self.$dupSearchBtn.button(dstr);
    self.revThumbSortChk.disabled = dval;
    self.srcAlbumOwnerList.disabled = dval;
    self.srcAlbumList.disabled = dval;
    self.dstAlbumList.disabled = dval;
  },

  updateSrcAlbumsListBox: function (albums) {
    var self = AMApi;
    self.srcAlbumList.selectedIndex = 0;

    //remove old options, skip "not selected" and "duplicates" options
    for (var i = self.srcAlbumList.length - 1; i >= 2; --i) {
      self.srcAlbumList.remove(i);
    }
    self.albumMap = {};

    for (i = 0; i < albums.length; i++) {
      self.albumMap[albums[i].id] = albums[i].title;

      //put service albums to the beginning
      var index = null;
      if ((albums[i].owner_id > 0) && (albums[i].id == Settings.ProfileAlbumId)) {
        continue;
      } else if (albums[i].id < 0) {
        index = 2;
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
      if ((albums[i].owner_id > 0) && (albums[i].id == Settings.WallAlbumId)) {
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
    self.duplicatesCache = [];

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
        need_system: 1,
        album_ids: (ownerId < 0) ? Settings.WallAlbumId : ""
      }).done(function (albums) {
        self.albumsCache[ownerId] = albums;
        doUpdate();
      }).fail(self.onFatalError);
    }
  },

  onDstOwnerChanged: function () {
    var self = AMApi;

    var ownerId = self.dstAlbumOwnerList.value;

    function doUpdate() {
      self.updateDstAlbumsListBox(self.albumsCache[ownerId]);
      self.onDstAlbumChanged();
    }

    self.displayNote(); //hide advice

    if (ownerId in self.albumsCache) {
      doUpdate();
    }
  },

  onSrcAlbumChanged: function () {
    var self = AMApi;
    var ddd = $.Deferred();

    self.$thumbsContainer.ThumbsViewer("empty");
    self.updSelectedNum();

    //clean album data
    self.albumData.photosCount = 0;
    self.albumData.pagesCount = 0;
    self.albumData.albumId = null;
    self.albumData.pages = {};
    self.albumData.page = 0;
    self.albumData.dirty = false;
    self.updateAlbumPageField();

    var selIndex = self.srcAlbumList.selectedIndex;
    var ownerId = self.srcAlbumOwnerList.value;
    var albumId = self.srcAlbumList.value;

    if (!selIndex) { //not selected
      Utils.hideSpinner();
      self.disableControls(0);
      ddd.resolve();
      return ddd.promise();
    }

    function onFail() {
      Utils.hideSpinner();
      self.disableControls(0);
      self.srcAlbumList.selectedIndex = 0;
      ddd.resolve();
    }

    if ((self.savedAlbumTipDisplayed < Settings.SavedAlbumTipTimes) && (albumId == Settings.SavedAlbumId)) {
      self.displayNote("<strong>Совет:</sctrong> Альбом &quot;Сохранённые фотографии&quot; является служебным, вернуть перемещённые фотографии в этот альбом нельзя!", Settings.NoteHideAfter / 2);
      VkApiWrapper.storageSet(self.savedAlbumTipDisplayedKey, ++self.savedAlbumTipDisplayed);
    }

    //update album data
    Utils.showSpinner();
    self.disableControls(1);

    self.queryAlbumPhotos(ownerId, albumId, 0, Settings.PhotosPerPage).done(function (photos, count) {
      self.albumData.photosCount = count;
      self.albumData.pagesCount = Math.ceil(count / Settings.PhotosPerPage);
      self.albumData.pages[0] = photos;
      self.albumData.albumId = albumId;

      self.updateAlbumPageField();
      self.showPhotosPage().always(function () {
        ddd.resolve();
      });
    }).fail(onFail);

    return ddd.promise();
  },

  onDstAlbumChanged: function () {
    var self = AMApi;

    var selIndex = self.dstAlbumList.selectedIndex;

    if (selIndex == 1) { //save album
      self.$goBtn.button("option", "label", self.goBtnLabelSave);
      if (!self.saveTipDisplayed) {
        self.displayNote("<strong>Совет:</sctrong><br /><ul><li>Открывшуюся страницу с фотографиями можно сохранить, используя сочетание клавиш CTRL+S.</li><li>Также, удобно загружать фотографии с помощью сервиса <a href='https://yandex.ru/support/disk/uploading.html#uploading__social-networks' target='_blank'><u>Яндекс Диск</u></a>.</li><li>&quot;Сохранение&quot; работает корректно только с браузерами Google Chrome и Mozilla Firefox!</li></ul>");
        self.saveTipDisplayed = true;
        //VkApiWrapper.storageSet(self.saveTipDisplayedKey, "1");
      }
      self.dstAlbumSizeEdit.value = "0";
    } else if (selIndex > 1) {
      self.displayNote(); //hide advice

      //query album size
      Utils.showSpinner();
      self.disableControls(1);

      var ownerId = self.dstAlbumOwnerList.value;
      var albumID = self.dstAlbumList.value;

      VkApiWrapper.queryPhotos({
        owner_id: ownerId,
        album_id: albumID,
        offset: 0,
        count: 0
      }).fail(function () {
        Utils.hideSpinner();
        self.disableControls(0);
        self.dstAlbumSizeEdit.value = "";
      }).done(function (response) {
        Utils.hideSpinner();
        self.disableControls(0);
        self.dstAlbumSizeEdit.value = response.count;
      });
      self.$goBtn.button("option", "label", self.goBtnLabelMove);
    } else { //not selected
      self.displayNote(); //hide advice
      self.dstAlbumSizeEdit.value = "0";
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
      self.srcAlbumSizeEdit.value = self.albumData.photosCount;
    } else {
      shownStr = "-/-";
      self.srcAlbumSizeEdit.value = "0";
    }

    self.$albumPageField.text(shownStr);
  },

  showPhotosPage: function () {
    var self = AMApi;
    var ddd = $.Deferred();

    if (!self.albumData.albumId) {
      ddd.resolve();
      return ddd.promise();
    }

    function showThumbs() {
      self.$thumbsContainer.ThumbsViewer("empty");
      self.$thumbsContainer.ThumbsViewer("updateAlbumMap", self.albumMap);
      self.$thumbsContainer.ThumbsViewer("addThumbList", self.albumData.pages[self.albumData.page]).done(function () {
        self.updSelectedNum();
        Utils.hideSpinner();
        self.disableControls(0);
        ddd.resolve();
      });
    }

    Utils.showSpinner();
    self.disableControls(1);

    //check if photos were downloaded for the current page
    if (self.albumData.page in self.albumData.pages) {
      showThumbs();
    } else {
      //download images for the current page

      var ownerId = self.srcAlbumOwnerList.value;
      var offset = self.albumData.page * Settings.PhotosPerPage;

      self.queryAlbumPhotos(ownerId, self.albumData.albumId, offset, Settings.PhotosPerPage).done(function (photos, count) {
        self.albumData.pages[self.albumData.page] = photos;
        showThumbs();
      }).fail(self.onFatalError);
    }

    return ddd.promise();
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
      self.$reloadPageBtn.button("disable");
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
      self.$reloadPageBtn.button("disable");
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

    self.albumData.photosCount -= (prevPagePhotos.length - newPagePhotos$.length);
    self.albumData.pagesCount = Math.ceil(self.albumData.photosCount / Settings.PhotosPerPage);
    self.albumData.pages = {};
    if (self.albumData.pagesCount) {
      self.albumData.page = Math.min(self.albumData.page, self.albumData.pagesCount - 1);
    } else {
      self.albumData.page = 0;
    }

    if (newPagePhotos$.length) {
      //don't refresh page automatically if there are some photos left
      var p = [];
      for (var i = 0; i < newPagePhotos$.length; ++i) {
        p.push(newPagePhotos$[i].data.vk_img);
      }
      self.albumData.pages[self.albumData.page] = p;

      self.albumData.dirty = true;
      self.$reloadPageBtn.button("enable");
    } else {
      //page is empty, refresh it
      self.onReloadPageClick();
    }
  },

  queryAlbumPhotos: function (ownerId, albumId, offset, maxCount, filterFn, noExtended) {
    var self = AMApi;
    if (albumId == self.duplicatesAlbumName) {
      var ddd = $.Deferred();
      ddd.resolve(self.duplicatesCache.slice(offset, offset + maxCount));
      return ddd.promise();
    }
    return VkAppUtils.queryAlbumPhotos(ownerId, albumId, offset, maxCount, filterFn, noExtended);
  },

  collectAllPhotos: function (ownerId) {
    var self = AMApi;
    var ddd = $.Deferred();

    var progress = 0;

    function onProgress(p) {
      progress += p;
      self.$progressBar.progressbar("value", progress);
    }

    var allPhotosList = [];

    function pushPhotos(photos) {
      allPhotosList = allPhotosList.concat(photos);
    }

    //request total number of photos for progress reporting purpose
    VkAppUtils.getTotalPhotosCount(ownerId).done(function (totalPhotosCount) {

      //no photos, nothing to do
      if (!totalPhotosCount) {
        self.$progressBar.progressbar("option", "max", 0);
        self.$progressBar.progressbar("value", 0);

        ddd.resolve();
        return;
      }

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", totalPhotosCount);
      self.$progressBar.progressbar("value", 0);

      //query photos from all albums and from service albums
      var d1 = VkAppUtils.queryAllPhotos(ownerId, 0, Settings.MaxTotalPhotos, false, true);
      var d2 = VkAppUtils.queryAlbumPhotos(ownerId, 'saved', 0, Settings.MaxTotalPhotos, false, true);
      var d3 = VkAppUtils.queryAlbumPhotos(ownerId, 'wall', 0, Settings.MaxTotalPhotos, false, true);
      var d4 = VkAppUtils.queryAlbumPhotos(ownerId, 'profile', 0, Settings.MaxTotalPhotos, false, true);

      d1.progress(onProgress).done(pushPhotos);
      d2.progress(onProgress).done(pushPhotos);
      d3.progress(onProgress).done(pushPhotos);
      d4.progress(onProgress).done(pushPhotos);

      //when all photos have been retreived
      $.when(d1, d2, d3, d4).fail(function () {
        ddd.reject();
      }).done(function () {
        ddd.resolve(allPhotosList);
      });
    }).fail(function () {
      ddd.reject();
    });

    return ddd.promise();
  },

  collectAlbumPhotos: function (ownerId, albumId) {
    var self = AMApi;
    var ddd = $.Deferred();

    var progress = 0;

    function onProgress(p) {
      progress += p;
      self.$progressBar.progressbar("value", progress);
    }

    //request total number of photos for progress reporting purpose
    VkApiWrapper.queryPhotos({
      owner_id: ownerId,
      album_id: albumId,
      offset: 0,
      count: 0
    }).done(function (rsp) {
      var photosCount = rsp.count;

      //no photos, nothing to do
      if (!photosCount) {
        self.$progressBar.progressbar("option", "max", 0);
        self.$progressBar.progressbar("value", 0);

        ddd.resolve();
        return;
      }

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", photosCount);
      self.$progressBar.progressbar("value", 0);

      VkAppUtils.queryAlbumPhotos(ownerId, albumId, 0, Settings.MaxTotalPhotos, false, true).progress(onProgress).done(function (photos) {
        ddd.resolve(photos);
      }).fail(function (error) {
        ddd.reject(error);
      });
    }).fail(function () {
      ddd.reject();
    });

    return ddd.promise();
  },

  reportFailedImages: function (images) {
    var self = AMApi;

    function compareById(a, b) {
      if (a.id < b.id) {
        return -1;
      } else if (a.id > b.id) {
        return 1;
      }
      return 0;
    }

    function printFailedPhotos($where) {
      images = images.sort(compareById);

      var $ul = $("<ul />");
      $where.append($ul);

      for (var i = 0; i < images.length; ++i) {
        var imgSrc = Utils.fixHttpUrl(images[i].photo_130);
        var str = "ID: " + images[i].id + ", URL: " + imgSrc;
        $ul.append($("<li />", {
          html: str
        }));
      }
    }

    function waitLoad() {
      divPhotos = popUp.document.getElementById("photos");
      if (divPhotos) {
        popUp.document.title = title;
        printFailedPhotos($(divPhotos));
      } else {
        setTimeout(waitLoad, WaitPageLoadTmout);
      }
    }

    //open new window and wait when it's loaded
    var popUp = window.open("SaveAlbum.html", "_blank", "location=yes,menubar=yes,toolbar=yes,titlebar=yes,scrollbars=yes", false);
    var title = "Failed photos";
    var divPhotos = null;
    var WaitPageLoadTmout = 100;
    setTimeout(waitLoad, WaitPageLoadTmout);

  },

  loadVkImages: function (photosList, abortFlagRef) {
    var self = AMApi;
    var ddd = $.Deferred();

    var loadImgQueue = photosList;
    var loadInProgressCnt = 0;
    var failedImages = [];

    function loadImg__() {
      //stop if no more images left and all loaded or the task was aborted
      if (abortFlagRef.abort || (!loadImgQueue.length && !loadInProgressCnt)) {
        ddd.resolve();
        self.reportFailedImages(failedImages);
        return;
      }

      //timeout depends on number of images being loaded
      var tmout = (loadInProgressCnt < Settings.LoadImgSldownThresh) ? Settings.LoadImgDelay : loadInProgressCnt * Settings.LoadImgDelay;

      if (loadImgQueue.length) {
        ++loadInProgressCnt;
        var vk_img = loadImgQueue.shift();
        //var imgSrc = Utils.fixHttpUrl(vk_img.photo_75);
        var imgSrc = Utils.fixHttpUrl(vk_img.photo_130);

        //slow down for retries
        if (vk_img.loadAttempts) {
          tmout = loadInProgressCnt * Settings.LoadImgDelay;
        }

        loadImage(
          imgSrc,
          function (result) {
            if (result.type === "error") {
              if (!("loadAttempts" in vk_img)) {
                vk_img.loadAttempts = 0;
              }

              if (++vk_img.loadAttempts < Settings.LoadImgRetries) {
                loadImgQueue.push(vk_img);
              } else {
                console.warn("AMApi::loadImg__() failed to load '" + imgSrc + "', att=" + vk_img.loadAttempts);
                failedImages.push(vk_img);
              }

              --loadInProgressCnt;
            } else {
              --loadInProgressCnt;
              ddd.notify(result, vk_img);
            }
          }, {
            canvas: false,
            noRevoke: true,
            crossOrigin: "Anonymous"
          }
        );
      }

      setTimeout(function () {
        loadImg__();
      }, tmout);
    }

    loadImg__();

    return ddd.promise();
  },

  onDupSearchBtnClick: function () {
    var self = AMApi;

    var srcSelIndex = self.srcAlbumList.selectedIndex;
    var ownerId = self.srcAlbumOwnerList.value;
    var albumId = self.srcAlbumList.value;
    var atitle = self.srcAlbumList.item(srcSelIndex).text;

    if (srcSelIndex == self.duplicatesAlbumIndex) {
      //nothing to do
      return;
    }

    //show empty "duplicates" album while collecting data
    self.duplicatesCache = [];
    self.srcAlbumList.selectedIndex = self.duplicatesAlbumIndex;
    self.onSrcAlbumChanged().done(function () {
      Utils.showSpinner();
      self.disableControls(1);
    });

    if (!srcSelIndex) {
      //album not selected, search duplicates in all photos
      self.displayNote("Поиск дубликатов изображений по всем альбомам: загрузка списка изображений ...", 0);

      self.collectAllPhotos(ownerId).done(onPhotosListLoaded).fail(onFail);
    } else {
      //search duplicates in selected album
      self.displayNote("Поиск дубликатов изображений в альбоме &quot;" + atitle + "&quot;: загрузка списка изображений ...", 0);

      self.collectAlbumPhotos(ownerId, albumId).done(onPhotosListLoaded).fail(onFail);
    }

    function onFail() {
      Utils.hideSpinner();
      self.disableControls(0);

      //update button label
      self.onDstAlbumChanged();
    }

    var imgHashedList = [];

    function onImageLoaded(img, vk_img) {
      var hash = simi.hash(img);
      imgHashedList.push({
        hash: hash,
        id: vk_img.id
      });

      //dispose unnecessary image
      if (img._objectURL) {
        loadImage.revokeObjectURL(img._objectURL);
        delete img._objectURL;
      }

      self.$progressBar.progressbar("value", imgHashedList.length);
    }

    function onPhotosListLoaded(photosList) {
      //enable "Cancel" button
      self.$goBtn.button("option", "label", self.goBtnLabelCancel);
      self.$goBtn.button("enable");

      //TODO: show time estimation for image loadding
      var timeEst = photosList.length * Settings.LoadImgDelay * 2;
      var timeEstHms = new Date(timeEst).toISOString().substr(11, 8);
      var startTime = new Date();
      self.displayNote("Поиск дубликатов изображений: загрузка изображений займет " + timeEstHms + " ...", 0);
      self.$progressBar.progressbar("option", "max", photosList.length);
      self.$progressBar.progressbar("value", 0);

      //load images and calculate hashes
      self.taskInfo.abort = false;
      self.loadVkImages(photosList, self.taskInfo).done(function () {
        var endTime = new Date();
        var actualTime = endTime - startTime;
        var actualTimeHms = new Date(actualTime).toISOString().substr(11, 8);
        console.log("Image load estimated time was: " + timeEstHms + ", actual time was " + actualTimeHms);

        //images loaded, hashes calculated, sort images and get duplicates
        var dupImgIdList = findDuplicates(imgHashedList);

        //query photos by their ids in list of duplicates
        var dupcount = dupImgIdList.length;
        VkAppUtils.queryPhotosById(ownerId, dupImgIdList).done(function (photosList) {
          self.duplicatesCache = photosList; //save photos to the cache

          //!!!DEBUG: replace likes with hash for debugging
          for (var k = 0; k < photosList.length; ++k) {
            photosList[k].likes.count = dupIdHashMap[photosList[k].id];
          }

          self.onSrcAlbumChanged();

          //update GO button label
          self.onDstAlbumChanged();

          self.displayNote("Найдено " + dupcount + " возможных дубликатов изображений");
        }).fail(onFail);
      }).progress(onImageLoaded);
    }

    function compareByHash(a, b) {
      if (a.hash < b.hash) {
        return -1;
      } else if (a.hash > b.hash) {
        return 1;
      }
      return 0;
    }

    var dupIdHashMap = {}; //!!!DEBUG
    function findDuplicates(imgHashedList_) {
      var dupImgIdList_ = [];

      //sort by hash and collect duplicates to the dupImgIdList_
      imgHashedList_ = imgHashedList_.sort(compareByHash);
      for (var i = 0; i < imgHashedList_.length - 1; ++i) {
        if (imgHashedList_[i].hash == imgHashedList_[i + 1].hash) {
          var h = imgHashedList_[i].hash;
          while ((i < imgHashedList_.length) && (imgHashedList_[i].hash == h)) {
            dupImgIdList_.push(imgHashedList_[i].id);
            dupIdHashMap[imgHashedList_[i].id] = h; //!!!DEBUG
            ++i;
          }
        }
      }
      return dupImgIdList_;
    }

  },

  onGoBtnClick: function () {
    var self = AMApi;

    if (self.$goBtn.button("option", "label") == self.goBtnLabelCancel) {
      //abort current task
      self.taskInfo.abort = true;
      return;
    }

    if (!self.dstAlbumList.selectedIndex) { //dst album not selected
      self.displayWarn("Не выбран альбом, куда перемещать фотографии");
      return;
    }

    if (self.dstAlbumList.value == self.srcAlbumList.value) {
      self.displayWarn("Нельзя переместить фотографии в тот же самый альбом!");
      return;
    }

    var selThumbsCnt = self.$thumbsContainer.ThumbsViewer("getThumbsCount").selected;
    if (!selThumbsCnt) { //no images selected
      self.displayWarn("Не выбраны фотографии для перемещения/сохранения");
      return;
    }

    function onDoneMove() {
      VkAppUtils.rateRequest(Settings.RateRequestDelay);
    }

    function onFailMove(error) {
      if (error) {
        self.displayWarn(error);
      }
    }

    function onAlwaysSave() {
      Utils.hideSpinner();
      self.disableControls(0);
      self.updSelectedNum();

      //update button label
      self.onDstAlbumChanged();
    }

    function onAlwaysMove() {
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
      self.$thumbsContainer.ThumbsViewer("selectToggle", $thumb);
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

      self.taskInfo.abort = false;
      var selIdx = self.srcAlbumList.selectedIndex;
      self.doSaveAlbum(self.srcAlbumList.item(selIdx).text, $thumbLists, self.taskInfo).progress(onProgressSave).always(onAlwaysSave);
    } else if (self.$goBtn.button("option", "label") == self.goBtnLabelMove) {
      //move

      //collect list of selected photos
      var $thumbListm = self.$thumbsContainer.ThumbsViewer("getThumbsData", true);

      //check album overflow
      if ($thumbListm.length + self.dstAlbumSizeEdit.value > Settings.MaxAlbumPhotos) {
        self.displayError("Переполнение альбома, невозможно поместить в один альбом больше " + Settings.MaxAlbumPhotos + " фотографий.");
        return;
      }

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", $thumbListm.length);
      self.$progressBar.progressbar("value", 0);

      var ownerId = self.srcAlbumOwnerList.value;
      var albumID = self.dstAlbumList.value;
      self.taskInfo.abort = false;

      self.doMovePhotosFast(ownerId, albumID, $thumbListm, self.taskInfo).done(onDoneMove).fail(onFailMove).always(onAlwaysMove).progress(onProgressMove);
    }

    //enable "Cancel" button
    self.$goBtn.button("option", "label", self.goBtnLabelCancel);
    self.$goBtn.button("enable");

  },

  doSaveAlbum: function (albumTitle, $thumbList, abortFlagRef) {
    var self = AMApi;
    var WaitPageLoadTmout = 100;
    var d = $.Deferred();

    //add leading zero
    function lzn(num) {
      return (num < 10) ? "0" + num : "" + num;
    }

    function savePhoto($where, num) {
      if (abortFlagRef.abort || !$thumbList.length) {
        d.resolve();
      }

      var thumbInfo = $thumbList.shift();
      var vk_img = thumbInfo.data.vk_img;
      var src = VkAppUtils.getVkImgMaxSizeSrc(vk_img);

      var cD = new Date(vk_img.date * 1000);
      var createdStr = lzn(cD.getDay()) + "." + lzn(cD.getMonth()) + "." + cD.getFullYear() + " " + lzn(cD.getHours()) + ":" + lzn(cD.getMinutes()) + ":" + lzn(cD.getSeconds());
      var text = vk_img.text ? $("<div>").text(vk_img.text).html() : "";

      var htmlStr = "";
      htmlStr = htmlStr + "<p> Фото №" + num + ", " + createdStr;
      if (text.length) {
        htmlStr = htmlStr + ", " + text + "</p>";
      } else {
        htmlStr = htmlStr + "</p>";
      }
      htmlStr = htmlStr + "<img src=\"" + src + "\" alt=\"" + text + "\"/ ><br/ ><br/ >";

      $where.append(htmlStr);
      d.notify(thumbInfo.$thumb);

      setTimeout(function () {
        savePhoto($where, num + 1);
      }, Settings.SavePhotoDelay);
    }

    function waitLoad() {
      divPhotos = popUp.document.getElementById("photos");
      if (divPhotos) {
        popUp.document.title = title;
        savePhoto($(divPhotos), 1);
      } else {
        setTimeout(waitLoad, WaitPageLoadTmout);
      }
    }

    //open new window and wait when it's loaded
    var popUp = window.open("SaveAlbum.html", "_blank", "location=yes,menubar=yes,toolbar=yes,titlebar=yes,scrollbars=yes", false);
    var title = "Фотографии из альбома \"" + albumTitle + "\"";
    var divPhotos = null;
    setTimeout(waitLoad, WaitPageLoadTmout);

    return d.promise();
  },

  doMovePhotosFast: function (ownerId, targetAid, $thumbList, abortFlagRef) {
    var self = AMApi;
    var d = $.Deferred();

    var GroupSize = 25;
    var errInfo = null;
    var trInProgress = 0;

    function getIds(obj) {
      return obj.data.vk_img.id;
    }

    function movePhotoGroup() {
      //stop if no more images left or the task was aborted
      if (abortFlagRef.abort || !$thumbList.length) {
        if (trInProgress) {
          //some transactions have not finished yet, waiting...
          setTimeout(movePhotoGroup, Settings.MovePhotoDelay);
        } else {
          if (!errInfo) { //no errors
            d.resolve();
          } else { //error info is not empty, something happened
            d.reject(errInfo.error_msg);
          }
        }
        return;
      }

      var thumbGrp = $thumbList.splice(0, GroupSize);
      var ids = thumbGrp.map(getIds);
      ++trInProgress;
      VkApiWrapper.movePhotoList(ownerId, targetAid, ids).fail(function (err) {
        abortFlagRef.abort = true;
        --trInProgress;
        d.reject(err.error_msg);
      }).done(function (rsp) {
        --trInProgress;
        for (var i = 0; i < thumbGrp.length; ++i) {
          if (rsp[i]) {
            d.notify(thumbGrp[i].$thumb);
          } else {
            errInfo = {
              error_msg: "Не удалось переместить некоторые фотографии, попробуйте еще раз."
            };
          }
        }
        movePhotoGroup();
      });
    }

    movePhotoGroup();

    return d.promise();
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
            d.reject(errInfo.error_msg, errInfo.thumbInfo);
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
          error_msg: error.error_msg,
          thumbInfo: thumbInfo
        };
      });

      setTimeout(movePhotoSingle, Settings.MovePhotoDelay);
    }

    movePhotoSingle();

    return d.promise();
  },

  doCreateAlbum: function () {
    var self = AMApi;

    //validate parameters
    function updateTips(t) {
      var tips = $("#createAlbumDialog-tips");
      tips
        .text(t)
        .addClass("ui-state-highlight");
      setTimeout(function () {
        tips.removeClass("ui-state-highlight", 1500);
      }, 500);
    }

    var albumName = $("#createAlbumDialog-name").val().trim();
    var albumDescr = $("#createAlbumDialog-description").val().trim();

    if (!albumName.length) {
      updateTips("Название альбома не может быть пустым!");
      $("#createAlbumDialog-name").addClass("ui-state-error");
      return;
    }

    var ownerId = self.dstAlbumOwnerList.value;

    //try to create album
    $("#createAlbumDialog").dialog("close");
    Utils.showSpinner();
    self.disableControls(1);

    VkApiWrapper.createAlbum({
      title: albumName,
      group_id: (ownerId < 0) ? -ownerId : "",
      description: albumDescr,
      privacy_view: "only_me",
      upload_by_admins_only: 1,
      comments_disabled: 1
    }).done(function (album) {
      //push new album to list boxes
      self.albumsCache[ownerId].push(album);

      var opt = new Option(album.title, album.id, false, false);
      $(opt).data("AMApi", album);
      self.srcAlbumList.add(opt, 1);

      var index = 2;
      opt = new Option(album.title, album.id, false, false);
      self.dstAlbumList.add(opt, index);
      self.dstAlbumList.selectedIndex = index;
      self.onDstAlbumChanged();
    }).always(function () {
      Utils.hideSpinner();
      self.disableControls(0);
    });

  },

  onReloadPageClick: function () {
    var self = AMApi;

    if (self.albumData.page in self.albumData.pages) {
      delete self.albumData.pages[self.albumData.page];
    }
    self.albumData.dirty = false;
    self.$reloadPageBtn.button("disable");
    self.showPhotosPage();
  },

  onCreateAlbumClick: function () {
    var self = AMApi;
    $("#createAlbumDialog").dialog("open");
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
    self.selectedPhotosEdit.value = cnt.selected + "/" + cnt.total;
  }
};

//Initialize application
$(function () {
  Settings.vkUserId = Utils.sanitizeParameter(Utils.getParameterByName("viewer_id"));
  Settings.vkSid = Utils.sanitizeParameter(Utils.getParameterByName("sid"));

  VkAppUtils.validateApp(Settings.vkSid, Settings.VkAppLocation, Settings.RedirectDelay);

  $("#ThumbsViewer").ThumbsViewer({
    disableSel: false
  });
  $("#Progressbar").progressbar({
    value: 0
  });

  $("#Form1_SelToggleAll").button();
  $("#Form1_SelToggleVisible").button();
  $("#Form1_CreateAlbum").button();
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
  $("#Form1_DupSearch").button();

  $("#welcome_dialog").dialog({
    autoOpen: false,
    show: {
      effect: "fade",
      duration: 1500
    },
    hide: true,
    modal: false,
    width: 650,
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
    width: 650,
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
      if (typeof VKAdman !== 'undefined') {
        var app_id = 3231070; //release: 3231070, beta: 3294304
        var a = new VKAdman();
        a.setupPreroll(app_id);
        admanStat(app_id, Settings.vkUserId);
      }

      VK.Widgets.Like("vk_like", {
        type: "button",
        height: 24
      }, 500);

      d.resolve();
    },
    function () {
      // API initialization failed
      VkAppUtils.displayError("Не удалось инициализировать VK JS API! Попробуйте перезагрузить приложение.", "GlobalErrorBox");
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
