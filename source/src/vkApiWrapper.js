/** Copyright (c) 2012-2016 Leonid Azarenkov
	Licensed under the MIT license
*/

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
              console.log("VkApiWrapper: VK.API call timeout, rescheduling request");
              timeout *= self.settings_.apiTmoutMultiplier;
              scheduleVkApiMethod();
            } else {
              var e = {
                error_msg: "VK.API call timeout, all retries failed"
              };
              console.log(e.error_msg);
              d.reject(e);
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
            var e = {
              error_msg: "VK.API call failed, unknow error!"
            };
            console.log(e.error_msg);
            d.reject(e);
          }
        });
      });
    }

    scheduleVkApiMethod();

    return d.promise();
  },

  wallPost: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("wall.post", options).fail(function (error) {
      error.error_msg = "Не удалось создать запись на стене! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  queryAlbums: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.getAlbums", options).fail(function (error) {
      error.error_msg = "Не удалось получить список альбомов! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
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
        error.error_msg = "Не удалось получить список фотографий из выбранного альбома! ERROR: " + error.error_msg;
        if (!silent) {
          self.settings_.errorHandler(error.error_msg);
        }
        d.reject(error);
      }
    });

    return d.promise();
  },

  queryAllPhotos: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.getAll", options).fail(function (error) {
      error.error_msg = "Не удалось получить список фотографий пользователя или группы! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  queryFriends: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("friends.get", options).fail(function (error) {
      error.error_msg = "Не удалось получить список друзей! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  queryUser: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("users.get", options).fail(function (error) {
      error.error_msg = "Не удалось получить информацию о пользователе! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  queryUserGroups: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("groups.get", options).fail(function (error) {
      error.error_msg = "Не удалось получить список групп пользователя! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  queryGroup: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("groups.getById", options).fail(function (error) {
      error.error_msg = "Не удалось получить информацию о группе/странице! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  movePhoto: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.move", options).fail(function (error) {
      error.error_msg = "Не удалось переместить фотографию! ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  resolveScreenName: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("utils.resolveScreenName", options).fail(function (error) {
      error.error_msg = "Не удалось получить информацию о пользователе/группе: ERROR: " + error.error_msg;
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  storageGet: function (keys) {
    var d = $.Deferred();

    this.callVkApi("storage.get", {
      keys: keys
    }).fail(function (error) {
      d.reject(error);
    }).done(function (resp) {
      var myresp = {};

      for (var i = 0; i < keys.length; ++i) {
        myresp[keys[i]] = "";
      }

      for (i = 0; i < resp.length; ++i) {
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
