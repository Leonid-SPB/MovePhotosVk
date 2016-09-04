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

 echo Generating production folder &> log.txt
 
 #clean
 rm -Rf ../prod/* >> log.txt 2>&1
 
 #resources
 cp -R ../source/graphics  ../prod/graphics >> log.txt 2>&1
 cp -R ../source/images    ../prod/images >> log.txt 2>&1
 cp -R ../source/src/*.css ../prod/ >> log.txt 2>&1
 cp -R ../source/src/*.png ../prod/ >> log.txt 2>&1
 cp -R ../source/src/*.jpg ../prod/ >> log.txt 2>&1
 cp -R ../source/src/photoRating_prod.html ../prod/photoRating.html >> log.txt 2>&1
 
 uglifyjs $FileList --compress --mangle --verbose --output ../prod/photoRating_min.js >> log.txt 2>&1
 