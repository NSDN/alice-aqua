DEP_DIR=qcs.ofr.me:~/www/alice-aqua-editor
TMP_DIR=.depoly-temp

webpack &&\
mkdir -p $TMP_DIR/node_modules/babylonjs/dist &&\
cp index.html $TMP_DIR/ &&\
cp -r assets $TMP_DIR/ &&\
cp -r build $TMP_DIR/ &&\
cp -r node_modules/babylonjs/dist/*.js $TMP_DIR/node_modules/babylonjs/dist/ &&\
cp -r node_modules/font-awesome $TMP_DIR/node_modules/ &&\
rsync -avr $TMP_DIR/. $DEP_DIR &&\
rm -rf $TMP_DIR &&\
echo "uploaded to $DEP_DIR"
