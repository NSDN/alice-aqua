const webpack = require("webpack"),
  isProd = process.env.NODE_ENV === 'production'

module.exports = {
  debug: true,
  entry: isProd ? ['babel-polyfill', './src/index.ts'] : ['./src/index.ts'],
  devtool: 'source-map',
  output: {
    filename: 'build/bundle.js'
  },
  resolve: {
    extensions: ['', '.js', '.ts']
  },
  module: {
    loaders: [
      {
        test: /\.ts$/,
        loaders: isProd ? ['babel-loader', 'ts-loader'] : ['ts-loader'],
      }
    ]
  },
  plugins: isProd ? [new webpack.optimize.UglifyJsPlugin()] : [ ]
}