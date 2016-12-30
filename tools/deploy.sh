DEP_DIR=qcs.ofr.me:~/www/alice-aqua
TMP_DIR=.depoly-temp

mkdir -p $TMP_DIR/node_modules &&\
cp index.html $TMP_DIR/ &&\
cp -r assets $TMP_DIR/ &&\
cp -r build $TMP_DIR/ &&\
cp -r node_modules/cannon       $TMP_DIR/node_modules/ &&\
cp -r node_modules/babylonjs    $TMP_DIR/node_modules/ &&\
cp -r node_modules/font-awesome $TMP_DIR/node_modules/ &&\
rsync -avr $TMP_DIR/. $DEP_DIR &&\
rm -rf $TMP_DIR &&\
echo "uploaded to $DEP_DIR"
