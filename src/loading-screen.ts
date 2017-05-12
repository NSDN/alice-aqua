import {
  LoadingScreen,
  appendScript,
} from './utils/dom'

import {
  queryStringGet,
} from './utils'

async function loadScripts(entry: string) {
  try {
    await appendScript('babylonjs/cannon.js')

    if (location.host === 'localhost:8080') {
      await appendScript(`//${location.host}/webpack-dev-server.js`)
      await appendScript('babylonjs/babylon.max.js')
      await appendScript('babylonjs/canvas2D/babylon.canvas2d.js')
    }
    else {
      await appendScript('babylonjs/babylon.js')
      await appendScript('babylonjs/canvas2D/babylon.canvas2d.min.js')
    }

    await appendScript(entry)
  }
  catch (err) {
    LoadingScreen.error(`ERR: load script "${err.target.src}" failed`)
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
