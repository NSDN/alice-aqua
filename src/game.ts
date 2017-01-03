import Sprite from './objs/sprite'
import Slope from './objs/slope'
import Gate from './objs/gate'
import Trigger from './objs/trigger'
import Box, { BoxGenerator } from './objs/box'
import Player, { PlayerGenerator } from './objs/player'

import {
  Engine,
  Scene,
  Vector3,
  ScreenSpaceCanvas2D,
  Color3,
  Mesh,
  Material,
  Texture,
  StandardMaterial,
  DynamicTexture,
} from './babylon'

import {
  debounce,
  EventEmitter,
} from './utils'

import {
  appendElement,
  LocationSearch,
} from './utils/dom'

import Chunks, {
  SaveData as ChunkSaveData
} from './utils/chunks'

import {
  FollowCamera,
  getPlaneVertexDataFromRegion,
} from './utils/babylon'

import ObjectBase from './objs/object-base'

export interface ObjectSaveData {
  x: number,
  y: number,
  z: number,
  clsId: number,
  args: any,
}

export interface SavedMap {
  chunksData: { [chunkId: string]: ChunkSaveData }
  objectsData: { [objectId: string]: ObjectSaveData }
}

const OBJECT_CLASSES = {
  sprite: Sprite,
  slope: Slope,
  gate: Gate,
  box: BoxGenerator,
  trigger: Trigger,
  player: PlayerGenerator,
}

export const TAGS = {
  object: 'tag-object',
  block: 'tag-block',
}

export const ASSET_IMAGES = {
  imAssetTile1: 'assets/rpg_maker_vx_rtp_tileset_by_telles0808.png',
  objectIcons1: 'assets/object_icons.png',
}

export const ASSET_TILES: [number, keyof typeof ASSET_IMAGES, number, number, number, boolean][] = [
  [ 2, 'imAssetTile1',    0,  576, 32, true],
  [ 3, 'imAssetTile1',    0,  480, 32, true],
  [ 4, 'imAssetTile1',   64,  480, 32, true],
  [ 5, 'imAssetTile1',   64,  576, 32, true],
  [ 6, 'imAssetTile1',  256, 1088, 32, true],
  [ 7, 'imAssetTile1',  384, 1088, 32, true],
  [ 8, 'imAssetTile1',  256, 1184, 32, true],
  [ 9, 'imAssetTile1',  384, 1184, 32, true],
  [10, 'imAssetTile1',  512,    0, 32, true],
  [11, 'imAssetTile1',  576,    0, 32, true],
  [12, 'imAssetTile1',  640,    0, 32, true],
  [13, 'imAssetTile1',  704,    0, 32, true],
  [14, 'imAssetTile1',  768,    0, 32, true],
  [15, 'imAssetTile1',  832,    0, 32, true],
  [16, 'imAssetTile1',  896,    0, 32, true],
  [17, 'imAssetTile1',  960,    0, 32, true],
  [18, 'imAssetTile1',  512,  160, 32, true],
  [19, 'imAssetTile1',  576,  160, 32, true],
  [20, 'imAssetTile1',  640,  160, 32, true],
  [21, 'imAssetTile1',  704,  160, 32, true],
  [22, 'imAssetTile1',  768,  160, 32, true],
  [23, 'imAssetTile1',  832,  160, 32, true],
  [24, 'imAssetTile1',  896,  160, 32, true],
  [25, 'imAssetTile1',  960,  160, 32, true],
  [26, 'imAssetTile1',  512,  320, 32, true],
  [27, 'imAssetTile1',  576,  320, 32, true],
  [28, 'imAssetTile1',  640,  320, 32, true],
  [29, 'imAssetTile1',  704,  320, 32, true],
  [30, 'imAssetTile1',  768,  320, 32, true],
  [31, 'imAssetTile1',  832,  320, 32, true],
  [32, 'imAssetTile1',  896,  320, 32, true],
  [33, 'imAssetTile1',  960,  320, 32, true],
]

export const ASSET_CLASSES: [number, keyof typeof ASSET_IMAGES, number, number, number, number, keyof typeof OBJECT_CLASSES, any][] = [
  [ 0, 'imAssetTile1',  96, 1632, 64, 96, 'sprite', { spriteHeight: 4 }],
  [ 1, 'imAssetTile1',   0, 1440, 64, 64, 'sprite', { spriteHeight: 4 }],
  [ 2, 'imAssetTile1',   0, 1504, 64, 64, 'sprite', { spriteHeight: 4 }],
  [ 3, 'imAssetTile1', 192, 1344, 64, 64, 'sprite', { spriteHeight: 4 }],
  [ 4, 'imAssetTile1', 512,  256, 64, 64, 'box',    { spriteHeight: 2, boxMass: 5 }],
  [33, 'imAssetTile1', 768,   32, 64, 64, 'box',    { spriteHeight: 2, boxMass: 50, velocityThreshold: 0.5 }],
  [ 5, 'imAssetTile1', 160, 1024, 32, 64, 'sprite', { spriteHeight: 4 }],
  [ 6, 'imAssetTile1', 128, 1120, 32, 64, 'sprite', { spriteHeight: 4 }],
  [ 7, 'imAssetTile1',   0, 1120, 32, 64, 'sprite', { spriteHeight: 4 }],
  [ 8, 'imAssetTile1', 160, 1408, 32, 64, 'sprite', { spriteHeight: 4 }],
  [ 9, 'imAssetTile1',  64, 1408, 32, 64, 'sprite', { spriteHeight: 4 }],
  [10, 'imAssetTile1',   0, 1376, 32, 32, 'sprite', { spriteHeight: 1 }],
  [11, 'imAssetTile1',  32, 1376, 32, 32, 'sprite', { spriteHeight: 1 }],
  [12, 'imAssetTile1',   0, 1408, 32, 32, 'sprite', { spriteHeight: 1 }],
  [13, 'imAssetTile1',   0,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  [14, 'imAssetTile1',  32,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  [15, 'imAssetTile1', 288,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  [16, 'imAssetTile1', 320,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  [17, 'imAssetTile1',   0, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  [18, 'imAssetTile1',  32, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  [19, 'imAssetTile1',  64, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  [20, 'imAssetTile1',  96, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  [21, 'imAssetTile1', 128, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  [22, 'imAssetTile1', 160, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  [23, 'imAssetTile1', 160, 1632, 32, 32, 'sprite', { spriteHeight: 1 }],
  [24, 'imAssetTile1', 192, 1632, 32, 32, 'sprite', { spriteHeight: 1 }],
  [25, 'imAssetTile1', 224, 1632, 32, 32, 'sprite', { spriteHeight: 1 }],
  [26, 'imAssetTile1', 160, 1664, 32, 32, 'sprite', { spriteHeight: 1 }],
  [27, 'imAssetTile1', 160, 1696, 32, 32, 'sprite', { spriteHeight: 1 }],
  [28, 'imAssetTile1',   0,   32, 32, 32, 'gate',    { }],
  [29, 'imAssetTile1',   0,   32, 32, 32, 'slope',   { }],
  [30, 'objectIcons1',  64,    0, 32, 32, 'trigger', { listenTags: [Box.BOX_TAG, Player.PLAYER_BODY_TAG] }],
  [31, 'objectIcons1',   0,    0, 32, 32, 'player',  { playerName: 'remilia' }],
  [32, 'objectIcons1',  32,    0, 32, 32, 'player',  { playerName: 'flandre' }],
]

export const KEY_MAP = {
  retKey: 13,
  shiftKey: 16,
  ctrlKey: 17,
  delKey: 46,

  focus: 'F',
  undo: 'Z',
  redo: 'Y',

  moveForward: 'W',
  moveBack: 'S',
  moveLeft: 'A',
  moveRight: 'D',
  jump: ' ',
  crunch: 'C',
  switch: 'Q',
  use: 'E'
}

const SKY_THEME_COLOR = Color3.FromHexString('#607f9a').scale(0.7),
  SKY_TOP_COLOR = Color3.White(),
  // WATER_THEME_COLOR = Color3.FromHexString('#6197ce'),
  SKY_COLOR_GRADS = [
    // from bottom to top
    [0.0, SKY_THEME_COLOR.scale(0.3)],
    [0.4, SKY_THEME_COLOR],
    [0.7, SKY_TOP_COLOR],
    [1.0, SKY_TOP_COLOR],
  ] as [number, Color3][]

type KeyType = keyof typeof KEY_MAP

export function createFpsCounter(n = 30) {
  let a = Array(n).fill(0), c = 0
  return () => {
    const i = c,
      j = (c + 1) % a.length,
      t = (a[i] - a[j]) / (a.length - 1)
    a[c = j] = Date.now()
    return 1000 / t
  }
}

export function createScene() {
  const attrs = { className: 'full-size', tabIndex: -1 },
    elem = appendElement('canvas', attrs) as HTMLCanvasElement,
    engine = new Engine(elem, true),
    scene = new Scene(engine)

  scene.enablePhysics(new Vector3(0, -3, 0))
  scene.workerCollisions = true
  scene.clearColor = SKY_THEME_COLOR

  engine.runRenderLoop(() => {
    scene.render()
  })
  window.addEventListener('resize', () => {
    engine.resize()
  })

  const camera = scene.activeCamera = new FollowCamera('camera', 0, 0, 50, Vector3.Zero(), scene)
  camera.lowerRadiusLimit = 20
  camera.upperRadiusLimit = 100
  camera.lowerBetaLimit = Math.PI * 0.15
  camera.upperBetaLimit = Math.PI * 0.45

  const canvas2d = new ScreenSpaceCanvas2D(scene)

  return { scene, camera, canvas2d }
}

export function createKeyStates() {
  const nameOfKeyCode = { } as { [key: number]: KeyType }
  for (const str in KEY_MAP) {
    const key = str as KeyType,
      val = KEY_MAP[key],
      name = typeof val === 'string' ? val.charCodeAt(0) : val
    nameOfKeyCode[name] = key
  }

  const keys = Object.assign(new EventEmitter<{
    'change': KeyType,
    'down': KeyType,
    'up': KeyType,
  }>(), { } as { [P in KeyType]: boolean })

  window.addEventListener('keydown', evt => {
    const name = nameOfKeyCode[evt.which]
    keys[name] = true
    keys.emit('down', name)
    keys.emit('change', name)
  })
  window.addEventListener('keyup', evt => {
    const name = nameOfKeyCode[evt.which]
    keys[name] = false
    keys.emit('up', name)
    keys.emit('change', name)
  })

  return { keys }
}

const random = (b, e) => Math.random() * (e - b) + b

function createSkyClouds(box: Mesh) {
  const scene = box.getScene(),
    cloud = new Mesh('cache/sky/cloud', scene),
    region = { offsetX: 1, offsetY: 0, width: 174, height: 143 }
  getPlaneVertexDataFromRegion(512, region).applyToMesh(cloud)
  cloud.isVisible = false
  const cloudMaterial = cloud.material = new StandardMaterial('cloud', scene)
  cloudMaterial.disableLighting = true
  cloudMaterial.emissiveColor = Color3.Lerp(SKY_THEME_COLOR, Color3.White(), 0.7)
  const cloudTexture = cloudMaterial.diffuseTexture = new Texture('assets/clouds.png', scene)
  cloudTexture.hasAlpha = true

  const clouds = Array(20).fill(0).map((_, i) => {
    const c = cloud.createInstance('sky/cloud/' + i),
      r = random(0.6, 0.9) * 0.5,
      y = random(0.1, 1.0) * 0.1,
      q = Math.sqrt(r * r - y * y),
      v = random(0.1, 1.0) * 0.001,
      t = random(0.0, 100),
      w = random(0.1, 0.3),
      h = random(0.02, 0.08)
    c.scaling.copyFromFloats(w, h, 1)
    c.parent = box
    return { c, y, q, t, v }
  })

  return clouds
}

function createSkyFarMountains(box: Mesh) {
  const scene = box.getScene(),
    mounts = Mesh.CreateTube('sky/mounts',
      [Vector3.Zero(), Vector3.Up()], 1, 16, null, Mesh.NO_CAP, scene, false, Mesh.BACKSIDE),
    r = 0.8 * 0.5,
    h = Math.sqrt(0.5 * 0.5 - r * r) * 0.8 * 2
  mounts.scaling.copyFromFloats(r, h, r)
  mounts.position.y = -h / 2
  mounts.parent = box

  const material = mounts.material = new StandardMaterial('sky/mounts', scene)
  material.disableLighting = true
  material.emissiveColor = SKY_THEME_COLOR

  const size = 256,
    texture = material.diffuseTexture =
      new DynamicTexture('sky/mounts', size, scene, false, Texture.NEAREST_SAMPLINGMODE),
    dc = texture.getContext()
  dc.fillStyle = '#ffffff'
  dc.strokeStyle = '#dddddd'
  dc.fillRect(0, 0.7 * size, size, size)
  Array(30).fill(0).forEach(_ => {
    const x = random(0, size),
      y = random(0.2, 0.5) * size,
      w = random(0.02, 0.04) * size
    dc.fillRect(x, y, w, size - y)
    dc.strokeRect(x, y, w, size)
  })
  texture.hasAlpha = true
  texture.update()

  return mounts
}

/*
export function createWater(box: Mesh) {
  const scene = box.getScene()

  const water = new Mesh('sky/water', scene)
  VERTEX_GROUND.applyToMesh(water)
  water.scaling.copyFromFloats(box.scaling.x, 1, box.scaling.z)
  water.position.y = 0.8
  water.visibility = 0.3

  const material = water.material = new StandardMaterial('sky/water', scene)
  material.disableLighting = true
  material.emissiveColor = WATER_THEME_COLOR
  const bump = material.bumpTexture = new Texture('assets/waterbump.png', scene)
  bump.uScale = bump.vScale = 1 / 16
  bump.level = 0.2

  return water
}
*/

export function createSkyBox(scene: Scene) {
  const box = Mesh.CreateSphere('skybox', 3, 1, scene, false, Mesh.BACKSIDE)
  box.scaling.scaleInPlace(256)

  const material = box.material = new StandardMaterial('skybox', scene)
  material.emissiveColor = Color3.White()
  material.disableLighting = true

  const size = 64,
    texture = material.diffuseTexture = new DynamicTexture('skytex', size, scene, false),
    dc = texture.getContext(),
    grad = dc.createLinearGradient(0, 0, 0, texture.getSize().width)
  SKY_COLOR_GRADS.forEach(([pos, color]) => grad.addColorStop(pos, color.toHexString()))
  dc.fillStyle = grad
  dc.fillRect(0, 0, size, size)
  texture.update()

  const clouds = createSkyClouds(box),
    mounts = createSkyFarMountains(box)

  box.registerAfterRender(_ => {
    const { x, z } = (scene.activeCamera as FollowCamera).target.multiplyByFloats(1, 0, 1)
    box.position.x = x
    box.position.z = z
    clouds.forEach(d => {
      d.c.position.copyFromFloats(d.q * Math.sin(d.t), d.y, d.q * Math.cos(d.t))
      d.c.rotation.y = d.t
      d.t += d.v
    })
  })

  const ret = {
    box,
    setIsVisible(isVisible: boolean) {
      box.isVisible = isVisible
      mounts.isVisible = isVisible
      clouds.forEach(d => d.c.isVisible = isVisible)
    }
  }
  ret.setIsVisible(false)
  return ret
}

export async function loadAssets(scene: Scene) {
  const materials = { } as { [key: string]: { material: Material, texSize: number } }
  for (const id in ASSET_IMAGES) {
    const src = ASSET_IMAGES[id as keyof typeof ASSET_IMAGES],
      style = { display: 'none' }
    await new Promise((onload, onerror) => appendElement('img', { src, style, id, onload, onerror }))

    const img = document.getElementById(id) as HTMLImageElement,
      texSize = 2 ** Math.ceil(Math.log2(Math.max(img.width, img.height))),
      canvas = document.createElement('canvas') as HTMLCanvasElement
    canvas.width = canvas.height = texSize
    canvas.getContext('2d').drawImage(img, 0, 0)

    const texture = Texture.CreateFromBase64String(canvas.toDataURL(),
      id, scene, false, true, Texture.NEAREST_SAMPLINGMODE)
    texture.hasAlpha = true

    const material = new StandardMaterial(id + '/mat', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()
    material.diffuseTexture = texture
    materials[id] = { material, texSize }
  }

  const tiles = ASSET_TILES.map(([tileId, srcId, offsetX, offsetY, size, isAutoTile]) => {
    const src = document.getElementById(srcId) as HTMLImageElement
    return { tileId, src, offsetX, offsetY, size, isAutoTile }
  })

  const classes = ASSET_CLASSES.map(([clsId, srcId, offsetX, offsetY, width, height, clsName, args]) => {
    const src = document.getElementById(srcId) as HTMLImageElement,
      cls = OBJECT_CLASSES[clsName] as typeof ObjectBase,
      { material, texSize } = materials[srcId],
      icon = { material, offsetX, offsetY, width, height, texSize }
    return { clsName, clsId, src, args, icon, cls }
  })

  return { tiles, classes }
}

export async function loadSavedMap() {
  const toJSON = function(chunks: Chunks) {
    const chunksData = chunks.serialize(),
      objectsData = savedMap.objectsData
    chunks.scene.getMeshesByTags(TAGS.object).forEach(obj => {
      const { clsId, args } = objectsData[obj.name],
        { x, y, z } = obj.position
      objectsData[obj.name] = { args, clsId, x, y, z }
    })
    return JSON.stringify({ objectsData, chunksData })
  }

  const saveDebounced = debounce((chunks: Chunks) => {
    const dataToSave = toJSON(chunks)
    localStorage.setItem('saved-map', dataToSave)
    console.log(`save chunk data ok (${dataToSave.length} bytes)`)
  }, 1000)

  const reset = () => {
    localStorage.setItem('saved-map', '{}')
  }

  let dataToLoad: string
  if (dataToLoad = LocationSearch.get('projSavedMap')) {
    console.log(`loaded from query string (${dataToLoad.length} bytes)`)
    history.pushState('', document.title, LocationSearch.get('projRestoreURL'))
    localStorage.setItem('saved-map', dataToLoad)
  }
  else if (dataToLoad = localStorage.getItem('saved-map')) {
    console.log(`loaded from localStorage (${dataToLoad.length} bytes)`)
  }

  let savedMap: SavedMap
  try {
    savedMap = JSON.parse(dataToLoad)
  }
  catch (err) {
    savedMap = { } as SavedMap
  }

  return { saveDebounced, reset, toJSON, ...savedMap }
}
