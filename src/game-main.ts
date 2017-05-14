import {
  Vector3,
} from './babylon'

import {
  Game,
  MapSaveData,
} from './game'

import {
  ObjectBase,
  IPlayStartStopListener,
} from './game/objbase'

import {
  appendElement,
  LoadingScreen,
  LocationSearch,
  MenuManager,
  loadWithXHR,
  checkFontsLoaded,
} from './utils/dom'

import {
  camelCaseToHyphen,
  queue,
  step,
  sleep,
} from './utils'

import {
  GamepadInput,
} from './utils/babylon'

import Terrain from './game/terrain'
import SkyBox from './game/skybox'

import Player from './objs/player'

const KEY_MAP = {
  escape: 'ESCAPE | PAD-B',
  return: 'RETURN | PAD-A',
  up: 'UP | PAD-UP',
  down: 'DOWN | PAD-DOWN',
  left: 'LEFT | PAD-LEFT',
  right: 'RIGHT | PAD-RIGHT',
  'nav-vertical': 'UP | DOWN | PAD-UP | PAD-DOWN',
  'nav-horizontal': 'LEFT | RIGHT | PAD-LEFT | PAD-RIGHT',
  'finish-dialog': 'CTRL',
}

class Stage {
  private constructor(readonly url: string, readonly position: Vector3) {
  }

  readonly terrains = [ ] as Terrain[]
  readonly objects = [ ] as ObjectBase[]
  static async create(url: string, position: Vector3, map: MapSaveData, game: Game) {
    const stage = new Stage(url, position),
      entryPosition = position.clone(),
      entryId = Object.keys(map.objects).find(id => map.objects[id].args.editorSingletonId === 'stage/entry')
    if (entryId) {
      const { x, y, z, args } = map.objects[entryId]
      entryPosition.subtractInPlace(new Vector3(Math.floor(x), Math.floor(y + (args.offsetY || 0)), Math.floor(z)))
    }

    for (const id of Object.keys(map.terrains)) {
      const { x, y, z } = map.terrains[id],
        position = new Vector3(x, y, z).addInPlace(entryPosition),
        terrain = new Terrain('terrain/' + id, game.scene, game.assets.tiles, map.terrains[id], position)
      await new Promise(resolve => terrain.once('loaded', resolve as any))
      stage.terrains.push(terrain)
    }

    for (const id of Object.keys(map.objects)) {
      const { clsId, x, y, z, args } = map.objects[id],
        position = new Vector3(x, y, z).addInPlace(entryPosition)
      try {
        stage.objects.push(game.createObject(id, clsId, position, args))
      }
      catch (err) {
        console.warn(`restore object failed: ${err && err.message || err}`)
      }
    }

    const playListeners = stage.objects as any[] as IPlayStartStopListener[]
    playListeners.forEach(object => object.onPlayStart && object.onPlayStart())

    return stage
  }

  dispose() {
    const playListeners = this.objects as any[] as IPlayStartStopListener[]
    playListeners.forEach(object => object.onPlayStop && object.onPlayStop())

    this.objects.forEach(object => object.dispose())
    this.terrains.forEach(terrain => terrain.dispose())
  }
}

class StageManager {
  static readonly defaultHistory = JSON.stringify([{ url: 'assets/stage/startup.json', x: 0, y: 0, z: 0 }])

  static async restore(game: Game) {
    const stageManager = new StageManager(game),
      history = [ ] as { url: string, x: number, y: number, z: number }[]
    // TODO: load from somewhere
    try {
      const historyJSON = LocationSearch.get('stageHistoryArray') || localStorage.getItem('stage-history') || StageManager.defaultHistory
      history.push.apply(history, JSON.parse(historyJSON))
    }
    catch (err) {
      console.error(err)
    }
    for (const stage of history) {
      await stageManager.loadFromURL(stage.url, new Vector3(stage.x || 0, stage.y || 0, stage.z || 0))
    }
    return stageManager
  }
  static hasProfile() {
    return !!localStorage.getItem('stage-history')
  }
  static clear() {
    localStorage.setItem('stage-history', StageManager.defaultHistory)
  }

  private stages = [ ] as Stage[]
  private isDisposed = false

  private addToQueue = queue()
  private async doLoad(url: string, position: Vector3) {
    if (!this.stages.find(stage => stage.url === url && stage.position.equals(position))) {
      const map = JSON.parse(await loadWithXHR<string>(url)) as MapSaveData
      if (!this.isDisposed) {
        this.stages.push(await Stage.create(url, position, map, this.game))
        this.stages.length > 2 && this.stages.shift().dispose()
        localStorage.setItem('stage-history', JSON.stringify(this.stages.map(({ url, position: { x, y, z } }) => ({ url, x, y, z }))))
      }
    }
  }

  private constructor(private game: Game) {
  }

  async loadFromURL(url: string, position: Vector3) {
    await this.addToQueue(() => this.doLoad(url, position))
  }

  dispose() {
    this.stages.forEach(stage => stage.dispose())
    this.isDisposed = true
  }
}

class Config<S> {
  static async load<S extends { [key: string]: (val?: string) => string }>(updater: S) {
    const config = new Config<S>()
    config.updater = updater

    let data = { } as { [P in keyof S]: string }
    try {
      Object.assign(data, JSON.parse(localStorage.getItem('game-config')))
    }
    catch (err) {
      console.error(err)
    }

    Object.keys(updater).forEach((key: keyof S) => {
      const configItem = document.querySelector(`[config-key="${key}"]`)
      if (configItem) {
        const allValues = configItem.querySelectorAll('[config-val]')
        for (const elem of allValues) {
          elem.classList.remove('active')
        }
        const val = config.updater[key](data[key]),
          configValue = configItem.querySelector(`[config-val="${val}"]`) || allValues[0]
        configValue.classList.add('active')
      }
    })

    return config
  }
  private data = { } as { [P in keyof S]: string }
  private updater: { [P in keyof S]: (val?: string) => string }
  private constructor() {
  }
  get(key: keyof S) {
    return this.data[key]
  }
  set(key: keyof S, val: string) {
    if (this.data[key] !== val) {
      this.data[key] = this.updater[key](val)
    }
  }
  save() {
    localStorage.setItem('game-config', JSON.stringify(this.data))
  }
}

class GameState<H extends { [name: string]: (next: () => Promise<any>, ...args: any[]) => Promise<any> }> {
  private stack = [ ] as { name: string, next: () => Promise<any> }[]
  private queue = queue()

  constructor(private handles: H) {
    const styles = ['']
    Object.keys(handles).forEach(name => {
      const cls = camelCaseToHyphen(name)
      styles.push(`.screen-${cls} { visibility: hidden }`)
      styles.push(`.game-${cls} .screen-${cls} { visibility: visible }`)
    })
    appendElement('style', { innerHTML: styles.join('\n') }, 'head')
  }

  private async exit() {
    if (this.stack.length > 0) {
      const { name, next } = this.stack.pop()
      document.body.classList.remove('game-' + camelCaseToHyphen(name))
      await next()
      const current = this.current
      current && MenuManager.activate('.menu-' + camelCaseToHyphen(current))
    }
    else {
      console.warn('already at root of game state')
    }
  }

  private async enter(name: keyof H, ...args: any[]) {
    if (this.handles[name]) {
      const next = await step(next => this.handles[name](next, ...args))
      this.stack.push({ name, next })
      document.body.classList.add('game-' + camelCaseToHyphen(name))
      MenuManager.activate('.menu-' + camelCaseToHyphen(name))
    }
    else {
      console.warn(`no ${name} state in game`)
    }
  }

  private async gotoAsync(path: string) {
    for (const name of path.split('/')) {
      if (name === '..') {
        await this.exit()
      }
      else if (name) {
        await this.enter.apply(this, name.split(':').map(decodeURIComponent))
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

function updateLoadingScreenProgress(index: number, total: number, progress: number) {
  LoadingScreen.update(`Loading Assets ${index + 1}/${total} (${~~(progress * 100)}%)`)
}

function updateGameLanguage(lang: string) {
  for (const elem of document.querySelectorAll(`[i18n-${lang}]`)) {
    elem.innerHTML = elem.getAttribute(`i18n-${lang}`)
  }
}

function selectNextConfigItem(delta: number) {
  MenuManager.selectNext(delta, 'menu-config-list', 'menu-config-item')
}

function updateConfigFromActiveMenu<S>(config: Config<S>) {
  const activeList = MenuManager.activeList(),
    key = activeList && activeList.getAttribute('config-key'),
    activeItem = MenuManager.activeItem(),
    val = activeItem && activeItem.getAttribute('config-val')
  key && config.set(key as any, val)
}

async function showDialogText(name: string, dialogJSON: string, isCanceled: () => boolean) {
  const dialogs = JSON.parse(dialogJSON) as { [name: string]: { text: string, options: any } },
    { text, options } = dialogs[name] || { text: '...', options: { } }

  const elem = document.querySelector('.game-dialog-content')
  elem.innerHTML = ''

  const elemLines = appendElement('pre', { }, elem)
  for (let i = 0; i < text.length; i ++) {
    if (isCanceled()) {
      elemLines.innerHTML = text
      await sleep(50)
      elem.parentElement.scrollTop = elem.scrollHeight
      break
    }
    else {
      elemLines.innerHTML += text[i]
      await sleep(50)
      if (text[i - 1] === '\n') {
        elem.parentElement.scrollTop = elem.scrollHeight
        await sleep(50)
      }
    }
  }

  const diagOptions = { } as { [title: string]: string }
  for (const title of Object.keys(options)) {
    const next = options[title],
      path = next && dialogs[next] ? ['text', next, dialogJSON].map(encodeURIComponent).join(':') : '..'
    diagOptions[title] = '../' + path
  }
  elem.parentElement.scrollTop = elem.scrollHeight

  const elemOptions = MenuManager.createList(elem, diagOptions, '../..')
  MenuManager.activate(elemOptions)
}

; (async function() {
  await checkFontsLoaded()

  let game: Game
  try {
    game = await Game.load(updateLoadingScreenProgress)
  }
  catch (err) {
    LoadingScreen.error(`create game failed: ${err && err.message || err}`)
    throw err
  }

  const configs = {
    ssao(val = 'off') {
      game.enableSSAO = val === 'on'
      return val
    },
    lensRendering(val = 'on') {
      game.enableLensRendering = val === 'on'
      return val
    },
    lang(val = 'en') {
      updateGameLanguage(val)
      return val
    },
    volume(val = '3') {
      console.warn('setting up volume is not implemented yet')
      return val
    },
  }

  let config: Config<typeof configs>
  try {
    config = await Config.load(configs)
  }
  catch (err) {
    LoadingScreen.error(`load config failed: ${err && err.message || err}`)
    throw err
  }

  const { scene, camera } = game,
    input = new GamepadInput(KEY_MAP),
    keys = input.state

  new SkyBox('sky', scene)

  const gameState = new GameState({
    async main(next) {
      document.querySelector('.show-if-has-profile')
        .classList[StageManager.hasProfile() ? 'remove' : 'add']('hidden')
      await next()
    },
    async play(next) {
      const stageManager = await StageManager.restore(game),
        unbindLoadStage = ObjectBase.eventEmitter.on('load-stage', data => stageManager.loadFromURL(data.url, data.position))
      await next()
      unbindLoadStage()
      stageManager.dispose()
      camera.followTarget.copyFromFloats(0, 0, 0)
    },
    async pause(next) {
      game.isPaused = true
      await next()
      game.isPaused = false
    },
    async config(next) {
      const unbindChangeConfigItem = input.down.on('nav-vertical', () => selectNextConfigItem(keys.up ? -1 : 1)),
        unbindChangeConfigValue = input.down.on('nav-horizontal', () => updateConfigFromActiveMenu(config))
      await next()
      unbindChangeConfigItem()
      unbindChangeConfigValue()
      config.save()
    },
    async clear(next) {
      StageManager.clear()
      await next()
    },
    async text(next, name: string = '', dialogJSON: string = '{ }') {
      let isCanceled = false
      input.down.once('escape', () => isCanceled = true)
      showDialogText(name, dialogJSON, () => keys['finish-dialog'] || isCanceled)
      await next()
    },
    async dialog(next, dialogJSON: string = '') {
      const player = Player.getActive(scene)
      player.isPlayerActive = false
      document.body.classList.add('keep-dialog-screen-open')

      const start = Object.keys(JSON.parse(dialogJSON)).shift(),
        url = ['text', start, dialogJSON].map(encodeURIComponent).join(':')
      setImmediate(() => gameState.goto(url))
      await next()

      document.body.classList.remove('keep-dialog-screen-open')
      player.isPlayerActive = true
    }
  })

  input.down.on('escape', () => {
    const activeList = MenuManager.activeList()
    if (activeList) {
      gameState.goto(activeList.getAttribute('menu-escape') || '')
    }
  })

  input.down.on('return', () => {
    const activeItem = MenuManager.activeItem()
    if (activeItem) {
      gameState.goto(activeItem.getAttribute('menu-goto') || '')
    }
  })

  input.down.on('nav-vertical', () => {
    const activeList = MenuManager.activeList()
    if (activeList && !activeList.classList.contains('menu-horizontal')) {
      MenuManager.selectNext(keys.up ? -1 : 1)
    }
  })

  input.down.on('nav-horizontal', () => {
    const activeList = MenuManager.activeList()
    if (activeList && !activeList.classList.contains('menu-vertical')) {
      MenuManager.selectNext(keys.left ? -1 : 1)
    }
  })

  scene.registerBeforeRender(() => {
    if (input.rightStick) {
      camera.updateRotation(input.rightStick)
    }
    if (input.leftTrigger || input.rightTrigger) {
      camera.updateDistance(input.rightTrigger - input.leftTrigger)
    }
  })

  camera.lowerBetaSoftLimit = Math.PI * 0.35
  camera.upperBetaSoftLimit = Math.PI * 0.45
  camera.lowerRadiusSoftLimit = 25
  camera.upperRadiusSoftLimit = 40

  LoadingScreen.hide()

  gameState.goto(LocationSearch.get('stageStartPath') || 'main')
})()
