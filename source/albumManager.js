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
    vkAppLocation   : "http://vk.com/app3231070",
    redirectDelay   : 3000
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
            zoom_icon.data('ThumbsViewer', {img_src: img.photo_604});
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
            return hs.expand( $("<a></a>", {href: data.img_src}).get(0) );
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

        if (data.spinner) {
            data.spinner.stop();
            delete data.spinner;
        }
        if (opts !== false) {
            data.spinner = new Spinner($.extend({color: $this.css('color')}, opts)).spin(this);
        }
    });
    return this;
};

$.fn.addme = function(name) {
    this.each(function() {
        var $this = $(this);
        var htmlstr = "<div style=\"text-align: center;\"><a href=\"http://vk.com/l.azarenkov\" target=\"addme\"><div class=\"clear_fix\" style=\"display: inline-block; height: 30px;\"><img width=\"30px\" height=\"30px\" class=\"adbox-logo\" src=\"http://cs319724.userapi.com/v319724876/53cf/H1pNnL_LDrw.jpg\" />";
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

function fillAlbumsListBox(albums, listBoxId){
    var albumsListSelect = document.getElementById(listBoxId);
    for(var i = 0; i < albums.length; i++){
        var title = $("<div>").html(albums[i].title).text();//to convert escape sequences (&amp;, &quot;...) to chars
        var opt = new Option(title, albums[i].id, false, false);
        albumsListSelect.add(opt, null);
    }
}

function validateApp(vkSid, appLocation, delay){
    if( vkSid ){//looks like a valid run
        return;
    }

    setTimeout(function (){
        document.location.href = appLocation;
    }, delay);
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
                if(data.response){
                    d.resolve(data.response);
                }else{
                    console.log(data.error.error_msg);
                    d.reject();
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

    queryPhotosList: function(ownerId, albumId) {
        var self = this;
        var p = this.callVkApi("photos.get", {owner_id: ownerId, album_id: albumId});
        p.fail(function(){
            self.displayError("Не удалось получить список фотографий из выбранного альбома! Попробуйте перезагрузить приложение.");
        });
        return p;
    },

    queryGroupsList: function(userId){
        var self = this;
        var p = this.callVkApi("groups.get", {user_id: userId});
        p.fail(function(){
            self.displayError("Не удалось получить список групп пользователя! Попробуйте перезагрузить приложение.");
        });
        return p;
    },

    movePhotos: function(ownerId, targetAlbumId, photoId){
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

    init: function(){
        this.srcPhotosNumEdit = document.getElementById("Form1_SrcPhotosNum");
        this.srcAlbumList     = document.getElementById("Form1_SrcAlbumList");
        this.dstPhotosNumEdit = document.getElementById("Form1_DstPhotosNum");
        this.dstAlbumList     = document.getElementById("Form1_DstAlbumList");
        this.revThumbSortChk  = document.getElementById("Form1_RevThumbSort");
    },

    srcAlbumChanged: function() {
        var self = this;
        var selIndex = self.srcAlbumList.selectedIndex;

        $("#thumbs_container").ThumbsViewer("empty");

        if(!selIndex){//not selected
            self.srcPhotosNumEdit.value = "";
            return;
        }
        showSpinner();

        VkApiWrapper.queryPhotosList(Settings.vkUserId, self.srcAlbumList.item(selIndex).value).done(
            function(photosList){
                self.srcPhotosNumEdit.value = photosList.items.length;

                self.revThumbSortChk.disabled = true;
                $("#thumbs_container").ThumbsViewer("addThumbList", photosList.items, self.revThumbSortChk.checked).done(
                    function(){self.revThumbSortChk.disabled = false;}
                );

                self.updSelectedNum();
                hideSpinner();
            }
        );
    },

    dstAlbumChanged: function() {
        var self = this;
        var selIndex = self.dstAlbumList.selectedIndex;

        if(selIndex == 1){//save album
            $("#movePhotosBtn").button("option","label", "Сохранить");
            self.dstPhotosNumEdit.value = "";
            return;
        }
        $("#movePhotosBtn").button("option","label","Переместить");
        if(selIndex == 0){//not selected
            self.dstPhotosNumEdit.value = "";
            return;
        }

        showSpinner();

        VkApiWrapper.queryPhotosList(Settings.vkUserId, self.dstAlbumList.item(selIndex).value).done(
            function(photosList){
                self.dstPhotosNumEdit.value = photosList.items.length;
                hideSpinner();
            }
        );
    },

    disableControls: function(disable){
        var self = this;

        var dval = 0;
        var dstr = "enable";
        if(disable){
            dval = 1;
            dstr = "disable";
        }

        $("#thumbs_container").ThumbsViewer("selectionDisable", dval);
        $("#movePhotosBtn").button(dstr);
        self.srcAlbumList.disabled = dval;
        self.dstAlbumList.disabled = dval;
        self.revThumbSortChk.disabled = dval;
    },

    movePhotosSingle: function(aid_target, selThumbsAr){
        /*var self = this;

        if(!selThumbsAr.length){
            //MOVE DONE
            $("#Progressbar").progressbar("value", 100);
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

        VkApiWrapper.movePhotos(Settings.vkUserId, aid_target, currThumbData.img.pid);
        VK.api("photos.move",{"pid":currThumbData.img.pid,"target_aid":aid_target},function(data) {
            if(data.response){
                ++self.dstPhotosNumEdit.value;
                --self.srcPhotosNumEdit.value;
                $("#thumbs_container").ThumbsViewer("removeThumb", currThumbData.$thumb);
                self.updSelectedNum();

                self.progressPerc = self.progressPerc + self.progressStep;
                $("#Progressbar").progressbar("value", self.progressPerc);
                setTimeout(function(){
                    self.movePhotosSingle(aid_target, selThumbsAr);
                }, Settings.movePhotosDelay);
            }else{
                displayError("Не удалось переместить фотографию! Попробуйте перезагрузить приложение.", "globalErrorBox");
                console.log(data.error.error_msg);
            }
        });  */
    },

    revThumbSortChkClick: function(){
        var self = this;
        $("#thumbs_container").ThumbsViewer("sort", self.revThumbSortChk.checked);
    },

    savePhotos: function(divPhotos, selThumbsAr, num){
        /*var self = this;

        if(!selThumbsAr.length){
            return;
        }

        var currThumbData = selThumbsAr.shift();
        var src;

        if(currThumbData.img.src_xxbig){
            src = currThumbData.img.src_xxbig;
        }else if(currThumbData.img.src_xbig){
            src = currThumbData.img.src_xbig;
        }else if(currThumbData.img.src_big){
            src = currThumbData.img.src_big;
        }else if(currThumbData.img.src){
            src = currThumbData.img.src;
        }

        function lzn(num){
            return (num < 10)? "0" + num: "" + num;
        }

        var cD = new Date(currThumbData.img.created*1000);
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
        setTimeout(function(){self.savePhotos(divPhotos, selThumbsAr, num+1)}, Settings.savePhotosDelay); */
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

        var selThumbsAr = $("#thumbs_container").ThumbsViewer("getSelThumbsData");
        if(!selThumbsAr.length){//no images selected
            displayWarn("Не выбраны фотографии для перемещения/сохранения", "NoteField", Settings.errorHideAfter);
            return;
        }

        //save on disk
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

    updSelectedNum: function(){
        $("#selectedPhotosNum").text($("#thumbs_container").ThumbsViewer("getSelThumbsNum")+"");
    },


    selToggleAll: function() {
        var self = this;
        $("#thumbs_container").ThumbsViewer("selectToggleAll");
        self.updSelectedNum();
    },

    selToggleVisible: function() {
        var self = this;
        $("#thumbs_container").ThumbsViewer("selectToggleVisible");
        self.updSelectedNum();
    },

    welcomeCheck: function () {
        //request isWelcomed var
        /*VK.api("storage.get", {key: "isWelcomed"}, function(data) {
            if(data.response !== undefined){
                if( data.response == "1"){//already welcomed
                    return;
                }

                //if not welcomed yet -> show welcome dialog
                $( "#welcome_dialog" ).dialog( "open" );
                VK.api("storage.set", {key: "isWelcomed", value: "1"});
            }else{
                console.log(data.error.error_msg);
            }
        }); */
    },

    rateRequest: function () {
        /*VK.api("storage.get", {key: "isRated"}, function(data) {
            if(data.response !== undefined){
                if( data.response == "1"){//already rated
                    return;
                }

                //if not rated yet -> show rate us dialog
                $( "#rateus_dialog" ).dialog( "open" );
                VK.api("storage.set", {key: "isRated", value: "1"});

                setTimeout(function(){blinkDiv("vk_like", Settings.blinkCount, Settings.blinkDelay);}, 1500);
            }else{
                console.log(data.error.error_msg);
            }
        });    */
    }
};

//make exports for AmApi methods
$.extend(AmApiExport, {
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
    $("#thumbs_container").on("click.AmApi__", ".ThumbsViewer-thumb_block", function(){AmApi__.updSelectedNum();});

    $("#welcome_dialog").dialog({autoOpen: false, modal: true, width: 550, position: { my: "center center-150", at: "center center", of: window }});
    $("#rateus_dialog").dialog({autoOpen: false, modal: false});

    showSpinner();

    VK.init(
        function() {
            // API initialization succeeded
            VkApiWrapper.init();
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
    VK.Widgets.Like("vk_like", {type: "button", height: 24}, 500);

    VkApiWrapper.queryAlbumsList(Settings.vkUserId).done(function(albums){
        //sort albums by name
        albums.items = albums.items.sort(function(a, b){
            if(a.title < b.title){
                return -1;
            }else if(a.title > b.title){
                return 1;
            }
            return 0;
        });

        fillAlbumsListBox(albums.items,"Form1_SrcAlbumList");
        fillAlbumsListBox(albums.items,"Form1_DstAlbumList");
        hideSpinner();
        //AmApi__.welcomeCheck();
    });
});
})( jQuery, AmApi );