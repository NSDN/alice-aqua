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
  ObjectOptions,
  ObjectPlayListener,
} from './objs'

import {
  appendElement,
  LoadingScreen,
  MenuManager,
  KeyEmitter,
} from './utils/dom'

import {
  queue,
  holdon,
} from './utils'

import Chunks, { TileDefine } from './game/chunks'
import SkyBox from './game/skybox'
import { StageLoader } from './objs/stage'

const KEY_MAP = {
  escape: 'ESCAPE',
  return: 'RETURN',
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  navigate: 'UP | DOWN | LEFT | RIGHT'
}

interface StageOptions {
  scene: BABYLON.Scene
  tiles: TileDefine[]
  classes: {
    clsId: number
    cls: typeof ObjectBase
    opts: ObjectOptions
    args: any
  }[]
}

class Stage {
  readonly chunks: Chunks
  readonly objects: (ObjectBase & ObjectPlayListener)[]
  constructor(
      readonly url: string,
      readonly position: Vector3,
      map: SavedMap, opts: StageOptions) {
    const entryPosition = this.position.clone(),
      entryId = Object.keys(map.objectsData).find(id => map.objectsData[id].args.editorSingletonId === 'stage/entry')
    if (entryId) {
      const { x, y, z, args } = map.objectsData[entryId]
      entryPosition.subtractInPlace(new Vector3(Math.floor(x), Math.floor(y + (args.offsetY || 0)), Math.floor(z)))
    }

    const name = url.split('.').slice(-2).shift()
    this.chunks = new Chunks(name, opts.scene, opts.tiles, map.chunksData, entryPosition)
    this.objects = [ ]

    Object.keys(map.objectsData).forEach(id => {
      const objData = map.objectsData[id],
        clsFound = opts.classes.find(c => c.clsId === objData.clsId)
      if (clsFound) {
        const { opts, cls } = clsFound,
          { x, y, z } = objData,
          args = Object.assign({ }, clsFound.args, objData.args),
          object = new cls(id, opts)
        object.position.copyFromFloats(x, y, z).addInPlace(entryPosition)
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

class StageManager {
  // TODO: save it somewhere
  private static _oldestURL = localStorage.getItem('stage-oldest-url') || ''
  static get oldestURL() {
    return this._oldestURL
  }
  static set oldestURL(val) {
    localStorage.setItem('stage-oldest-url', val)
    this._oldestURL = val
  }

  private stages = [ ] as Stage[]
  private isDisposed = false

  private addToQueue = queue()
  private async doLoad(url: string, position: Vector3) {
    if (!this.stages.find(stage => stage.url === url && stage.position.equals(position))) {
      const map = await fetch(url).then(res => res.json()) as any as SavedMap
      if (!this.isDisposed) {
        this.stages.push(new Stage(url, position, map, this.opts))
        this.stages.length > 2 && this.stages.shift().dispose()
        StageManager.oldestURL = this.stages[0].url
      }
    }
    return url
  }

  constructor(private opts: StageOptions) {
  }

  async loadFromURL(url: string, position: Vector3) {
    await this.addToQueue(() => this.doLoad(url, position))
    return url
  }

  async loadFromLoader(loader: StageLoader) {
    const { position: { x, y, z }, offsetY } = loader,
      position = new Vector3(Math.floor(x), Math.floor(y + offsetY), Math.floor(z))
    return await this.loadFromURL(loader.stageURL, position)
  }

  dispose() {
    this.stages.forEach(stage => stage.dispose())
    this.isDisposed = true
  }
}

const camelCaseToHyphen = (str: string) => str.replace(/[a-z][A-Z]{1}/g, m => m[0] + '-' + m[1].toLowerCase()),
  wrapString = (str: string) => str.replace(/'[^']*'/g, m => '\'' + btoa(m.slice(1, -1))),
  unwrapString = (str: string) => str[0] === '\'' ? atob(str.slice(1)) : str
class GameState<H extends { [name: string]: (next: Promise<any>, ...args: any[]) => Promise<any> }> {
  private stack = [ ] as { name: string, next: () => Promise<any> }[]
  private queue = queue()

  constructor(private handles: H) {
    const styles = [ ] as string[]
    Object.keys(handles).forEach(name => {
      const cls = camelCaseToHyphen(name)
      styles.push(`.screen-${cls} { visibility: hidden }`)
      styles.push(`.game-${cls} .screen-${cls} { visibility: visible }`)
    })
    appendElement('style', { innerHTML: styles.join('\n') }, 'head')
  }

  private async exit() {
    if (this.stack.length > 1) {
      const { name, next } = this.stack.pop()
      document.body.classList.remove('game-' + camelCaseToHyphen(name))
      await next()
      const current = this.current
      MenuManager.activate('.menu-' + camelCaseToHyphen(current))
    }
  }

  enter(name: keyof H, ...args: any[]) {
    if (this.handles[name]) {
      const next = holdon(next => this.handles[name](next, ...args))
      this.stack.push({ name, next })
      document.body.classList.add('game-' + camelCaseToHyphen(name))
      MenuManager.activate('.menu-' + camelCaseToHyphen(name))
    }
  }

  private async gotoAsync(path: string) {
    for (const name of wrapString(path).split('/')) {
      if (name === '..') {
        await this.exit()
      }
      else if (name) {
        this.enter.apply(this, name.split(':').map(unwrapString))
      }
    }
  }

  goto(path: string) {
    return this.queue(() => this.gotoAsync(path))
  }

  get current() {
    const last = this.stack[this.stack.length - 1]
    return last && last.name
  }
}

; (async function() {
  const { scene, camera, canvas2d, ctrl, clock } = createScene(),
    source = new Mesh('cache/object/source', scene),
    assets = await loadAssets(scene, (index, total, progress) =>
      LoadingScreen.update(`Loading Assets ${index + 1}/${total} (${~~(progress * 100)}%)`)),
    tiles = assets.tiles,
    classes = assets.classes.map(({ clsId, cls, args, icon }) => ({ clsId, cls, args, opts: { icon, source, canvas2d, clock } })),
    keyInput = new KeyEmitter(KEY_MAP)

  new SkyBox('sky', scene)

  const gameState = new GameState({
    async main(next) {
      // TODO
      await next
    },
    async play(next, url: string) {
      const stageManager = new StageManager({ scene, classes, tiles }),
        onTrigger = (loader: StageLoader) => stageManager.loadFromLoader(loader)
      StageLoader.eventEmitter.on('trigger', onTrigger)
      await stageManager.loadFromURL(url || StageManager.oldestURL, Vector3.Zero())
      await next
      StageLoader.eventEmitter.off('trigger', onTrigger)
      stageManager.dispose()
      camera.followTarget.copyFromFloats(0, 0, 0)
    },
    async pause(next) {
      ctrl.pause()
      await next
      ctrl.resume()
    },
    async config(next) {
      // TODO
      await next
    },
  })

  keyInput.ondown('escape', () => {
    if (gameState.current === 'play') {
      gameState.enter('pause')
    }
    else {
      gameState.goto('..')
    }
  })

  keyInput.ondown('return', () => {
    const activeItem = MenuManager.activeItem()
    if (activeItem) {
      gameState.goto(activeItem.getAttribute('goto'))
    }
  })

  keyInput.ondown('navigate', () => {
    const activeList = MenuManager.activeList()
    if (activeList && activeList.classList.contains('menu-config-item')) {
      if (keyInput.state.up || keyInput.state.down) {
        MenuManager.selectNext(keyInput.state.up ? -1 : 1, 'menu-config-list', 'menu-config-item')
      }
      else {
        MenuManager.selectNext(keyInput.state.left ? -1 : 1)
      }
    }
    else {
      MenuManager.selectNext(keyInput.state.up || keyInput.state.left ? -1 : 1)
    }
  })

  await new Promise(resolve => setTimeout(resolve, 1000))

  camera.lowerBetaSoftLimit = Math.PI * 0.35
  camera.upperRadiusSoftLimit = 40

  gameState.enter('main')
  LoadingScreen.hide()
})()
