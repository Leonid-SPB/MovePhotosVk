/** Copyright (c) 2012-2016 Leonid Azarenkov
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

    
    };


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
                var app_id = 3231070; //release: 3231070, beta: 3294304
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
