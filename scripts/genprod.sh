#!/bin/sh
FileList="\
 ../source/src/highslide-full.packed.js\
 ../source/src/highslide.config.js\
 ../source/src/spin.js\
 ../source/src/utils.js\
 ../source/src/thumbsContainer.js\
 ../source/src/vkApiWrapper.js\
 ../source/src/vkAppUtils.js\
 ../source/src/photoRating.js"
echo $FileList
uglifyjs $FileList --compress --mangle --verbose --output ../prod/photoRating_min.js &> log.txt
