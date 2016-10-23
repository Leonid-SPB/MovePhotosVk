#!/bin/sh
FileList="\
 ../source/src/highslide-full.packed.js\
 ../source/src/load-image.js\
 ../source/src/canvas-to-blob.js\
 ../source/src/highslide.config.js\
 ../source/src/spin.js\
 ../source/src/utils.js\
 ../source/src/thumbsContainer.js\
 ../source/src/vkApiWrapper.js\
 ../source/src/vkAppUtils.js\
 ../source/src/albumManager.js"

echo Generating production folder
echo &> log.txt

#clean
rm -Rf ../prod/* >> log.txt 2>&1

#resources
cp -R ../source/graphics  ../prod/graphics >> log.txt 2>&1
cp -R ../source/images    ../prod/images >> log.txt 2>&1
cp -R ../source/src/*.css ../prod/ >> log.txt 2>&1
cp -R ../source/src/*.png ../prod/ >> log.txt 2>&1
cp -R ../source/src/*.jpg ../prod/ >> log.txt 2>&1
cp -R ../source/src/*.html ../prod/ >> log.txt 2>&1
cp -R ../source/src/HackTimer*.js ../prod/ >> log.txt 2>&1

#replace links separate scripts to a single minified script
JSFILES="<!--JSFILES-->(.*)<!--EOF-JSFILES-->"
MINJSFILE='<script src=\"albumManager_min.js\" type=\"text/javascript\" charset=\"utf-8\"></script>'
awk -i inplace -v RS='' "{gsub(/$JSFILES/,\"$MINJSFILE\")}; { print }" ../prod/albumManager3.html >> log.txt 2>&1

#produce minified script
uglifyjs $FileList --compress --mangle --verbose --output ../prod/albumManager_min.js >> log.txt 2>&1

echo Done!
