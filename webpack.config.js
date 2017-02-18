const webpack = require('webpack'),
  isDevServer = process.argv.find(v => v.includes('webpack-dev-server'))

module.exports = {
  devtool: isDevServer && 'source-map',
  devServer: { inline: false },
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
  externals: {
    yamljs: 'YAML'
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
  plugins: isDevServer ? [
    new webpack.LoaderOptionsPlugin({ debug: true })
  ] : [
    new webpack.optimize.UglifyJsPlugin()
  ]
}
