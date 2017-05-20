import { ObjectBase, ObjectOptions } from './objbase'
import * as DefaultPlugin from '../objs'

import Terrain, { TerrainData, TileDefine } from './terrain'

import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Material,
  Texture,
  StandardMaterial,
  Mesh,
  SSAORenderingPipeline,
  LensRenderingPipeline,
  DirectionalLight,
  ShadowGenerator,
} from '../babylon'

import {
  softClamp,
  propGet,
  propSet,
} from '../utils'

import {
  createElement,
  appendElement,
  loadWithXHR,
  loadBlobWithXHR,
  readBlob,
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
  group: string
  args: any
}

export interface ObjectSaveData {
  x: number,
  y: number,
  z: number,
  clsId: number,
  args: any,
}

export interface TerrainSaveData extends TerrainData {
  x: number
  y: number
  z: number
}

export interface MapSaveData {
  objects: { [id: string]: ObjectSaveData }
  terrains: { [id: string]: TerrainSaveData }
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

const DEFAULT_CONFIG = {
  clearColor: Color3.FromHexString('#607f9a').scale(0.7).toHexString(),
  physicsGravity: 3,
  cameraLowerRadius: 15,
  cameraUpperRadius: 100,
  cameraLowerBeta: Math.PI * 0.15,
  cameraUpperBeta: Math.PI * 0.48,
  shadowMapSize: 2048,
  shadowMapUpdateInterval: 30,
  shadowMapUpdateRadius: 15,
  shadowMapLightOffset: 30,
}

export class Game {
  readonly scene: Scene
  readonly camera: FollowCamera
  readonly engine: Engine

  readonly light: DirectionalLight

  private constructor(private opts?: Partial<typeof DEFAULT_CONFIG>) {
    opts = this.opts = Object.assign({ }, DEFAULT_CONFIG, opts)

    const attrs = { style: { width: '100%', height: '100%' }, tabIndex: -1, className: 'canvas-main' },
      elem = appendElement('canvas', attrs) as HTMLCanvasElement,
      engine = this.engine = new Engine(elem, true, { stencil: true }),
      scene = this.scene = new Scene(engine)

    scene.enablePhysics(new Vector3(0, -opts.physicsGravity, 0))
    scene.workerCollisions = true
    scene.clearColor = Color3.FromHexString(opts.clearColor).toColor4()

    const camera = this.camera = scene.activeCamera = new FollowCamera('camera', 0, 0, 50, Vector3.Zero(), scene)
    camera.lowerRadiusLimit = opts.cameraLowerRadius
    camera.upperRadiusLimit = opts.cameraUpperRadius
    camera.lowerBetaLimit = opts.cameraLowerBeta
    camera.upperBetaLimit = opts.cameraUpperBeta
    camera.attachControl(elem, true)
    camera.keysUp = camera.keysDown = camera.keysLeft = camera.keysRight = [ ]

    engine.runRenderLoop(() => scene.render())
    window.addEventListener('resize', () => engine.resize())

    this.light = new DirectionalLight('dir', new Vector3(-0.5, -1, -1).normalize(), scene)
    this.light.intensity = 0.5

    let updateShadowRenderIndex = opts.shadowMapUpdateInterval
    scene.registerAfterRender(() => {
      this.updateTimeout()
      this.updateAnimation()
      this.lensFocusDistance = softClamp(this._lensFocusDistance, this.camera.radius - 1, this.camera.radius + 1)
      this.light.position.copyFrom(this.camera.followTarget)
      this.light.position.y += opts.shadowMapLightOffset
      if (this._shadow && updateShadowRenderIndex ++ > opts.shadowMapUpdateInterval) {
        updateShadowRenderIndex = 0
        this.updateShadows()
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
  private updateTimeout() {
    const tick = this.tickNow
    if (this._timers.length && tick > this._timers[0].until) {
      this._timers = this._timers.filter(({ fn, until }) => until > tick || (fn(), false))
    }
  }
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
      throw `class #${clsId} is not found when creating object #${id}!`
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

  private _assets = { tiles: [] as TileDefine[], classes: [] as ClassDefine[] }
  get assets() {
    return this._assets
  }

  private _shadow: ShadowGenerator
  get enableShadows() {
    return !!this._shadow
  }
  set enableShadows(val: boolean) {
    if (val && !this._shadow) {
      this._shadow = new ShadowGenerator(this.opts.shadowMapSize, this.light)
      this._shadow.getShadowMap().refreshRate = BABYLON.RenderTargetTexture.REFRESHRATE_RENDER_ONEVERYTWOFRAMES
    }
    else if (!val && this._shadow) {
      this._shadow.dispose()
      this._shadow = null
    }
  }
  private updateShadows() {
    const renderList = this._shadow.getShadowMap().renderList
    renderList.length = 0

    const target = this.camera.target,
      hSize = new Vector3(this.opts.shadowMapUpdateRadius, 100, this.opts.shadowMapUpdateRadius),
      region = new BABYLON.BoundingInfo(target.subtract(hSize), target.add(hSize)),
      activeTerrainNames = { } as { [key: string]: boolean }
    ObjectBase.getShadowEnabled(this.scene)
      .filter(mesh => mesh.isVisible && region.intersectsPoint(mesh.getAbsolutePosition()))
      .forEach(mesh => renderList.push(mesh))
    Terrain.getTopMeshes(this.scene)
      .filter(mesh => mesh.isVisible && region.intersects(mesh.getBoundingInfo(), false))
      .filter(mesh => activeTerrainNames[Terrain.getTerrainFromMesh(mesh).name] = true)
      .forEach(mesh => renderList.push(mesh))
    Terrain.getSideMeshes(this.scene)
      .filter(mesh => mesh.isVisible && activeTerrainNames[Terrain.getTerrainFromMesh(mesh).name])
      .forEach(mesh => renderList.push(mesh))
  }

  private _ssao: SSAORenderingPipeline
  get enableSSAO() {
    return !!this._ssao
  }
  set enableSSAO(val: boolean) {
    if (val && !this._ssao) {
      // FIXME
      const hasLensRendering = this.enableLensRendering
      if (hasLensRendering) {
        this.enableLensRendering = false
      }
      this._ssao = new SSAORenderingPipeline('ao', this.scene, 1, [this.camera])
      if (hasLensRendering) {
        this.enableLensRendering = true
      }
    }
    else if (!val && this._ssao) {
      this._ssao.dispose()
      this._ssao = null
    }
  }

  private _lensFocusDistance = 20
  get lensFocusDistance() {
    return this._lensFocusDistance
  }
  set lensFocusDistance(val) {
    if (val !== this._lensFocusDistance) {
      this._lensRendering && this._lensRendering.setFocusDistance(val)
      this._lensFocusDistance = val
    }
  }

  private _lensRendering: LensRenderingPipeline
  get enableLensRendering() {
    return !!this._lensRendering
  }
  set enableLensRendering(val: boolean) {
    if (val && !this._lensRendering) {
      this._lensRendering = new LensRenderingPipeline('lensEffects', {
        edge_blur: 1.0,
        chromatic_aberration: 1.0,
        distortion: 1.0,
        dof_focus_distance: this._lensFocusDistance = this.camera.radius,
        dof_aperture: 2.0,
        grain_amount: 1.0,
        dof_pentagon: true,
        dof_gain: 1.0,
        dof_threshold: 1.0,
        dof_darken: 0.1
      }, this.scene, 1.0, [this.camera])
    }
    else if (!val && this._lensRendering) {
      // FIXME
      const hasSSAO = this.enableSSAO
      if (hasSSAO) {
        this.enableSSAO = false
      }

      // FIXME: have to disable effects before disposing
      this.scene.postProcessRenderPipelineManager.disableEffectInPipeline('lensEffects', this._lensRendering.HighlightsEnhancingEffect, this.scene.cameras)
      this.scene.postProcessRenderPipelineManager.disableEffectInPipeline('lensEffects', this._lensRendering.LensChromaticAberrationEffect, this.scene.cameras)
      this.scene.postProcessRenderPipelineManager.disableEffectInPipeline('lensEffects', this._lensRendering.LensDepthOfFieldEffect, this.scene.cameras)

      this._lensRendering.dispose(true)
      this._lensRendering = null

      if (hasSSAO) {
        this.enableSSAO = true
      }
    }
  }

  private animations = { } as {
    [id: string]: {
      object: any,
      key: string,
      target: number,
      step: number
    }
  }
  private updateAnimation() {
    Object.keys(this.animations).forEach(id => {
      const { object, key, target, step } = this.animations[id],
        current = propGet(object, key)
      if (Math.abs(current - target) > step) {
        const next = current < target ? Math.min(target, current + step) : Math.max(target, current - step)
        propSet(object, key, next)
      }
      else {
        delete this.animations[id]
        propSet(object, key, target)
      }
    })
  }
  startAnimation(id: string, object: any, key: string, target: number, step = (target - propGet(object, key)) / 100) {
    this.animations[id] = { object, key, target, step }
  }
  stopAnimation(id: string) {
    delete this.animations[id]
  }

  static async load(onProgress: (index: number, total: number, progress: number) => void) {
    const game = new Game(),
      plugins = await loadAllPlugins()

    const materials = { } as { [key: string]: { material: Material, src: HTMLImageElement, texSize: number } },
      imageIds = Object.keys(plugins.images), total = imageIds.length
    for (let index = 0; index < total; index ++) {
      const id = imageIds[index]
      let blob = await loadBlobWithXHR(plugins.images[id], progress => onProgress(index, total, progress)),
        src = await readBlob(blob, 'objectURL')

      let img: HTMLImageElement
      await new Promise<HTMLImageElement>((onload, onerror) => {
        img = createElement('img', { id, src, onload, onerror }) as HTMLImageElement
      })

      const texSize = 2 ** Math.ceil(Math.log2(Math.max(img.width, img.height)))
      if (img.width !== texSize || img.height !== texSize) {
        const canvas = document.createElement('canvas') as HTMLCanvasElement
        canvas.width = canvas.height = texSize
        canvas.getContext('2d').drawImage(img, 0, 0)
        blob = await new Promise<Blob>(resolve => canvas.toBlob(resolve))
        src = await readBlob(blob, 'objectURL')
      }

      let texture: Texture
      await new Promise<Texture>((resolve, reject) => {
        texture = new Texture(src, game.scene, false, true,
          Texture.NEAREST_SAMPLINGMODE, resolve, reject)
      })
      texture.hasAlpha = true

      const material = new StandardMaterial(id + '/mat', game.scene)
      material.disableLighting = true
      material.emissiveColor = Color3.White()
      material.diffuseTexture = texture
      material.backFaceCulling = false

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
        opts = { icon, clock: game, source: null as Mesh }
      game._classes[clsId] = { cls, args, opts }
      return { clsId, clsName, src, offsetX, offsetY, width, height, args, ...uiArgs }
    })

    game._assets = { tiles, classes }
    return game
  }
}
