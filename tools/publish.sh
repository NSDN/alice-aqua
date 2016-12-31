VER_HASH=`cat build/bundle.js | md5sum | awk '{ print $1 }'`
DST_DIR=qcs.ofr.me:~/www/alice-aqua-editor-$VER_HASH
TMP_DIR=.depoly-temp
SRC_DIRS=(
  "node_modules/babylonjs/dist/*.js"
  "node_modules/font-awesome/css/*.css"
)

mkdir -p $TMP_DIR &&\
cp index.html $TMP_DIR/ &&\
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
