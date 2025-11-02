#!/bin/sh

THIS_DIR=`realpath $(dirname $0)`
ROOT_DIR=`realpath $THIS_DIR/..`
BUILD_DIR="$ROOT_DIR/build"
BUILD_LOG="$THIS_DIR/build.log"

JS_FILE_LIST="\
 $ROOT_DIR/source/js/highslide-full.packed.js\
 $ROOT_DIR/source/js/highslide.config.js\
 $ROOT_DIR/source/js/simi.js\
 $ROOT_DIR/source/js/spin.js\
 $ROOT_DIR/source/js/load-image.js\
 $ROOT_DIR/source/js/utils.js\
 $ROOT_DIR/source/js/js.cookie.js\
 $ROOT_DIR/source/js/thumbsContainer.js\
 $ROOT_DIR/source/js/vkApiWrapper.js\
 $ROOT_DIR/source/js/vkAppUtils.js\
 $ROOT_DIR/source/js/albumManager.js"


cd $ROOT_DIR
echo Building application at @$BUILD_DIR/
mkdir -p $BUILD_DIR

# clean build folder includiing hidden files
rm -Rf $BUILD_DIR/*

# copy resources to build folder, skip files starting with dot
echo "Copying source files to $BUILD_DIR/ ..."
cd $ROOT_DIR/source && find . -type f -not -name ".*" -exec cp --parents {} $BUILD_DIR/ \;
if [ $? -ne 0 ]; then
	echo "Error, see $BUILD_LOG for details"
	exit 1
fi

# in build folder remove jsfiles that will be combined and minified
echo "Removing separate JS files from $BUILD_DIR/js/ ..."
for jsfile in $JS_FILE_LIST; do
	jsfilename=`basename $jsfile`
	rm -f $BUILD_DIR/js/$jsfilename
	if [ $? -ne 0 ]; then
		echo "Error, see $BUILD_LOG for details"
		exit 1
	fi
done


# replace separate scripts with a single combined minified script
JSFILES="<!--JSFILES-->(.*)<!--EOF-JSFILES-->"
MINJSFILE='<script src=\"js/albumManager_min.js\" type=\"text/javascript\" charset=\"utf-8\"></script>'
gawk -i inplace -v RS='' "{gsub(/$JSFILES/,\"$MINJSFILE\")}; { print }" $BUILD_DIR/albumManager3.html
if [ $? -ne 0 ]; then
	echo "Error, see $BUILD_LOG for details"
	exit 1
fi

# produce minified script
echo "Minifying JS files into $BUILD_DIR/js/albumManager_min.js..."
uglifyjs $JS_FILE_LIST --compress --mangle --output $BUILD_DIR/js/albumManager_min.js
if [ $? -ne 0 ]; then
	echo "Error, see $BUILD_LOG for details"
	exit 1
fi

echo Build Done!
exit 0
