import Sprite from './objs/sprite'
import Slope from './objs/slope'
import ObjectGenerator from './objs/object-generator'

import {
  Engine,
  Scene,
  ScreenSpaceCanvas2D,
  Vector3,
  ArcRotateCamera,
  SSAORenderingPipeline,
  LinesMesh,
  Color3,
  Mesh,
  Material,
  Texture,
  StandardMaterial,
} from './babylon'

import {
  debounce,
} from './utils'

import {
  appendElement,
  LocationSearch,
} from './utils/dom'

import Chunks, {
  ChunkData,
  SaveData as ChunkSaveData
} from './utils/chunks'

import {
  getBoundingVertexData,
  VERTEX_GROUND,
  WireframeNoLightingMaterial,
} from './utils/babylon'

export interface ObjectSaveData {
  x: number,
  y: number,
  z: number,
  clsId: string,
  args: any,
}

export interface SavedMap {
  chunksData: { [chunkId: string]: ChunkSaveData }
  objectsData: { [objectId: string]: ObjectSaveData }
}

const OBJECT_CLASSES = {
  sprite: Sprite,
  slope: Slope,
  boxGen: ObjectGenerator,
}

function appendConfigItem(label: string, tag: string, attrs: any, container: HTMLElement) {
  const item = appendElement('div', { className: 'config-item' }, container)
  appendElement('label', { innerText: label }, item)
  return appendElement(tag, attrs, item)
}

const OBJECT_BINDER = {
  sprite(container: HTMLElement, sprite: Sprite, save: (args: Partial<Sprite>) => void) {
    const attrs = { type: 'range', min: 1, max: sprite.opts.height / 32 * 4, step: 1 },
      range = appendConfigItem('height: ', 'input', attrs, container) as HTMLInputElement
    range.value = sprite.spriteHeight as any
    range.addEventListener('change', evt => save({ spriteHeight: parseFloat(range.value) }))
  },
  slope(container: HTMLElement, slope: Slope, save: (args: Partial<Slope>) => void) {
    const tarSel = appendConfigItem('target: ', 'select', { }, container) as HTMLSelectElement
    appendElement('option', { innerHTML: '--', value: '' }, tarSel)
    slope.getScene().getMeshesByTags(Slope.TARGET_TAG, mesh => {
      mesh !== slope && (mesh as Slope).targetName !== slope.name &&
        appendElement('option', { innerHTML: mesh.name }, tarSel)
    })
    tarSel.value = slope.targetName
    tarSel.addEventListener('change', evt => save({ targetName: tarSel.value }))
    
    const dirSel = appendConfigItem('direction: ', 'select', { }, container) as HTMLSelectElement
    appendElement('option', { innerHTML: 'x', value: 'x' }, dirSel)
    appendElement('option', { innerHTML: 'z', value: 'z' }, dirSel)
    dirSel.value = slope.direction
    dirSel.addEventListener('change', evt => save({ direction: dirSel.value as any }))
  },
}

export const TAGS = {
  object: 'tag-object',
  block: 'tag-block',
}

export const ASSET_IMAGES: { [id: string]: string } = {
  imAssetTile1: 'assets/rpg_maker_vx_rtp_tileset_by_telles0808.png'
}

export const ASSET_TILES: [string, number, number, number, boolean][] = [
  ['imAssetTile1',   16,  624, 32, false],
  ['imAssetTile1',    0,  480, 32, true],
  ['imAssetTile1',    0,  576, 32, true],
  ['imAssetTile1',   64,  480, 32, true],
  ['imAssetTile1',   64,  576, 32, true],
  ['imAssetTile1',  256, 1088, 32, true],
  ['imAssetTile1',  384, 1088, 32, true],
  ['imAssetTile1',  256, 1184, 32, true],
  ['imAssetTile1',  384, 1184, 32, true],
  ['imAssetTile1',  512,    0, 32, true],
  ['imAssetTile1',  576,    0, 32, true],
  ['imAssetTile1',  640,    0, 32, true],
  ['imAssetTile1',  704,    0, 32, true],
  ['imAssetTile1',  768,    0, 32, true],
  ['imAssetTile1',  832,    0, 32, true],
  ['imAssetTile1',  896,    0, 32, true],
  ['imAssetTile1',  960,    0, 32, true],
  ['imAssetTile1',  512,  160, 32, true],
  ['imAssetTile1',  576,  160, 32, true],
  ['imAssetTile1',  640,  160, 32, true],
  ['imAssetTile1',  704,  160, 32, true],
  ['imAssetTile1',  768,  160, 32, true],
  ['imAssetTile1',  832,  160, 32, true],
  ['imAssetTile1',  896,  160, 32, true],
  ['imAssetTile1',  960,  160, 32, true],
  ['imAssetTile1',  512,  320, 32, true],
  ['imAssetTile1',  576,  320, 32, true],
  ['imAssetTile1',  640,  320, 32, true],
  ['imAssetTile1',  704,  320, 32, true],
  ['imAssetTile1',  768,  320, 32, true],
  ['imAssetTile1',  832,  320, 32, true],
  ['imAssetTile1',  896,  320, 32, true],
  ['imAssetTile1',  960,  320, 32, true],
  ['imAssetTile1',  256, 1440, 32, true],
  ['imAssetTile1',  320, 1440, 32, true],
  ['imAssetTile1',  384, 1440, 32, true],
  ['imAssetTile1',  448, 1440, 32, true],
]

export const ASSET_CLASSES: [string, number, number, number, number, keyof typeof OBJECT_CLASSES, any][] = [
  ['imAssetTile1',  96, 1632, 64, 96, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1',   0, 1440, 64, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1',   0, 1504, 64, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1', 192, 1344, 64, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1', 160, 1024, 32, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1', 128, 1120, 32, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1',   0, 1120, 32, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1', 160, 1408, 32, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1',  64, 1408, 32, 64, 'sprite', { spriteHeight: 4 }],
  ['imAssetTile1',   0, 1376, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',  32, 1376, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',   0, 1408, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',   0,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',  32,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 288,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 320,  992, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',   0, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',  32, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',  64, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',  96, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 128, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 160, 1344, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 160, 1632, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 192, 1632, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 224, 1632, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 160, 1664, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1', 160, 1696, 32, 32, 'sprite', { spriteHeight: 1 }],
  ['imAssetTile1',   0,   32, 32, 32, 'slope', { }],
  ['imAssetTile1',   0,   32, 32, 32, 'boxGen', { }],
]

export const KEY_MAP = {
  retKey: 13,
  shiftKey: 16,
  ctrlKey: 17,
  delKey: 46,
  moveForward: 'W',
  moveBack: 'S',
  moveLeft: 'A',
  moveRight: 'D',
  jump: ' ',
  crunch: 'C',
}

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
    scene = new Scene(engine),
    canvas = new ScreenSpaceCanvas2D(scene, { id: 'canvas' })

  scene.enablePhysics(new Vector3(0, -3, 0))
  scene.workerCollisions = true

  engine.runRenderLoop(() => {
    scene.render()
  })
  window.addEventListener('resize', () => {
    engine.resize()
  })

  const camera = scene.activeCamera = new ArcRotateCamera('camera', 0, 0, 50, null, scene)
  camera.lowerRadiusLimit = 20
  camera.upperRadiusLimit = 100
  camera.lowerBetaLimit = Math.PI * 0.15
  camera.upperBetaLimit = Math.PI * 0.45

  const ssao = new SSAORenderingPipeline('ssaopipeline', scene, 1, [camera])

  return { scene, camera }
}

export function createKeyStates() {
  const keys = { } as {
    [P in keyof typeof KEY_MAP]: boolean
  }

  const nameOfKeyCode = { } as any
  for (const key in KEY_MAP) {
    const val = KEY_MAP[key],
      name = typeof val === 'string' ? val.charCodeAt(0): val
    nameOfKeyCode[name] = key
  }

  window.addEventListener('keydown', evt => {
    (keys as any)[ nameOfKeyCode[evt.which] ] = true
  })
  window.addEventListener('keyup', evt => {
    (keys as any)[ nameOfKeyCode[evt.which] ] = false
  })

  return { keys }
}

export function createSelectionBox(scene: Scene) {
  const box = new LinesMesh('selection', scene)
  box.scaling.copyFromFloats(0, 0, 0)
  getBoundingVertexData(0.3, 0.3, 0.3, false).applyToMesh(box)
  box.color = new Color3(1, 0.5, 0.5)
  return box
}

export function createObjectFrame(scene: Scene) {
  const frame = new Mesh('cache/object/frame', scene)
  frame.isVisible = false
  VERTEX_GROUND.applyToMesh(frame)
  frame.material = new WireframeNoLightingMaterial('frame', scene, new Color3(1, 0.5, 0.5))
  return frame
}

export async function loadAssets(scene: Scene) {
  const materials = { } as { [key: string]: { material: Material, texSize: number } }
  for (const id in ASSET_IMAGES) {
    const src = ASSET_IMAGES[id], style = { display: 'none' }
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
  const tiles = ASSET_TILES.map(([srcId, offsetX, offsetY, size, isAutoTile]) => {
    const src = document.getElementById(srcId as string) as HTMLImageElement
    return { src, offsetX, offsetY, size, isAutoTile }
  })
  const classes = ASSET_CLASSES.map(([srcId, offsetX, offsetY, width, height, clsName, args]) => {
    const src = document.getElementById(srcId as string) as HTMLImageElement,
      cls = OBJECT_CLASSES[clsName],
      binder = OBJECT_BINDER[clsName],
      { material, texSize } = materials[srcId],
      opts = { clsName, src, material, offsetX, offsetY, width, height, texSize },
      clsId = [clsName, srcId, offsetX, offsetY].join('/')
    return { clsName, clsId, args, opts, cls, binder }
  })

  return { tiles, classes }
}

export async function loadSavedMap() {
  const toJSON = function(chunks: Chunks, objectsToSave: { [id: string]: ObjectSaveData }) {
    const chunksData = chunks.serialize(),
      objectsData = { } as typeof objectsToSave
    chunks.scene.getMeshesByTags(TAGS.object).forEach(obj => {
      const { clsId, args } = objectsToSave[obj.name],  
        { x, y, z } = obj.position
      objectsData[obj.name] = { args, clsId, x, y, z }
    })
    return JSON.stringify({ objectsData, chunksData })
  }

  const saveDebounced = debounce((chunks: Chunks, objectsToSave: { [id: string]: ObjectSaveData }) => {
    const dataToSave = toJSON(chunks, objectsToSave)
    localStorage.setItem('saved-map', dataToSave)
    console.log(`save chunk data ok (${dataToSave.length} bytes)`)
  }, 1000)

  const reset = () => {
    localStorage.clear()
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
