/** Copyright (c) 2013-2017 Leonid Azarenkov
	Licensed under the MIT license
*/

//requires VkApiWrapper, jQuery, highslide, spin.js
/* globals $, Utils, VkApiWrapper, VkAppUtils, VK, VKAdman, admanStat, ImgPercHash, loadImage, Cookies */

var Settings = {
  VkAppLocation: "https://vk.com/movephotos3",

  GetPhotosChunksSz: 200,
  MaxTotalPhotos: 1000000,
  MaxAlbumPhotos: 10000,

  RedirectDelay: 3000,
  RateRequestDelay: 1000,
  ErrorHideAfter: 6000,
  AdviceHideAfter: 30000,
  NoteHideAfter: 10000,
  BlinkDelay: 500,
  BlinkCount: 12,
  SavedAlbumTipTimes: 3,
  DuplicatesAlbumTipTimes: 3,

  PhotosPageRefreshDelay: 700,
  PageSlideDelay: 1400,
  PageSlideRepeatDelay: 350,
  MovePhotoDelay: 335,
  SavePhotoDelay: 100,

  MaxUserGrpAlbumNameLen: 40,
  MaxFriendsList: 500,
  PhotosPerPage: 500,

  WallAlbumId: -7,
  ProfileAlbumId: -6,
  SavedAlbumId: -15,
  DuplicatesAlbumId: "duplicates",
  DuplicatesAlbumIndex: 1,

  LoadImgRetries: 2,
  LoadImgSldownThresh: 25,
  LoadImgDelay: 10,

  RevSortOrderDefaultsSaved: true,
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
  sortingRuleList: null,

  $progressBar: null,
  $goBtn: null,

  $showPrevBtn: null,
  $showNextBtn: null,
  $albumPageField: null,
  $reloadPageBtn: null,
  $createAlbumBtn: null,

  selectedPhotosEdit: null,
  $selToggleAllBtn: null,
  $selTogglePageBtn: null,
  $selToggleVisibleBtn: null,

  $dupSearchBtn: null,

  revThumbSortChk: null,
  $thumbsContainer: null,

  //number of hardcoded options in album lists 
  srcAlbumListHardcodedOpts: 2, //(not selected, duplicates)
  dstAlbumListHardcodedOpts: 2, //(not selected, save)

  busyFlag: true,
  GoBtnLabelMove: "Переместить",
  GoBtnLabelSave: "Сохранить",
  GoBtnLabelCancel: "Отмена",
  GoBtnLabelReorder: "Переупорядочить",

  SortingRuleOrder: "byOrder",
  SortingRuleDate: "byDate",
  SortingRuleLikes: "byLikes",
  SortingRuleCommentsCnt: "byCommentsCnt",
  SortingRuleRandom: "byRandom",

  ThumbClass: '.ThumbsViewer-thumb',
  ThumbLiDivClass: '.ThumbsViewer-liDiv',

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
  albumPhotosCache: [],
  duplicatesCache: [],
  movedPhotosList: {},

  pageRefreshTimer: null,
  pageSlideTimer: null,

  allSelected: false,

  saveTipDisplayed: false,
  //SaveTipDisplayedKey: "saveTipDisplayed",
  savedAlbumTipDisplayed: false,
  SavedAlbumTipDisplayedKey: "savedAlbumTipDisplayed",
  duplicatesAlbumTipDisplayed: false,
  DuplicatesAlbumTipDisplayedKey: "duplicatesAlbumTipDisplayed",
  RevSortCheckedKeySaved: "RevSortChecked-saved",
  RevSortCheckedKeyAll: "RevSortChecked-all",

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
    self.$selTogglePageBtn = $("#Form1_SelTogglePage");
    self.$selToggleVisibleBtn = $("#Form1_SelToggleVisible");

    self.sortingRuleList = document.getElementById("Form1_ThumbSortRule");
    self.revThumbSortChk = document.getElementById("Form1_RevThumbSort");
    self.$thumbsContainer = $("#ThumbsViewer");

    self.srcAlbumOwnerList.item(0).value = Settings.vkUserId;
    self.dstAlbumOwnerList.item(0).value = Settings.vkUserId;

    //assign event handlers
    $(self.sortingRuleList).change(self.onSortingRuleChanged);
    $(self.srcAlbumOwnerList).change(self.onSrcOwnerChanged);
    $(self.dstAlbumOwnerList).change(self.onDstOwnerChanged);
    $(self.srcAlbumList).change(self.onSrcAlbumChanged);
    $(self.dstAlbumList).change(self.onDstAlbumChanged);
    self.$goBtn.click(self.onGoBtnClick);
    self.$dupSearchBtn.click(self.onDupSearchBtnClick);
    self.$goBtn.button("option", "label", self.GoBtnLabelMove);
    self.$showNextBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(true);
    });
    self.$showPrevBtn.mouseup(self.onSlideBtnUp).mousedown(function (event) {
      self.onSlideBtnDown(false);
    });
    self.$reloadPageBtn.click(self.onReloadPageClick);
    self.$createAlbumBtn.click(self.onCreateAlbumClick);
    self.$selToggleAllBtn.click(self.onSelToggleAll);
    self.$selTogglePageBtn.click(self.onSelTogglePage);
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

    self.disableControls(1);
    self.busyFlag = true;

    VkAppUtils.welcomeCheck().done(function (state) {
      //show spinner if still busy when dialog is closed
      if (self.busyFlag) {
        Utils.showSpinner();
      }

      if ((state == VkAppUtils.IsWelcomed) && (!VkAppUtils.isSubscribedToMe())) {
        //self.showSubscribeTooltip();
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
    //noteMsg == ""  => hide note immediately
    //hideDelay == 0 => persistent note (don't hide by timer)
    //else           => show message and hide by timeout
    VkAppUtils.displayNote(noteMsg, "NoteBox", hideDelay);
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

  showSubscribeTooltip: function () {
    var self = AMApi;
    var divId = "SubscribeBox";
    var showDelay = 20000;
    var hideAfter = Settings.AdviceHideAfter;

    // jshint multistr:true
    var noteEntity = "\
    <div class='ui-corner-all' style='display: table; background: #f6f6fb; text-align: center; width: 98%; margin-left: auto ;margin-right: auto;'>\
      <div style='display: table-cell; vertical-align: middle; padding-right: 3em;'>\
        <p class='italic_bold'>Подпишись на автора, чтобы отключить рекламу в приложении!</p>\
      </div>\
      <div style='display: table-cell; vertical-align: middle'>\
        <div id='vk_subscribe'></div>\
      </div>\
      <div style='display: table-cell; vertical-align: top; text-align: right'>\
      <div class='tooltip-close' onclick='$(\"#SubscribeBox\").hide(\"fade\");' title='Закрыть'>\
      </div>\
    </div>";

    setTimeout(function () {
      $("#" + divId).empty().hide(0).html(noteEntity).show("highlight");
      if (hideAfter) {
        setTimeout(function () {
          $("#" + divId).hide("fade");
        }, hideAfter);
      }
      VK.Widgets.Subscribe("vk_subscribe", {
        soft: 1
      }, 105876);
    }, showDelay);
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
    self.$showPrevBtn.button(dstr);
    self.$showNextBtn.button(dstr);
    self.$createAlbumBtn.button(dstr);
    self.$dupSearchBtn.button(dstr);
    self.srcAlbumOwnerList.disabled = dval;
    self.srcAlbumList.disabled = dval;
    self.dstAlbumList.disabled = dval;
    self.revThumbSortChk.disabled = dval;
    self.sortingRuleList.disabled = dval;
    self.$selToggleAllBtn.button(dstr);
    self.$selToggleVisibleBtn.button(dstr);
    self.$selTogglePageBtn.button(dstr);

    if (self.albumData.dirty) {
      self.$reloadPageBtn.button(dstr);
    } else {
      self.$reloadPageBtn.button("disable");
    }

    if (self.srcAlbumList.value == Settings.DuplicatesAlbumId) {
      self.$selToggleVisibleBtn.button("disable");
      self.$selTogglePageBtn.button("disable");
      self.$dupSearchBtn.button("disable");
      self.revThumbSortChk.disabled = 1;
      self.sortingRuleList.disabled = 1;
    }

    if (self.allSelected) {
      self.$showPrevBtn.button("disable");
      self.$showNextBtn.button("disable");
      self.$dupSearchBtn.button("disable");
      self.revThumbSortChk.disabled = 1;
      self.sortingRuleList.disabled = 1;
    }
  },

  updateSrcAlbumsListBox: function (albums) {
    var self = AMApi;
    self.srcAlbumList.selectedIndex = 0;

    //remove old options, skip "not selected" and "duplicates" options
    for (var i = self.srcAlbumList.length - 1; i >= self.srcAlbumListHardcodedOpts; --i) {
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
        index = self.srcAlbumListHardcodedOpts;
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
    for (var i = self.dstAlbumList.length - 1; i >= self.dstAlbumListHardcodedOpts; --i) {
      self.dstAlbumList.remove(i);
    }

    //add new options
    for (i = 0; i < albums.length; i++) {
      var index = null;
      if ((albums[i].owner_id > 0) && (albums[i].id == Settings.WallAlbumId)) {
        index = self.dstAlbumListHardcodedOpts;
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

  onSrcAlbumChanged: function (keepSortingRule) {
    var self = AMApi;
    var ddd = $.Deferred();

    self.doSelectAll(false);
    self.displayNote(); //hide advice
    self.displayWarn(); //hide warn
    self.$thumbsContainer.ThumbsViewer("empty");
    self.updSelectedNum();

    if (keepSortingRule !== true) {
      self.sortingRuleList.selectedIndex = 0;
      self.albumPhotosCache = [];
    }

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

    if (albumId == Settings.SavedAlbumId) {
      var savedAlbumTipDisplayedTimes = +Utils.getCookieParam(self.SavedAlbumTipDisplayedKey, 0);
      if (!self.savedAlbumTipDisplayed && (savedAlbumTipDisplayedTimes < Settings.SavedAlbumTipTimes)) {
        self.displayNote("<strong>Совет:</sctrong> Альбом &quot;Сохранённые фотографии&quot; является служебным, вернуть перемещённые фотографии в этот альбом нельзя!", Settings.NoteHideAfter);
        self.savedAlbumTipDisplayed = true;
        Utils.setCookieParam(self.SavedAlbumTipDisplayedKey, savedAlbumTipDisplayedTimes + 1);
      }

      self.revThumbSortChk.checked = +Utils.getCookieParam(self.RevSortCheckedKeySaved, Settings.RevSortOrderDefaultsSaved);
    } else if (albumId == Settings.DuplicatesAlbumId) {
      var duplicatesAlbumTipDisplayedTimes = +Utils.getCookieParam(self.DuplicatesAlbumTipDisplayedKey, 0);
      if (!self.duplicatesAlbumTipDisplayed && (duplicatesAlbumTipDisplayedTimes < Settings.DuplicatesAlbumTipTimes)) {
        self.displayNote("<strong>Совет:</sctrong><ul><li>Альбом &quot;Найденные дубликаты&quot; хранит результат поиска повторяющихся изображений.</li><li>Поиск возможен по всем альбомам (если альбом не выбран) или только по выбранному альбому.</li><li>Кнопка  &quot;Поиск дубликатов &quot; (внизу страницы) запускает процесс поиска.</li></ul>", Settings.AdviceHideAfter);
        self.duplicatesAlbumTipDisplayed = true;
        Utils.setCookieParam(self.DuplicatesAlbumTipDisplayedKey, duplicatesAlbumTipDisplayedTimes + 1);
      }

      self.revThumbSortChk.checked = false;
    } else {
      if (keepSortingRule !== true) {
        self.revThumbSortChk.checked = false;
      }
    }

    //update album data
    Utils.showSpinner();
    self.disableControls(1);

    self.queryAlbumPhotos(ownerId, albumId, 0, Settings.PhotosPerPage, self.revThumbSortChk.checked).done(function (photos, count) {
      self.albumData.photosCount = count;
      self.albumData.pagesCount = Math.ceil(count / Settings.PhotosPerPage);
      self.albumData.pages[0] = photos;
      self.albumData.albumId = albumId;

      self.updateAlbumPageField();
      self.showPhotosPage().always(function () {
        self.updateGoBtnLabel();
        ddd.resolve();
      });
    }).fail(onFail);

    return ddd.promise();
  },

  onDstAlbumChanged: function () {
    var self = AMApi;

    var selIndex = self.dstAlbumList.selectedIndex;
    self.displayWarn(); //hide warn
    if (selIndex == 1) { //save album
      if (!self.saveTipDisplayed) {
        self.displayNote("<strong>Совет:</sctrong><br /><ul><li>Открывшуюся страницу с фотографиями можно сохранить, используя сочетание клавиш CTRL+S.</li><li>Также, удобно загружать фотографии с помощью сервиса <a href='https://yandex.ru/support/disk/uploading.html#uploading__social-networks' target='_blank'><u>Яндекс Диск</u></a>.</li><li>&quot;Сохранение&quot; работает корректно только с браузерами Google Chrome и Mozilla Firefox!</li></ul>", Settings.AdviceHideAfter);
        self.saveTipDisplayed = true;
        //VkApiWrapper.storageSet(self.SaveTipDisplayedKey, "1");
      }
      self.dstAlbumSizeEdit.value = "0";
    } else if (selIndex && (self.dstAlbumList.value == self.srcAlbumList.value)) {
      self.displayNote(); //hide advice
      self.dstAlbumSizeEdit.value = self.albumData.photosCount;
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
    } else { //not selected
      self.displayNote(); //hide advice
      self.dstAlbumSizeEdit.value = "0";
    }
    self.updateGoBtnLabel();
  },

  updateGoBtnLabel: function () {
    var self = AMApi;
    var dstSelIndex = self.dstAlbumList.selectedIndex;
    if (dstSelIndex == 1) { //save album
      self.$goBtn.button("option", "label", self.GoBtnLabelSave);
    } else if (dstSelIndex && (self.dstAlbumList.value == self.srcAlbumList.value)) {
      self.$goBtn.button("option", "label", self.GoBtnLabelReorder);
    } else {
      self.$goBtn.button("option", "label", self.GoBtnLabelMove);
    }
  },

  updateAlbumPageField: function () {
    var self = AMApi;

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
      self.$thumbsContainer.ThumbsViewer("empty").done(function () {
        self.$thumbsContainer.ThumbsViewer("updateAlbumMap", self.albumMap);
        self.$thumbsContainer.ThumbsViewer("addThumbList", self.albumData.pages[self.albumData.page]).done(function () {
          self.updSelectedNum();

          if (self.albumData.albumId == Settings.DuplicatesAlbumId) {
            showDuplicates();
          } else if (self.sortingRuleList.value == self.SortingRuleDate) {
            showDividers();
          }

          Utils.hideSpinner();
          self.disableControls(0);

          ddd.resolve();
        });
      });

    }

    function showDuplicates() {
      var PluginName = 'ThumbsViewer';
      var MaxDescrLen = 200;

      var $thumbs = self.$thumbsContainer.find(self.ThumbClass);
      var thumbsData = [];
      $thumbs.each(function () {
        thumbsData.push($(this).data(PluginName));
      });
      $thumbs.detach();

      for (var i = 0; i < thumbsData.length - 1;) {
        if (thumbsData[i].vk_img.hash == thumbsData[i + 1].vk_img.hash) {
          var h = thumbsData[i].vk_img.hash;
          var $li = $("<li />");

          while ((i < thumbsData.length) && (thumbsData[i].vk_img.hash == h)) {
            var $divSubLi = $("<div class='ThumbsViewer-liDiv'></div>");
            var $divImg = $("<div class='ThumbsViewer-liDivImg'></div>");
            var $divInfo = $("<div class='ThumbsViewer-liDivInfo'></div>");

            var likes = (thumbsData[i].vk_img.likes.count) ? "<b>" + thumbsData[i].vk_img.likes.count + "</b>" : thumbsData[i].vk_img.likes.count;
            var comments = (thumbsData[i].vk_img.comments.count) ? "<b>" + thumbsData[i].vk_img.comments.count + "</b>" : thumbsData[i].vk_img.comments.count;
            var reposts = (thumbsData[i].vk_img.reposts.count) ? "<b>" + thumbsData[i].vk_img.reposts.count + "</b>" : thumbsData[i].vk_img.reposts.count;

            var dateStr = VkAppUtils.getVkImgDateStr(thumbsData[i].vk_img);
            var maxSz = VkAppUtils.getVkImgMaxSizeDim(thumbsData[i].vk_img);
            var maxSzStr = maxSz.width + "x" + maxSz.height;

            $divInfo.append("<p><b>Альбом: " + self.albumMap[thumbsData[i].vk_img.album_id] + "</b></p>");
            $divInfo.append("<p>Лайки: " + likes + ", комментарии: " + comments + ", репосты: " + reposts + "</p>");
            $divInfo.append("<p>Дата добавления: " + dateStr + ". Размер: " + maxSzStr + "</p>");
            //$divInfo.append("<p>Хэш: " + thumbsData[i].vk_img.hash + "</p>");
            $divInfo.append("<p>Описание: " + Utils.html2Text(thumbsData[i].vk_img.text, MaxDescrLen) + "</p>");

            $divImg.append($thumbs[i]);
            $divSubLi.append($divImg).append($divInfo);
            $li.append($divSubLi);
            ++i;
          }

          self.$thumbsContainer.append($li);
        } else {
          ++i;
        }
      }
    }

    function showDividers() {
      var PluginName = 'ThumbsViewer';

      var $thumbs = self.$thumbsContainer.find(self.ThumbClass);
      var thumbsData = [];
      $thumbs.each(function () {
        thumbsData.push($(this).data(PluginName));
      });
      $thumbs.detach();

      var dateStr = "";
      for (var i = 0; i < thumbsData.length;) {
        var $li = $("<li />");
        dateStr = VkAppUtils.getVkImgDateStr_yyyymmdd(thumbsData[i].vk_img);
        
        var $div_date = $("<div class='ThumbsViewer-date'>" + dateStr + "</div>");
        
        $li.append($div_date);
        
        while ((i < thumbsData.length) && (VkAppUtils.getVkImgDateStr_yyyymmdd(thumbsData[i].vk_img) == dateStr)) {
          $li.append($thumbs[i]);
          ++i;
        }
        self.$thumbsContainer.append($li);
      }
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

      self.queryAlbumPhotos(ownerId, self.albumData.albumId, offset, Settings.PhotosPerPage, self.revThumbSortChk.checked).done(function (photos, count) {
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

  slideNextPage: function () {
    var self = AMApi;

    //don't change page, refresh current
    if (self.albumData.dirty) {
      self.albumData.dirty = false;
      self.$reloadPageBtn.button("disable");
      delete self.albumData.pages[self.albumData.page];
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
      delete self.albumData.pages[self.albumData.page];
      return false;
    }

    if (self.albumData.page > 0) {
      --self.albumData.page;
      self.updateAlbumPageField();
      return true;
    }
    return false;
  },

  invalidateAlbumPageCache: function () {
    var self = AMApi;

    var prevPagePhotos = self.albumData.pages[self.albumData.page];
    var newPagePhotos$ = self.$thumbsContainer.ThumbsViewer("getThumbsData");

    if (self.albumData.albumId == Settings.DuplicatesAlbumId) {
      //clean-up current page
      for (var j = 0; j < newPagePhotos$.length; ++j) {
        var $thumb = newPagePhotos$[j].$thumb;
        var $dupLi = $thumb.parent().parent().parent();

        //only one image, remove <li> completely
        if ($dupLi.find(self.ThumbClass).length < 2) {
          $dupLi.detach();
          self.$thumbsContainer.ThumbsViewer("removeThumb", $thumb);
          self.movedPhotosList[newPagePhotos$[j].data.vk_img.id] = 1;
          $dupLi.remove();
        }
      }
      newPagePhotos$ = self.$thumbsContainer.ThumbsViewer("getThumbsData");

      //remove moved duplicates from the duplicates cache
      self.duplicatesCache = self.duplicatesCache.filter(function (el) {
        return !self.movedPhotosList[el.id];
      });
      self.movedPhotosList = {};
    } else {
      //remove moved photos from the cache
      self.albumPhotosCache = self.albumPhotosCache.filter(function (el) {
        return !self.movedPhotosList[el.id];
      });
      self.movedPhotosList = {};
    }

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

  queryAlbumPhotos: function (ownerId, albumId, offset, maxCount, revOrd, filterFn, noExtended) {
    var self = AMApi;
    if (albumId == Settings.DuplicatesAlbumId) {
      var ddd1 = $.Deferred();
      ddd1.resolve(self.duplicatesCache.slice(offset, offset + maxCount), self.duplicatesCache.length);
      return ddd1.promise();
    } else if (self.albumPhotosCache.length) {
      var ddd2 = $.Deferred();
      if (revOrd) {
        var tmp = self.albumPhotosCache.slice().reverse();
        ddd2.resolve(tmp.slice(offset, offset + maxCount), tmp.length);
      } else {
        ddd2.resolve(self.albumPhotosCache.slice(offset, offset + maxCount), self.albumPhotosCache.length);
      }
      return ddd2.promise();
    }
    return VkAppUtils.queryAlbumPhotos(ownerId, albumId, offset, maxCount, revOrd, filterFn, noExtended);
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
    VkAppUtils.getTotalPhotosCount(ownerId, true).done(function (totalPhotosCount) {

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
      var d2 = VkAppUtils.queryAlbumPhotos(ownerId, 'saved', 0, Settings.MaxTotalPhotos, false, false, true);

      d1.progress(onProgress).done(pushPhotos);
      d2.progress(onProgress).done(pushPhotos);

      //when all photos have been retreived
      $.when(d1, d2).fail(function () {
        ddd.reject();
      }).done(function () {
        ddd.resolve(allPhotosList);
      });
    }).fail(function () {
      ddd.reject();
    });

    return ddd.promise();
  },

  collectAlbumPhotos: function (ownerId, albumId, noExtended) {
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

      VkAppUtils.queryAlbumPhotos(ownerId, albumId, 0, Settings.MaxTotalPhotos, false, false, noExtended).progress(onProgress).done(function (photos) {
        ddd.resolve(photos);
      }).fail(function (error) {
        ddd.reject(error);
      });
    }).fail(function () {
      ddd.reject();
    });

    return ddd.promise();
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
        ddd.resolve(failedImages);
        //self.reportFailedImages(failedImages);
        return;
      }

      //timeout depends on number of images being loaded
      var tmout = (loadInProgressCnt < Settings.LoadImgSldownThresh) ? Settings.LoadImgDelay : loadInProgressCnt * Settings.LoadImgDelay;

      if (loadImgQueue.length) {
        ++loadInProgressCnt;
        var vk_img = loadImgQueue.shift();
        var imgSrc = Utils.fixHttpUrl(vk_img.url);

        //slow down for retries
        //if (vk_img.loadAttempts) {
        //  tmout = loadInProgressCnt * Settings.LoadImgDelay;
        //}

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
                //console.warn("AMApi::loadImg__() failed to load '" + imgSrc + "', att=" + vk_img.loadAttempts);
                failedImages.push(vk_img);
                ddd.notify(null, vk_img);
              }

              --loadInProgressCnt;
            } else {
              --loadInProgressCnt;
              //if ("loadAttempts" in vk_img) {
              //  console.warn("AMApi::loadImg__() successfull load retry '" + imgSrc + "', att=" + vk_img.loadAttempts);
              //}
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

    //hide previous warnings and errors
    self.displayWarn();
    self.displayError();

    var srcSelIndex = self.srcAlbumList.selectedIndex;
    var ownerId = self.srcAlbumOwnerList.value;
    var albumId = self.srcAlbumList.value;
    var atitle = self.srcAlbumList.item(srcSelIndex).text;

    if (albumId == Settings.DuplicatesAlbumId) {
      //nothing to do
      return;
    }

    //show empty "duplicates" album while collecting data
    self.duplicatesAlbumTipDisplayed = true;
    self.duplicatesCache = [];
    self.srcAlbumList.selectedIndex = Settings.DuplicatesAlbumIndex;
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

      self.collectAlbumPhotos(ownerId, albumId, true).done(onPhotosListLoaded).fail(onFail);
    }

    function onFail() {
      Utils.hideSpinner();
      self.disableControls(0);

      //update button label
      self.onDstAlbumChanged();
    }

    function onPhotosListLoaded(photosList_) {
      //enable "Cancel" button
      self.$goBtn.button("option", "label", self.GoBtnLabelCancel);
      self.$goBtn.button("enable");

      self.displayNote("Поиск дубликатов изображений: загрузка изображений и вычисление хэшей ...", 0);

      //fix vk_img urls
      var photosList = photosList_.filter(function (vk_img) {
        var url = VkAppUtils.getVkImgSmallUrl(vk_img, "invalidURL");
        if (url != "invalidURL") {
          vk_img.url = url + "";
          return true;
        } else {
          return false;
        }
      });

      self.$progressBar.progressbar("option", "max", photosList.length);
      self.$progressBar.progressbar("value", 0);

      var dupInfoByUrl = findDuplicatesByUrl(photosList);

      var imgHashedList = [];
      var simi = new ImgPercHash(16);

      function onImageLoaded(img, vk_img) {
        if (img) {
          var hash = simi.hash(img);
          vk_img.hash = hash;
          imgHashedList.push(vk_img);

          //dispose unnecessary image
          if (img._objectURL) {
            loadImage.revokeObjectURL(img._objectURL);
            delete img._objectURL;
          }
        }

        var new_val = +self.$progressBar.progressbar("value") + 1;
        self.$progressBar.progressbar("value", new_val);
      }

      //load images and calculate perceptual hashes
      self.taskInfo.abort = false;
      var startTime = new Date();
      self.loadVkImages(photosList, self.taskInfo).done(function (failedImages) {
        photosList = null;
        var endTime = new Date();
        var actualTime = endTime - startTime;
        var actualTimeHms = new Date(actualTime).toISOString().substr(11, 8);
        console.log("Image load time was " + actualTimeHms);

        //images loaded, hashes calculated, sort images and get duplicates
        var dupInfoPercHash = findDuplicatesByHash(imgHashedList);

        //merge dupInfoPercHash and dupInfoByUrl
        //combining two methods (URL/PercHash), as it's not always possible to load all images and calculate hash
        var dupInfo = mergeDupInfo(dupInfoPercHash, dupInfoByUrl);
        var dupImgIdList = dupInfo2IdList(dupInfo);
        var dupIdHashMap = dupInfo.id2HashMap;
        var dupGroupsCount = Object.keys(dupInfo.hash2ImgLstMap).length;
        var dupImagesCount = dupImgIdList.length;
        dupInfoPercHash = null;
        dupInfoByUrl = null;
        dupInfo = null;

        //query photos by their ids in list of duplicates
        VkAppUtils.queryPhotosById(ownerId, dupImgIdList).done(function (photosList_) {
          //inject hashes
          for (var k = 0; k < photosList_.length; ++k) {
            photosList_[k].hash = dupIdHashMap[photosList_[k].id];
          }
          //photosList_ = photosList_.sort(compareByHash);

          self.duplicatesCache = photosList_; //save photos to the cache
          self.onSrcAlbumChanged();

          //update GO button label
          self.onDstAlbumChanged();

          self.displayNote("Найдено групп дубликатов: " + dupGroupsCount + ", всего изображений: " + dupImagesCount, Settings.NoteHideAfter);
        }).fail(onFail);
      }).progress(onImageLoaded);
    }

    function dupInfo2IdList(dupInfo) {
      var dupIdList = [];
      var keys = Object.keys(dupInfo.hash2ImgLstMap);

      function getIds(obj) {
        return obj.id;
      }

      function compareByAid(a, b) {
        if (a.album_id < b.album_id) {
          return -1;
        } else if (a.album_id > b.album_id) {
          return 1;
        }
        return 0;
      }

      for (var i = 0; i < keys.length; ++i) {
        var idGrp = dupInfo.hash2ImgLstMap[keys[i]];

        //sort by album ID
        idGrp = idGrp.sort(compareByAid);

        var ids = idGrp.map(getIds);
        dupIdList = dupIdList.concat(ids);
      }
      return dupIdList;
    }

    //merge dupInfoB to dupInfoA
    function mergeDupInfo(dupInfoA, dupInfoB) {
      var hashesB = Object.keys(dupInfoB.hash2ImgLstMap);

      for (var i = 0; i < hashesB.length; ++i) {
        var hB = hashesB[i];
        var dupGrpB = dupInfoB.hash2ImgLstMap[hB];
        var merged = false;

        //if groups have intersection -> merge, otherwise group is unique -> add to map as is
        for (var j = 0; j < dupGrpB.length; ++j) {
          //if at least one common elemet -> merge two groups
          if (dupGrpB[j].id in dupInfoA.id2HashMap) {
            var hA = dupInfoA.id2HashMap[dupGrpB[j].id];
            for (var p = 0; p < dupGrpB.length; ++p) {
              //add only unique elements
              if (!(dupGrpB[p].id in dupInfoA.id2HashMap)) {
                dupInfoA.id2HashMap[dupGrpB[p].id] = hA;
                dupInfoA.hash2ImgLstMap[hA].push(dupGrpB[p]);
              }
            }

            merged = true;
            break;
          }
        }

        //unique group -> add to hash2ImgLstMap and update id2HashMap
        if (!merged) {
          dupInfoA.hash2ImgLstMap[hB] = dupGrpB;
          for (var k = 0; k < dupGrpB.length; ++k) {
            dupInfoA.id2HashMap[dupGrpB[k].id] = hB;
          }
        }
      }

      return dupInfoA;
    }

    function compareByHash(a, b) {
      if (a.hash < b.hash) {
        return -1;
      } else if (a.hash > b.hash) {
        return 1;
      }
      return 0;
    }

    function findDuplicatesByHash(vkImgList) {
      var hash2ImgLstMap = {};
      var id2HashMap = {};

      //sort by hash and collect duplicates to the dupImgIdList_
      vkImgList = vkImgList.sort(compareByHash);
      for (var i = 0; i < vkImgList.length - 1;) {
        if (vkImgList[i].hash == vkImgList[i + 1].hash) {
          var h = vkImgList[i].hash;
          hash2ImgLstMap[h] = [];
          while ((i < vkImgList.length) && (vkImgList[i].hash == h)) {
            hash2ImgLstMap[h].push(vkImgList[i]);
            id2HashMap[vkImgList[i].id] = h;
            ++i;
          }
        } else {
          ++i;
        }
      }

      return {
        hash2ImgLstMap: hash2ImgLstMap,
        id2HashMap: id2HashMap
      };
    }

    function findDuplicatesByUrl(vkImgList) {
      for (var i = 0; i < vkImgList.length; ++i) {
        //use image file name as a hash
        var fname = vkImgList[i].url;
        var hash = fname.substring(fname.lastIndexOf('/') + 1);
        vkImgList[i].hash = hash;
      }

      return findDuplicatesByHash(vkImgList);
    }

  },

  onGoBtnClick: function () {
    var self = AMApi;

    //hide previous warnings and errors
    self.displayWarn();
    self.displayError();

    if (self.$goBtn.button("option", "label") == self.GoBtnLabelCancel) {
      //abort current task
      self.taskInfo.abort = true;
      self.$goBtn.button("disable");
      return;
    }

    if (!self.dstAlbumList.selectedIndex) { //dst album not selected
      self.displayWarn("Не выбран альбом, куда перемещать фотографии");
      return;
    }

    if (self.$goBtn.button("option", "label") != self.GoBtnLabelReorder) {
      var selThumbsCnt = self.$thumbsContainer.ThumbsViewer("getThumbsCount").selected;
      if (!selThumbsCnt) { //no images selected
        self.displayWarn("Не выбраны фотографии для перемещения/сохранения");
        return;
      }
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

      //update button label
      self.onDstAlbumChanged();

      if (self.allSelected) {
        self.doSelectAll(false);
      } else {
        self.disableControls(0);
        self.updSelectedNum();
      }
    }

    function onAlwaysMove() {
      Utils.hideSpinner();

      //update button label
      self.onDstAlbumChanged();

      self.invalidateAlbumPageCache();

      self.updateAlbumPageField();
    }

    function onAlwaysMoveAll() {
      self.onSrcAlbumChanged();
    }

    var progress = 0;

    function onProgressMove($thumbInfo) {
      self.$progressBar.progressbar("value", ++progress);
      var $thumb = $thumbInfo.$thumb;
      self.movedPhotosList[$thumbInfo.data.vk_img.id] = 1;

      if (self.albumData.albumId == Settings.DuplicatesAlbumId) {
        var $dupLiSubDiv = $thumb.parent().parent();
        $dupLiSubDiv.detach();
        self.$thumbsContainer.ThumbsViewer("removeThumb", $thumb);
        $dupLiSubDiv.remove();
      } else {
        self.$thumbsContainer.ThumbsViewer("removeThumb", $thumb);
      }

      self.updSelectedNum();
    }

    function onProgressMoveAll(movedCnt) {
      progress += +movedCnt;
      self.$progressBar.progressbar("value", progress);
    }

    function onProgressSave($thumbInfo) {
      self.$progressBar.progressbar("value", ++progress);
      self.$thumbsContainer.ThumbsViewer("selectToggle", $thumbInfo.$thumb);
      self.updSelectedNum();
    }

    Utils.showSpinner();
    self.disableControls(1);

    //do action
    if (self.$goBtn.button("option", "label") == self.GoBtnLabelSave) {
      //save

      //collect list of selected photos
      var $thumbLists = self.$thumbsContainer.ThumbsViewer("getThumbsData", true);

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", $thumbLists.length);
      self.$progressBar.progressbar("value", 0);

      if (self.allSelected && (self.albumData.pagesCount > 1)) {
        self.displayNote("Альбом слишком большой. Сохраняем только текущую страницу альбома...", Settings.AdviceHideAfter);
      }

      self.taskInfo.abort = false;
      var selIdx = self.srcAlbumList.selectedIndex;
      self.doSaveAlbum(self.srcAlbumList.item(selIdx).text, $thumbLists, self.taskInfo).progress(onProgressSave).always(onAlwaysSave);
    } else if (!self.allSelected && (self.$goBtn.button("option", "label") == self.GoBtnLabelMove)) {
      //move

      //collect list of selected photos
      var $thumbListm = self.$thumbsContainer.ThumbsViewer("getThumbsData", true);

      //check album overflow
      if ($thumbListm.length + Number(self.dstAlbumSizeEdit.value) > Settings.MaxAlbumPhotos) {
        self.displayWarn("Переполнение альбома, невозможно поместить в один альбом больше " + Settings.MaxAlbumPhotos + " фотографий.");
        Utils.hideSpinner();
        self.disableControls(0);
        return;
      }

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", $thumbListm.length);
      self.$progressBar.progressbar("value", 0);

      self.movedPhotosList = {};

      var ownerId = self.srcAlbumOwnerList.value;
      var albumID = self.dstAlbumList.value;
      self.taskInfo.abort = false;

      self.doMovePhotosFast(ownerId, albumID, $thumbListm, self.taskInfo).done(onDoneMove).fail(onFailMove).always(onAlwaysMove).progress(onProgressMove);
    } else if (self.allSelected && (self.$goBtn.button("option", "label") == self.GoBtnLabelMove)) {
      //move ALL

      //check album overflow
      if (self.albumData.photosCount + Number(self.dstAlbumSizeEdit.value) > Settings.MaxAlbumPhotos) {
        self.displayWarn("Переполнение альбома, невозможно поместить в один альбом больше " + Settings.MaxAlbumPhotos + " фотографий.");
        Utils.hideSpinner();
        self.disableControls(0);
        return;
      }

      //set new progress bar range
      self.$progressBar.progressbar("option", "max", self.albumData.photosCount);
      self.$progressBar.progressbar("value", 0);

      self.taskInfo.abort = false;
      self.doMovePhotosAll(self.srcAlbumOwnerList.value, self.srcAlbumList.value, self.dstAlbumList.value, self.taskInfo).done(onDoneMove).fail(onFailMove).always(onAlwaysMoveAll).progress(onProgressMoveAll);
    } else if (self.$goBtn.button("option", "label") == self.GoBtnLabelReorder) {
      //set new progress bar range
      self.$progressBar.progressbar("option", "max", self.albumData.photosCount);
      self.$progressBar.progressbar("value", 1);
      progress = 1;

      if (!self.albumPhotosCache.length && !self.revThumbSortChk.checked || (self.albumData.photosCount < 2)) {
        self.displayNote("Переупорядочивание не требуется (параметры сортировки не изменены).", Settings.NoteHideAfter);
        self.$progressBar.progressbar("value", self.albumData.photosCount);
        Utils.hideSpinner();
        self.disableControls(0);
        return;
      }

      self.taskInfo.abort = false;
      self.doSelectAll(true);
      self.doReorderPhotosAll(self.taskInfo).done(onDoneMove).fail(onFailMove).always(onAlwaysMoveAll).progress(onProgressMoveAll);
    }

    //enable "Cancel" button
    self.$goBtn.button("option", "label", self.GoBtnLabelCancel);
    self.$goBtn.button("enable");

  },

  doSaveAlbum: function (albumTitle, $thumbList, abortFlagRef) {
    var self = AMApi;
    var WaitPageLoadTmout = 100;
    var d = $.Deferred();

    function savePhoto(num) {
      if (abortFlagRef.abort || !$thumbList.length || popUp.closed) {
        d.resolve();
        return;
      }

      var thumbInfo = $thumbList.shift();
      var vk_img = thumbInfo.data.vk_img;
      var src = VkAppUtils.getVkImgMaxSizeSrc(vk_img);

      var createdStr = VkAppUtils.getVkImgDateStr(vk_img);
      var text = vk_img.text ? $("<div>").text(vk_img.text).html() : "";

      var htmlStr = "";
      htmlStr = htmlStr + "<p> Фото №" + num + ", " + createdStr;
      if (text.length) {
        htmlStr = htmlStr + ", " + text + "</p>";
      } else {
        htmlStr = htmlStr + "</p>";
      }
      htmlStr = htmlStr + "<img src=\"" + src + "\" alt=\"" + text + "\"/ ><br/ ><br/ >";

      $divPhotos.append(htmlStr);
      d.notify(thumbInfo);

      setTimeout(function () {
        savePhoto(num + 1);
      }, Settings.SavePhotoDelay);
    }

    function waitLoad() {
      var divPhotos = popUp.document.getElementById("photos");
      if (divPhotos) {
        popUp.document.title = title;
        $divPhotos = $(divPhotos);
        savePhoto(1);
      } else {
        setTimeout(waitLoad, WaitPageLoadTmout);
      }
    }

    //open new window and wait when it's loaded
    var popUp = window.open("SaveAlbum.html", "_blank", "location=yes,menubar=yes,toolbar=yes,titlebar=yes,scrollbars=yes", false);
    var title = "Фотографии из альбома \"" + albumTitle + "\"";
    var $divPhotos = null;
    setTimeout(waitLoad, WaitPageLoadTmout);

    return d.promise();
  },

  doReorderPhotosAll: function (abortFlagRef) {
    var self = AMApi;
    var d = $.Deferred();

    var GroupSize = 25;
    var errInfo = null;
    var ownerId = self.srcAlbumOwnerList.value;

    function getIds(obj) {
      return obj.id;
    }

    function reorderPhotoGroup(idAfter, photoIdsList) {
      //stop if no more images left or the task was aborted
      if (abortFlagRef.abort || !photoIdsList.length) {
        if (!errInfo) { //no errors
          d.resolve();
        } else { //error info is not empty, something happened
          d.reject(errInfo.error_msg);
        }
        return;
      }

      var photosGrp = photoIdsList.splice(0, GroupSize);
      VkApiWrapper.reorderPhotoList(ownerId, idAfter, photosGrp).fail(function (err) {
        d.reject(err.error_msg);
      }).done(function (rsp) {
        d.notify(rsp.count);
        reorderPhotoGroup(photosGrp.pop(), photoIdsList);
      });
    }

    if (!self.albumPhotosCache.length) {
      self.doLoadAlbumPhotosCache().done(function () {
        //show spinner and disable controls again, as they enabled by doLoadAlbumPhotosCache()
        Utils.showSpinner();
        self.disableControls(1);
        var plst = self.albumPhotosCache.map(getIds);
        if (+self.revThumbSortChk.checked) {
          plst.reverse();
        }
        reorderPhotoGroup(plst.shift(), plst);
      });
    } else {
      var plstx = self.albumPhotosCache.map(getIds);
      if (+self.revThumbSortChk.checked) {
        plstx.reverse();
      }
      reorderPhotoGroup(plstx.shift(), plstx);
    }

    return d.promise();
  },

  doMovePhotosAll: function (ownerId, srcAid, targetAid, abortFlagRef) {
    var self = AMApi;
    var d = $.Deferred();

    var errInfo = null;
    var skipCnt = 0;

    function movePhotoGroup() {
      //stop if no more images left or the task was aborted
      if (abortFlagRef.abort) {
        if (!errInfo) { //no errors
          d.resolve();
        } else { //error info is not empty, something happened
          d.reject(errInfo.error_msg);
        }

        return;
      }

      VkApiWrapper.moveAllPhotos(ownerId, srcAid, targetAid, skipCnt).fail(function (err) {
        d.reject(err.error_msg);
      }).done(function (rsp) {
        if (+rsp.ph_cnt === 0) {
          //no more photos in album
          abortFlagRef.abort = true;
        } else {
          d.notify(+rsp.ph_cnt);
        }

        if (+rsp.err_cnt) {
          errInfo = {
            error_msg: "Не удалось переместить некоторые фотографии, попробуйте еще раз."
          };
          skipCnt += +rsp.err_cnt; //skip not movable photos
        }

        movePhotoGroup();
      });
    }

    movePhotoGroup();

    return d.promise();
  },

  doMovePhotosFast: function (ownerId, targetAid, $thumbList, abortFlagRef) {
    var self = AMApi;
    var d = $.Deferred();

    var GroupSize = 25;
    var errInfo = null;
    var error_msg = "Не удалось переместить некоторые фотографии, попробуйте еще раз.";

    function getIds(obj) {
      return obj.data.vk_img.id;
    }

    function movePhotoGroup() {
      //stop if no more images left or the task was aborted
      if (abortFlagRef.abort || !$thumbList.length) {
        if (!errInfo) { //no errors
          d.resolve();
        } else { //error info is not empty, something happened
          d.reject(errInfo.error_msg);
        }

        return;
      }

      var thumbGrp = $thumbList.splice(0, GroupSize);
      var ids = thumbGrp.map(getIds);
      VkApiWrapper.movePhotoList(ownerId, targetAid, ids).fail(function (err) {
        d.reject(err.error_msg);
      }).done(function (rsp) {
        var movedCnt = 0;
        for (var i = 0; i < rsp.length; ++i) {
          if (+rsp[i]) {
            d.notify(thumbGrp[i]);
            ++movedCnt;
          } else {
            //failed to move some photos, but don't abort task
            errInfo = {
              error_msg: error_msg
            };
          }
        }

        if (!movedCnt) {
          //no photos were successfully moved, abort task
          d.reject(error_msg);
          return;
        }

        movePhotoGroup();
      });
    }

    movePhotoGroup();

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

      var index;
      var opt = new Option(album.title, album.id, false, false);
      $(opt).data("AMApi", album);
      index = self.srcAlbumList.selectedIndex;
      self.srcAlbumList.add(opt, self.srcAlbumListHardcodedOpts);
      if (index >= self.srcAlbumListHardcodedOpts) {
        //fix selected index after new option inserted
        self.srcAlbumList.selectedIndex = index + 1;
      }

      index = self.dstAlbumListHardcodedOpts;
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

  doLoadAlbumPhotosCache: function () {
    var self = AMApi;
    var d = $.Deferred();

    Utils.showSpinner();
    self.disableControls(1);
    self.displayNote("Загрузка списка изображений для сортировки...", 0);

    var ownerId = self.srcAlbumOwnerList.value;
    var albumId = self.srcAlbumList.value;
    self.collectAlbumPhotos(ownerId, albumId, false).done(function (albumPhotos) {
      Utils.hideSpinner();
      self.disableControls(0);
      self.displayNote();

      //push original index to the list
      for (var j = 0; j < albumPhotos.length; ++j) {
        albumPhotos[j].idx = j;
      }
      self.albumPhotosCache = albumPhotos;
      d.resolve();
    }).fail(self.onFatalError);

    return d.promise();
  },

  onSortingRuleChanged: function () {
    var self = AMApi;

    function doUpdate() {
      //do sorting, update view
      if (self.sortingRuleList.value == self.SortingRuleDate) {
        VkAppUtils.sortVkImgByDate(self.albumPhotosCache);
      } else if (self.sortingRuleList.value == self.SortingRuleLikes) {
        VkAppUtils.sortVkImgByLikes(self.albumPhotosCache);
      } else if (self.sortingRuleList.value == self.SortingRuleCommentsCnt) {
        VkAppUtils.sortVkImgByCommentsCnt(self.albumPhotosCache);
      } else if (self.sortingRuleList.value == self.SortingRuleRandom) {
        Utils.shuffle(self.albumPhotosCache);
      } else {
        VkAppUtils.sortVkImgByIndex(self.albumPhotosCache);
      }

      self.onSrcAlbumChanged(true);
    }

    if (!self.albumPhotosCache.length && self.albumData.photosCount) {
      //query all album photos to the second level cache and do sorting
      self.doLoadAlbumPhotosCache().done(doUpdate);
    } else {
      //already cached, do sorting only
      doUpdate();
    }
  },

  onRevThumbSortChkClick: function () {
    var self = AMApi;

    if (!self.albumData.albumId) {
      //not selected, nothing to do
      return;
    } else if (self.albumData.albumId == Settings.SavedAlbumId) {
      Utils.setCookieParam(self.RevSortCheckedKeySaved, +self.revThumbSortChk.checked);
      Settings.RevSortOrderDefaultsSaved = self.revThumbSortChk.checked;
    }

    self.onSrcAlbumChanged(true);
  },

  doSelectAll: function (enable) {
    var self = AMApi;

    self.allSelected = !!enable;
    if (self.allSelected) {
      self.$selToggleAllBtn.addClass("ui-button-active");
      self.$thumbsContainer.ThumbsViewer("selectAll");
      self.$thumbsContainer.ThumbsViewer("selectionDisable", true);
    } else {
      self.$thumbsContainer.ThumbsViewer("selectionDisable", false);
      self.$thumbsContainer.ThumbsViewer("selectNone");
      self.$selToggleAllBtn.removeClass("ui-button-active");
    }

    self.disableControls(0);
    self.updSelectedNum();
  },

  onSelToggleAll: function () {
    var self = AMApi;

    if (self.srcAlbumList.value == Settings.DuplicatesAlbumId) {
      self.selectToggleDuplicates();
    } else {
      self.doSelectAll(!self.allSelected);
    }
  },

  onSelTogglePage: function () {
    var self = AMApi;

    if (self.allSelected) {
      self.doSelectAll(false);
    }
    self.$thumbsContainer.ThumbsViewer("selectToggleAll");
    self.updSelectedNum();
  },

  onSelToggleVisible: function () {
    var self = AMApi;

    if (self.allSelected) {
      self.doSelectAll(false);
    }
    self.$thumbsContainer.ThumbsViewer("selectToggleVisible");
    self.updSelectedNum();
  },

  selectToggleDuplicates: function () {
    var self = AMApi;

    var cnt = self.$thumbsContainer.ThumbsViewer("getThumbsCount");
    if (cnt.selected > 0) {
      self.$thumbsContainer.ThumbsViewer("selectNone");
    } else {
      self.$thumbsContainer.ThumbsViewer("selectAll");

      //deselect the first thumb in each duplicate group
      var $dupGrps = self.$thumbsContainer.children("li");

      $dupGrps.each(function (index) {
        var $childThumbs = $(this).find(self.ThumbClass);
        self.$thumbsContainer.ThumbsViewer("selectToggle", $($childThumbs[0]));
      });
    }

    self.updSelectedNum();
  },

  updSelectedNum: function () {
    var self = AMApi;

    if (self.allSelected) {
      self.selectedPhotosEdit.value = " * / * ";
    } else {
      var cnt = self.$thumbsContainer.ThumbsViewer("getThumbsCount");
      self.selectedPhotosEdit.value = cnt.selected + "/" + cnt.total;
    }
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
  $("#Form1_SelTogglePage").button();
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
    '5.60'
  );

  //VK API init finished: query user data
  d.done(function () {
    Utils.hideSpinner();
    AMApi.init();
  });
});
