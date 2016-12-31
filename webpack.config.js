const webpack = require("webpack"),
  isDevServer = process.argv.find(v => v.includes('webpack-dev-server'))

module.exports = {
  debug: true,
  entry: isDevServer ? ['./src'] : ['babel-polyfill', './src'],
  devtool: isDevServer && 'source-map',
  output: {
    filename: 'build/bundle.js'
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
