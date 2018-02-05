/** Copyright (c) 2012-2017 Leonid Azarenkov
    Licensed under the MIT license
*/

/* Thumbs Container */
/* globals $, hs*/

(function ($, hs) {
  var defaults = {
    AddThumbDelay: 40,
    AddThumbCount: 25,
    LoadThumbDelay: 100,
    LoadThumbSldownThresh: 10,
    LoadThumbRetries: 3,

    VkPhotoPopupSettings: 'toolbar=yes,scrollbars=yes,resizable=yes,width=1024,height=600'
  };

  var PluginName = 'ThumbsViewer';
  var ThumbClass = '.ThumbsViewer-thumb';

  var thC = {

    //PUBLIC:
    //------------------------------------------------------

    ///initialize Thumbs Container
    init: function (opts) {
      var $this = $(this);

      var data = {
        disableSel: false,
        revSortOrder: false,
        albumMap: {},

        //private
        busy_dfrd__: $.Deferred(),
        abortTask__: false,
        thumbsSelCnt__: 0,
        thumbsCnt__: 0
      };
      data.busy_dfrd__.resolve();
      $.extend(data, defaults, opts);

      $this.data(PluginName, data);
      $this.addClass("ThumbsViewer-list");
      $this.on("click.ThumbsViewer", ThumbClass, function (event) {
        thC.onThumbClick.call(this, event, $this);
      });
      $this.on("click.ThumbsViewer", ".ThumbsViewer-zoomIco", function (event) {
        thC.onZoomClick.call(this, event, $this);
      });
    },

    ///removes $thumb div from container
    removeThumb: function ($thumb) {
      var $data = $(this).data(PluginName);
      if ($thumb.hasClass("selected")) {
        --$data.thumbsSelCnt__;
      }
      --$data.thumbsCnt__;
      $thumb.remove();
    },

    ///thumbsAr is expected to be non empty array of Vk API images
    ///returns Deferred which will be resolved when all thumbs are added to the 
    ///container or job is aborted (added != loaded)
    addThumbList: function (thumbsAr) {
      var self = this;
      var $this = $(this);
      var $data = $this.data(PluginName);
      var d = $.Deferred();

      function addThumb__(queue) {
        for (var i = 0; i < $data.AddThumbCount; ++i) {
          if (!queue.length) {
            d.resolve();
            return;
          }
          thC.createThumb_.call(self, queue.shift());
          ++$data.thumbsCnt__;
        }
        setTimeout(function () {
          addThumb__(queue);
        }, $data.AddThumbDelay);
      }

      //abort prev job in progress
      $data.abortTask__ = true;

      //when prev job aborted, start new job
      $.when($data.busy_dfrd__).done(function () {
        $data.busy_dfrd__ = $.Deferred();
        $data.abortTask__ = false;
        var thumbs = thumbsAr.slice();
        if ($data.revSortOrder) {
          thumbs.reverse();
        }
        addThumb__(thumbs);
      });

      //start loading images when all thumbnais are added to the container
      d.done(function () {
        thC.loadImages.call(self);
      });

      return d.promise();
    },

    ///update album map (id -> description) with new records
    updateAlbumMap: function (albumMap) {
      var $this = $(this);
      var $data = $this.data(PluginName);

      $.extend($data.albumMap, albumMap);
    },

    ///disable/enable selection
    selectionDisable: function (disable) {
      var $this = $(this);
      var $data = $this.data(PluginName);
      $data.disableSel = disable;
    },

    ///select all thumbnails in container
    selectAll: function () {
      var $this = $(this);
      var $data = $this.data(PluginName);

      if ($data.disableSel) {
        return;
      }

      $data.thumbsSelCnt__ = 0;

      $this.find(ThumbClass).each(function () {
        $(this).addClass("selected");
        ++$data.thumbsSelCnt__;
      });
    },

    ///deselect all thumbnails in container
    selectNone: function () {
      var $this = $(this);
      var $data = $this.data(PluginName);

      if ($data.disableSel) {
        return;
      }

      $data.thumbsSelCnt__ = 0;
      $this.find(ThumbClass).removeClass("selected");
    },

    ///toggle selection of $thumb
    selectToggle: function ($thumb) {
      var $this = $(this);
      var $data = $this.data(PluginName);

      if ($data.disableSel) {
        return;
      }

      $thumb.toggleClass("selected");

      if ($thumb.hasClass("selected")) {
        ++$data.thumbsSelCnt__;
      } else {
        --$data.thumbsSelCnt__;
      }
    },

    ///select all if any one is selected, deselect all if all are selected
    selectToggleAll: function () {
      var $this = $(this);
      var $data = $this.data(PluginName);

      if ($data.disableSel) {
        return;
      }

      var thumbsSelCnt__ = 0;
      var thumbsTotal = 0;

      /*$this.find(ThumbClass).each(function () {
        ++thumbsTotal;
        if ($(this).hasClass("selected")) {
          ++thumbsSelCnt__;
        }
      });*/
      thumbsSelCnt__ = $data.thumbsSelCnt__;
      thumbsTotal = $data.thumbsCnt__;

      if (thumbsSelCnt__ == thumbsTotal) {
        $this.find(ThumbClass).removeClass("selected");
        $data.thumbsSelCnt__ = 0;
      } else {
        $this.find(ThumbClass).addClass("selected");
        $data.thumbsSelCnt__ = thumbsTotal;
      }
    },

    ///for currently visible on screen: select all if any one is selected, deselect all if all are selected
    selectToggleVisible: function () {
      var $this = $(this);
      var $data = $this.data(PluginName);

      if ($data.disableSel) {
        return;
      }

      var $thumbs = $this.find(ThumbClass);
      if (!$thumbs.length) { //no thumbs in container
        return;
      }

      //calculate which thumbs are currently visible based on 
      //scroll position and container/image geometry
      var $parentDiv = $this.parent().first();
      var divHeight = $parentDiv.height();
      var divWidth = $parentDiv.width();
      var liHeight = $thumbs.first().outerHeight(true);
      var liWidth = $thumbs.first().outerWidth(true);
      var rowsScrolled = Math.round($parentDiv.scrollTop() / liHeight);
      var rowsOnScreen = Math.round(divHeight / liHeight);
      var thumbsInRow = Math.floor(divWidth / liWidth);

      var selFirstIndex = rowsScrolled * thumbsInRow;
      var selLastIndex = Math.min(selFirstIndex + rowsOnScreen * thumbsInRow, $thumbs.length);
      $thumbs = $thumbs.slice(selFirstIndex, selLastIndex);

      var thumbsSelCnt__ = 0;
      var thumbsTotal = 0;
      $thumbs.each(function () {
        ++thumbsTotal;
        if ($(this).hasClass("selected")) {
          ++thumbsSelCnt__;
        }
      });

      if (thumbsSelCnt__ == thumbsTotal) {
        $thumbs.removeClass("selected");
      } else {
        $thumbs.addClass("selected");
      }

      $data.thumbsSelCnt__ = $this.find(ThumbClass + ".selected").length;
    },

    ///returns array of 'data' associated with thumbnails in container
    getThumbsData: function (onlySelected) {
      var thumbData = [];
      var selector = onlySelected ? ThumbClass + ".selected" : ThumbClass;

      this.find(selector).each(function () {
        var $this = $(this);
        var item = {
          data: $this.data(PluginName),
          $thumb: $this
        };
        thumbData.push(item);
      });

      return thumbData;
    },

    ///returns number of thumbnails total/selected
    getThumbsCount: function () {
      var $data = $(this).data(PluginName);
      var total_ = $data.thumbsCnt__;
      var selected_ = $data.thumbsSelCnt__;
      return {
        total: total_,
        selected: selected_
      };
    },

    ///remove all thumbnails from the container
    empty: function () {
      var $this = $(this);
      var $data = $this.data(PluginName);
      $data.abortTask__ = true; //abort any job in progress(if any)

      hs.close();

      var d = $.Deferred();

      //when job aborted, clean container
      $.when($data.busy_dfrd__).done(function () {
        $this.empty();
        $data.disableSel = false;
        $data.revSortOrder = false;
        $data.thumbsSelCnt__ = 0;
        $data.thumbsCnt__ = 0;
        $data.albumMap = {};
        d.resolve();
      });

      return d.promise();
    },

    ///reorder thumbnails in the container (straight/reverse)
    reorder: function (revSort) {
      var self = this;
      var $this = $(this);
      var $data = $this.data(PluginName);

      //if sort order changed, resort thumbs
      if ($data.revSortOrder != revSort) {
        $data.revSortOrder = revSort;

        //when prev job aborted, start new job
        $data.abortTask__ = true; //abort any job in progress(if any)
        $.when($data.busy_dfrd__).done(function () {
          $data.busy_dfrd__ = $.Deferred();
          $data.abortTask__ = false;

          var $thumbs = $this.find(ThumbClass);
          $thumbs.detach();
          var thumbsLi = $thumbs.toArray().reverse();
          for (var i = 0; i < thumbsLi.length; ++i) {
            $this.append(thumbsLi[i]);
          }

          thC.loadImages.call(self);
        });
      }
    },

    //shuffle - reorder randomly

    //PROTECTED:
    //------------------------------------------------------

    ///load images for the thumbnail objects in the container
    loadImages: function () {
      var $this = $(this);
      var $data = $(this).data(PluginName);

      var loadImgQueue = $this.find(ThumbClass + ".loading").toArray();
      var loadInProgressCnt = 0;

      function loadImg__() {
        //stop if no more images left and all loaded or the task was aborted
        if ($data.abortTask__ || (!loadImgQueue.length && !loadInProgressCnt)) {
          $data.busy_dfrd__.resolve();
          return;
        }

        if (loadImgQueue.length) {
          var thumb = $(loadImgQueue.shift());
          if (!$.contains(document, thumb[0])) { //don't load image if element has already been removed
            return loadImg__();
          }

          ++loadInProgressCnt;
          var vk_img = thumb.data(PluginName).vk_img;
          var imgSrc = thC.fixHttpUrl(thC.getSelSizeUrl(vk_img, ['p', 'o', 'm', 's']));
          var thumb_img = $("<img />");
          thumb_img.on('load', function () {
            --loadInProgressCnt;
            thumb.removeClass('loading');
            thumb.addClass('showphoto');
            thumb.css('background-image', 'url(' + imgSrc + ')');
            thumb_img.on('load', null);
          }).on('error', function () {
            if (!("loadAttempts" in thumb.data(PluginName))) {
              thumb.data(PluginName).loadAttempts = 0;
            }

            if (++thumb.data(PluginName).loadAttempts < $data.LoadThumbRetries) {
              loadImgQueue.push(thumb[0]);
            }

            console.warn(PluginName + "::loadImg__() failed to load '" + imgSrc + "', att=" + thumb.data(PluginName).loadAttempts);

            thumb_img.on('error', null);
            --loadInProgressCnt;
          });
          thumb_img.attr("src", imgSrc);
        }

        //timeout depends on number of images being loaded
        var tmout = (loadInProgressCnt < $data.LoadThumbSldownThresh) ? $data.LoadThumbDelay : loadInProgressCnt * $data.LoadThumbDelay;
        setTimeout(function () {
          loadImg__();
        }, tmout);
      }

      loadImg__();
    },

    ///create new thumbnail object and append to the container
    ///expects VK API image object
    createThumb_: function (vk_img) {
      var $this = $(this);
      //var $data = $(this).data(PluginName);
      var thumb_parent = $("<div class='ThumbsViewer-thumb loading' />");

      var titleStr = thC.makeTitle_.call(this, vk_img);
      var captionStr = thC.makeCaption_.call(this, vk_img);
      var zoomImgSrc = thC.fixHttpUrl(thC.getSelSizeUrl(vk_img, ['y', 'x']));
      var aa = $("<a />", {
        class: 'ThumbsViewer-hslink',
        href: zoomImgSrc,
        title: 'Увеличить',
        onclick: 'return hs.expand(this, hs.config1)'
      }).data({
        title: titleStr,
        caption: captionStr
      });
      var zoomIcon = $('<div class="ThumbsViewer-zoomIco" />').append(aa);

      thumb_parent.append(zoomIcon);
      thumb_parent.attr("title", "Выбрать фото");
      thumb_parent.data(PluginName, {
        vk_img: vk_img
      });
      thC.oncreateThumb_.call(this, thumb_parent);
      thumb_parent.appendTo($this);
    },

    ///used by createThumb_ to create title for the photo
    makeTitle_: function (vk_img) {
      return 'Фото %1/%2:&nbsp; &#10084; ' + vk_img.likes.count + ", &#x1f5e8; " + vk_img.comments.count + ", &#x1F56B; " + vk_img.reposts.count;
    },

    ///used by createThumb_ to create caption for the photo
    makeCaption_: function (vk_img) {
      var $this = $(this);
      var $data = $this.data(PluginName);

      var album = "";
      if (vk_img.album_id in $data.albumMap) {
        album = $data.albumMap[vk_img.album_id];
      }

      //caption contains album name, link to original VK photo and description
      var origUrl = "//vk.com/photo" + vk_img.owner_id + "_" + vk_img.id;
      var onClickOrigUrl = "var myWindow = window.open('" + origUrl + "', 'vk_photo', '" + $data.VkPhotoPopupSettings + "', false); myWindow.focus();";

      // jshint multistr:true
      var caption = '\
<div>\
  <div class="highslide-caption-divinfo" style="text-align: left"><b>Альбом</b>:<i> %1</i></div><div class="highslide-caption-divinfo" style="text-align: right"><a onclick="%2">Оригинал фото</a></div>\
</div>\
<div class="highslide-caption-descr">%3</div>';

      caption = caption.replace("%1", album);
      caption = caption.replace("%2", onClickOrigUrl);
      caption = caption.replace("%3", vk_img.text);

      return caption;
    },

    //replace protocol prefix to fix insecure http://<...> links
    fixHttpUrl: function (url) {
      return url.replace("https:", "").replace("http:", "");
    },

    ///retreive from VK Api image object a link to image with desired size szLiterPrefs
    getSelSizeUrl: function (vk_img, szLiterPrefs) {
      var src_alt = "logo150.png";

      if (("sizes" in vk_img) && vk_img.sizes.length) {
        src_alt = vk_img.sizes[0].src;
      } else if ("photo_130" in vk_img) {
        return vk_img.photo_130;
      } else if ("photo_75" in vk_img) {
        return vk_img.photo_75;
      } else {
        console.log(PluginName + ":getSelSizeUrl() - can't find vk image urls!");
        return src_alt;
      }

      for (var j = 0; j < szLiterPrefs.length; ++j) {
        for (var i = 0; i < vk_img.sizes.length; ++i) {
          if (vk_img.sizes[i].type == szLiterPrefs[j]) {
            return vk_img.sizes[i].src;
          }
        }
      }

      return src_alt;
    },

    ///createThumb_() calls this function modify $thumb object before insertion to the container
    oncreateThumb_: function ($thumb) {
      var vk_img = $thumb.data(PluginName).vk_img;
      var likesbox = '<div class="ui-state-default ThumbsViewer_likesBox ui-corner-br">&#10084; ' + vk_img.likes.count + '</div>';
      $thumb.append($(likesbox));
    },

    ///handle click on thumbnail area
    onThumbClick: function (event, parent) {
      event.stopPropagation();
      return false;
    },

    ///handle click on zoom icon
    onZoomClick: function (event, parent) {
      //do nothing here, using handler from <a onclick="...">
      event.stopPropagation();
      return false;
    }
  };

  $.fn.ThumbsViewer = function (method) {
    var args = arguments;

    if (method == "getThumbsData") {
      return thC.getThumbsData.apply(this, Array.prototype.slice.call(args, 1));
    } else if (method == "getThumbsCount") {
      return thC.getThumbsCount.apply(this, Array.prototype.slice.call(args, 1));
    } else if (method == "addThumbList") {
      return thC.addThumbList.apply(this, Array.prototype.slice.call(args, 1));
    }

    return this.each(function () {
      if (thC[method]) {
        return thC[method].apply(this, Array.prototype.slice.call(args, 1));
      } else if (typeof method === 'object' || !method) {
        return thC.init.apply(this, args);
      } else {
        $.error('Method ' + args + ' does not exist on jQuery.ThumbsViewer');
      }
    });
  };
})(jQuery, hs);
