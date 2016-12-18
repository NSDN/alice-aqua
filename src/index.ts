import Player from './objs/player'
import Sprite from './objs/sprite'
import Cursor from './objs/cursor'
import Slope from './objs/slope'


import Chunks, { ChunkData, SaveData as ChunkSaveData } from './utils/chunks'

import {
  Engine,
  Scene,
  Mesh,
  ArcRotateCamera,
  Vector2,
  Vector3,
  Color3,
  Color4,
  Quaternion,
  StandardMaterial,
  ScreenSpaceCanvas2D,
  DirectionalLight,
  ShadowGenerator,
  SSAORenderingPipeline,
  Ray,
  Texture,
  BoundingBox,
  Text2D,
  Rectangle2D,
  Tags,
  LinesMesh,
  Material,
  Matrix,
} from './babylon'

import {
  UI
} from './ui'

import {
  watch,
  debounce,
} from './utils'

import {
  appendElement,
  attachDragable,
  LocationSearch,
} from './utils/dom'

import {
  WireframeNoLightingMaterial,
  getBoundingVertexData,
} from './utils/babylon'

interface ObjectSaveData {
  x: number,
  y: number,
  z: number,
  clsId: string,
  args: any,
}

interface SavedMap {
  chunksData: { [chunkId: string]: ChunkSaveData }
  objectsData: { [objectId: string]: ObjectSaveData }
}

const OBJECT_CLASSES = {
  sprite: Sprite,
  slope: Slope,
}

const OBJECT_BINDER = {
  sprite(container: HTMLElement, sprite: Sprite, save: (args: Partial<Sprite>) => void) {
    const item = appendElement('div', { className: 'config-item' }, container),
      text = appendElement('label', { innerText: 'height: ' }, item),
      attrs = { min: 1, max: sprite.opts.height / 32 * 4, step: 1 },
      range = appendElement('input', { type: 'range', ...attrs  }, item) as HTMLInputElement
    range.value = sprite.spriteHeight as any
    range.addEventListener('change', evt => {
      save({ spriteHeight: parseFloat(range.value) })
    })
  },
  slope(container: HTMLElement, slope: Slope, save: (args: Partial<Slope>) => void) {
    const item = appendElement('div', { className: 'config-item' }, container),
      text = appendElement('label', { innerText: 'target: ' }, item),
      select = appendElement('select', { }, item) as HTMLSelectElement
    appendElement('option', { innerHTML: '--', value: '' }, select)
    slope.scene.getMeshesByTags(Slope.TARGET_TAG).forEach(mesh => {
      mesh !== slope && appendElement('option', { innerHTML: mesh.name }, select)
    })
    select.value = slope.targetName
    select.addEventListener('change', evt => {
      save({ targetName: select.value })
    })
  },
} as {
  [P in keyof typeof OBJECT_CLASSES]: (container: HTMLElement, object: Mesh, save: (args: any) => void) => void
}

const TAGS = {
  object: 'tag-object',
  block: 'tag-block'
}

const ASSET_IMAGES: { [id: string]: string } = {
  imAssetTile1: 'assets/rpg_maker_vx_rtp_tileset_by_telles0808.png'
}

const ASSET_TILES: [string, number, number, number, boolean][] = [
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

const ASSET_CLASSES: [string, number, number, number, number, keyof typeof OBJECT_CLASSES, any][] = [
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
]

const KEY_MAP = {
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

function createScene() {
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

function createKeyStates() {
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

async function loadAssets(scene: Scene) {
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
      { material, texSize } = materials[srcId],
      opts = { material, offsetX, offsetY, width, height, texSize },
      def = { src, offsetX, offsetY, width, height },
      clsId = [clsName, srcId, offsetX, offsetY].join('/')
    return { clsName, clsId, args, opts, def }
  })

  return { tiles, classes }
}

async function loadSavedMap() {
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

  let dataToLoad: string
  if (dataToLoad = LocationSearch.get('projSavedMap')) {
    console.log(`loaded from query string (${dataToLoad.length} bytes)`)
    history.pushState('', document.title, LocationSearch.get('projRestoreURL'))
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

  return { saveDebounced, toJSON, ...savedMap }
}

;(async function() {
  const { scene, camera } = createScene(),
    { keys } = createKeyStates(),
    map = await loadSavedMap(),
    assets = await loadAssets(scene),
    canvas = scene.getEngine().getRenderingCanvas()

  const cursor = new Cursor('cursor', scene, (mesh: Mesh) => Tags.MatchesQuery(mesh, TAGS.block))
  // use shift to draw rectangles
  attachDragable(canvas, evt => {
    const { t, h } = ui.selectedTilePixel,
      { x, z } = cursor.hover
    selectedPixel = {
      t: t < 0 ? chunks.getPixel(x, z).t : t,
      h: h && cursor.hover.y + parseInt(h)
    }
  }, evt => {
    // ...
  }, evt => {
    const { minimum, maximum } = cursor,
      { t, h } = ui.selectedTilePixel,
      pixel = { t: selectedPixel.t, h: h && maximum.y - 1 + parseInt(h) }
    for (let m = minimum.x; m < maximum.x; m ++) {
      for (let n = minimum.z; n < maximum.z; n ++) {
        chunks.setPixel(m, n, pixel)
      }
    }
  }, evt => {
    return ui.activePanel === 'brushes' && !keys.ctrlKey && keys.shiftKey
  })

  let selectedPixel: { t: number, h: number }
  // use ctrl key to draw pixels
  attachDragable(canvas, evt => {
    const { t, h } = ui.selectedTilePixel,
      { x, z } = cursor.hover
    selectedPixel = {
      t: t < 0 ? chunks.getPixel(x, z).t : t,
      h: h && cursor.hover.y + parseInt(h)
    }
    chunks.setPixel(x, z, selectedPixel)
  }, evt => {
    const { x, z } = cursor.hover
    chunks.setPixel(x, z, selectedPixel)
  }, evt => {
    // ...
  }, evt => {
    return ui.activePanel === 'brushes' && keys.ctrlKey && !keys.shiftKey
  })

  let selectedObject: Mesh
  // use shift key to select objects
  attachDragable(canvas, evt => {
    // ...
  }, evt => {
    // ...
  }, evt => {
    const box = new BoundingBox(cursor.minimum, cursor.maximum),
      objs = scene.getMeshesByTags(TAGS.object)
    selectedObject = objs.find(mesh => box.intersectsPoint(mesh.position))
  }, evt => {
    return ui.activePanel === 'objects' && !keys.ctrlKey && keys.shiftKey
  })

  // use ctrl key to create objects
  attachDragable(canvas, evt => {
    const box = new BoundingBox(cursor.minimum, cursor.maximum),
      objs = scene.getMeshesByTags(TAGS.object)
    selectedObject = objs.find(mesh => box.intersectsPoint(mesh.position))
    if (!selectedObject) {
      const index = ui.selectedClassIndex,
        { clsId, clsName, args, opts } = assets.classes[index],
        rnd = Math.floor(Math.random() * 0xffffffff + 0x100000000).toString(16).slice(1),
        id = ['object', clsName, rnd].join('/'),
        object = new (OBJECT_CLASSES[clsName] as any)(id, scene, opts) as Mesh
      object.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0, 0.5)))
      Object.assign(object, args)
      const { x, z } = object.position
      objectsToSave[id] = JSON.parse(JSON.stringify({ x, z, clsId, args }))
      Tags.AddTagsTo(object, TAGS.object)
      if (object instanceof Slope) {
        Tags.AddTagsTo(object.getGroundMesh(), TAGS.block)
      }
      selectedObject = object
    }
  }, evt => {
    selectedObject.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0, 0.5)))
  }, evt => {
    map.saveDebounced(chunks, objectsToSave)
  }, evt => {
    return ui.activePanel === 'objects' && keys.ctrlKey && !keys.shiftKey
  })

  const chunks = new Chunks(scene, assets.tiles, map.chunksData)
  chunks.addEventListener('height-updated', (chunk: ChunkData) => {
    const pos = chunk.top.position, size = chunks.chunkSize,
      box = new BoundingBox(pos, pos.add(new Vector3(size, 0, size)))
    scene.getMeshesByTags(TAGS.object).forEach(mesh => {
      const { x, y, z } = mesh.position
      if (box.intersectsPoint(new Vector3(x, pos.y, z))) {
        const origin = new Vector3(x, y + 0.1, z),
          direction = new Vector3(0, -1, 0),
          picked = scene.pickWithRay(new Ray(origin, direction), cursor.pickFilter)
        mesh.position.y = picked.hit ? picked.pickedPoint.y : chunks.getPixel(x, z).h
      }
    })
    map.saveDebounced(chunks, objectsToSave)
  })
  chunks.addEventListener('tile-updated', () => {
    map.saveDebounced(chunks, objectsToSave)
  })

  const objectsToRestore = { ...map.objectsData },
    objectsToSave = { ...map.objectsData }
  chunks.addEventListener('chunk-loaded', (chunk: ChunkData) => {
    Tags.AddTagsTo(chunk.top, TAGS.block)
    Tags.AddTagsTo(chunk.side, TAGS.block)

    const pos = chunk.top.position, size = chunks.chunkSize,
      box = new BoundingBox(pos, pos.add(new Vector3(size, 0, size)))
    Object.keys(objectsToRestore).forEach(id => {
      const { x, y, z, clsId, args } = objectsToRestore[id],
        { clsName, opts } = assets.classes.find(s => s.clsId === clsId)
      if (box.intersectsPoint(new Vector3(x, pos.y, z))) {
        const object = new (OBJECT_CLASSES[clsName] as any)(id, scene, opts) as Mesh
        object.position.copyFromFloats(x, y, z)
        setImmediate(() => Object.assign(object, args))
        Tags.AddTagsTo(object, TAGS.object)
        if (object instanceof Slope) {
          Tags.AddTagsTo(object.getGroundMesh(), TAGS.block)
        }
        delete objectsToRestore[id]
      }
    })
  })

  const ui = new UI(assets.tiles, assets.classes.map(cls => cls.def))
  ui.addEventListener('tile-selected', () => {
    canvas.focus()
  })

  let playerObject: Player
  ui.addEventListener('panel-changed', (oldPanel: string) => {
    const tag = 'remove-exiting-play-mode'
    if (ui.activePanel === 'play') {
      const { x, z } = camera.target,
        { h } = chunks.getPixel(x, z)
      playerObject = new Player('remilia', scene, keys)
      playerObject.position.copyFromFloats(x, h + 2, z)
      Tags.AddTagsTo(playerObject, tag)
    }
    if (oldPanel === 'play') {
      scene.getMeshesByTags(tag).forEach(mesh => mesh.dispose())
    }
    canvas.focus()
  })

  const showDebugLayer = document.getElementById('showDebugLayer') as HTMLInputElement
  showDebugLayer && showDebugLayer.addEventListener('click', evt => {
    showDebugLayer.checked ? scene.debugLayer.show() : scene.debugLayer.hide()
  })

  const objectToolbar = document.getElementById('objectToolbar')
  attachDragable(canvas, evt => {
    objectToolbar.style.display = 'none'
  }, evt => {
  }, evt => {
    objectToolbar.style.display = selectedObject ? 'block' : 'none'
  }, evt => {
    return ui.activePanel === 'objects' && !keys.ctrlKey && !keys.shiftKey
  })
  let cursorOffset = null as { x: number, y: number }
  attachDragable(objectToolbar.querySelector('.move-object') as HTMLElement, evt => {
    cursorOffset = { ...cursor.offset }
    cursor.offset.x = parseFloat(objectToolbar.style.left) - evt.clientX
    cursor.offset.y = parseFloat(objectToolbar.style.top) - evt.clientY
  }, evt => {
    selectedObject.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0, 0.5)))
    objectToolbar.style.left = (evt.clientX + cursor.offset.x) + 'px'
    objectToolbar.style.top = (evt.clientY + cursor.offset.y) + 'px'
  }, evt => {
    cursor.offset.x = cursorOffset.x
    cursor.offset.y = cursorOffset.y
    cursorOffset = null
    map.saveDebounced(chunks, objectsToSave)
  })
  objectToolbar.querySelector('.focus-object').addEventListener('click', evt => {
    if (selectedObject) {
      cameraTarget.copyFrom(selectedObject.position)
    }
  })
  objectToolbar.querySelector('.remove-object').addEventListener('click', evt => {
    delete objectsToSave[selectedObject.name]
    map.saveDebounced(chunks, objectsToSave)

    selectedObject.dispose()
    selectedObject = null
  })
  objectToolbar.querySelector('.cancel-select').addEventListener('click', evt => {
    selectedObject = null
  })

  const configRotateCamera = document.getElementById('configRotateCamera') as HTMLInputElement
  configRotateCamera && configRotateCamera.addEventListener('click', function tick() {
    if (configRotateCamera.checked && ui.activePanel !== 'play') {
      camera.alpha += 0.01
      setTimeout(tick, 20)
    }
  })
  document.getElementById('configDownloadMap').addEventListener('click', evt => {
    const s = map.toJSON(chunks, objectsToSave)
    const a = appendElement('a', {
      href: 'data:text/json;charset=utf-8,' + encodeURIComponent(s),
      target: '_blank',
      download: 'map.json',
    }) as HTMLLinkElement
    a.click()
    a.parentNode.removeChild(a)
  })
  document.getElementById('configUploadMap').addEventListener('change', evt => {
    const f = new FileReader(),
      u = location.href.split(location.host).pop()
    f.onload = evt => LocationSearch.set({ projSavedMap: f.result, projRestoreURL: u })
    f.readAsText((evt.target as HTMLInputElement).files[0])
  })

  const renderListeners = [
    watch(() => {
      return 0 ||
        (ui.activePanel === 'brushes' && (keys.ctrlKey || keys.shiftKey)) ||
        (ui.activePanel === 'objects' && (keys.ctrlKey || keys.shiftKey))
    }, shouldDetachCamera => {
      shouldDetachCamera ? camera.detachControl(canvas) : camera.attachControl(canvas)
    }, true),
    watch(() => {
      return ui.activePanel === 'objects' && selectedObject
    }, (newObject, oldObject) => {
      objectToolbar.style.display = newObject ? 'block' : 'none'
      if (oldObject) {
        oldObject.getChildMeshes().forEach(child => child.showBoundingBox = false)
      }
      if (newObject) {
        newObject.getChildMeshes().forEach(child => child.showBoundingBox = true)
        const { clsId, args } = objectsToSave[newObject.name],
          { clsName } = assets.classes.find(c => c.clsId === clsId),
          container = Object.assign(objectToolbar.querySelector('.object-config'), { innerHTML: '' }),
          head = appendElement('div', { innerHTML: newObject.name }, container),
          content = appendElement('div', { }, container)
        OBJECT_BINDER[clsName](content, newObject, ret => {
          Object.assign(args, ret)
          Object.assign(newObject, ret)
          map.saveDebounced(chunks, objectsToSave)
        })
      }
    }),
  ]

  const panelListeners = {
    objects: [
      () => {
        if (selectedObject && !cursorOffset && objectToolbar.style.display === 'block') {
          const src = selectedObject.position,
            viewport = camera.viewport.toGlobal(canvas.width, canvas.height),
            pos = Vector3.Project(src, Matrix.Identity(), scene.getTransformMatrix(), viewport)
          objectToolbar.style.left = pos.x + 'px'
          objectToolbar.style.top = pos.y + 'px'
        }
      },
    ],
    play: [
      () => {
        const minBeta = Math.PI * 0.38
        if (camera.beta < minBeta && !cursor.isKeyDown) {
          camera.beta = camera.beta * 0.9 + minBeta * 0.1
        }
        const maxRadius = 40
        if (camera.radius > maxRadius && !cursor.isKeyDown) {
          camera.radius = camera.radius * 0.9 + maxRadius * 0.1
        }
        if (playerObject && !playerObject.isDisposed()) {
          playerObject.updateForward(cameraDirection)
          cameraTarget.copyFrom(playerObject.position)
        }
      },
    ]
  }

  const cameraTarget = Vector3.Zero(), cameraDirection = Vector3.Zero()
  scene.registerBeforeRender(() => {
    cameraDirection.copyFrom(camera.target.subtract(camera.position))
    camera.setTarget(Vector3.Lerp(camera.target, cameraTarget, 0.1))
    camera.setPosition(camera.target.subtract(cameraDirection))

    renderListeners.forEach(poll => poll())
    const cbs = panelListeners[ui.activePanel]
    cbs && cbs.forEach(poll => poll())

    cursor.isVisible = keys.ctrlKey || keys.shiftKey
  })

  setImmediate(() => {
    chunks.getPixel( 1,  1)
    chunks.getPixel(-1,  1)
    chunks.getPixel(-1, -1)
    chunks.getPixel( 1, -1)
  })

})()
