import {
  Vector3,
  Ray,
  Scene,
} from './babylon'

import {
  Game,
  MapSaveData,
} from './game'

import {
  ObjectBase,
} from './game/objbase'

import {
  appendElement,
  LoadingScreen,
  LocationSearch,
  MenuManager,
  KeyEmitter,
  loadWithXHR,
  checkFontsLoaded,
} from './utils/dom'

import {
  camelCaseToHyphen,
  queue,
  step,
  sleep,
  check,
} from './utils'

import Terrain from './game/terrain'
import SkyBox from './game/skybox'

import BulletinBoard from './objs/bulletin'
import Player from './objs/player'

const KEY_MAP = {
  escape: 'ESCAPE',
  return: 'RETURN',
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  'nav-vertical': 'UP | DOWN',
  'nav-horizontal': 'LEFT | RIGHT',
  'finish-dialog': 'CTRL',
}

class Stage {
  readonly terrains: Terrain[]
  readonly objects: ObjectBase[]
  constructor(readonly url: string, readonly position: Vector3, map: MapSaveData, game: Game) {
    const entryPosition = this.position.clone(),
      entryId = Object.keys(map.objects).find(id => map.objects[id].args.editorSingletonId === 'stage/entry')
    if (entryId) {
      const { x, y, z, args } = map.objects[entryId]
      entryPosition.subtractInPlace(new Vector3(Math.floor(x), Math.floor(y + (args.offsetY || 0)), Math.floor(z)))
    }

    this.terrains = [ ]
    Object.keys(map.terrains).forEach(id => {
      const { x, y, z } = map.terrains[id],
        position = new Vector3(x, y, z).addInPlace(entryPosition)
      this.terrains.push(new Terrain('terrain/' + id, game.scene, game.assets.tiles, map.terrains[id], position))
    })

    this.objects = [ ]
    Object.keys(map.objects).forEach(id => {
      const { clsId, x, y, z, args } = map.objects[id],
        position = new Vector3(x, y, z).addInPlace(entryPosition)
      try {
        this.objects.push(game.createObject(id, clsId, position, args))
      }
      catch (err) {
        console.warn(`restore object failed: ${err && err.message || err}`)
      }
    })
    this.objects.forEach(object => object.startPlaying())
  }

  dispose() {
    this.objects.forEach(object => object.stopPlaying())
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
        this.stages.push(new Stage(url, position, map, this.game))
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

class ConfigManager {
  private static defaultValues = {
    lang: 'en',
    lensRendering: 'on',
    ssao: 'off',
    volume: '3',
  }

  static async load(game: Game) {
    // TODO: load from somewhere
    let data = { ...ConfigManager.defaultValues }
    try {
      Object.assign(data, JSON.parse(localStorage.getItem('game-config')))
    }
    catch (err) {
      console.error(err)
    }

    const config = new ConfigManager()
    config.updater = {
      ssao(val) {
        game.enableSSAO = val === 'on'
      },
      lensRendering(val) {
        game.enableLensRendering = val === 'on'
      },
      lang(val) {
        updateGameLanguage(val)
      },
      volume(_val) {
        console.warn('setting up volume is not implemented yet')
      },
    }

    Object.keys(data).forEach((key: keyof typeof ConfigManager.defaultValues) => {
      const val = data[key],
        configItem = document.querySelector(`[config-key="${key}"]`)
      if (configItem) {
        const allValues = configItem.querySelectorAll('[config-val]')
        for (const elem of allValues) {
          elem.classList.remove('active')
        }
        const configValue = configItem.querySelector(`[config-val="${val}"]`) || allValues[0]
        configValue.classList.add('active')
      }
      config.set(key, val)
    })

    return config
  }
  private data = { } as typeof ConfigManager.defaultValues
  private updater = { } as { [P in keyof typeof ConfigManager.defaultValues]: (val: string) => void }
  private constructor() {
  }
  get(key: keyof typeof ConfigManager.defaultValues) {
    return this.data[key]
  }
  set(key: keyof typeof ConfigManager.defaultValues, val: string) {
    if (this.data[key] !== val) {
      this.data[key] = val
      this.updater[key](val)
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
    const styles = [ ] as string[]
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

function updateConfigFromActiveMenu(config: ConfigManager) {
  const activeList = MenuManager.activeList(),
    key = activeList && activeList.getAttribute('config-key'),
    activeItem = MenuManager.activeItem(),
    val = activeItem && activeItem.getAttribute('config-val')
  key && config.set(key as any, val)
}

function checkCoverTerrain(scene: Scene, origin: Vector3, target: Vector3) {
  const delta = target.subtract(origin),
    ray = new Ray(origin, delta.clone().normalize(), delta.length()),
    picked = scene.pickWithRay(ray, mesh => !!Terrain.getTerrainFromMesh(mesh))
    return picked.hit && Terrain.getTerrainFromMesh(picked.pickedMesh)
}

; (async function() {
  await checkFontsLoaded()

  let game: Game
  try {
    game = await Game.load(updateLoadingScreenProgress)
  }
  catch (err) {
    LoadingScreen.update(`create game failed: ${err && err.message || err}`)
    throw err
  }

  let config: ConfigManager
  try {
    config = await ConfigManager.load(game)
  }
  catch (err) {
    LoadingScreen.update(`load config failed: ${err && err.message || err}`)
    throw err
  }

  const { scene, camera } = game,
    keyInput = new KeyEmitter(KEY_MAP),
    keys = keyInput.state

  new SkyBox('sky', scene)

  const gameState = new GameState({
    async main(next) {
      camera.followTarget.copyFromFloats(0, 0, 0)
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
    },
    async pause(next) {
      game.isPaused = true
      await next()
      game.isPaused = false
    },
    async config(next) {
      const unbindChangeConfigItem = keyInput.down.on('nav-vertical', () => selectNextConfigItem(keys.up ? -1 : 1)),
        unbindChangeConfigValue = keyInput.down.on('nav-horizontal', () => updateConfigFromActiveMenu(config))
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
      const dialogs = JSON.parse(dialogJSON) as { [name: string]: { text: string, options: any } },
        { text, options } = dialogs[name] || { text: '...', options: { } }

      let isCanceled = false
      const unbindOnEscape = keyInput.down.on('escape', () => {
        isCanceled = true
        unbindOnEscape()
      })

      const elem = document.querySelector('.game-dialog-content')
      elem.innerHTML = ''

      const elemLines = appendElement('pre', { }, elem)
      for (let i = 0; i < text.length; i ++) {
        if (keys['finish-dialog'] || isCanceled) {
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

      const elemOptions = appendElement('div', { className: 'menu-list', attributes: { 'menu-escape': '../..' } }, elem)
      for (const title of Object.keys(options)) {
        const next = options[title],
          path = next && dialogs[next] ? ['text', next, dialogJSON].map(encodeURIComponent).join(':') : '..'
        appendElement('span', { innerHTML: title, className: 'menu-item', attributes: { 'menu-goto': '../' + path } }, elemOptions)
      }
      elem.parentElement.scrollTop = elem.scrollHeight
      MenuManager.activate(elemOptions)

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

  keyInput.down.on('escape', () => {
    const activeList = MenuManager.activeList()
    if (activeList) {
      gameState.goto(activeList.getAttribute('menu-escape') || '')
    }
  })

  keyInput.down.on('return', () => {
    const activeItem = MenuManager.activeItem()
    if (activeItem) {
      gameState.goto(activeItem.getAttribute('menu-goto') || '')
    }
  })

  keyInput.down.on('nav-vertical', () => {
    const activeList = MenuManager.activeList()
    if (activeList && !activeList.classList.contains('menu-horizontal')) {
      MenuManager.selectNext(keys.up ? -1 : 1)
    }
  })

  keyInput.down.on('nav-horizontal', () => {
    const activeList = MenuManager.activeList()
    if (activeList && !activeList.classList.contains('menu-vertical')) {
      MenuManager.selectNext(keys.left ? -1 : 1)
    }
  })

  BulletinBoard.eventEmitter.on('read-bulletin-content', dialogContent => {
    const dialogJSON = JSON.stringify(dialogContent)
    gameState.goto(`dialog:${encodeURIComponent(dialogJSON)}`)
  })

  const checkHoverTerrainChange = check<Terrain>((newTerrain, oldTerrain) => {
    oldTerrain && game.startAnimation(oldTerrain.name + '/fade', oldTerrain, 'visibility', 1.0, 0.03)
    newTerrain && game.startAnimation(newTerrain.name + '/fade', newTerrain, 'visibility', 0.3, 0.03)
  })

  scene.registerBeforeRender(() => {
    const player = Player.getActive(scene)
    if (player) {
      const spritePosition = player.spriteBody.getAbsolutePosition(),
        offset = new Vector3(0, player.spriteBody.scaling.y * 0.4, 0),
        coverTop = checkCoverTerrain(scene, camera.position, spritePosition.add(offset))
      checkHoverTerrainChange(coverTop)
    }
  })

  await sleep(1000)

  camera.lowerBetaSoftLimit = Math.PI * 0.35
  camera.upperRadiusSoftLimit = 40

  LoadingScreen.hide()

  gameState.goto(LocationSearch.get('stageStartPath') || 'main')
})()
