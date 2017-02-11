BUILD_HASH=`webpack | grep Hash: | awk '{ print $2 }'`
DST_DIR=qcs.ofr.me:~/www/alice-aqua-$BUILD_HASH
TMP_DIR=.depoly-temp
SRC_DIRS=(
  "babylonjs/*.js"
  "babylonjs/**/*.js"
  "node_modules/font-awesome/css/*.css"
  "node_modules/font-awesome/fonts/*.*"
)

mkdir -p $TMP_DIR &&\
sed -i -r \
  -e "s/\\{\\{BUILD_HASH\\}\\}/$BUILD_HASH/" \
  -e "s/<([^>]+)(class=\"build-hash\"[^>]*)>[^<]*</<\1\2>$BUILD_HASH</" \
  *.html &&\
cp package.json $TMP_DIR/ &&\
cp *.html $TMP_DIR/ &&\
cp -r assets $TMP_DIR/ &&\
cp -r build $TMP_DIR/ &&\
for src in "${SRC_DIRS[@]}"
do
  for file in $src
  do
    dst=$TMP_DIR/`dirname $file`
    mkdir -p $dst && cp -r $src $dst
  done
done &&\
rsync -avr $TMP_DIR/. $DST_DIR &&\
rm -rf $TMP_DIR &&\
echo "uploaded to $DST_DIR"
