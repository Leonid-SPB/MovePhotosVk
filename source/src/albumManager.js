/** Copyright (c) 2013-2016 Leonid Azarenkov
	Licensed under the MIT license
*/

//requires VkApiWrapper, jQuery, highslide, spin.js
/* globals $, Utils, VkApiWrapper, VkAppUtils, VK, VKAdman, admanStat */

var Settings = {
  VkAppLocation: "https://vk.com/movephotos3",
  GetPhotosChunksSz: 200,
  ErrorHideAfter: 6000,
  NoteHideAfter: 30000,
  MaxTotalPhotos: 1000000,
  RateRequestDelay: 1000,
  BlinkDelay: 500,
  BlinkCount: 12,
  RedirectDelay: 3000,
  MaxGroupNameLen: 40,
  MaxOptionLength: 40,
  MaxFriendsList: 500,
  PhotosPerPage: 500,
  PhotosPageRefreshDelay: 700,
  PageSlideDelay: 1400,
  PageSlideRepeatDelay: 350,
  MovePhotoDelay: 335,
  SavePhotoDelay: 100,
  WallAlbumId: -7,
  ProfileAlbumId: -6,
  SavedAlbumId: -15,

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

  revThumbSortChk: null,
  $thumbsContainer: null,

  busyFlag: true,
  goBtnLabelMove: "Переместить",
  goBtnLabelSave: "Сохранить",
  goBtnLabelCopy: "Копировать",
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

  saveTipDisplayed: false,
  saveTipDisplayedKey: "saveTipDisplayed",
  savedAlbumTipDisplayed: false,
  savedAlbumTipDisplayedKey: "savedAlbumTipDisplayed",

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
        self.savedAlbumTipDisplayed = true;
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
    if (!hideDelay) {
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
    self.$createAlbumBtn.button((self.$goBtn.button("option", "label") != self.goBtnLabelSave) ? dstr : "disable");
    self.revThumbSortChk.disabled = dval;
    self.srcAlbumOwnerList.disabled = dval;
    self.dstAlbumOwnerList.disabled = dval;
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

    for (i = 0; i < albums.length; i++) {
      //put service albums to the beginning
      var index = null;
      if ((albums[i].owner_id > 0) && (albums[i].id == Settings.ProfileAlbumId)) {
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
    //i >= 1 to skip "not selected" option
    for (var i = self.dstAlbumList.length - 1; i >= 1; --i) {
      self.dstAlbumList.remove(i);
    }

    //add new options
    for (i = 0; i < albums.length; i++) {
      var index = null;
      if ((albums[i].owner_id > 0) && (albums[i].id == Settings.WallAlbumId)) {
        index = 1;
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
      //synchronize to dstAlbumOwner, index mapping: 0 -> 0, i -> i+1 because of "Save" option
      self.dstAlbumOwnerList.selectedIndex = selIndex ? selIndex + 1 : selIndex;
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

    var srcSelIndex = self.srcAlbumOwnerList.selectedIndex;
    var dstSelIndex = self.dstAlbumOwnerList.selectedIndex;
    var ownerId = self.dstAlbumOwnerList.value;

    function doUpdate() {
      self.updateDstAlbumsListBox(self.albumsCache[ownerId]);
      self.onDstAlbumChanged();
    }

    self.displayNote(); //hide advice
    self.$createAlbumBtn.button("enable");

    //index mapping: 0 -> 0, i -> i+1 because of "Save" option
    if ((!srcSelIndex && !dstSelIndex) || srcSelIndex && (dstSelIndex == srcSelIndex + 1)) {
      self.$goBtn.button("option", "label", self.goBtnLabelMove);
    } else if (dstSelIndex == 1) {
      self.$goBtn.button("option", "label", self.goBtnLabelSave);
      self.$createAlbumBtn.button("disable");
      self.albumsCache[ownerId] = {};
      if (!self.saveTipDisplayed) {
        self.displayNote("<strong>Совет:</sctrong><br /><ul><li>Открывшуюся страницу с фотографиями можно сохранить, используя сочетание клавиш CTRL+S.</li><li>Также, удобно загружать фотографии с помощью сервиса <a href='https://yandex.ru/support/disk/uploading.html#uploading__social-networks' target='_blank'><u>Яндекс Диск</u></a>.</li><li>&quot;Сохранение&quot; работает корректно только с браузерами Google Chrome и Mozilla Firefox!</li></ul>");
        self.saveTipDisplayed = true;
        //VkApiWrapper.storageSet(self.saveTipDisplayedKey, "1");
      }
    } else {
      self.$goBtn.button("option", "label", self.goBtnLabelCopy);
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
    var ownerId = self.srcAlbumOwnerList.value;
    var albumId = self.srcAlbumList.value;

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

    if ((!self.savedAlbumTipDisplayed) && (albumId == Settings.SavedAlbumId)) {
      self.displayNote("<strong>Совет:</sctrong> Альбом &quot;Сохранённые фотографии&quot; является служебным, вернуть перемещённые фотографии в этот альбом нельзя.", Settings.NoteHideAfter / 2);
      self.savedAlbumTipDisplayed = true;
      VkApiWrapper.storageSet(self.savedAlbumTipDisplayedKey, "1");
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
    if (selIndex > 0) {
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
        count: 0,
        extended: 1,
        photo_sizes: 1,
        no_service_albums: 0
      }).fail(function () {
        Utils.hideSpinner();
        self.disableControls(0);
        self.dstAlbumSizeEdit.value = "";
      }).done(function (response) {
        Utils.hideSpinner();
        self.disableControls(0);
        self.dstAlbumSizeEdit.value = response.count;
      });
    } else { //not selected
      self.dstAlbumSizeEdit.value = "0";
      Utils.hideSpinner();
      self.disableControls(0);
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

  onGoBtnClick: function () {
    var self = AMApi;

    var selThumbsCnt = self.$thumbsContainer.ThumbsViewer("getThumbsCount").selected;
    if (!selThumbsCnt) { //no images selected
      self.displayWarn("Не выбраны фотографии для перемещения/сохранения");
      return;
    }

    var dstSelIndex = self.dstAlbumList.selectedIndex;
    if (!dstSelIndex && (self.$goBtn.button("option", "label") != self.goBtnLabelSave)) { //dst album not selected
      self.displayWarn("Не выбран альбом, куда перемещать фотографии");
      return;
    }

    var srcSelIndex = self.srcAlbumList.selectedIndex;
    if ((self.dstAlbumList.value == self.srcAlbumList.value) && (self.$goBtn.button("option", "label") == self.goBtnLabelMove)) {
      self.displayWarn("Нельзя переместить фотографии в тот же самый альбом!");
      return;
    }

    function onDoneMoveCopy() {
      VkAppUtils.rateRequest(Settings.RateRequestDelay);
    }

    function onFailMoveCopy(error) {
      if (error) {
        self.displayWarn(error);
      }
    }

    function onAlwaysSaveCopy() {
      Utils.hideSpinner();
      self.disableControls(0);
      self.updSelectedNum();

      self.onDstAlbumChanged();
    }

    function onAlwaysMove() {
      Utils.hideSpinner();
      self.disableControls(0);

      self.invalidateAlbumPageCache();

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

    function onProgressSaveCopy($thumb) {
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
      self.doSaveAlbum(self.srcAlbumList.item(selIdx).text, $thumbLists, self.taskInfo).progress(onProgressSaveCopy).always(onAlwaysSaveCopy);
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

      self.doMovePhotosFast(ownerId, albumID, $thumbListm, self.taskInfo).done(onDoneMoveCopy).fail(onFailMoveCopy).always(onAlwaysMove).progress(onProgressMove);
    } else if (self.$goBtn.button("option", "label") == self.goBtnLabelCopy) {
      //copy (upload)

      //collect list of selected photos
      var $thumbListc = self.$thumbsContainer.ThumbsViewer("getThumbsData", true);

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", $thumbListc.length);
      self.$progressBar.progressbar("value", 0);

      var dstOwnerId = self.dstAlbumOwnerList.value;
      var dstAlbumId = self.dstAlbumList.value;
      self.taskInfo.abort = false;
      self.doCopyPhotos(dstOwnerId, dstAlbumId, $thumbListc, self.taskInfo).done(onDoneMoveCopy).fail(onFailMoveCopy).always(onAlwaysSaveCopy).progress(onProgressSaveCopy);
    } else {
      //abort task
      self.taskInfo.abort = true;
      return;
    }

    //enable "Cancel" button
    self.$goBtn.button("option", "label", self.goBtnLabelCancel);
    self.$goBtn.button("enable");
  },

  doCopyPhotos: function (dstOwnerId, dstAlbumId, $thumbList, abortFlagRef) {
    var self = AMApi;
    var d = $.Deferred();

    var GroupSize = 5;
    var errInfo = null;
    var trInProgress = 0;

    function getVkImgs(obj) {
      return obj.data.vk_img;
    }

    function uploadPhotoGroup() {
      //stop if no more images left or the task was aborted
      if (abortFlagRef.abort || !$thumbList.length) {
        if (trInProgress) {
          //some transactions have not finished yet, waiting...
          setTimeout(uploadPhotoGroup, Settings.MovePhotoDelay);
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
      var vkImgs = thumbGrp.map(getVkImgs);
      ++trInProgress;

      VkAppUtils.uploadPhotos(-dstOwnerId, dstAlbumId, vkImgs).fail(function (err) {
        abortFlagRef.abort = true;
        --trInProgress;
        d.reject(err.error_msg);
      }).done(function (rsp) {
        --trInProgress;
        uploadPhotoGroup();
      });
    }

    uploadPhotoGroup();

    return d.promise();
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

    var ownSelIndex = self.dstAlbumOwnerList.selectedIndex;
    var ownerId = self.dstAlbumOwnerList.item(ownSelIndex).value;

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
