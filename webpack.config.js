const webpack = require("webpack"),
  isDevServer = process.argv.find(v => v.includes('webpack-dev-server'))

module.exports = {
  debug: true,
  devtool: isDevServer && 'source-map',
  entry: isDevServer ? {
    game: './src/game-main',
    editor: './src/editor-main',
    screen: './src/loading-screen'
  } : {
    game: ['babel-polyfill', './src/game-main'],
    editor: ['babel-polyfill', './src/editor-main'],
    screen: './src/loading-screen'
  },
  output: {
    filename: 'build/[name].bundle.js'
  },
  resolve: {
    extensions: ['', '.js', '.ts']
  },
  module: {
    preLoaders: [
      {
        test: /\.ts$/,
        loader: 'tslint-loader'
      }
    ],
    loaders: [
      {
        test: /\.ts$/,
        loaders: isDevServer ? ['ts-loader'] : ['babel-loader', 'ts-loader'],
      }
    ],
  },
  plugins: isDevServer ? [ ] : [new webpack.optimize.UglifyJsPlugin()]
}
