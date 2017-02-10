import Sprite from '../objs/sprite'
import Slope from '../objs/slope'
import Gate from '../objs/gate'
import Trigger from '../objs/trigger'
import Jump from '../objs/jump'
import Block from '../objs/block'
import Box, { BoxGenerator } from '../objs/box'
import Player, { PlayerGenerator } from '../objs/player'
import { ChunkRestoreData } from '../game/chunks'
import { StageEntry, StageLoader } from '../objs/stage'

import {
  Engine,
  Scene,
  Vector3,
  ScreenSpaceCanvas2D,
  Color3,
  Material,
  Texture,
  StandardMaterial,
} from '../babylon'

import {
  appendElement,
  loadDataURLWithXHR,
} from '../utils/dom'

import {
  FollowCamera,
} from '../utils/babylon'

export interface ObjectSaveData {
  x: number,
  y: number,
  z: number,
  clsId: number,
  args: any,
}

export interface SavedMap {
  chunksData: ChunkRestoreData
  objectsData: { [objectId: string]: ObjectSaveData }
}

const OBJECT_CLASSES = {
  sprite: Sprite,
  slope: Slope,
  gate: Gate,
  box: BoxGenerator,
  trigger: Trigger,
  jump: Jump,
  player: PlayerGenerator,
  block: Block,
  stageEntry: StageEntry,
  stageLoader: StageLoader,
}

export const ASSET_IMAGES = {
  imAssetTile1: 'assets/rpg_maker_vx_rtp_tileset_by_telles0808.png',
  imAssetTile2: 'assets/tileset_pokemon_rpgmaker_xp_by_kutoal-d59p9c9.png',
}

export const ASSET_TILES: [number, keyof typeof ASSET_IMAGES, number, number, number, string][] = [
  [ 2, 'imAssetTile1',    0,  576, 32, 'h4x6'],
  [ 3, 'imAssetTile1',    0,  480, 32, 'h4x6'],
  [ 4, 'imAssetTile1',   64,  480, 32, 'h4x6'],
  [ 5, 'imAssetTile1',   64,  576, 32, 'h4x6'],
  [ 6, 'imAssetTile1',  256, 1088, 32, 'h4x6'],
  [ 7, 'imAssetTile1',  384, 1088, 32, 'h4x6'],
  [ 8, 'imAssetTile1',  256, 1184, 32, 'h4x6'],
  [ 9, 'imAssetTile1',  384, 1184, 32, 'h4x6'],
  [10, 'imAssetTile1',  512,    0, 32, 'h4x6'],
  [11, 'imAssetTile1',  576,    0, 32, 'h4x6'],
  [12, 'imAssetTile1',  640,    0, 32, 'h4x6'],
  [13, 'imAssetTile1',  704,    0, 32, 'h4x6'],
  [14, 'imAssetTile1',  768,    0, 32, 'h4x6'],
  [15, 'imAssetTile1',  832,    0, 32, 'h4x6'],
  [16, 'imAssetTile1',  896,    0, 32, 'h4x6'],
  [17, 'imAssetTile1',  960,    0, 32, 'h4x6'],
  [18, 'imAssetTile1',  512,  160, 32, 'h4x6'],
  [19, 'imAssetTile1',  576,  160, 32, 'h4x6'],
  [20, 'imAssetTile1',  640,  160, 32, 'h4x6'],
  [21, 'imAssetTile1',  704,  160, 32, 'h4x6'],
  [22, 'imAssetTile1',  768,  160, 32, 'h4x6'],
  [23, 'imAssetTile1',  832,  160, 32, 'h4x6'],
  [24, 'imAssetTile1',  896,  160, 32, 'h4x6'],
  [25, 'imAssetTile1',  960,  160, 32, 'h4x6'],
  [26, 'imAssetTile1',  512,  320, 32, 'h4x6'],
  [27, 'imAssetTile1',  576,  320, 32, 'h4x6'],
  [28, 'imAssetTile1',  640,  320, 32, 'h4x6'],
  [29, 'imAssetTile1',  704,  320, 32, 'h4x6'],
  [30, 'imAssetTile1',  768,  320, 32, 'h4x6'],
  [31, 'imAssetTile1',  832,  320, 32, 'h4x6'],
  [32, 'imAssetTile1',  896,  320, 32, 'h4x6'],
  [33, 'imAssetTile1',  960,  320, 32, 'h4x6'],
  [56, 'imAssetTile2',  208,  720, 32, ''],
  [34, 'imAssetTile2',    0,  704, 32, 'h5x3'],
  [36, 'imAssetTile2',    0,  800, 32, 'h5x3'],
  [40, 'imAssetTile2',    0,  656, 32, 'h5x3'],
  [41, 'imAssetTile2',    0,  752, 32, 'h5x3'],
  [54, 'imAssetTile2',  128,  656, 32, 'h5x3'],
  [46, 'imAssetTile2',  128,    0, 32, 'h5x3'],
  [35, 'imAssetTile2',  128,   48, 32, 'h5x3'],
  [47, 'imAssetTile2',  128,   96, 32, 'h5x3'],
  [48, 'imAssetTile2',  128,  144, 32, 'h5x3'],
  [50, 'imAssetTile2',  128,  240, 32, 'h5x3'],
  /*
  [57, 'imAssetTile2',  112,  624, 32, ''],
  [43, 'imAssetTile2',    0,  896, 32, 'h5x3'],
  [55, 'imAssetTile2',  128,  704, 32, 'h5x3'],
  */
  [58, 'imAssetTile2',  176,  992, 32, ''],
  [59, 'imAssetTile2',  208,  800, 32, ''],
  [52, 'imAssetTile2',  128,  800, 32, 'h5x3'],
  [53, 'imAssetTile2',  128,  944, 32, 'h5x3'],
  /*
  [51, 'imAssetTile2',  128,  288, 32, 'h5x3'],
  [37, 'imAssetTile2',    0,  384, 32, 'h5x3'],
  [38, 'imAssetTile2',    0,  432, 32, 'h5x3'],
  [39, 'imAssetTile2',    0,  480, 32, 'h5x3'],
  [44, 'imAssetTile2',    0,  944, 32, 'h5x3'],
  */
]

export const ASSET_CLASSES: [number, keyof typeof ASSET_IMAGES, number, number, number, number, keyof typeof OBJECT_CLASSES, any, any][] = [
  [ 0, 'imAssetTile1',   96, 1632, 64, 96, 'sprite', { spriteHeight: 4 }, { }],
  [ 1, 'imAssetTile1',    0, 1440, 64, 64, 'sprite', { spriteHeight: 4 }, { }],
  [ 2, 'imAssetTile1',    0, 1504, 64, 64, 'sprite', { spriteHeight: 4 }, { }],
  [ 3, 'imAssetTile1',  192, 1344, 64, 64, 'sprite', { spriteHeight: 4 }, { }],
  [ 4, 'imAssetTile1',  512,  256, 64, 64, 'box',    { spriteHeight: 2, boxMass: 5 }, { }],
  [33, 'imAssetTile1',  768,   32, 64, 64, 'box',    { spriteHeight: 2, boxMass: 20, velocityThreshold: 0.5 }, { }],
  [ 5, 'imAssetTile1',  160, 1024, 32, 64, 'sprite', { spriteHeight: 4 }, { }],
  [ 6, 'imAssetTile1',  128, 1120, 32, 64, 'sprite', { spriteHeight: 4 }, { }],
  [ 7, 'imAssetTile1',    0, 1120, 32, 64, 'sprite', { spriteHeight: 4 }, { }],
  [ 8, 'imAssetTile1',  160, 1408, 32, 64, 'sprite', { spriteHeight: 4 }, { }],
  [ 9, 'imAssetTile1',   64, 1408, 32, 64, 'sprite', { spriteHeight: 4 }, { }],
  [10, 'imAssetTile1',    0, 1376, 32, 32, 'sprite', { }, { }],
  [11, 'imAssetTile1',   32, 1376, 32, 32, 'sprite', { }, { }],
  [12, 'imAssetTile1',    0, 1408, 32, 32, 'sprite', { }, { }],
  [13, 'imAssetTile1',    0,  992, 32, 32, 'sprite', { }, { }],
  [14, 'imAssetTile1',   32,  992, 32, 32, 'sprite', { }, { }],
  [15, 'imAssetTile1',  288,  992, 32, 32, 'sprite', { }, { }],
  [16, 'imAssetTile1',  320,  992, 32, 32, 'sprite', { }, { }],
  [17, 'imAssetTile1',    0, 1344, 32, 32, 'sprite', { }, { }],
  [18, 'imAssetTile1',   32, 1344, 32, 32, 'sprite', { }, { }],
  [19, 'imAssetTile1',   64, 1344, 32, 32, 'sprite', { }, { }],
  [20, 'imAssetTile1',   96, 1344, 32, 32, 'sprite', { }, { }],
  [21, 'imAssetTile1',  128, 1344, 32, 32, 'sprite', { }, { }],
  [22, 'imAssetTile1',  160, 1344, 32, 32, 'sprite', { }, { }],
  [23, 'imAssetTile1',  160, 1632, 32, 32, 'sprite', { }, { }],
  [24, 'imAssetTile1',  192, 1632, 32, 32, 'sprite', { }, { }],
  [25, 'imAssetTile1',  224, 1632, 32, 32, 'sprite', { }, { }],
  [26, 'imAssetTile1',  160, 1664, 32, 32, 'sprite', { }, { }],
  [27, 'imAssetTile1',  160, 1696, 32, 32, 'sprite', { }, { }],
  [28, 'imAssetTile1', 1024,    0, 32, 32, 'gate',    { }, { title: '可触发的门' }],
  [29, 'imAssetTile1', 1056,    0, 32, 32, 'slope',   { }, { title: '两个 slope 相连形成斜坡' }],
  [36, 'imAssetTile1', 1088,    0, 32, 32, 'block',   { }, { title: '可触发移动的方块' }],
  [34, 'imAssetTile1', 1120,    0, 32, 32, 'jump',    { listenTags: [Player.PLAYER_TAG] }, { title: '跳！' }],
  [30, 'imAssetTile1', 1152,    0, 32, 32, 'trigger', { listenTags: [Player.PLAYER_TAG, Box.BOX_TAG] }, { title: '触发器' }],
  [35, 'imAssetTile1', 1248,    0, 32, 32, 'stageLoader', { editorSingletonId: 'stage/loader' }, { title: '在此载入新关卡' }],
  [37, 'imAssetTile1', 1280,    0, 32, 32, 'stageEntry',  { editorSingletonId: 'stage/entry'  }, { title: '关卡载入时使用的原点' }],
  [31, 'imAssetTile1', 1184,    0, 32, 32, 'player',      { editorSingletonId: 'player/remilia', playerName: 'remilia' }, { }],
  [32, 'imAssetTile1', 1216,    0, 32, 32, 'player',      { editorSingletonId: 'player/flandre', playerName: 'flandre' }, { }],
]

export function createScene() {
  const attrs = { style: { width: '100%', height: '100%' }, tabIndex: -1 },
    elem = appendElement('canvas', attrs) as HTMLCanvasElement,
    engine = new Engine(elem, true),
    scene = new Scene(engine)

  scene.enablePhysics(new Vector3(0, -3, 0))
  scene.workerCollisions = true
  scene.clearColor = Color3.FromHexString('#607f9a').scale(0.7).toColor4()

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
  camera.attachControl(elem, true)
  camera.keysUp = camera.keysDown = camera.keysLeft = camera.keysRight = [ ]

  let pauseTick = 0
  const ctrl = {
    isPaused() {
      return pauseTick !== 0
    },
    pause() {
      if (pauseTick === 0) {
        pauseTick = Date.now()
        engine.stopRenderLoop()
      }
    },
    resume() {
      if (pauseTick) {
        timerOffset += Date.now() - pauseTick
        pauseTick = 0
        engine.runRenderLoop(() => scene.render())
      }
    }
  }

  let timerOffset = Date.now(),
    timers = [ ] as [Function, number][]
  const clock = {
    now() {
      return Date.now() - timerOffset
    },
    timeout(fn: Function, delay: number) {
      const until = clock.now() + delay,
        timer = [fn, until] as [Function, number]
      timers.push(timer)
      timers.sort((a, b) => a[1] - b[1])
      return () => timers.splice(timers.indexOf(timer), 1)
    },
  }

  scene.registerAfterRender(() => {
    const tick = clock.now()
    if (timers.length && tick > timers[0][1]) {
      timers = timers.filter(([fn, until]) => until > tick || (fn(), false))
    }
  })

  const canvas2d = new ScreenSpaceCanvas2D(scene)

  return { scene, camera, canvas2d, ctrl, clock }
}

export async function loadAssets(scene: Scene,
    onProgress?: (index: number, total: number, progress: number) => void) {
  const materials = { } as { [key: string]: { material: Material, texSize: number } },
    ids = Object.keys(ASSET_IMAGES)
  for (let i = 0; i < ids.length; i ++) {
    const id = ids[i],
      url = ASSET_IMAGES[id as keyof typeof ASSET_IMAGES],
      src = await loadDataURLWithXHR(url, progress => onProgress(i, ids.length, progress)),
      img = appendElement('img', { id, src }) as HTMLImageElement,
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
        id, scene, false, true, Texture.NEAREST_SAMPLINGMODE, resolve, reject)
    })
    texture.hasAlpha = true

    const material = new StandardMaterial(id + '/mat', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()
    material.diffuseTexture = texture
    materials[id] = { material, texSize }
  }

  const tiles = ASSET_TILES.map(([tileId, srcId, offsetX, offsetY, size, autoTileType]) => {
    const src = document.getElementById(srcId) as HTMLImageElement
    return { tileId, src, offsetX, offsetY, size, autoTileType }
  })

  const classes = ASSET_CLASSES.map(([clsId, srcId, offsetX, offsetY, width, height, clsName, args, editorClass]) => {
    const src = document.getElementById(srcId) as HTMLImageElement,
      cls = OBJECT_CLASSES[clsName],
      { material, texSize } = materials[srcId],
      icon = { material, offsetX, offsetY, width, height, texSize },
      ui = { clsId, clsName, src, offsetX, offsetY, width, height, ...editorClass }
    return { cls, clsName, clsId, args, icon, ui }
  })

  return { tiles, classes }
}
