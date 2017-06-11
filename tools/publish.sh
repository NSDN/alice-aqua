TMP_DIR=.pub &&\
mkdir -p $TMP_DIR &&\
webpack > $TMP_DIR/webpack.txt &&\

BUILD_HASH=`cat $TMP_DIR/webpack.txt | grep Hash: | awk '{ print $2 }'` &&\
DST_DIR=qcs.ofr.me:~/www/alice-aqua-$BUILD_HASH &&\
SRC_DIRS=(
  "babylonjs/babylon.js"
  "babylonjs/cannon.js"
  "babylonjs/**/*.min.js"
  "node_modules/font-awesome/css/*.css"
  "node_modules/font-awesome/fonts/*.*"
) &&\

git add -A && \
git commit -m "publish $BUILD_HASH" &&\

cp package.json $TMP_DIR/ &&\
cp *.html $TMP_DIR/ &&\
cp -r assets $TMP_DIR/ &&\
cp -r build $TMP_DIR/ &&\
for src in "${SRC_DIRS[@]}"
do
  for file in $src
  do
    dst=$TMP_DIR/`dirname $file`
    mkdir -p $dst && cp -r $file $dst
  done
done &&\

rsync -avr $TMP_DIR/. $DST_DIR &&\

rm -rf $TMP_DIR/babylonjs &&\
rm -rf $TMP_DIR &&\
echo "uploaded to $DST_DIR"
