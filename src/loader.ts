import {
  LoadingScreen,
  appendScript,
} from './utils/dom'

async function bootstrap(entry: string) {
  await LoadingScreen.init()
  try {
    LoadingScreen.update(`Loading page`)
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

    LoadingScreen.update(`Starting ${entry}`)
    await appendScript(entry)
  }
  catch (err) {
    LoadingScreen.error(`load script "${err.target.src}" failed`)
  }
}

const script = document.querySelector('script[bootstrap-src]')
if (script) {
  bootstrap(script.getAttribute('bootstrap-src'))
}
