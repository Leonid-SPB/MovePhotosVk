/** Copyright (c) 2012-2016 Leonid Azarenkov
	Licensed under the MIT license
*/

/* globals $, Utils, Settings, VK, VkApiWrapper */

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
      var title = $("<div>").html(friendList[i].first_name + " " + friendList[i].last_name).text();
      friendList[i].title = title;
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
      var title = $("<div>").html(groupList[i].name).text();
      if (title.length > Settings.MaxGroupNameLen) {
        title = title.substring(0, Settings.MaxGroupNameLen) + "...";
      }
      groupList[i].title = title;
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

  //query total number of photos in all albums
  getTotalPhotosCount: function (ownerId) {
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
      album_id: 'wall',
      offset: 0,
      count: 0
    });
    var d3 = VkApiWrapper.queryPhotos({
      owner_id: ownerId,
      album_id: 'saved',
      offset: 0,
      count: 0
    });
    var d4 = VkApiWrapper.queryPhotos({
      owner_id: ownerId,
      album_id: 'profile',
      offset: 0,
      count: 0
    });

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
  queryAllPhotos: function (ownerId, offset, maxCount, filterFn) {
    var self = this;
    var ddd = $.Deferred();
    var photos = [];

    function getNextChunk__(offset, countLeft) {
      var count = Math.min(countLeft, Settings.GetPhotosChunksSz);
      VkApiWrapper.queryAllPhotos({
        owner_id: ownerId,
        offset: offset,
        count: count,
        extended: 1,
        photo_sizes: 1,
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
          if ((offset < response.count) && (countLeft > 0)) {
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

  //query photos from all public albums (except for service albums)
  //applies filterFn to each retreived chunk of photos
  //reports progress (photos retreived, photos left after filtering)
  queryAlbumPhotos: function (ownerId, albumId, offset, maxCount, filterFn) {
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
        extended: 1,
        photo_sizes: 1,
        no_service_albums: 0
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
          if ((offset < response.count) && (countLeft > 0)) {
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
        var title = $("<div>").html(albums[i].title).text();
        if (title.length > Settings.MaxOptionLength) {
          title = title.substring(0, Settings.MaxOptionLength) + "...";
        }
        albums[i].title = title;
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

  IsWelcomedKey: "isWelcomed3",
  IsRatedKey: "isRated3",

  welcomeCheck: function () {
    var d = $.Deferred();

    //request isWelcomed var
    VkApiWrapper.storageGet(VkAppUtils.IsWelcomedKey).done(function (data) {
      if (data[VkAppUtils.IsWelcomedKey] == "1") { //already welcomed
        d.resolve();
        return;
      }

      //if not welcomed yet -> show welcome dialog
      $("#welcome_dialog").dialog("open").on("dialogclose", function (event, ui) {
        VkApiWrapper.storageSet(VkAppUtils.IsWelcomedKey, "1");
        d.resolve();
      });
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
