import { ObjectBase, ObjectOptions } from './objbase'
import * as DefaultPlugin from '../objs'

import { RestoreData, TileDefine } from './chunks'

import {
  Engine,
  Scene,
  Vector3,
  ScreenSpaceCanvas2D,
  Color3,
  Material,
  Texture,
  StandardMaterial,
  Mesh,
  SSAORenderingPipeline,
} from '../babylon'

import {
  EventEmitter
} from '../utils'

import {
  createElement,
  appendElement,
  loadWithXHR,
  loadDataURLWithXHR,
} from '../utils/dom'

import {
  FollowCamera,
} from '../utils/babylon'

export interface ClassDefine {
  clsId: number
  clsName: string
  src: HTMLImageElement
  offsetX: number
  offsetY: number
  width: number
  height: number
  title: string
  args: any
}

export interface ObjectSaveData {
  x: number,
  y: number,
  z: number,
  clsId: number,
  args: any,
}

export interface SavedMap {
  chunksData: RestoreData
  objectsData: { [objectId: string]: ObjectSaveData }
}

const loadedPlugins: { [name: string]: typeof DefaultPlugin } = {
  default: DefaultPlugin
}
async function loadPlugin(name: string) {
  const packageJson = JSON.parse(await loadWithXHR<string>(`node_modules/${name}/package.json`)),
    scriptContent = await loadWithXHR<string>(`node_modules/${name}/` + (packageJson.main || 'index.js')),
    exportObject = { } as any
  new Function(`${scriptContent}`, 'exports')(exportObject)
  return exportObject
}
async function loadAllPlugins() {
  const pluginList = ['default']
  try {
    const packageJson = JSON.parse(await loadWithXHR<string>('package.json'))
    pluginList.push.apply(pluginList, packageJson.aliceSquaPlugins || [ ])
  }
  catch (err) {
    throw `get plugin list from package.json failed: ${err && err.message || err}`
  }

  for (const name of pluginList) {
    try {
      loadedPlugins[name] = loadedPlugins[name] || await loadPlugin(name)
    }
    catch (err) {
      throw `load plugin ${name} failed: ${err && err.message || err}`
    }
  }

  const images = { } as typeof DefaultPlugin.images,
    tiles = [ ] as typeof DefaultPlugin.tiles,
    tileIndex = { } as { [clsId: string]: number },
    classes = [ ] as typeof DefaultPlugin.classes,
    classIndex = { } as { [clsId: string]: number }
  for (const name of pluginList) {
    const plugin = loadedPlugins[name]
    if (plugin.images) for (const id in plugin.images) {
      if (images[id]) {
        console.warn(`image ${id} overwritten by plugin ${name}`)
      }
      images[id] = plugin.images[id]
    }
    if (plugin.tiles) for (const tile of plugin.tiles) {
      const [id, srcId] = tile
      if (!images[srcId]) {
        throw `asset image ${srcId} is not found!`
      }
      if (tileIndex[id] >= 0) {
        console.warn(`tile ${id} overwritten by plugin ${name}`)
        tiles.splice(tileIndex[id], 1)
      }
      tileIndex[id] = tiles.length
      tiles.push(tile)
    }
    if (plugin.classes) for (const cls of plugin.classes) {
      const [id, srcId] = cls
      if (!images[srcId]) {
        throw `asset image ${srcId} is not found!`
      }
      if (classIndex[id] >= 0) {
        console.warn(`class ${id} overwritten by plugin ${name}`)
        classes.splice(classIndex[id], 1)
      }
      classIndex[id] = classes.length
      classes.push(cls)
    }
  }

  return { images, tiles, classes }
}

export class Game extends EventEmitter<{
  loadProgress: { index: number, total: number, progress: number }
}> {
  readonly scene: Scene
  readonly camera: FollowCamera
  readonly engine: Engine
  readonly canvas: ScreenSpaceCanvas2D
  private constructor() {
    super()

    const attrs = { style: { width: '100%', height: '100%' }, tabIndex: -1 },
      elem = appendElement('canvas', attrs) as HTMLCanvasElement,
      engine = this.engine = new Engine(elem, true),
      scene = this.scene = new Scene(engine)

    scene.enablePhysics(new Vector3(0, -3, 0))
    scene.workerCollisions = true
    scene.clearColor = Color3.FromHexString('#607f9a').scale(0.7).toColor4()

    const camera = this.camera = scene.activeCamera = new FollowCamera('camera', 0, 0, 50, Vector3.Zero(), scene)
    camera.lowerRadiusLimit = 20
    camera.upperRadiusLimit = 100
    camera.lowerBetaLimit = Math.PI * 0.15
    camera.upperBetaLimit = Math.PI * 0.45
    camera.attachControl(elem, true)
    camera.keysUp = camera.keysDown = camera.keysLeft = camera.keysRight = [ ]

    this.canvas = new ScreenSpaceCanvas2D(scene)

    engine.runRenderLoop(() => scene.render())
    window.addEventListener('resize', () => engine.resize())

    scene.registerAfterRender(() => {
      const tick = this.tickNow
      if (this._timers.length && tick > this._timers[0].until) {
        this._timers = this._timers.filter(({ fn, until }) => until > tick || (fn(), false))
      }
    })
  }

  private _tickOffset = 0
  get tickNow() {
    return Date.now() - this._tickOffset
  }

  private _pauseTick = 0
  get isPaused() {
    return this._pauseTick !== 0
  }
  set isPaused(val) {
    if (val && this._pauseTick === 0) {
      this._pauseTick = Date.now()
      this.engine.stopRenderLoop()
    }
    else if (!val && this._pauseTick) {
      this._tickOffset += Date.now() - this._pauseTick
      this._pauseTick = 0
      this.engine.runRenderLoop(() => this.scene.render())
    }
  }

  private _timers = [ ] as { fn: Function, until: number }[]
  timeout(fn: Function, delay: number) {
    const until = this.tickNow + delay,
      timer = { fn, until }
    this._timers.push(timer)
    this._timers.sort((a, b) => a.until - b.until)
    return () => this._timers.splice(this._timers.indexOf(timer), 1)
  }

  private _classes = { } as { [clsId: string]: { cls: typeof ObjectBase, args: any, opts: ObjectOptions } }

  objectSource = null as Mesh
  createObject(id: string, clsId: number, position = Vector3.Zero(), restoreArgs = null as any) {
    if (!this._classes[clsId]) {
      throw `class id ${clsId} is not found when create object #${id}!`
    }
    if (!this.objectSource) {
      this.objectSource = new Mesh('cache/game/source', this.scene)
    }

    const { cls, args, opts } = this._classes[clsId]
    opts.source = this.objectSource

    const object = new cls(id, opts)
    object.position.copyFrom(position)

    const objArgs = Object.assign({ }, args, restoreArgs)
    Object.assign(object, objArgs)

    return object
  }

  private _assets = { } as { tiles: TileDefine[], classes: ClassDefine[] }
  get assets() {
    return this._assets
  }

  private _ssao: SSAORenderingPipeline
  set enableSSAO(val: boolean) {
    if (val && !this._ssao) {
      this._ssao = new SSAORenderingPipeline('ao', this.scene, 1, [this.camera])
    }
    else if (!val && this._ssao) {
      this._ssao.dispose()
      this._ssao = null
    }
  }

  static async load(onProgress: (index: number, total: number, progress: number) => void) {
    const game = new Game(),
      plugins = await loadAllPlugins()

    const materials = { } as { [key: string]: { material: Material, src: HTMLImageElement, texSize: number } },
      imageIds = Object.keys(plugins.images), total = imageIds.length
    for (let index = 0; index < total; index ++) {
      const id = imageIds[index],
        src = await loadDataURLWithXHR(plugins.images[id], progress => onProgress(index, total, progress)),
        img = createElement('img', { id, src }) as HTMLImageElement,
        texSize = 2 ** Math.ceil(Math.log2(Math.max(img.width, img.height)))

      let base64Src = src
      if (img.width !== texSize || img.height !== texSize) {
        const canvas = document.createElement('canvas') as HTMLCanvasElement
        canvas.width = canvas.height = texSize
        canvas.getContext('2d').drawImage(img, 0, 0)
        base64Src = canvas.toDataURL()
      }

      let texture: Texture
      await new Promise<Texture>((resolve, reject) => {
        texture = Texture.CreateFromBase64String(base64Src,
          id, game.scene, false, true, Texture.NEAREST_SAMPLINGMODE, resolve, reject)
      })
      texture.hasAlpha = true

      const material = new StandardMaterial(id + '/mat', game.scene)
      material.disableLighting = true
      material.emissiveColor = Color3.White()
      material.diffuseTexture = texture

      materials[id] = { material, texSize, src: img }
    }

    const tiles = plugins.tiles.map(([tileId, srcId, offsetX, offsetY, size, autoTileType, sideTileId]) => {
      const { src } = materials[srcId]
      return { tileId, src, offsetX, offsetY, size, autoTileType, sideTileId }
    })

    const classes = plugins.classes.map(([clsId, srcId, offsetX, offsetY, width, height, cls, args, uiArgs]) => {
      const { src, material, texSize } = materials[srcId],
        clsName = cls.name,
        icon = { material, texSize, offsetX, offsetY, width, height },
        opts = { icon, clock: game, source: null as Mesh, canvas: game.canvas }
      game._classes[clsId] = { cls, args, opts }
      return { clsId, clsName, src, offsetX, offsetY, width, height, args, ...uiArgs }
    })

    game._assets = { tiles, classes }
    return game
  }
}
