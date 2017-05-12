import {
  h,
} from 'preact'

import {
  Vector3,
  BoundingBox,
  AbstractMesh,
  Scene,
} from './babylon'

import {
  Game,
} from './game'

import Terrain, {
  eventEmitter as terrainEvents,
} from './game/terrain'

import {
  ObjectBase,
} from './game/objbase'

import {
  SelectionBox,
  GridPlane,
  ObjectBoundary,
  ArrowBoundary,
  createDataURLFromIconFontAndSub,
  EditorMap,
} from './editor'

import Cursor from './editor/cursor'

import {
  SetPixelAction,
  MoveObjectAction,
  CreateObjectAction,
  RemoveObjectAction,
  UpdateObjectAction,
  AddLayerAction,
  MoveLayerAction,
  SelectLayerAction,
  RemoveLayerAction,
  EditorHistory,
} from './editor/history'

import {
  eventEmitter as toolbarActions,
  PanelTabs,
  PanelBrushes,
  PanelClasses,
  PanelLayers,
  TILE_AUTO,
} from './editor/toolbar'

import {
  queryStringSet,
  check,
  memo,
  sleep,
  randomBytes,
  fpsCounter,
} from './utils'

import {
  appendElement,
  attachDragable,
  LoadingScreen,
  KeyEmitter,
  checkFontsLoaded,
  renderReactComponent,
  promptDownloadText,
} from './utils/dom'

const pixelHeightNames: { [key: string]: string } = {
  '+1': 'up',
  '-1': 'down',
  '0': 'flat',
  '': 'none',
}

const iconClassFromCursorClass: { [key: string]: string } = {
  'cursor-up-ctrl' : 'fa fa-pencil/fa fa-arrow-up',
  'cursor-down-ctrl' : 'fa fa-pencil/fa fa-arrow-down',
  'cursor-flat-ctrl' : 'fa fa-pencil/fa fa-arrows-h',
  'cursor-none-ctrl' : 'fa fa-pencil',
  'cursor-up-shift': 'fa fa-pencil-square-o/fa fa-arrow-up',
  'cursor-down-shift': 'fa fa-pencil-square-o/fa fa-arrow-down',
  'cursor-flat-shift': 'fa fa-pencil-square-o/fa fa-arrows-h',
  'cursor-none-shift': 'fa fa-pencil-square-o',
  'cursor-objects-ctrl' : 'fa fa-tree',
  'cursor-objects-shift': 'fa fa-object-group',
}

const appendCursorStyle = memo((cursorClass: string) => {
  const [mainClass, subClass] = iconClassFromCursorClass[cursorClass].split('/'),
    dataUrl = createDataURLFromIconFontAndSub(mainClass, subClass)
  return appendElement('style', { innerHTML: `.${cursorClass} { cursor: url(${dataUrl}), auto }` })
})

const KEY_MAP = {
  ctrlKey: 'CTRL',
  shiftKey: 'SHIFT',
  showCursor: 'CTRL | SHIFT',
  focus: 'SHIFT + F',
  undo: 'CTRL + Z',
  redo: 'CTRL + Y',
}

function updateLoadingScreenProgress(index: number, total: number, progress: number) {
  LoadingScreen.update(`Loading Assets ${index + 1}/${total} (${~~(progress * 100)}%)`)
}

function toggleDebugLayer(scene: Scene) {
  document.querySelector('.insp-wrapper') ? scene.debugLayer.hide() : scene.debugLayer.show(true)
}

function toggleHelpDisplay() {
  const isHelpShown = document.querySelector('.doc-help').scrollHeight > 0
  isHelpShown ? document.body.classList.remove('show-help') : document.body.classList.add('show-help')
}

function playMapInNewWindow(map: EditorMap) {
  const history = [{ url: 'data:text/json;charset=utf-8,' + encodeURIComponent(map.toJSON()) }],
    queryDict = { stageHistoryArray: JSON.stringify(history), stageStartPath: 'play' },
    queryString = queryStringSet(location.search.replace(/^\?/, ''), queryDict)
  location.href = location.href.replace(/\/editor.html.*/, '') + '?' + queryString
}

; (async function() {
  await checkFontsLoaded()

  let game: Game
  try {
    game = await Game.load(updateLoadingScreenProgress)
    game.objectSource = new ObjectBoundary('frame', game.scene)
    game.objectSource.renderingGroupId = 1
  }
  catch (err) {
    LoadingScreen.error(`create game failed: ${err && err.message || err}`)
    throw err
  }

  let map: EditorMap
  try {
    map = await EditorMap.load(game)
  }
  catch (err) {
    LoadingScreen.error(`load map failed: ${err && err.message || err}`)
    throw err
  }

  const { scene, camera, assets } = game,
    canvas = scene.getEngine().getRenderingCanvas(),

    keyInput = new KeyEmitter(KEY_MAP),
    keys = keyInput.state,

    cursor = new Cursor('cursor', scene, mesh => !!Terrain.getTerrainFromMesh(mesh)),
    lastSelection = new SelectionBox('select', scene),
    grid = new GridPlane('grids', scene, 32),

    editorHistory = new EditorHistory()

  const toolbar = await renderReactComponent((states: {
    panel: string
    tileId: number
    clsId: number
    tileHeight: string
    layerId: string
  }) => <div class="ui-toolbar">
    <div class="ui-top">
      <PanelTabs panels={ ['brushes', 'objects', 'layers', 'game'] } { ...states } />
      <span class="undo-redo"> / {' '}
        <a href="javascript:void(0)" class={{ active: editorHistory.canUndo }}
          onClick={ _ => editorHistory.undo() }
          title="undo (ctrl+Z)"><i class="fa fa-undo"></i></a> {' '}
        <a href="javascript:void(0)" class={{ active: editorHistory.canRedo }}
          onClick={ _ => editorHistory.redo() }
          title="redo (ctrl+Y)"><i class="fa fa-repeat"></i></a>
      </span>
      <span> / {' '}
        <span id="cursorHoverInfo"></span>
      </span>
      <div class="float-right">
        <span id="fpsCounterText"></span> / {' '}
        <a href="javascript:void(0)" title="debug" onClick={ _ => toggleDebugLayer(scene)}>
          <i class="fa fa-info"></i>
        </a> / {' '}
        <a href="javascript:void(0)" title="help" onClick={ _ => toggleHelpDisplay()}>
          <i class="fa fa-question"></i>
        </a>
      </div>
    </div>
    <div class="ui-panels">
      <div class={{ 'panel-brushes': true, hidden: states.panel !== 'brushes' }}>
        <PanelBrushes tiles={ assets.tiles } { ...states } />
      </div>
      <div class={{ 'panel-objects': true, hidden: states.panel !== 'objects' }}>
        <PanelClasses classes={ assets.classes } { ...states } />
      </div>
      <div class={{ 'panel-layers': true, hidden: states.panel !== 'layers' }}>
        <PanelLayers tiles={ assets.tiles } layers={ map.terrains } { ...states } />
      </div>
      <div class={{ 'panel-game': true, hidden: states.panel !== 'game' }}>
        <button onClick={ _ => playMapInNewWindow(map) }>Play</button> {' '}
        <button onClick={ _ => promptDownloadText('map.json', map.toJSON())}>Save</button> {' '}
        <button onClick={ _ => EditorMap.upload() }>Upload</button> {' '}
        <button onClick={ _ => EditorMap.reset() }>Reset</button>
      </div>
    </div>
  </div>, document.body)

  const activeTerrainId = Object.keys(map.terrains).pop() || 'Terrain/' + randomBytes()
  map.activeTerrain = map.createTerrianIfNotExists(activeTerrainId)
  grid.position.y = cursor.baseHeight = map.activeTerrain.position.y

  toolbar.setStatePartial({
    panel: 'brushes',
    tileId: assets.tiles[0].tileId,
    clsId: assets.classes[0].clsId,
    tileHeight: '+1',
    layerId: map.activeTerrain.name,
  })

  // use shift to draw rectangles
  let startTileId: number
  attachDragable(evt => {
    return evt.target === canvas && toolbar.state.panel === 'brushes' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    const { x, z } = cursor.hover
    startTileId = toolbar.state.tileId === TILE_AUTO ? map.activeTerrain.getPixel(x, z).t : toolbar.state.tileId

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { minimum, maximum } = cursor
    lastSelection.position.copyFrom(maximum.add(minimum).scale(0.5))
    lastSelection.scaling.copyFrom(maximum.subtract(minimum))
  }, _ => {
    const { minimum, maximum } = cursor, h = toolbar.state.tileHeight,
      pixel = { t: startTileId, h: h && maximum.y - 1 + parseInt(h) }
    for (let m = minimum.x; m < maximum.x; m ++) {
      for (let n = minimum.z; n < maximum.z; n ++) {
        editorHistory.push(new SetPixelAction(map.activeTerrain, m, n, pixel))
      }
    }
    editorHistory.commit()
  })

  // use ctrl key to draw pixels
  let selectedPixel = { t: 0, h: 0 }
  attachDragable(evt => {
    return evt.target === canvas && toolbar.state.panel === 'brushes' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const { x, z } = cursor.hover,
      t = toolbar.state.tileId === TILE_AUTO ? map.activeTerrain.getPixel(x, z).t : toolbar.state.tileId,
      h = toolbar.state.tileHeight && cursor.hover.y + parseInt(toolbar.state.tileHeight)
    selectedPixel = { t, h }
    editorHistory.push(new SetPixelAction(map.activeTerrain, x, z, selectedPixel))

    cursor.alpha = 0

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { x, z } = cursor.hover
    editorHistory.push(new SetPixelAction(map.activeTerrain, x, z, selectedPixel))

    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    cursor.alpha = 1

    editorHistory.commit()
  })

  // use shift key to select objects
  let selectedObject: ObjectBase
  attachDragable(_ => {
    return toolbar.state.panel === 'objects' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    // mouse down
  }, _ => {
    // mouse move
  }, _ => {
    const box = new BoundingBox(cursor.minimum, cursor.maximum),
      objects = Object.keys(map.objects).map(id => scene.getMeshByName(id) as ObjectBase),
      intersected = objects.filter(mesh => box.intersectsPoint(mesh.position)),
      index = intersected.indexOf(selectedObject)
    selectedObject = intersected[(index + 1) % objects.length]
  })

  function createObjectFromActiveClass() {
    const clsId = toolbar.state.clsId,
      { clsName, args } = assets.classes.find(c => c.clsId === clsId),
      id = [clsName, randomBytes()].join('/'),
      pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    if (args.editorSingletonId) {
      const clsIds = assets.classes
        .filter(c => c.args.editorSingletonId === args.editorSingletonId).map(c => c.clsId)
      Object.keys(map.objects)
        .filter(id => clsIds.indexOf(map.objects[id].clsId) >= 0)
        .forEach(id => editorHistory.push(new RemoveObjectAction(map, scene.getMeshByName(id))))
    }
    editorHistory.push(new CreateObjectAction(map, id, clsId, pos))
  }

  // use ctrl key to create objects
  attachDragable(evt => {
    return evt.target === canvas && toolbar.state.panel === 'objects' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    createObjectFromActiveClass()
  }, _ => {
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    pos.y = map.activeTerrain.getPixel(pos.x, pos.z).h
    editorHistory.push(new MoveObjectAction(map.activeTerrain, selectedObject.name, pos))
  }, _ => {
    editorHistory.commit()
  })

  // drag from class toolbar
  attachDragable(evt => {
    const im = evt.target as HTMLImageElement
    return !keys.showCursor && im.tagName.toLowerCase() === 'img' && im.classList.contains('cls-icon')
  }, evt => {
    const clsId = parseInt((evt.target as HTMLImageElement).parentElement.getAttribute('class-id'))
    toolbar.setStatePartial({ clsId })
    cursor.isVisible = false
  }, evt => {
    if (evt.target === canvas || cursor.isVisible) {
      cursor.updateFromPickTarget(evt)
      if (!cursor.isVisible) {
        cursor.isVisible = true
        createObjectFromActiveClass()
      }
      const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
      pos.y = map.activeTerrain.getPixel(pos.x, pos.z).h
      editorHistory.push(new MoveObjectAction(map.activeTerrain, selectedObject.name, pos))
    }
  }, _ => {
    cursor.isVisible = false
    editorHistory.commit()
  })

  attachDragable(evt => {
    return !keys.showCursor && evt.target === canvas && toolbar.state.panel === 'objects'
  }, _ => {
    document.body.classList.add('on-object-dragging')
  }, _ => {
    // mouse move
  }, _ => {
    document.body.classList.remove('on-object-dragging')
  })

  map.on('object-created', object => {
    selectedObject = object
  })

  map.on('object-removed', object => {
    if (selectedObject === object) {
      selectedObject = null
    }
  })

  map.on('terrain-activated', terrain => {
    cursor.baseHeight = grid.position.y = terrain.position.y
    if (selectedObject && map.objects[selectedObject.name].terrainId !== terrain.name) {
      selectedObject = null
    }
  })

  terrainEvents.on('tile-updated', () => {
    map.saveDebounced()
  })

  terrainEvents.on('height-updated', ({ terrain, chunk }) => {
    const pos = chunk.top.position, size = terrain.chunkSize,
      box = new BoundingBox(pos, pos.add(new Vector3(size, 0, size)))
    Object.keys(map.objects)
      .filter(id => map.objects[id].terrainId === terrain.name)
      .map(id => scene.getMeshByName(id))
      .forEach(mesh => {
        const { x, z } = mesh.position
        if (box.intersectsPoint(new Vector3(x, pos.y, z))) {
          mesh.position.y = terrain.getPixel(x, z).h
        }
      })
    map.saveDebounced()
  })

  terrainEvents.on('position-updated', ({ terrain, delta }) => {
    Object.keys(map.objects)
      .filter(id => map.objects[id].terrainId === terrain.name)
      .map(id => scene.getMeshByName(id))
      .forEach(mesh => mesh.position.addInPlace(delta))
    if (terrain === map.activeTerrain) {
      cursor.baseHeight = grid.position.y = terrain.position.y
    }
    map.saveDebounced()
  })

  editorHistory.on('change', () => {
    toolbar.forceUpdate()
    map.saveDebounced()
  })

  function setTilesInSelectedRegion() {
    const { position, scaling } = lastSelection,
      minimum = position.subtract(scaling.scale(0.5)),
      maximum = position.add(scaling.scale(0.5)),
      t = toolbar.state.tileId,
      h = toolbar.state.tileHeight
    for (let m = minimum.x; m < maximum.x; m ++) {
      for (let n = minimum.z; n < maximum.z; n ++) {
        editorHistory.push(new SetPixelAction(map.activeTerrain, m, n, { t, h }))
      }
    }
    editorHistory.commit()
  }

  toolbarActions.on('tile-selected', tileId => {
    toolbar.setStatePartial({ tileId })
    keys.showCursor && setTilesInSelectedRegion()
  })

  toolbarActions.on('tile-height-selected', tileHeight => {
    toolbar.setStatePartial({ tileHeight })
    keys.showCursor && setTilesInSelectedRegion()
  })

  toolbarActions.on('class-selected', clsId => {
    toolbar.setStatePartial({ clsId })
  })

  toolbarActions.on('panel-changed', panel => {
    lastSelection.isVisible = panel === 'brushes'
    toolbar.setStatePartial({ panel })
  })

  toolbarActions.on('layer-added', () => {
    const layerId = 'Terrain/' + randomBytes()
    editorHistory.commit(new AddLayerAction(map, layerId))
    toolbar.setStatePartial({ layerId })
  })

  toolbarActions.on('layer-selected', layerId => {
    editorHistory.commit(new SelectLayerAction(map, layerId))
    toolbar.setStatePartial({ layerId })
  })

  toolbarActions.on('layer-updated', ({ position }) => {
    if (position) {
      const { x, y, z } = position
      editorHistory.push(new MoveLayerAction(map, new Vector3(x, y, z)))
    }
    editorHistory.commit()
    toolbar.forceUpdate()
  })

  toolbarActions.on('layer-removed', () => {
    if (Object.keys(map.terrains).length > 1) {
      Object.keys(map.objects)
        .filter(id => {
          const layerId = map.objects[id].terrainId
          return layerId === map.activeTerrain.name || !map.terrains[layerId]
        })
        .forEach(id => {
          editorHistory.push(new RemoveObjectAction(map, scene.getMeshByName(id)))
        })
      editorHistory.push(new RemoveLayerAction(map))
      editorHistory.commit()
      toolbar.setStatePartial({ layerId: map.activeTerrain.name })
    }
  })

  const objectToolbar = await renderReactComponent(({ object }: {
    object: ObjectBase,
  }) => {
    return object && <div class="object-editor shown-object-selected">
      <div>
        <b>{ object.name }</b>
        <div class="float-right">
          <i class="action-icon fa fa-crosshairs" title="look at this"
            onClick={ _ => camera.followTarget.copyFrom(selectedObject.position)}></i> {' '}
          <i class="action-icon fa fa-trash" title="remove"
            onClick={ _ => editorHistory.commit(new RemoveObjectAction(map, selectedObject))}></i> {' '}
          <i class="action-icon fa fa-close" title="cancel"
            onClick={ _ => selectedObject = null }></i>
        </div>
      </div>
      <div>({ object.position.x }, { object.position.y }, { object.position.z })</div>
      {
        object.renderConfig(data => {
          editorHistory.commit(new UpdateObjectAction(map, object, data))
          objectToolbar.setStatePartial({ object })
        })
      }
    </div>
  }, document.body)

  attachDragable(evt => {
    const ray = scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
      picked = scene.pickWithRay(ray, mesh => !!map.objects[mesh.name])
    if (picked.hit) {
      checkSelectedObjectChange(selectedObject = picked.pickedMesh as any as ObjectBase)
    }
    return picked.hit
  }, evt => {
    camera.detachControl(canvas)
    cursor.updateFromPickTarget(evt)
  }, evt => {
    cursor.updateFromPickTarget(evt)
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    editorHistory.push(new MoveObjectAction(map.activeTerrain, selectedObject.name, pos))
    objectHoverCursor.position.copyFrom(pos)
  }, _ => {
    editorHistory.commit()
    camera.attachControl(canvas, true)
  })

  const objectHoverCursor = new ArrowBoundary('arrow', scene)
  objectHoverCursor.isVisible = false

  const cursorHoverInfo = document.getElementById('cursorHoverInfo') as HTMLDivElement
  canvas.addEventListener('mousemove', evt => {
    if (!keys.showCursor) {
      const ray = scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
        picked = scene.pickWithRay(ray, mesh => !!map.objects[mesh.name])
      if (objectHoverCursor.isVisible = picked.hit) {
        cursorHoverInfo.innerHTML = '#' + picked.pickedMesh.name
        objectHoverCursor.position.copyFrom(picked.pickedMesh.position)
      }
      else {
        const { hover, isVisible, isKeyDown, minimum, maximum } = cursor
        cursorHoverInfo.innerHTML = `${hover.x}, ${hover.z}` +
          (isVisible && isKeyDown ? `: ${minimum.x}, ${minimum.z} ~ ${maximum.x}, ${maximum.z}` : '')
      }
    }
  })

  const cvMouseDownPos = new Vector3(-1, -1, 0)
  canvas.addEventListener('mousedown', evt => {
    cvMouseDownPos.x = evt.clientX
    cvMouseDownPos.y = evt.clientY
    // hack to resolve selection issue
    getSelection().removeAllRanges()
  })
  canvas.addEventListener('mouseup', evt => {
    const cvMouseUpPos = new Vector3(evt.clientX, evt.clientY, 0)
    if (!keys.showCursor && cvMouseDownPos.subtract(cvMouseUpPos).lengthSquared() < 9) {
      const ray = scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
        picked = scene.pickWithRay(ray, mesh => !!map.objects[mesh.name])
      if (picked.hit) {
        selectedObject = picked.pickedMesh as ObjectBase
        toolbar.setStatePartial({ panel: 'objects' })
      }
      else {
        const picked = scene.pickWithRay(ray, mesh => !!Terrain.getTerrainFromMesh(mesh))
        if (picked.hit) {
          map.activeTerrain = Terrain.getTerrainFromMesh(picked.pickedMesh)
          toolbar.setStatePartial({ layerId: map.activeTerrain.name })
        }
      }
    }
  })

  cursor.isVisible = false
  keyInput.on('showCursor', isDown => {
    (cursor.isVisible = isDown) ? camera.detachControl(canvas) : camera.attachControl(canvas, true)
  })

  const checkCursorStateChange = check<string[]>(keyStates => {
    const cursorClass = 'cursor-' + keyStates.join(''),
      iconClass = iconClassFromCursorClass[cursorClass]
    Object.keys(iconClassFromCursorClass).forEach(cursorClass => canvas.classList.remove(cursorClass))
    if (iconClass) {
      appendCursorStyle(cursorClass)
      canvas.classList.add(cursorClass)
    }
  })

  keyInput.any.on('change', () => checkCursorStateChange([
    toolbar.state.panel === 'brushes' ? pixelHeightNames[toolbar.state.tileHeight] : toolbar.state.panel,
    keys.ctrlKey ? '-ctrl' : '',
    keys.shiftKey ? '-shift' : ''
  ]))

  keyInput.down.on('focus', () => camera.followTarget.copyFrom(cursor.hover))
  keyInput.down.on('undo',  () => editorHistory.undo())
  keyInput.down.on('redo',  () => editorHistory.redo())

  const checkSelectedObjectChange = check<AbstractMesh>((newObject, oldObject) => {
    document.body.classList[newObject ? 'add' : 'remove']('has-object-selected')

    if (oldObject) {
      oldObject.showBoundingBox = false
      oldObject.getChildMeshes().forEach(child => child.showBoundingBox = false)
    }

    if (newObject) {
      newObject.showBoundingBox = true
      newObject.getChildMeshes().forEach(child => child.showBoundingBox = true)
      const terrain = map.terrains[ map.objects[newObject.name].terrainId ]
      if (terrain !== map.activeTerrain) {
        editorHistory.commit(new SelectLayerAction(map, terrain.name))
        toolbar.setStatePartial({ layerId: terrain.name })
      }
      objectToolbar.setStatePartial({ object: newObject as ObjectBase })
    }
  })

  const fpsCounterText = document.getElementById('fpsCounterText'),
    computeFps = fpsCounter()
  scene.registerBeforeRender(() => {
    checkSelectedObjectChange(toolbar.state.panel === 'objects' && selectedObject)

    fpsCounterText.textContent = computeFps().toFixed(1) + 'fps'

    if (keys.showCursor) {
      const { x, z } = cursor.hover, g = map.activeTerrain.chunkSize,
        p = grid.position, s = grid.scaling
      if (x < p.x - s.x / 2) grid.position.x -= g
      if (x > p.x + s.x / 2) grid.position.x += g
      if (z < p.z - s.z / 2) grid.position.z -= g
      if (z > p.z + s.z / 2) grid.position.z += g
    }
  })

  await sleep(800)

  camera.lowerBetaSoftLimit = camera.lowerBetaLimit
  camera.upperRadiusSoftLimit = camera.upperRadiusLimit

  LoadingScreen.hide()
})()
