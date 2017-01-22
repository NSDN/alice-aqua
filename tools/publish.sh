BUILD_HASH=`webpack | grep Hash: | awk '{ print $2 }'`
DST_DIR=qcs.ofr.me:~/www/alice-aqua-editor-$BUILD_HASH
TMP_DIR=.depoly-temp
SRC_DIRS=(
  "node_modules/babylonjs/dist/*.js"
  "node_modules/font-awesome/css/*.css"
  "node_modules/font-awesome/fonts/*.*"
)

mkdir -p $TMP_DIR &&\
sed -i -e "s/{{BUILD_HASH}}/$BUILD_HASH/" editor.html &&\
cp *.html $TMP_DIR/ &&\
cp -r assets $TMP_DIR/ &&\
cp -r build $TMP_DIR/ &&\
for src in "${SRC_DIRS[@]}"
do
  dst=$TMP_DIR/`dirname $src | head -1`
  mkdir -p $dst && cp -r $src $dst
done &&\
rsync -avr $TMP_DIR/. $DST_DIR &&\
rm -rf $TMP_DIR &&\
echo "uploaded to $DST_DIR"
