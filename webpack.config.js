const webpack = require('webpack'),
  isDevServer = process.argv.find(v => v.includes('webpack-dev-server'))

module.exports = {
  devtool: isDevServer && 'source-map',
  devServer: { inline: false },
  entry: {
    loader: isDevServer ? './src/loader' : ['babel-polyfill', './src/loader'],
    game: './src/game-main',
    editor: './src/editor-main',
  },
  output: {
    filename: 'build/[name].bundle.js'
  },
  resolve: {
    extensions: ['.js', '.ts', '.tsx']
  },
  module: {
    rules: [
      {
        test: /\.ts(x?)$/,
        enforce: 'pre',
        loader: 'tslint-loader'
      },
      {
        test: /\.ts(x?)$/,
        use: isDevServer ? ['ts-loader'] : ['babel-loader', 'ts-loader'],
      }
    ],
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({ name: 'common' })
  ].concat(isDevServer ? [
    new webpack.LoaderOptionsPlugin({ debug: true })
  ] : [
    new webpack.optimize.UglifyJsPlugin()
  ])
}
