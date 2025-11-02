/** Copyright (c) 2012-2025 Leonid Azarenkov
	Licensed under the MIT license
*/

/* globals $, RateLimit, VK*/

var VkApiWrapper = {
  defaults_: {
    authToken: '',
    apiVersion: '5.199',

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

  getVkBridgeErrDescr: function (error) {
    var err_descr = "Unknown error.";
    if ("error_reason" in error.error_data) {
      err_descr = error.error_data.error_reason;
    } else if ("error_msg" in error.error_data) {
      err_descr = error.error_data.error_msg;
    }
    if ("error_description" in error.error_data) {
      err_descr = err_descr + "\n" + error.error_data.error_description;
    }
    return err_descr;
  },

  //calls VK API method with specified parameters
  //returns Deferred.promise()
  callVkApi: function (vkApiMethod, methodParams, noTimeout) {
    var self = this;
    var d = $.Deferred();
    var retries = self.settings_.apiCallMaxRetries;
    var timeout = self.settings_.apiCallTimeout;

    function scheduleVkApiMethod() {
      self.rateLimiter_.schedule(function () {
        if (!noTimeout) {
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
        }

        $.extend(methodParams, {
          v: self.settings_.apiVersion,
          access_token: self.settings_.authToken
        });
        vkBridge.send('VKWebAppCallAPIMethod', {
          method: vkApiMethod,
          params: methodParams
        })
        .then((data) => { 
          // don't resolve/reject again on duplicate request
          if (d.state() !== "pending") {
            return;
          }

          if ("response" in data) {
            d.resolve(data.response);
          } else {
            var err = {
              error_msg: "VK.API call failed, unknow error!",
              response: data
            };
            console.log("VkApiWrapper: " + err.error_msg + ' Response: ' + JSON.stringify(data));
            d.reject(err);
          }
        })
        .catch((error) => {
            // don't resolve/reject again on duplicate request
            if (d.state() !== "pending") {
              return;
            }
            var err = {
              error_msg: "VK.API call failed, " + self.getVkBridgeErrDescr(error),
              response: error
            };
            console.log("VkApiWrapper: " + err.error_msg);
            d.reject(err);
        });
      });
    }

    scheduleVkApiMethod();

    return d.promise();
  },

  wallPost: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("wall.post", options, true).fail(function (error) {
      error.error_msg = "Не удалось создать запись на стене!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось получить список альбомов!<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  queryPhotosByIds: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.getById", options).done(function (response) {
      d.resolve(response);
    }).fail(function (error) {
      if (("error_code" in error) && ((error.error_code == self.ApiErrCodes.AccessDenied) ||
          (error.error_code == self.ApiErrCodes.AlbumAccessDenied))) { //handle access denied error, return empty data
        var resp = [];
        d.resolve(resp);
      } else {
        error.error_msg = "Не удалось получить выбранные фотографий!<br /><small>" + error.error_msg + "</small>";
        if (!silent) {
          self.settings_.errorHandler(error.error_msg);
        }
        d.reject(error);
      }
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
        error.error_msg = "Не удалось получить список фотографий из выбранного альбома!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось получить список фотографий пользователя или группы!<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  queryAllRatedPhotos: function (ownerId, offset, count, minLikes, silent) {
    var self = this;
    var d = $.Deferred();

    // jshint multistr:true
    var code_ = "var tmp,rsp=[],i=0,rtd=0;\n\
tmp=API.photos.getAll({owner_id:%1,offset:%2,count:%3,extended:1,photo_sizes:1,no_service_albums:1});\n\
if(tmp.error_code)return tmp;\n\
while(i<tmp.items.length){\n\
if(tmp.items[i].likes.count>=%4)rsp.push(tmp.items[i]);\n\
if(tmp.items[i].likes.count>0)rtd=rtd+1;\n\
i=i+1;\n\
}\n\
return {count: tmp.count, items: rsp, rated: rtd};\n";

    var code = code_.replace(/%1/g, ownerId);
    code = code.replace(/%2/g, offset);
    code = code.replace(/%3/g, count);
    code = code.replace(/%4/g, minLikes);

    self.callVkApi("execute", {
      code: code
    }).fail(function (error) {
      error.error_msg = "Не удалось получить список фотографий пользователя или группы!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось получить список друзей!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось получить информацию о пользователе!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось получить список групп пользователя!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось получить информацию о группе/странице!<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  createAlbum: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.createAlbum", options).fail(function (error) {
      error.error_msg = "Не удалось создать альбом!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось переместить фотографию!<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  copyPhoto: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.copy", options).fail(function (error) {
      error.error_msg = "Не удалось сохранить фотографию!<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  reorderPhotoList: function (ownerId, photoIdAfter, photoIds, silent) {
    var self = this;
    var d = $.Deferred();

    // jshint multistr:true
    var code_ = "\
var oid=%1,pida=%2,phl=[%3],rsp,i=0;\
while(i<phl.length){\
  rsp = API.photos.reorderPhotos({owner_id:oid,after:pida,photo_id:phl[i]});\
  pida = phl[i];\
  if(rsp.error_code)\
    return rsp;\
  i=i+1;\
}\
return {count: phl.length};";

    var code = code_.replace("%1", ownerId);
    code = code.replace("%2", photoIdAfter);
    code = code.replace("%3", photoIds.join());

    self.callVkApi("execute", {
      code: code
    }).fail(function (error) {
      error.error_msg = "Не удалось переупорядочить фотографии!<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  movePhotoList: function (ownerId, targetAlbumId, photoIds, silent) {
    var self = this;
    var d = $.Deferred();

    // jshint multistr:true
    var code_ = "var oid=%1,tid=%2,phl=[%3],rsp=[],i=0;while(i<phl.length){rsp.push(!API.photos.move({owner_id:oid,target_album_id:tid,photo_id:phl[i]}).error_code);i=i+1;}return rsp;";

    var code = code_.replace("%1", ownerId);
    code = code.replace("%2", targetAlbumId);
    code = code.replace("%3", photoIds.join());

    self.callVkApi("execute", {
      code: code
    }).fail(function (error) {
      error.error_msg = "Не удалось переместить фотографии!<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  moveAllPhotos: function (ownerId, srcAlbumId, targetAlbumId, skipCnt, silent) {
    var self = this;
    var d = $.Deferred();

    // jshint multistr:true
    var code_ = "\
var oid=%1,sid=%2,tid=%3,skp=%4;\n\
var phl,i=0,err_cnt=0;\n\
phl = API.photos.get({owner_id:oid,album_id:sid,offset:skp,count:24});\n\
if(phl.error_code)return phl;\n\
while(i<phl.items.length){\n\
  if (API.photos.move({owner_id:oid,target_album_id:tid,photo_id:phl.items[i].id}).error_code)\n\
    err_cnt = err_cnt + 1;\n\
  i=i+1;\n\
}\n\
return {ph_cnt:phl.items.length,err_cnt:err_cnt};";

    var code = code_.replace("%1", ownerId);
    code = code.replace("%2", srcAlbumId);
    code = code.replace("%3", targetAlbumId);
    code = code.replace("%4", skipCnt);

    self.callVkApi("execute", {
      code: code
    }).fail(function (error) {
      error.error_msg = "Не удалось переместить фотографии!<br /><small>" + error.error_msg + "</small>";
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
      error.error_msg = "Не удалось получить информацию о пользователе/группе:<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  getUploadServer: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.getUploadServer", options).fail(function (error) {
      error.error_msg = "Не удалось получить адрес сервера для загрузки фотографий:<br /><small>" + error.error_msg + "</small>";
      if (!silent) {
        self.settings_.errorHandler(error.error_msg);
      }
      d.reject(error);
    }).done(function (resp) {
      d.resolve(resp);
    });

    return d.promise();
  },

  saveUploadPhotos: function (options, silent) {
    var self = this;
    var d = $.Deferred();

    self.callVkApi("photos.save", options).fail(function (error) {
      error.error_msg = "Не удалось cохранить фотографии после успешной загрузки:<br /><small>" + error.error_msg + "</small>";
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
  },

  resizeAppWindow: function (width, height) {
    var d = $.Deferred();

    vkBridge.send("VKWebAppResizeWindow", {width: width, height: height})
    .then((data) => {
      if (data.width) {
        d.resolve(data);
      } else {
        var err = {
          error_msg: "VKWebAppResizeWindow call failed, unknow error!",
          response: data
        };
        console.log("VkApiWrapper: " + err.error_msg + ' Response: ' + JSON.stringify(data));
        d.reject(err);
      }
    })
    .catch((error) => {
      var err = {
        error_msg: "VKWebAppResizeWindow call failed, " + self.getVkBridgeErrDescr(error),
        response: error
      };
      console.log("VkApiWrapper: " + err.error_msg);
      d.reject(err);
    });

    return d.promise();
  }

};
