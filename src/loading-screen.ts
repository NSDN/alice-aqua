import {
  LoadingScreen,
  appendElement,
} from './utils/dom'

const loadScript = (src: string) => new Promise((onload, onerror) => appendElement('script', { src, onload, onerror }))
; (window as any)['startWithEntry'] = async function (entry: string) {
  LoadingScreen.show()
  LoadingScreen.update('Loading Page')

  try {
    if (location.host === 'localhost:8080') {
      await loadScript(`//${location.host}/webpack-dev-server.js`)
    }

    await loadScript('babylonjs/cannon.js')
    await loadScript('babylonjs/babylon.max.js')
    await loadScript('babylonjs/canvas2D/babylon.canvas2d.js')

    await loadScript(entry)
  }
  catch (err) {
    LoadingScreen.update(`ERR: load script "${err.target.src}" failed`)
  }
}
