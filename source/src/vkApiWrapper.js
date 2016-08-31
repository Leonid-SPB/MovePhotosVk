/** Copyright (c) 2012-2016 Leonid Azarenkov
	Licensed under the MIT license
*/

//requires jQuery, utils(RateLimit, displayError), Vk API
/* globals $, RateLimit, VK*/

var VkApiWrapper = {
  defaults_: {
    //allowed: 3 requests in 1000 ms
    apiMaxCallsCount: 3,
    apiMaxCallsPeriod: 1000,

    //timeout-retry params
    apiCallTimeout: 2000,
    apiCallMaxRetries: 4,
    apiTmoutMultiplier: 2.0,

    errorHandler: function (errMsg) {
      console.log("VkApiWrapper:" + errMsg);
    }
  },

  ApiErrCodes: {
    AccessDenied: 15,
    AlbumAccessDenied: 200
  },

  rateLimiter_: null,

  settings_: {

  },

  init: function (opts) {
    $.extend(this.settings_, this.defaults_, opts);
    this.rateLimiter_ = new RateLimit(this.settings_.apiMaxCallsCount, this.settings_.apiMaxCallsPeriod, false);
  },

  //calls VK API method with specified parameters
  //returns Deferred.promise()
  callVkApi: function (vkApiMethod, methodParams) {
    var self = this;
    var d = $.Deferred();
    var retries = self.settings_.apiCallMaxRetries;
    var timeout = self.settings_.apiCallTimeout;

    function scheduleVkApiMethod() {
      self.rateLimiter_.schedule(function () {
        setTimeout(function () {
          //check if api call is still in progress
          if (d.state() === "pending") {
            if (retries-- > 0) {
              console.log("VkApiWrapper: VK.api call timeout, rescheduling request");
              timeout *= self.settings_.apiTmoutMultiplier;
              scheduleVkApiMethod();
            } else {
              console.log("VkApiWrapper: VK.api call timeout, all retries failed");
              d.reject();
            }
          }

          //else: no timeout, api call has finished
        }, timeout);

        VK.api(vkApiMethod, methodParams, function (data) {
          //don't resolve/reject again on duplicate request
          if (d.state() !== "pending") {
            return;
          }

          if ("response" in data) {
            d.resolve(data.response);
          } else if ("error" in data) {
            console.log("VkApiWrapper: " + data.error.error_msg);
            d.reject(data.error);
          } else {
            console.log("VkApiWrapper: Unknow error!");
            d.reject(null);
          }
        });
      });
    }

    scheduleVkApiMethod();

    return d.promise();
  },

  wallPost: function (options, silent) {
    var self = this;
    var p = self.callVkApi("wall.post", options);
    if (!silent) {
      p.fail(function () {
        self.settings_.errorHandler("Не удалось создать запись на стене!");
      });
    }
    return p;
  },

  queryAlbums: function (options, silent) {
    var self = this;
    var p = self.callVkApi("photos.getAlbums", options);
    if (!silent) {
      p.fail(function () {
        self.settings_.errorHandler("Не удалось получить список альбомов!");
      });
    }
    return p;
  },

  queryPhotos: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.get", options).done(function (response) {
      d.resolve(response);
    }).fail(function (error) {
      if (("error_code" in error) && ((error.error_code == self.ApiErrCodes.AccessDenied) ||
          (error.error_code == self.ApiErrCodes.AlbumAccessDenied))) { //handle access denied error, return empty data
        var resp = {
          items: [],
          count: 0
        };
        d.resolve(resp);
      } else {
        if (!silent) {
          self.settings_.errorHandler("Не удалось получить список фотографий из выбранного альбома!");
        }
        d.reject();
      }
    });

    return d;
  },

  queryAllPhotos: function (options, silent) {
    var self = this;
    var p = self.callVkApi("photos.getAll", options);
    if (!silent) {
      p.fail(function () {
        self.settings_.errorHandler("Не удалось получить список фотографий пользователя или группы!");
      });
    }
    return p;
  },

  queryFriends: function (options, silent) {
    var self = this;
    var p = self.callVkApi("friends.get", options);
    if (!silent) {
      p.fail(function () {
        self.settings_.errorHandler("Не удалось получить список друзей!");
      });
    }
    return p;
  },

  queryUser: function (options, silent) {
    var self = this;
    var p = self.callVkApi("users.get", options);
    if (!silent) {
      p.fail(function () {
        self.settings_.errorHandler("Не удалось получить информацию о пользователе!");
      });
    }
    return p;
  },

  queryUserGroups: function (options, silent) {
    var self = this;
    var p = self.callVkApi("groups.get", options);
    if (!silent) {
      p.fail(function () {
        self.settings_.errorHandler("Не удалось получить список групп пользователя!");
      });
    }
    return p;
  },

  queryGroup: function (options, silent) {
    var self = this;
    var p = self.callVkApi("groups.getById", options);
    if (!silent) {
      p.fail(function () {
        self.settings_.errorHandler("Не удалось получить информацию о группе/странице!");
      });
    }
    return p;
  },

  /*movePhoto: function(ownerId, targetAlbumId, photoId){
  	var self = this;
  	var p = self.callVkApi("photos.move", {owner_id: ownerId, target_album_id: targetAlbumId, photo_id: photoId});
  	if (!silent) {
  		p.fail(function(){
  			self.settings_.errorHandler("Не удалось переместить фотографию!");
  		});
  	}
  	return p;
  },*/

  resolveScreenName: function (options, silent) {
    var self = this;
    var p = self.callVkApi("utils.resolveScreenName", options);
    if (!silent) {
      p.fail(function () {
        var str = ("screen_name" in options) ? options.screen_name : 'undefined';
        self.settings_.errorHandler("Не удалось получить информацию о пользователе/группе: '" + str + "'");
      });
    }
    return p;
  },

  storageGet: function (keys) {
    var d = $.Deferred();

    this.callVkApi("storage.get", {
      keys: keys
    }).fail(function (error) {
      d.reject();
    }).done(function (resp) {
      var myresp = {};

      for (var i = 0; i < keys.length; ++i) {
        myresp[keys[i]] = "";
      }

      for (var i = 0; i < resp.length; ++i) {
        myresp[resp[i].key] = resp[i].value;
      }
      d.resolve(myresp);
    });

    return d.promise();
  },

  storageSet: function (key, value) {
    return this.callVkApi("storage.set", {
      key: key,
      value: value
    });
  }

};
