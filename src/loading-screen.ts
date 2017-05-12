import {
  LoadingScreen,
  appendScript,
} from './utils/dom'

import {
  queryStringGet,
} from './utils'

async function loadScripts(entry: string) {
  try {
    if (location.host === 'localhost:8080') {
      await appendScript(`//${location.host}/webpack-dev-server.js`)
    }

    await appendScript('babylonjs/cannon.js')
    await appendScript('babylonjs/babylon.max.js')
    await appendScript('babylonjs/canvas2D/babylon.canvas2d.js')

    await appendScript(entry)
  }
  catch (err) {
    LoadingScreen.update(`ERR: load script "${err.target.src}" failed`)
  }
}

LoadingScreen.show()

for (const script of document.querySelectorAll('script[src]')) {
  const src = script.getAttribute('src') || '',
    entry = queryStringGet(src.replace(/.*\?/, ''), 'bootstrap-entry')
  if (entry) {
    LoadingScreen.update(`Starting ${entry}`)
    loadScripts(entry)
    break
  }
}
