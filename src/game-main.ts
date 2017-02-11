import {
  Vector3,
} from './babylon'

import {
  Game,
  SavedMap,
} from './game'

import {
  ObjectBase,
  ObjectPlayListener,
} from './game/objbase'

import {
  appendElement,
  LoadingScreen,
  MenuManager,
  KeyEmitter,
  loadWithXHR,
} from './utils/dom'

import {
  queue,
  step,
  sleep,
  EventEmitter,
} from './utils'

import Chunks from './game/chunks'
import SkyBox from './game/skybox'

import { StageLoader } from './objs/stage'
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
  readonly chunks: Chunks
  readonly objects: ObjectBase[] & ObjectPlayListener[]
  constructor(
      readonly url: string,
      readonly position: Vector3,
      map: SavedMap, game: Game) {
    const entryPosition = this.position.clone(),
      entryId = Object.keys(map.objectsData).find(id => map.objectsData[id].args.editorSingletonId === 'stage/entry')
    if (entryId) {
      const { x, y, z, args } = map.objectsData[entryId]
      entryPosition.subtractInPlace(new Vector3(Math.floor(x), Math.floor(y + (args.offsetY || 0)), Math.floor(z)))
    }

    const name = url.split('.').slice(-2).shift()
    this.chunks = new Chunks(name, game.scene, game.assets.tiles, map.chunksData, entryPosition)
    this.objects = [ ]

    Object.keys(map.objectsData).forEach(id => {
      const objData = map.objectsData[id],
        { clsId, x, y, z, args } = objData,
        position = new Vector3(x, y, z).addInPlace(entryPosition)
      try {
        this.objects.push(game.createObject(id, clsId, position, args))
      }
      catch (err) {
        console.warn(`restore object failed: ${err && err.message || err}`)
      }
    })
    this.objects.forEach((object: ObjectPlayListener) => object.startPlaying && object.startPlaying())
  }

  dispose() {
    this.objects.forEach((object: ObjectPlayListener) => object.stopPlaying && object.stopPlaying())
    this.objects.forEach(object => object.dispose())
    this.chunks.dispose()
  }
}

class StageManager {
  static DEFAULT_HISTORY_VALUE = JSON.stringify([{ url: 'assets/stage/startup.json', x: 0, y: 0, z: 0 }])
  static async restore(game: Game) {
    const stageManager = new StageManager(game),
      history = [ ] as { url: string, x: number, y: number, z: number }[]
    // TODO: load from somewhere
    try {
      history.push.apply(history, JSON.parse(localStorage.getItem('stage-history') || StageManager.DEFAULT_HISTORY_VALUE))
    }
    catch (err) {
      console.error(err)
    }
    for (const stage of history) {
      await stageManager.loadFromURL(stage.url, new Vector3(stage.x, stage.y, stage.z))
    }
    return stageManager
  }
  static hasProfile() {
    return !!localStorage.getItem('stage-history')
  }
  static clear() {
    localStorage.setItem('stage-history', StageManager.DEFAULT_HISTORY_VALUE)
  }

  private stages = [ ] as Stage[]
  private isDisposed = false

  private addToQueue = queue()
  private async doLoad(url: string, position: Vector3) {
    if (!this.stages.find(stage => stage.url === url && stage.position.equals(position))) {
      const map = await fetch(url).then(res => res.json()) as any as SavedMap
      if (!this.isDisposed) {
        this.stages.push(new Stage(url, position, map, this.game))
        this.stages.length > 2 && this.stages.shift().dispose()
        localStorage.setItem('stage-history', JSON.stringify(this.stages.map(({ url, position: { x, y, z } }) => ({ url, x, y, z }))))
      }
    }
  }

  private constructor(private game: Game) {
  }

  private async loadFromURL(url: string, position: Vector3) {
    await this.addToQueue(() => this.doLoad(url, position))
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

class ConfigManager extends EventEmitter<{ change: string }> {
  static async load() {
    const config = new ConfigManager()
    // TODO: load from somewhere
    try {
      Object.assign(config.data, JSON.parse(localStorage.getItem('game-config')))
    }
    catch (err) {
      console.error(err)
    }

    Object.keys(config.data).forEach(key => {
      const val = config.data[key],
        configItem = document.querySelector(`[config-key="${key}"]`)
      if (configItem) {
        const allValues = configItem.querySelectorAll('[config-val]')
        for (const elem of allValues) {
          elem.classList.remove('active')
        }
        const configValue = configItem.querySelector(`[config-val="${val}"]`) || allValues[0]
        configValue.classList.add('active')
      }
    })
    return config
  }
  private constructor(private data = {
    lang: 'en',
    display: 'fine',
    volume: '3',
  } as { [key: string]: any }) {
    super()
  }
  get(key: string) {
    return this.data[key]
  }
  set(key: string, val: string) {
    this.data[key] = val
    this.emit('change', key)
  }
  update() {
    const activeList = MenuManager.activeList(),
      key = activeList && activeList.getAttribute('config-key'),
      activeItem = MenuManager.activeItem(),
      val = activeItem && activeItem.getAttribute('config-val')
    key && this.set(key, val)
  }
  save() {
    localStorage.setItem('game-config', JSON.stringify(this.data))
  }
}

const camelCaseToHyphen = (str: string) => str.replace(/[a-z][A-Z]{1}/g, m => m[0] + '-' + m[1].toLowerCase()),
  wrapString = (str: string) => str.replace(/'[^']*'/g, m => '\'' + btoa(m.slice(1, -1))),
  unwrapString = (str: string) => str[0] === '\'' ? atob(str.slice(1)) : str
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
  }

  private async enter(name: keyof H, ...args: any[]) {
    if (this.handles[name]) {
      const next = await step(next => this.handles[name](next, ...args))
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
        await this.enter.apply(this, name.split(':').map(unwrapString))
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

; (async function() {
  let game: Game
  try {
    game = await Game.load(updateLoadingScreenProgress)
  }
  catch (err) {
    LoadingScreen.update(`create game failed: ${err && err.message || err}`)
    throw err
  }

  const scene = game.scene,
    configManager = await ConfigManager.load(),
    keyInput = new KeyEmitter(KEY_MAP)

  new SkyBox('sky', scene)

  updateGameLanguage(configManager.get('lang'))
  configManager.on('change', key => {
    if (key === 'lang') {
      updateGameLanguage(configManager.get(key))
    }
  })

  const gameState = new GameState({
    async main(next) {
      game.camera.followTarget.copyFromFloats(0, 0, 0)
      document.querySelector('.show-if-has-profile')
        .classList[StageManager.hasProfile() ? 'remove' : 'add']('hidden')
      await next()
    },
    async play(next) {
      const stageManager = await StageManager.restore(game),
        onTrigger = StageLoader.eventEmitter.on('trigger', loader => stageManager.loadFromLoader(loader))
      await next()
      StageLoader.eventEmitter.off('trigger', onTrigger)
      stageManager.dispose()
    },
    async pause(next) {
      game.isPaused = true
      await next()
      game.isPaused = false
    },
    async config(next) {
      const changeConfigItem = keyInput.down.on('nav-vertical', () => selectNextConfigItem(keyInput.state.up ? -1 : 1)),
        changeConfigValue = keyInput.down.on('nav-horizontal', () => configManager.update())
      await next()
      keyInput.down.off('nav-vertical', changeConfigItem)
      keyInput.down.off('nav-horizontal', changeConfigValue)
      configManager.save()
    },
    async clear(next) {
      StageManager.clear()
      await next()
    },
    async dialog(next) {
      const player = scene.getMeshesByTags(Player.PLAYER_TAG)
        .find(player => (player as Player).isPlayerActive) as Player
      player.isPlayerActive = false

      const elem = document.querySelector('.game-dialog-content')
      elem.innerHTML = ''

      const text = await loadWithXHR<string>('package.json')
      for (let i = 0; i < text.length && gameState.current === 'dialog'; i ++) {
        if (keyInput.state['finish-dialog']) {
          elem.innerHTML = text
          await sleep(50)
          elem.parentElement.scrollTop = elem.scrollHeight
          break
        }
        else {
          elem.innerHTML += text[i]
          await sleep(50)
          if (text[i - 1] === '\n') {
            elem.parentElement.scrollTop = elem.scrollHeight
            await sleep(50)
          }
        }
      }

      const onFinishDialog = keyInput.down.on('finish-dialog', () => gameState.goto('..'))
      await next()
      keyInput.down.off('finish-dialog', onFinishDialog)

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
      MenuManager.selectNext(keyInput.state.up ? -1 : 1)
    }
  })

  keyInput.down.on('nav-horizontal', () => {
    const activeList = MenuManager.activeList()
    if (activeList && !activeList.classList.contains('menu-vertical')) {
      MenuManager.selectNext(keyInput.state.left ? -1 : 1)
    }
  })

  BulletinBoard.eventEmitter.on('use', data => {
    const { target } = data
    gameState.goto(`dialog:'${target.textContent}'`)
  })

  await new Promise(resolve => setTimeout(resolve, 1000))

  game.camera.lowerBetaSoftLimit = Math.PI * 0.35
  game.camera.upperRadiusSoftLimit = 40

  gameState.goto('main')
  LoadingScreen.hide()
})()
