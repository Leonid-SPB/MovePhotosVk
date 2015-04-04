/** Copyright (c) 2012-2014 Leonid Azarenkov
    Licensed under the MIT license
*/

//requires VkApiWrapper, jQuery, highslide, spin.js

var Settings = {
    vkUserId        : null,
    vkSid           : null,
    albumMaxCapacity: 10000,
    movePhotosDelay : 350,
    savePhotosDelay : 100,
    errorHideAfter  : 3000,
    blinkDelay      : 500,
    blinkCount      : 12,
    vkAppLocation   : "//vk.com/app3231070",
    redirectDelay   : 3000,
    photosInTab     : 500,
    photosGetChunkSz: 1000,
    maxOptionLength : 40
};

//Album manager global object
var AmApi = {};

/* Hide All Code*/
(function($, AmApiExport) {
/* Thumbs Container */
(function( $, hs ) {
    var defaults = {
        AddThumbDelay: 50,
        AjaxLoaderGifSrc: "graphics/loader.gif",
        ThumbsInRow: 5
    };

    var preloadAjaxLoaderGif = $("<img />",{src: defaults.AjaxLoaderGifSrc});

    var methods = {
        init: function(opts) {
            var $this = $(this);
            var options = $.extend(defaults, opts);
            $this.addClass("ThumbsViewer-thumbs_container");
            $this.on("click.ThumbsViewer", ".ThumbsViewer-thumb_block", function(event){methods.onSelClick__.call(this, $this)});
            $this.on("click.ThumbsViewer", ".ThumbsViewer_zoom-ico", function(event){methods.onZoomClick__.call(this, event, $this)});

            var data = {
                disableSel: false,
                busy_dfrd : $.Deferred(),
                abort     : false,
                thumbsSelected: 0,
                revSortOrder: false
            };
            data.busy_dfrd.resolve();
            $this.data('ThumbsViewer', data);
        },

        //expects object img with property src
        addThumb: function(img) {
            var $this = $(this);

            var thumb_li = $("<li></li>", {class: "ThumbsViewer-thumb_block"});
            var thumb_parent = $("<a></a>");

            var loader_gif = $("<img />",{src: defaults.AjaxLoaderGifSrc, class: "ThumbsViewer_loader_gif"});
            thumb_parent.append(loader_gif);
            thumb_li.append(thumb_parent, $("<a class=\"bg\">&nbsp;</a>"));

            var zoom_icon = $("<div class=\"ThumbsViewer_zoom-ico\"><img src=\"graphics/Zoom-In-icon.png\" /></div>");
            zoom_icon.data('ThumbsViewer', {img_src: img.photo_604, img_title: img.text});
            thumb_parent.append(zoom_icon);

            var thumb_img = $("<img />");
            thumb_img.load(function(){
                loader_gif.replaceWith(thumb_img);
            });
            thumb_img.attr({src: img.photo_130});

            var data = {img: img};
            thumb_li.data('ThumbsViewer', data);

            thumb_li.appendTo($this);
        },

        removeThumb: function($thumb){
            if($thumb.hasClass("selected")){
                var data   = $(this).data('ThumbsViewer');
                --data.thumbsSelected;
            }
            $thumb.remove();
        },

        //thumbsAr is expected to be non empty array with elements containing .src property
        //returns Deferred which will be resolved when all thumbs are added to container or job is aborted
        addThumbList: function(thumbsAr, revSort){
            var d = $.Deferred();

            function addThumb__(self, thumbsAr, idx){
                var data   = $(self).data('ThumbsViewer');
                if(idx >= thumbsAr.length || data.abort){
                    data.busy_dfrd.resolve();
                    d.resolve();
                    return;
                }

                methods.addThumb.call(self, thumbsAr[idx++]);
                setTimeout(function(){addThumb__(self, thumbsAr, idx);}, defaults.AddThumbDelay);
            }

            //abort prev job in progress
            var $this = $(this);
            var data   = $this.data('ThumbsViewer');
            data.abort = true;

            if(!thumbsAr.length){
                d.reject();
                return d.promise();
            }

            data.revSortOrder = revSort;
            if(revSort){
                thumbsAr.reverse();
            }

            //when prev job aborted, start new job
            var self = this;
            $.when( data.busy_dfrd ).done(function(){
                data.busy_dfrd = $.Deferred();
                data.abort = false;
                addThumb__(self, thumbsAr, 0);
            });

            return d.promise();
        },

        selectAll: function(){
            var $this  = $(this);
            var data   = $this.data('ThumbsViewer');

            if( data.disableSel ){
                return;
            }

            data.thumbsSelected = 0;

            $this.find(".ThumbsViewer-thumb_block").each(function (){
                $(this).addClass("selected");
                ++data.thumbsSelected;
            });
        },

        selectNone: function(){
            var $this  = $(this);
            var data   = $this.data('ThumbsViewer');

            if( data.disableSel ){
                return;
            }

            data.thumbsSelected = 0;
            $this.find(".ThumbsViewer-thumb_block").removeClass("selected");
        },

        selectionDisable: function(disable){
            var $this = $(this);
            var data   = $this.data('ThumbsViewer');
            data.disableSel = disable;
        },

        selectToggleAll: function(){
            var $this  = $(this);
            var data   = $this.data('ThumbsViewer');

            if( data.disableSel ){
                return;
            }

            var thumbsSelected = 0;
            var thumbsTotal = 0;

            $this.find(".ThumbsViewer-thumb_block").each(function(){
                ++thumbsTotal;
                if( $(this).hasClass("selected") ){
                    ++thumbsSelected;
                }
            });

            if(thumbsSelected == thumbsTotal){
                $this.find(".ThumbsViewer-thumb_block").removeClass("selected");
                data.thumbsSelected = 0;
            }else{
                $this.find(".ThumbsViewer-thumb_block").addClass("selected");
                data.thumbsSelected = thumbsTotal;
            }
        },

        selectToggleVisible: function(){
            var $this  = $(this);
            var data   = $this.data('ThumbsViewer');

            if( data.disableSel ){
                return;
            }

            var $thumbs = $this.find(".ThumbsViewer-thumb_block");
            if(!$thumbs.length){//no thumbs in container
                return;
            }

            var $parentDiv = $this.parent().first();
            var divHeight = $parentDiv.innerHeight();
            var liHeight = $thumbs.first().outerHeight();
            var rowsScrolled = Math.round($parentDiv.scrollTop()/liHeight);
            var rowsOnScreen = Math.ceil(divHeight/liHeight);

            var selFirstIndex = rowsScrolled*defaults.ThumbsInRow;
            var selLastIndex = Math.min(selFirstIndex + rowsOnScreen*defaults.ThumbsInRow, $thumbs.length);
            $thumbs = $thumbs.slice(selFirstIndex, selLastIndex);

            var thumbsSelected = 0;
            var thumbsTotal = 0;
            $thumbs.each(function(){
                ++thumbsTotal;
                if( $(this).hasClass("selected") ){
                    ++thumbsSelected;
                }
            });

            if(thumbsSelected == thumbsTotal){
                $thumbs.removeClass("selected");
            }else{
                $thumbs.addClass("selected");
            }

            data.thumbsSelected = $this.find(".ThumbsViewer-thumb_block.selected").length;
        },

        empty: function() {
            var $this = $(this);
            var data   = $this.data('ThumbsViewer');
            data.abort = true;//abort job in progress(if any)

            //when job aborted, clean container
            $.when( data.busy_dfrd ).done(function(){
                $this.empty();
                data.thumbsSelected = 0;
            });
        },

        sort: function(revSort) {
            var $this = $(this);
            var data   = $this.data('ThumbsViewer');

            //if busy, abort sorting
            if( data.busy_dfrd.state() != "resolved" ){
                return;
            }

            //if sort order changed, resort thumbs
            if( data.revSortOrder != revSort ){
                data.revSortOrder = revSort;

                var $thumbs = $this.find(".ThumbsViewer-thumb_block");
                $thumbs.detach();
                var thumbsLi = $thumbs.toArray().reverse();
                for( var i = 0; i < thumbsLi.length; ++i){
                    $this.append(thumbsLi[i]);
                }
            }
        },

        onSelClick__: function(parent){
            var data   = parent.data('ThumbsViewer');
            if( data.disableSel ){
                return;
            }

            $this = $(this);

            if($this.hasClass("selected")){
                $this.removeClass("selected");
                --data.thumbsSelected;
            }else{
                ++data.thumbsSelected;
                $this.addClass("selected");
            }
        },

        onZoomClick__: function(event, parent){
            $this = $(this);
            var data   = $this.data('ThumbsViewer');
            event.stopPropagation();
            return hs.expand( $("<a></a>", {href: data.img_src, title: data.img_title}).get(0) );
        }
    };

    function getSelThumbsData() {
        var thumbData = [];

        this.find(".ThumbsViewer-thumb_block.selected").each(function(){
            $this = $(this);
            var data = $this.data('ThumbsViewer');
            data.$thumb = $this;
            thumbData.push(data);
        });

        return thumbData;
    }

    function getSelThumbsNum() {
        var data = this.data('ThumbsViewer');

        return data.thumbsSelected;
    }

    $.fn.ThumbsViewer = function (method) {
        var args = arguments;

        if(method == "getSelThumbsData"){
            return getSelThumbsData.apply( this );
        }else if(method == "getSelThumbsNum"){
            return getSelThumbsNum.apply( this );
        }else if(method == "addThumbList"){
            return methods.addThumbList.apply( this, Array.prototype.slice.call(args, 1 ) );
        }

        return this.each(function() {
            if ( methods[method] ) {
                return methods[ method ].apply( this, Array.prototype.slice.call(args, 1 ));
            } else if ( typeof method === 'object' || !method ) {
                return methods.init.apply( this, args );
            } else {
                $.error( 'Method ' +  args + ' does not exist on jQuery.ThumbsViewer' );
            }
        });
    };
})( jQuery, hs );

$.fn.spin = function(opts) {
    this.each(function() {
        var $this = $(this),
            data = $this.data();

        if ( (opts === false) && (data.spinner) ) {
            data.spinner.stop();
            delete data.spinner;
        } else if ((!data.spinner) && (opts !== false)) {
            data.spinner = new Spinner($.extend({color: $this.css('color')}, opts)).spin(this);
        }
    });
    return this;
};

$.fn.addme = function(name) {
    this.each(function() {
        var $this = $(this);
        var htmlstr = "<div style=\"text-align: center;\"><a href=\"//vk.com/l.azarenkov\" target=\"addme\"><div class=\"clear_fix\" style=\"display: inline-block; height: 30px;\"><img width=\"30px\" height=\"30px\" class=\"adbox-logo\" src=\"//cs319724.userapi.com/v319724876/53cf/H1pNnL_LDrw.jpg\" />";
        var text = name + ", добавь меня в друзья! =)";
        htmlstr += "<div class=\"adbox-text\" style=\"margin-top:8px; font-size: 14px;\">" + text + "</div></div></a></div>";

        $this.replaceWith(htmlstr);
    });
    return this;
};

function getParameterByName(name){
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.search);
    if(results == null)
        return null;
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "));
}

function displayError(eMsg, noteDivId, hideAfter){
    var errEntity = "<div class=\"ui-widget\"><div class=\"ui-state-error ui-corner-all\" style=\"padding: 0 .7em;\"><p><span class=\"ui-icon ui-icon-alert\" style=\"float: left; margin-right: .3em;\"></span><strong>ОШИБКА: </strong>" + eMsg + "</p></div></div>";
    $("#"+noteDivId).empty().html(errEntity);

    if(hideAfter){
        setTimeout(function(){
            $("#"+noteDivId).empty()
        }, hideAfter);
    }
}

function displayWarn(eMsg, noteDivId, hideAfter){
    var errEntity = "<div class=\"ui-widget\"><div class=\"ui-state-error ui-corner-all\">" + eMsg + "</div></div>";
    $("#"+noteDivId).empty().html(errEntity);

    if(hideAfter){
        setTimeout(function(){
            $("#"+noteDivId).empty()
        }, hideAfter);
    }
}

function showInviteBox(){
    VK.callMethod("showInviteBox");
}

function showSpinner(){
    var opts = {
        lines: 17,
        length: 26,
        width: 11,
        radius: 40,
        corners: 1,
        rotate: 0,
        color: '#000',
        speed: 0.9,
        trail: 64,
        shadow: false,
        hwaccel: false,
        className: 'spinner',
        zIndex: 2e9,
        top: 'auto',
        left: 'auto'
    };
    $("body").spin(opts);
}

function hideSpinner(){
    $("body").spin(false);
}

function blinkDiv(divId, blinks, delay){
    var bclass = "blink_1";

    function toggleBlink(el, blinks, delay){
        if( !blinks ){
            setTimeout(function(){el.removeClass(bclass);}, delay);
            return;
        }

        if( el.hasClass(bclass) ){
            el.removeClass(bclass);
        }else{
            el.addClass(bclass);
        }
        setTimeout(function(){toggleBlink(el, --blinks, delay);}, delay);
    }

    toggleBlink($("#"+divId), blinks, delay);
}

var RateLimit = (function() {
    //by Matteo Agosti
    var RateLimit = function(maxOps, interval, allowBursts) {
        this._maxRate = allowBursts ? maxOps : maxOps / interval;
        this._interval = interval;
        this._allowBursts = allowBursts;

        this._numOps = 0;
        this._start = new Date().getTime();
        this._queue = [];
    };

    RateLimit.prototype.schedule = function(fn) {
        var that = this,
            rate = 0,
            now = new Date().getTime(),
            elapsed = now - this._start;

        if (elapsed > this._interval) {
            this._numOps = 0;
            this._start = now;
        }

        rate = this._numOps / (this._allowBursts ? 1 : elapsed);

        if (rate < this._maxRate) {
            if (this._queue.length === 0) {
                this._numOps++;
                fn();
            }
            else {
                if (fn) this._queue.push(fn);

                this._numOps++;
                this._queue.shift()();
            }
        }
        else {
            if (fn) this._queue.push(fn);

            setTimeout(function() {
                that.schedule();
            }, 1 / this._maxRate);
        }
    };

    return RateLimit;
})();

var VkApiWrapper = {
    //allowed: 3 requests in 1000 ms
    apiMaxCallsCount  : 3,
    apiMaxCallsPeriod : 1000,

    rateLimiter       : null,

    init              : function(){
        this.rateLimiter = new RateLimit(this.apiMaxCallsCount, this.apiMaxCallsPeriod, false);
    },

    displayError      : function(errMsg) {
        //use global displayError(msg, errorBoxId)
        displayError(errMsg, "globalErrorBox");
    },

    //calls VK API method with specified parameters
    //returns Deferred.promise()
    callVkApi: function(vkApiMethod, methodParams) {
        var d = $.Deferred();

        this.rateLimiter.schedule(function(){
            VK.api(vkApiMethod, methodParams, function(data) {
                if("response" in data){
                    d.resolve(data.response);
                }else{
                    console.log(data.error.error_msg);
                    d.reject(data.error);
                }
            });
        });

        return d.promise();
    },

    queryAlbumsList: function(ownerId) {
        var self = this;
        var p = this.callVkApi("photos.getAlbums", {owner_id: ownerId});
        p.fail(function(){
            self.displayError("Не удалось получить список альбомов! Попробуйте перезагрузить приложение.");
        });
        return p;
    },

    queryPhotosList: function(ownerId, albumId, offset, count) {
        var self = this;
        var p = this.callVkApi("photos.get", {owner_id: ownerId, album_id: albumId, offset: offset, count: count});
        p.fail(function(){
            self.displayError("Не удалось получить список фотографий из выбранного альбома! Попробуйте перезагрузить приложение.");
        });
        return p;
    },

    queryGroupsList: function(userId){
        var self = this;
        var p = this.callVkApi("groups.get", {user_id: userId, extended: 1, filter: "moder"});
        p.fail(function(){
            self.displayError("Не удалось получить список групп пользователя! Попробуйте перезагрузить приложение.");
        });
        return p;
    },

    movePhoto: function(ownerId, targetAlbumId, photoId){
        var self = this;
        var p = this.callVkApi("photos.move", {owner_id: ownerId, target_album_id: targetAlbumId, photo_id: photoId});
        p.fail(function(){
            self.displayError("Не удалось переместить фотографию! Попробуйте перезагрузить приложение.");
        });
        return p;
    },

    storageGet: function(key){
        return this.callVkApi("storage.get", {key: key});
    },

    storageSet: function(key, value){
        return this.callVkApi("storage.set", {key: key, value: value});
    }
};



/* Album manager */
var AmApi__ = {
    progressStep: 0,
    progressPerc: 0,
    dstPhotosNumEdit: null,
    srcPhotosNumEdit: null,
    srcAlbumList: null,
    dstAlbumList: null,
    revThumbSortChk: null,
    srcAlbumOwnerList: null,
    dstAlbumOwnerList: null,
    albumCache: {},
    shownPhotosEdit: null,
    shownFotosSlider: null,
    thumbsContainer: null,
    progressBar: null,
    movePhotosBtn: null,
    selectedPhotosNumSpan: null,

    init: function(){
        this.srcPhotosNumEdit  = document.getElementById("Form1_SrcPhotosNum");
        this.srcAlbumList      = document.getElementById("Form1_SrcAlbumList");
        this.dstPhotosNumEdit  = document.getElementById("Form1_DstPhotosNum");
        this.dstAlbumList      = document.getElementById("Form1_DstAlbumList");
        this.revThumbSortChk   = document.getElementById("Form1_RevThumbSort");
        this.dstAlbumOwnerList = document.getElementById("Form1_DstAlbumOwner");
        this.srcAlbumOwnerList = document.getElementById("Form1_SrcAlbumOwner");
        this.shownPhotosEdit   = document.getElementById("Form1_ShownFotos");
        this.shownFotosSlider  = $("#Form1_ShownFotosSlider");
        this.thumbsContainer   = $("#thumbs_container");
        this.progressBar       = $("#Progressbar");
        this.movePhotosBtn     = $("#movePhotosBtn");
        this.selectedPhotosNumSpan = $("#selectedPhotosNum");
    },

    queryPhotos: function(ownerId, albumId, offset, count){
        var self = this;
        var d = $.Deferred();
        var photos = [];

        showSpinner();

        function queryPhotosChunk(offset, countLeft){
            var count_ = Math.min(countLeft, Settings.photosGetChunkSz);
            VkApiWrapper.queryPhotosList(ownerId, albumId, offset, count_).done(
                function(photosList){
                    if(!photosList.items){
                        photosList.items = [];
                    }

                    photos = photos.concat(photosList.items);

                    if( photosList.items.length && (offset < photosList.count) && (countLeft > 0)){
                        queryPhotosChunk(offset + photosList.items.length, countLeft - photosList.items.length);
                    } else {
                        hideSpinner();
                        d.resolve(photos, photosList.count);
                    }
                }
            ).fail(
                function(){
                    hideSpinner();
                    d.reject(photos, 0);
                }
            );
        }

        queryPhotosChunk(offset, count);

        return d.promise();
    },
    
    srcAlbumChanged: function() {
        var self = this;
        var selIndex = self.srcAlbumList.selectedIndex;

        var ownSelIndex = self.srcAlbumOwnerList.selectedIndex;
        var ownerId = self.srcAlbumOwnerList.item(ownSelIndex).value;

        self.thumbsContainer.ThumbsViewer("empty");

        if(!selIndex){//not selected
            self.srcPhotosNumEdit.value = "";
            return;
        }
        
        //get album size
        self.queryPhotos(ownerId, self.srcAlbumList.item(selIndex).value, 0, 0).done(
            function(photosList, albumSize){
                self.srcPhotosNumEdit.value = albumSize;
                
                //update slider
                var numTabs = Math.max(Math.ceil(albumSize/Settings.photosInTab) - 1, 0);
                self.shownFotosSlider.slider("option", "value", 0);
                self.shownFotosSlider.slider("option", "max", numTabs);
                self.shownPhotosEdit.value = 0 + "-" + Settings.photosInTab;
            }
        );

        //query photos for active tab
        self.queryPhotos(ownerId, self.srcAlbumList.item(selIndex).value, 0, Settings.photosInTab).done(
            function(photosList){
                self.revThumbSortChk.disabled = true;
                self.thumbsContainer.ThumbsViewer("addThumbList", photosList, self.revThumbSortChk.checked).done(
                    function(){self.revThumbSortChk.disabled = false;}
                );

                self.updSelectedNum();
            }
        );
    },
    
    silde: function(event, ui) {
        var self = this;
        var selIndex = self.srcAlbumList.selectedIndex;
        var ownSelIndex = self.srcAlbumOwnerList.selectedIndex;
        var ownerId = self.srcAlbumOwnerList.item(ownSelIndex).value;

        self.thumbsContainer.ThumbsViewer("empty");
        self.shownPhotosEdit.value = ui.value * Settings.photosInTab + "-" + (ui.value + 1) * Settings.photosInTab;
        
        //query photos for active tab
        self.queryPhotos(ownerId, self.srcAlbumList.item(selIndex).value, ui.value * Settings.photosInTab, Settings.photosInTab).done(
            function(photosList){
                self.revThumbSortChk.disabled = true;
                self.thumbsContainer.ThumbsViewer("addThumbList", photosList, self.revThumbSortChk.checked).done(
                    function(){self.revThumbSortChk.disabled = false;}
                );

                self.updSelectedNum();
            }
        );
    },

    dstAlbumChanged: function() {
        var self = this;
        var selIndex = self.dstAlbumList.selectedIndex;

        var ownSelIndex = self.dstAlbumOwnerList.selectedIndex;
        var ownerId = self.dstAlbumOwnerList.item(ownSelIndex).value;

        if(selIndex == 1){//save album
            self.movePhotosBtn.button("option","label", "Сохранить");
            self.dstPhotosNumEdit.value = "";
            return;
        }
        self.movePhotosBtn.button("option","label","Переместить");
        if(selIndex == 0){//not selected
            self.dstPhotosNumEdit.value = "";
            return;
        }

        self.queryPhotos(ownerId, self.dstAlbumList.item(selIndex).value, 0, 0).done(
            function(photosList, albumSize){
                self.dstPhotosNumEdit.value = albumSize;
            }
        );
    },

    srcOwnerChanged: function(){
        var self = this;
        var selIndex = self.srcAlbumOwnerList.selectedIndex;
        var ownerId = self.srcAlbumOwnerList.item(selIndex).value;

        function doUpdate(){
            self.fillSrcAlbumsListBox(self.albumCache[ownerId], ownerId == Settings.vkUserId);
            self.srcAlbumChanged();

            //synchronize with srcAlbumOwner as it is disabled
            self.dstAlbumOwnerList.selectedIndex = selIndex;
            self.dstOwnerChanged();
        }

        if(ownerId in self.albumCache){
            doUpdate();
        } else {
            self.queryAlbumList(ownerId).done(doUpdate);
        }
    },

    dstOwnerChanged: function(){
        var self = this;
        var selIndex = self.dstAlbumOwnerList.selectedIndex;
        var ownerId = self.dstAlbumOwnerList.item(selIndex).value;

        function doUpdate(){
            self.fillDstAlbumsListBox(self.albumCache[ownerId]);
            self.dstAlbumChanged();
        }

        if(ownerId in self.albumCache){
            doUpdate()
        } else {
            self.queryAlbumList(ownerId).done(doUpdate);
        }
    },

    disableControls: function(disable){
        var self = this;

        var dval = 0;
        var dstr = "enable";
        if(disable){
            dval = 1;
            dstr = "disable";
        }

        self.thumbsContainer.ThumbsViewer("selectionDisable", dval);
        self.movePhotosBtn.button(dstr);
        self.srcAlbumList.disabled = dval;
        self.dstAlbumList.disabled = dval;
        self.revThumbSortChk.disabled = dval;
        self.srcAlbumOwnerList.disabled = dval;
        //self.dstAlbumOwnerList.disabled = dval;
        self.shownFotosSlider.slider(dstr);
    },

    movePhotosSingle: function(aid_target, selThumbsAr){
        var self = this;

        if(!selThumbsAr.length){
            //MOVE DONE
            self.progressBar.progressbar("value", 100);
            self.disableControls(false);

            //self.srcAlbumChanged();
            //setTimeout(function(){self.dstAlbumChanged();}, Settings.movePhotosDelay);
            self.rateRequest();

            return;
        }

        if( +self.dstPhotosNumEdit.value >= Settings.albumMaxCapacity ){//album overflow
            self.disableControls(false);
            displayWarn("Альбом переполнен. Перемещение остановлено.", "NoteField", Settings.errorHideAfter);
            return;
        }

        var currThumbData = selThumbsAr.shift();

        var ownSelIndex = self.srcAlbumOwnerList.selectedIndex;
        var ownerId = self.srcAlbumOwnerList.item(ownSelIndex).value;

        VkApiWrapper.movePhoto(ownerId, aid_target, currThumbData.img.id).done(
            function() {
                ++self.dstPhotosNumEdit.value;
                --self.srcPhotosNumEdit.value;
                self.thumbsContainer.ThumbsViewer("removeThumb", currThumbData.$thumb);
                self.updSelectedNum();

                self.progressPerc = self.progressPerc + self.progressStep;
                self.progressBar.progressbar("value", self.progressPerc);
                setTimeout(function(){
                    self.movePhotosSingle(aid_target, selThumbsAr);
                }, Settings.movePhotosDelay);
            }
        );
    },

    revThumbSortChkClick: function(){
        var self = this;
        self.thumbsContainer.ThumbsViewer("sort", self.revThumbSortChk.checked);
    },

    savePhotos: function(divPhotos, selThumbsAr, num){
        var self = this;

        if(!selThumbsAr.length){
            return;
        }

        var currThumbData = selThumbsAr.shift();
        var src = currThumbData.img.photo_130;

        if(currThumbData.img.photo_2560){
            src = currThumbData.img.photo_2560;
        }else if(currThumbData.img.photo_1280){
            src = currThumbData.img.photo_1280;
        }else if(currThumbData.img.photo_807){
            src = currThumbData.img.photo_807;
        }else if(currThumbData.img.photo_604){
            src = currThumbData.img.photo_604;
        }

        function lzn(num){
            return (num < 10)? "0" + num: "" + num;
        }

        var cD = new Date(currThumbData.img.date*1000);
        var createdStr = lzn(cD.getDay()) + "." + lzn(cD.getMonth()) + "." + cD.getFullYear() + " " + lzn(cD.getHours()) + ":" + lzn(cD.getMinutes()) + ":" + lzn(cD.getSeconds());
        var text = currThumbData.img.text ? $("<div>").text(currThumbData.img.text).html() : "";

        var htmlStr = "";
        htmlStr = htmlStr + "<p> Фото №" + num + ", " + createdStr;
        if(text.length){
            htmlStr = htmlStr + ", " + text + "</p>";
        }else{
            htmlStr = htmlStr + "</p>";
        }
        htmlStr = htmlStr + "<img src=\"" + src + "\" alt=\"" + text + "\"/ ><br/ ><br/ >";

        //divPhotos.innerHTML = divPhotos.innerHTML + htmlStr;
        $(divPhotos).append(htmlStr);
        $(currThumbData.$thumb).removeClass("selected");
        setTimeout(function(){self.savePhotos(divPhotos, selThumbsAr, num+1)}, Settings.savePhotosDelay);
    },

    movePhotosClick: function() {
        var self = this;
        var dstSelIndex = self.dstAlbumList.selectedIndex;
        if(!dstSelIndex){//dst album not selected
            displayWarn("Не выбран альбом, куда перемещать фотографии", "NoteField", Settings.errorHideAfter);
            return;
        }

        var srcSelIndex = self.srcAlbumList.selectedIndex;
        if(self.dstAlbumList.item(dstSelIndex).value == self.srcAlbumList.item(srcSelIndex).value){
            displayWarn("Нельзя переместить фотографии в тот же самый альбом!", "NoteField", Settings.errorHideAfter);
            return;
        }

        var selThumbsAr = self.thumbsContainer.ThumbsViewer("getSelThumbsData");
        if(!selThumbsAr.length){//no images selected
            displayWarn("Не выбраны фотографии для перемещения/сохранения", "NoteField", Settings.errorHideAfter);
            return;
        }

        //save to disk
        if(self.dstAlbumList.item(dstSelIndex).value == "save"){
            var popUp = window.open("SaveAlbum.html", "_blank", "location=1, menubar=1, toolbar=1, titlebar=1, scrollbars=1",false);
            var title = "Фотографии из альбома \"" + self.srcAlbumList.item(srcSelIndex).text + "\"";
            var divPhotos = null;
            function waitLoad(){
                divPhotos = popUp.document.getElementById("photos");
                if(divPhotos){
                    popUp.document.title = title;
                    self.savePhotos(divPhotos, selThumbsAr, 1);
                } else {
                    setTimeout(waitLoad, 100);
                }
            }
            setTimeout(waitLoad, 100);
            return;
        }

        //move photos
        self.disableControls(true);

        self.progressStep = 100.0/(selThumbsAr.length);
        self.progressPerc = 0.0;

        self.movePhotosSingle(self.dstAlbumList.item(dstSelIndex).value, selThumbsAr);
    },

    fillSrcAlbumsListBox: function(albums, selfOwn){
        var self = this;
        self.srcAlbumList.selectedIndex = 0;

        //remove old options, skip "not selected" option
        for(var i = self.srcAlbumList.length-1; i >= 1; --i){
            self.srcAlbumList.remove(i);
        }

        var opt2 = new Option("Фото на стене", -7, false, false);
        $(opt2).addClass("italic_bold");
        self.srcAlbumList.add(opt2, null);

        //my albums, add service albums
        if(selfOwn){
            var opt1 = new Option("Сохраненные фотографии", -15, false, false);
            $(opt1).addClass("italic_bold");
            self.srcAlbumList.add(opt1, null);
        }

        for(var i = 0; i < albums.length; i++){
            var title = $("<div>").html(albums[i].title).text();//to convert escape sequences (&amp;, &quot;...) to chars
            var opt = new Option(title, albums[i].id, false, false);
            self.srcAlbumList.add(opt, null);
        }
    },

    fillDstAlbumsListBox: function(albums){
        var self = this;
        self.dstAlbumList.selectedIndex = 0;

        //remove old options
        //i >= 2 to skip "not selected" and "save locally" options
        for(var i = self.dstAlbumList.length-1; i >= 2; --i){
            self.dstAlbumList.remove(i);
        }

        //add new options
        for(var i = 0; i < albums.length; i++){
            var title = $("<div>").html(albums[i].title).text();//to convert escape sequences (&amp;, &quot;...) to chars
            var opt = new Option(title, albums[i].id, false, false);
            self.dstAlbumList.add(opt, null);
        }
    },

    fillGroupsListBox: function(groups, groupsListSelect){
        for(var i = 0; i < groups.length; i++){
            var title = $("<div>").html(groups[i].name).text();//to convert escape sequences (&amp;, &quot;...) to chars
            var opt = new Option(title, -groups[i].id, false, false);//NOTE: using minus for group ID
            groupsListSelect.add(opt, null);
        }
    },

    updSelectedNum: function(){
        var self = this;
        this.selectedPhotosNumSpan.text(self.thumbsContainer.ThumbsViewer("getSelThumbsNum")+"");
    },


    selToggleAll: function() {
        var self = this;
        self.thumbsContainer.ThumbsViewer("selectToggleAll");
        self.updSelectedNum();
    },

    selToggleVisible: function() {
        var self = this;
        self.thumbsContainer.ThumbsViewer("selectToggleVisible");
        self.updSelectedNum();
    },

    queryAlbumList: function(ownerId) {
        var d = $.Deferred();
        var self = this;
        showSpinner();

        VkApiWrapper.queryAlbumsList(ownerId).done(function(albums){
            //sort albums by name
            albums.items = albums.items.sort(function(a, b){
                var ta = a.title.toLowerCase();
                var tb = b.title.toLowerCase();
                if(ta < tb){
                    return -1;
                }else if(ta > tb){
                    return 1;
                }
                return 0;
            });

            for(var i = 0; i < albums.items.length; ++i){
                if(albums.items[i].title.length > Settings.maxOptionLength){
                    albums.items[i].title = albums.items[i].title.substring(0, Settings.maxOptionLength) + "...";
                }
            }

            //save album list to cache
            self.albumCache[ownerId] = albums.items;
            hideSpinner();
            d.resolve();
        }).fail(function(){
            hideSpinner();
            d.reject();
        });

        return d.promise();
    },

    welcomeCheck: function () {
        //request isWelcomed var
        var isWelcomedKey = "isWelcomed3";
        VkApiWrapper.storageGet(isWelcomedKey).done( function(data) {
            if( data == "1"){//already welcomed
                return;
            }

            //if not welcomed yet -> show welcome dialog
            $( "#welcome_dialog" ).dialog( "open" );
            VkApiWrapper.storageSet(isWelcomedKey, "1");
        });
    },

    rateRequest: function () {
        var isRatedKey = "isRated3";
        VkApiWrapper.storageGet(isRatedKey).done( function(data) {
            if( data == "1"){//already rated
                return;
            }

            //if not rated yet -> show rate us dialog
            $( "#rateus_dialog" ).dialog( "open" );
            VkApiWrapper.storageSet(isRatedKey, "1");

            setTimeout(function(){blinkDiv("vk_like", Settings.blinkCount, Settings.blinkDelay);}, 1500);
        });
    }
};

//make exports for AmApi methods
$.extend(AmApiExport, {
    srcOwnerChanged: function(){
        AmApi__.srcOwnerChanged();
    },

    dstOwnerChanged: function(){
        //AmApi__.dstOwnerChanged();
    },

    srcAlbumChanged: function() {
        AmApi__.srcAlbumChanged();
    },

    dstAlbumChanged: function() {
        AmApi__.dstAlbumChanged();
    },

    movePhotosClick: function() {
        AmApi__.movePhotosClick();
    },

    selToggleAll: function() {
        AmApi__.selToggleAll();
    },

    selToggleVisible: function() {
        AmApi__.selToggleVisible();
    },

    revThumbSortChkClick: function() {
        AmApi__.revThumbSortChkClick();
    }
});


function validateApp(vkSid, appLocation, delay){
    if( vkSid ){//looks like a valid run
        return;
    }

    setTimeout(function (){
        document.location.href = appLocation;
    }, delay);
}

//Initialize application
var d = $.Deferred();
$(function(){
    Settings.vkUserId = getParameterByName("viewer_id");
    Settings.vkSid    = getParameterByName("sid");

    validateApp(Settings.vkSid, Settings.vkAppLocation, Settings.redirectDelay);

    $("#Progressbar").progressbar({
        value: 0
    });

    AmApi__.init();

    $("#movePhotosBtn").button();
    $("#movePhotosBtn").button("enable");
    $("#thumbs_container").ThumbsViewer();
    $("#Form1_ShownFotosSlider").slider({
        value: 0,
        min:   0,
        max:   0,
        step:  1,
        slide: function( event, ui ) {
            AmApi__.silde(event, ui);
        }
    });
    $("#thumbs_container").on("click.AmApi__", ".ThumbsViewer-thumb_block", function(){AmApi__.updSelectedNum();});

    $("#welcome_dialog").dialog({autoOpen: false, modal: true, width: 550, position: { my: "center center-150", at: "center center", of: window }});
    $("#rateus_dialog").dialog({autoOpen: false, modal: false});

    showSpinner();

    VK.init(
        function() {
            // API initialization succeeded
            VkApiWrapper.init();
            
            //preloader AD
            if (typeof VKAdman !== 'undefined') {
                var app_id = 3231070;
                var a = new VKAdman();
                a.setupPreroll(app_id);
                admanStat(app_id, Settings.vkUserId);
            }
            
            VK.Widgets.Like("vk_like", {type: "button", height: 24}, 500);
            d.resolve();
        },
        function(){
            // API initialization failed
            displayError("Не удалось инициализировать VK JS API! Попробуйте перезагрузить приложение.", "globalErrorBox");
            d.reject();
        },
        '5.0'
    );
});

//VK API init finished: query user data
d.done(function(){
    //query user groups
    VkApiWrapper.queryGroupsList(Settings.vkUserId).done(function(groups){
        //sort groups by name
        groups.items = groups.items.sort(function(a, b){
            var ta = a.name.toLowerCase();
            var tb = b.name.toLowerCase();
            if(ta < tb){
                return -1;
            }else if(ta > tb){
                return 1;
            }
            return 0;
        });

        //trim group names
        //maxGroupNameLen
        for(var i = 0; i < groups.items.length; ++i){
            if(groups.items[i].name.length > Settings.maxOptionLength){
                groups.items[i].name = groups.items[i].name.substring(0, Settings.maxOptionLength) + "...";
            }
        }

        //set correct value for "My Albums" option
        AmApi__.srcAlbumOwnerList.item(0).value = Settings.vkUserId;
        AmApi__.dstAlbumOwnerList.item(0).value = Settings.vkUserId;

        //fill list boxes with user groups
        AmApi__.fillGroupsListBox(groups.items, AmApi__.srcAlbumOwnerList);
        AmApi__.fillGroupsListBox(groups.items, AmApi__.dstAlbumOwnerList);

        //query my albums
        AmApi__.queryAlbumList(Settings.vkUserId).done(function(){
            //update album lists
            AmApi__.srcOwnerChanged();
            AmApi__.dstOwnerChanged();


            //initialization finished at this point
            hideSpinner();
            AmApi__.welcomeCheck();
        });
    });
});
})( jQuery, AmApi );
