import {
  Mesh,
  Vector3,
} from './babylon'

import {
  createScene,
  loadAssets,
  SavedMap,
} from './game'

import {
  ObjectBase,
  ObjectPlayListener,
} from './objs'

import {
  LoadingScreen,
  MenuManager,
  KeyEmitter,
} from './utils/dom'

import {
  queue,
} from './utils'

import Chunks from './game/chunks'
import SkyBox from './game/skybox'
import StageLoader from './objs/stage-loader'

const KEY_MAP = {
  escape: 'ESCAPE',
  return: 'RETURN',
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  navigate: 'UP | DOWN | LEFT | RIGHT',
}

; (async function() {
  const { scene, canvas2d, ctrl, clock } = createScene(),
    assets = await loadAssets(scene, (index, total, progress) =>
      LoadingScreen.update(`Loading Assets ${index + 1}/${total} (${~~(progress * 100)}%)`)),
    keyInput = new KeyEmitter(KEY_MAP),
    source = new Mesh('cache/object/source', scene)

  new SkyBox('sky', scene)

  keyInput.ondown('escape', () => {
    if (!ctrl.isPaused()) {
      document.body.classList.add('game-paused')
      MenuManager.activate('.pause-menu')
      ctrl.pause()
    }
    else {
      document.body.classList.remove('game-paused')
      ctrl.resume()
    }
  })

  keyInput.ondown('return', () => {
    const activeItem = MenuManager.activeItem(),
      action = activeItem && activeItem.getAttribute('action')
    if (action === 'game-continue') {
      if (ctrl.isPaused()) {
        document.body.classList.remove('game-paused')
        ctrl.resume()
      }
    }
    else if (action === '') {
      // TODO
    }
  })

  keyInput.ondown('navigate', () => {
    MenuManager.selectNext(keyInput.state.up || keyInput.state.left ? -1 : 1)
  })

  class Stage {
    static insts = [ ] as Stage[]

    static addToLoading = queue()
    static async execLoading(url: string, position: Vector3) {
      if (this.insts.find(stage => stage.url === url && stage.position.equals(position))) {
        return console.warn(`stage ${url} has been loaded`)
      }
      try {
        const map = await fetch(url).then(res => res.json()) as any as SavedMap
        this.insts.push(new Stage(url, position, map))
        this.insts.length > 2 && this.insts.shift().dispose()
      }
      catch (err) {
        console.error(err)
      }
    }
    static async load(url: string, position: Vector3) {
      return await this.addToLoading(() => this.execLoading(url, position))
    }

    constructor(
        readonly url: string,
        readonly position: Vector3,
        readonly map: SavedMap,
        readonly name = url.split('.').slice(-2).shift(),
        readonly chunks = new Chunks(name, scene, assets.tiles, map.chunksData, position),
        readonly objects = [ ] as (ObjectBase & ObjectPlayListener)[]) {
      Object.keys(map.objectsData).forEach(id => {
        const objData = map.objectsData[id],
          clsFound = assets.classes.find(c => c.clsId === objData.clsId)
        if (clsFound) {
          const { icon, cls } = clsFound,
            { x, y, z } = objData,
            args = Object.assign({ }, clsFound.args, objData.args),
            object = new cls(id, { icon, source, canvas2d, clock })
          object.position.copyFromFloats(x, y, z).addInPlace(this.position)
          Object.assign(object, args)
          this.objects.push(object as any)
        }
        else {
          console.warn(`class ${objData.clsId} is not found! ignoring object #${id}`)
        }
      })
      this.objects.forEach((object: ObjectPlayListener) => object.startPlaying && object.startPlaying() as any)
    }
    dispose() {
      this.objects.forEach((object: ObjectPlayListener) => object.stopPlaying && object.stopPlaying())
      this.objects.forEach(object => object.dispose())
      this.chunks.dispose()
    }
  }

  StageLoader.eventEmitter.on('trigger', loader => {
    const { x, y, z } = loader.position,
      position = new Vector3(Math.floor(x), Math.floor(y + loader.offsetY), Math.floor(z))
    Stage.load(loader.stageURL, position)
  })

  await Stage.load('assets/stage/startup.json', Vector3.Zero())

  await new Promise(resolve => setTimeout(resolve, 800))
  LoadingScreen.hide()
})()
