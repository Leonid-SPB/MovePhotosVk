/** Copyright (c) 2012-2017 Leonid Azarenkov
	Licensed under the MIT license
*/

/* globals $, Utils, Settings, VK, VkApiWrapper, loadImage */

var VkAppUtils = {
  displayError: function (eMsg, errDivId, hideAfter) {
    if (!eMsg) {
      $("#" + errDivId).hide("fade");
      return;
    }

    var errEntity = "<div class='ui-widget'><div class='ui-state-error ui-corner-all' style='padding: 0 .7em;'><div class='tooltip-close' onclick='VkAppUtils.displayError(null,\"" + errDivId + "\");' title='Закрыть'></div><p><span class='ui-icon ui-icon-alert' style='float: left; margin-right: .3em;'></span><strong>ОШИБКА: </strong>" + eMsg + "</p></div></div>";
    var dataKey = "displayError";
    $("#" + errDivId).empty().hide(0).html(errEntity).show("highlight");

    var $data = $("#" + errDivId).data(dataKey);
    if ($data && $data.tm) {
      clearTimeout($data.tm);
      $data.tm = null;
    }

    if (hideAfter) {
      var tm_ = setTimeout(function () {
        $("#" + errDivId).hide("fade");
      }, hideAfter);
      $("#" + errDivId).data(dataKey, {
        tm: tm_
      });
    }
  },

  displayWarn: function (eMsg, warnDivId, hideAfter) {
    if (!eMsg) {
      $("#" + warnDivId).hide("fade");
      return;
    }

    var warnEntity = "<div class='ui-widget'><div class='ui-state-error ui-corner-all' style='padding: 0.7em; text-align: center'><div class='tooltip-close' onclick='VkAppUtils.displayWarn(null,\"" + warnDivId + "\");' title='Закрыть'></div><p>" + eMsg + "</p></div></div>";
    $("#" + warnDivId).empty().hide(0).html(warnEntity).show("highlight");
    //var dataKey = "displayWarn";
    var dataKey = "displayError";

    var $data = $("#" + warnDivId).data(dataKey);
    if ($data && $data.tm) {
      clearTimeout($data.tm);
      $data.tm = null;
    }

    if (hideAfter) {
      var tm_ = setTimeout(function () {
        $("#" + warnDivId).hide("fade");
      }, hideAfter);
      $("#" + warnDivId).data(dataKey, {
        tm: tm_
      });
    }
  },

  displayNote: function (eMsg, noteDivId, hideAfter) {
    if (!eMsg) {
      $("#" + noteDivId).hide("fade");
      return;
    }

    var noteEntity = "<div class='ui-widget'><div class='ui-state-highlight ui-corner-all' style='padding: 0 .7em;'><div class='tooltip-close' onclick='VkAppUtils.displayNote(null,\"" + noteDivId + "\");' title='Закрыть'></div><p><span class='ui-icon ui-icon-info' style='float: left; margin-right: .3em;'></span>" + eMsg + "</p></div></div>";
    $("#" + noteDivId).empty().hide(0).html(noteEntity).show("highlight");
    var dataKey = "displayNote";

    var $data = $("#" + noteDivId).data(dataKey);
    if ($data && $data.tm) {
      clearTimeout($data.tm);
      $data.tm = null;
    }

    if (hideAfter) {
      var tm_ = setTimeout(function () {
        $("#" + noteDivId).hide("fade");
      }, hideAfter);
      $("#" + noteDivId).data(dataKey, {
        tm: tm_
      });
    }
  },

  //remove deactivated, create title, sort alphabetically
  filterFriendList: function (friendList) {
    var friends = [];
    for (var i = 0; i < friendList.length; ++i) {
      if ("deactivated" in friendList[i]) {
        continue;
      }
      //to convert escape sequences (&amp;, &quot;...) to chars
      friendList[i].title = Utils.html2Text(friendList[i].first_name + " " + friendList[i].last_name, Settings.MaxUserGrpAlbumNameLen);
      friends.push(friendList[i]);
    }

    friends = friends.sort(function (a, b) {
      var ta = a.title.toLowerCase();
      var tb = b.title.toLowerCase();
      if (ta < tb) {
        return -1;
      } else if (ta > tb) {
        return 1;
      }
      return 0;
    });

    return friends;
  },

  //remove deactivated, create title, sort alphabetically
  filterGroupList: function (groupList) {
    var groups = [];
    for (var i = 0; i < groupList.length; ++i) {
      if ("deactivated" in groupList[i]) {
        continue;
      }
      //to convert escape sequences (&amp;, &quot;...) to chars
      groupList[i].title = Utils.html2Text(groupList[i].name, Settings.MaxUserGrpAlbumNameLen);
      groups.push(groupList[i]);
    }

    groups = groups.sort(function (a, b) {
      var ta = a.title.toLowerCase();
      var tb = b.title.toLowerCase();
      if (ta < tb) {
        return -1;
      } else if (ta > tb) {
        return 1;
      }
      return 0;
    });

    return groups;
  },

  ///retreive from VK Api image object a link to an image with desired size szLiterPrefs
  getSelSizeUrl: function (vk_img, szLiterPrefs) {
    var src_alt = "logo150.png";

    if (("sizes" in vk_img) && vk_img.sizes.length) {
      src_alt = vk_img.sizes[0].url;
    } else {
      console.error("VkAppUtils::getSelSizeUrl() - can't find vk image urls!");
      return src_alt;
    }

    for (var j = 0; j < szLiterPrefs.length; ++j) {
      for (var i = 0; i < vk_img.sizes.length; ++i) {
        if (vk_img.sizes[i].type == szLiterPrefs[j]) {
          return vk_img.sizes[i].url;
        }
      }
    }

    return src_alt;
  },

  ///retreive from VK Api image object a date, format string as "yyyy.mm.dd hh:mm:ss"
  getVkImgDateStr: function (vk_img) {
    //add leading zero
    function lzn(num) {
      return (num < 10) ? "0" + num : "" + num;
    }
    var cD = new Date(vk_img.date * 1000);
    return cD.getFullYear() + "." + lzn(cD.getMonth() + 1) + "." + lzn(cD.getDate()) + " " + lzn(cD.getHours()) + ":" + lzn(cD.getMinutes()) + ":" + lzn(cD.getSeconds());
  },

  ///retreive from VK Api image object a date, format string as "yyyy.mm.dd"
  getVkImgDateStr_yyyymmdd: function (vk_img) {
    //add leading zero
    function lzn(num) {
      return (num < 10) ? "0" + num : "" + num;
    }
    
    var cD = new Date(vk_img.date * 1000);
    return cD.getFullYear() + "." + lzn(cD.getMonth() + 1) + "." + lzn(cD.getDate());
  },

  ///retreive from VK Api image object a link to an image with smallest size
  getVkImgSmallUrl: function (vk_img, alt_url) {
    var url = VkAppUtils.getSelSizeUrl(vk_img, ['s', 'm', 'o', 'p']);
    if (url != "logo150.png") {
        return url;
    } else {
      console.error("VkAppUtils::getVkImgSmallUrl() - can't find vk image urls, ids = " + vk_img.id + ", " + vk_img.album_id + ", " + vk_img.owner_id);
      return alt_url;
    }
  },

  getVkImgMaxSizeSrc: function (vk_img) {
    var src = "";
    var sz = 0;
    for (var i = 0; i < vk_img.sizes.length; ++i) {
      if (vk_img.sizes[i].width >= sz) {
        src = vk_img.sizes[i].url;
        sz = vk_img.sizes[i].width;
      }
    }
    return src;
  },

  getVkImgMaxSizeDim: function (vk_img) {
    var dim = {
      height: 0,
      width: 0
    };
    var sz = 0;
    for (var i = 0; i < vk_img.sizes.length; ++i) {
      var x = vk_img.sizes[i].width * vk_img.sizes[i].height;
      if (x >= sz) {
        dim = vk_img.sizes[i];
        sz = x;
      }
    }
    return dim;
  },

  imageToBlob: function (imageUrl) {
    var liDD = $.Deferred();

    loadImage(
      imageUrl,
      function (result) {
        if (result.type === "error") {
          liDD.reject("Failed to load image");
        } else {
          try {
            result.toBlob(function (blob) {
              liDD.resolve(blob);
            }, "image/jpeg", 1.0);
          } catch (err) {
            liDD.reject("Failed to convert image to blob");
          }
        }
      }, {
        canvas: true,
        noRevoke: true,
        crossOrigin: "Anonymous"
      }
    );

    return liDD.promise();
  },

  sortVkImgByDate: function (vkImgList) {
    vkImgList.sort(function (a, b) {
      if (a.date < b.date) {
        return -1;
      } else if (a.date > b.date) {
        return 1;
      }
      return 0;
    });

    return vkImgList;
  },

  sortVkImgByLikes: function (vkImgList) {
    vkImgList.sort(function (a, b) {
      if (a.likes.count > b.likes.count) {
        return -1;
      } else if (a.likes.count < b.likes.count) {
        return 1;
      }
      return 0;
    });

    return vkImgList;
  },

  sortVkImgByCommentsCnt: function (vkImgList) {
    vkImgList.sort(function (a, b) {
      if (a.comments.count > b.comments.count) {
        return -1;
      } else if (a.comments.count < b.comments.count) {
        return 1;
      }
      return 0;
    });

    return vkImgList;
  },

  sortVkImgByIndex: function (vkImgList) {
    vkImgList.sort(function (a, b) {
      if (a.idx < b.idx) {
        return -1;
      } else if (a.idx > b.idx) {
        return 1;
      }
      return 0;
    });

    return vkImgList;
  },

  //query total number of photos in all albums
  getTotalPhotosCount: function (ownerId, noWallProfile) {
    var ddd = $.Deferred();
    var photosCount = 0;

    var d1 = VkApiWrapper.queryAllPhotos({
      owner_id: ownerId,
      offset: 0,
      count: 0,
      no_service_albums: 1
    });
    var d2 = VkApiWrapper.queryPhotos({
      owner_id: ownerId,
      album_id: 'saved',
      offset: 0,
      count: 0
    });

    var d3, d4;

    if (noWallProfile) {
      d3 = $.Deferred();
      d3.resolve({
        count: 0
      });

      d4 = $.Deferred();
      d4.resolve({
        count: 0
      });
    } else {
      d3 = VkApiWrapper.queryPhotos({
        owner_id: ownerId,
        album_id: 'wall',
        offset: 0,
        count: 0
      });

      d4 = VkApiWrapper.queryPhotos({
        owner_id: ownerId,
        album_id: 'profile',
        offset: 0,
        count: 0
      });
    }

    function updCnt(response) {
      photosCount += response.count;
    }

    function onFail(error) {
      ddd.reject(error);
    }

    d1.done(updCnt).fail(onFail);
    d2.done(updCnt).fail(onFail);
    d3.done(updCnt).fail(onFail);
    d4.done(updCnt).fail(onFail);

    $.when(d1, d2, d3, d4).done(function () {
      ddd.resolve(photosCount);
    });

    return ddd.promise();
  },

  //query photos from all public albums (except for service albums)
  //applies filterFn to each retreived chunk of photos
  //reports progress (photos retreived, photos left after filtering)
  queryAllPhotos: function (ownerId, offset, maxCount, filterFn, noExtended) {
    var self = this;
    var ddd = $.Deferred();
    var photos = [];

    function getNextChunk__(offset, countLeft) {
      var count = Math.min(countLeft, Settings.GetPhotosChunksSz);
      VkApiWrapper.queryAllPhotos({
        owner_id: ownerId,
        offset: offset,
        count: count,
        extended: +!noExtended,
        photo_sizes: +!noExtended,
        no_service_albums: 1
      }).done(
        function (response) {
          if (!response.items) {
            response.items = [];
          }

          //filter photos if filtering function is defined
          var photosFiltered;
          if (filterFn) {
            photosFiltered = filterFn(response.items);
          } else {
            photosFiltered = response.items;
          }
          photos = photos.concat(photosFiltered);

          //report progress
          ddd.notify(response.items.length, photosFiltered.length);

          offset = offset + response.items.length;
          if ((offset < response.count) && (countLeft > 0) && response.items.length) {
            //request next chunk
            getNextChunk__(offset, countLeft - response.items.length);
          } else {
            //finally resolve with the list of retreived photos
            ddd.resolve(photos);
          }
        }
      ).fail(function (error) {
        ddd.reject(error);
      });
    }

    getNextChunk__(offset, maxCount);

    return ddd.promise();
  },

  queryPhotosById: function (ownerId, photoIds, filterFn, noExtended) {
    var self = this;
    var ddd = $.Deferred();

    var opt = {
      photos: "",
      extended: +!noExtended,
      photo_sizes: +!noExtended
    };

    var photos = [];

    function getNextChunk__() {
      //stop if no more images left
      if (!photoIds.length) {
        ddd.resolve(photos, photos.length);
        return;
      }

      var ids = photoIds.splice(0, Settings.GetPhotosChunksSz);

      var idstr = ownerId + "_" + ids[0];
      for (var i = 1; i < ids.length; ++i) {
        idstr += "," + ownerId + "_" + ids[i];
      }

      opt.photos = idstr;

      VkApiWrapper.queryPhotosByIds(opt).done(
        function (response) {
          if (!response) {
            response = [];
          }

          //filter photos if filtering function is defined
          var photosFiltered;
          if (filterFn) {
            photosFiltered = filterFn(response);
          } else {
            photosFiltered = response;
          }
          photos = photos.concat(photosFiltered);

          //report progress
          ddd.notify(response.length, photosFiltered.length);
          getNextChunk__();
        }
      ).fail(function (error) {
        ddd.reject(error);
      });
    }

    getNextChunk__();

    return ddd.promise();
  },

  //query photos from all public albums (except for service albums)
  //applies filterFn to each retreived chunk of photos
  //reports progress (photos retreived, photos left after filtering)
  queryAlbumPhotos: function (ownerId, albumId, offset, maxCount, revOrd, filterFn, noExtended) {
    var self = this;
    var ddd = $.Deferred();
    var photos = [];

    function getNextChunk__(offset, countLeft) {
      var count = Math.min(countLeft, Settings.GetPhotosChunksSz);
      VkApiWrapper.queryPhotos({
        owner_id: ownerId,
        album_id: albumId,
        offset: offset,
        count: count,
        rev: +revOrd,
        extended: +!noExtended,
        photo_sizes: +!noExtended
      }).done(
        function (response) {
          if (!response.items) {
            response.items = [];
          }

          //filter photos if filtering function is defined
          var photosFiltered;
          if (filterFn) {
            photosFiltered = filterFn(response.items);
          } else {
            photosFiltered = response.items;
          }
          photos = photos.concat(photosFiltered);

          //report progress
          ddd.notify(response.items.length, photosFiltered.length);

          offset = offset + response.items.length;
          if ((offset < response.count) && (countLeft > 0) && response.items.length) {
            //request next chunk
            getNextChunk__(offset, countLeft - response.items.length);
          } else {
            //finally resolve with the list of retreived photos
            ddd.resolve(photos, response.count);
          }
        }
      ).fail(function (error) {
        ddd.reject(error);
      });
    }

    getNextChunk__(offset, maxCount);

    return ddd.promise();
  },

  queryAlbumList: function (options) {
    var d = $.Deferred();

    VkApiWrapper.queryAlbums(options).done(function (albums) {
      albums = albums.items;

      for (var i = 0; i < albums.length; ++i) {
        albums[i].title = Utils.html2Text(albums[i].title, Settings.MaxUserGrpAlbumNameLen);
      }

      //sort albums by name
      albums = albums.sort(function (a, b) {
        var ta = a.title.toLowerCase();
        var tb = b.title.toLowerCase();
        if (ta < tb) {
          return -1;
        } else if (ta > tb) {
          return 1;
        }
        return 0;
      });

      d.resolve(albums);
    }).fail(function (error) {
      d.reject(error);
    });

    return d.promise();
  },

  //creates map: album id -> album.title
  queryAlbumsInfo: function (ownerId, ratedPhotos) {
    var albumMap = {};

    //collect all album ids
    for (var i = 0; i < ratedPhotos.length; ++i) {
      albumMap[ratedPhotos[i].album_id] = "";
    }

    var ddd = $.Deferred();

    //request albums info for collected album ids
    var albumListStr = Object.keys(albumMap).join();
    VkApiWrapper.queryAlbums({
      owner_id: ownerId,
      album_ids: albumListStr
    }).done(function (response) {
      //update map
      for (var i = 0; i < response.count; ++i) {
        albumMap[response.items[i].id] = response.items[i].title;
      }

      ddd.resolve(albumMap);
    }).fail(function (error) {
      ddd.reject(error);
    });

    return ddd.promise();
  },

  //retreive user/group info by screen_name
  resolveUidGid: function (str) {
    var ddd = $.Deferred();

    function onFail(error) {
      if (!("error_msg" in error)) {
        error.error_msg = "Не удалось получить информацию о пользователе/группе: '" + str + "'";
      }

      VkAppUtils.displayError("Не удалось получить информацию о пользователе/группе: '" + str + "'", "GlobalErrorBox", Settings.ErrorHideAfter);
      ddd.reject(error);
    }

    VkApiWrapper.resolveScreenName({
      screen_name: str
    }, true).done(function (resp) {
      if (resp.type == "user") {
        VkApiWrapper.queryUser({
          user_ids: resp.object_id,
          fields: Settings.QueryUserFields
        }).done(function (friends) {
          friends = VkAppUtils.filterFriendList(friends);
          if (friends.length) {
            ddd.resolve(friends[0], true);
          } else {
            //resolved, but inactive user was filtered out
            onFail({});
          }
        }).fail(onFail);
      } else if ((resp.type == "group") || (resp.type == "page")) {
        VkApiWrapper.queryGroup({
          group_ids: resp.object_id
        }).done(function (groups) {
          groups = VkAppUtils.filterGroupList(groups);
          if (groups.length) {
            ddd.resolve(groups[0], false);
          } else {
            //resolved, but inactive group was filtered out
            onFail({});
          }
        }).fail(onFail);
      } else {
        //unknown type
        onFail({});
        return;
      }
    }).fail(onFail);

    return ddd.promise();
  },

  validateApp: function (vkSid, appLocation, delay) {
    if (vkSid) { //looks like a valid run
      return;
    }

    setTimeout(function () {
      document.location.href = appLocation;
    }, delay);
  },

  isSubscribedToMe: function () {
    var apiResult = Utils.sanitizeParameter(Utils.getParameterByName("api_result"));
    var friendSts = apiResult.substr(-1);

    return (friendSts == "1") || (friendSts == "3");
  },

  IsWelcomedKey: "isWelcomed3",
  IsRatedKey: "isRated3",
  IsWelcomed: "1",
  IsSubscribeTtDisplayed: "2",

  welcomeCheck: function () {
    var d = $.Deferred();

    //request isWelcomed var
    VkApiWrapper.storageGet(VkAppUtils.IsWelcomedKey).done(function (data) {
      if (data[VkAppUtils.IsWelcomedKey] === "") {
        //if not welcomed yet -> show welcome dialog
        $("#welcome_dialog").dialog("open").on("dialogclose", function (event, ui) {
          VkApiWrapper.storageSet(VkAppUtils.IsWelcomedKey, VkAppUtils.IsWelcomed);
          d.resolve(0);
        });
      } else if (data[VkAppUtils.IsWelcomedKey] == VkAppUtils.IsWelcomed) {
        //already welcomed, display subscribe tooltip
        d.resolve(VkAppUtils.IsWelcomed);
        VkApiWrapper.storageSet(VkAppUtils.IsWelcomedKey, VkAppUtils.IsSubscribeTtDisplayed);
      } else {
        //already welcomed and subscribe tooltip displayed
        d.resolve(VkAppUtils.IsSubscribeTtDisplayed);
      }
    });

    return d.promise();
  },

  rateRequest: function (delay) {
    var BlinkAfterDialogDelay = 2000;
    var d = $.Deferred();

    setTimeout(function () {
      VkApiWrapper.storageGet(VkAppUtils.IsWelcomedKey + "," + VkAppUtils.IsRatedKey).done(function (data) {
        if ((data[VkAppUtils.IsWelcomedKey] == "0") || (data[VkAppUtils.IsRatedKey] == "1")) { //already rated or first run
          d.resolve();
          return;
        }

        //if not rated yet -> show rate us dialog
        $("#rateus_dialog").dialog("open").on("dialogclose", function (event, ui) {
          VkApiWrapper.storageSet(VkAppUtils.IsRatedKey, "1");
          d.resolve();
        });

        setTimeout(function () {
          Utils.blinkDiv("vk_like", Settings.BlinkCount, Settings.BlinkDelay);
        }, BlinkAfterDialogDelay);
      });
    }, delay);

    return d.promise();
  }

};
