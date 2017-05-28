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
} from './editor'

import Cursor from './editor/cursor'
import EditorMap from './editor/map'

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
  randomBytes,
  fpsCounter,
} from './utils'

import {
  getMousePickOnPlane,
} from './utils/babylon'

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

const iconClassFromCursorClass = {
  'cursor-up-ctrl' : 'fa fa-pencil/fa fa-arrow-up',
  'cursor-down-ctrl' : 'fa fa-pencil/fa fa-arrow-down',
  'cursor-flat-ctrl' : 'fa fa-pencil/fa fa-arrows-h',
  'cursor-none-ctrl' : 'fa fa-pencil',
  'cursor-up-shift': 'fa fa-pencil-square-o/fa fa-arrow-up',
  'cursor-down-shift': 'fa fa-pencil-square-o/fa fa-arrow-down',
  'cursor-flat-shift': 'fa fa-pencil-square-o/fa fa-arrows-h',
  'cursor-none-shift': 'fa fa-pencil-square-o',
  'cursor-classes-ctrl' : 'fa fa-tree',
  'cursor-classes-shift': 'fa fa-object-group',
}

const appendCursorStyle = memo((cursorClass: keyof typeof iconClassFromCursorClass) => {
  const [mainClass, subClass] = iconClassFromCursorClass[cursorClass].split('/'),
    dataUrl = createDataURLFromIconFontAndSub(mainClass, subClass)
  return appendElement('style', { innerHTML: `.${cursorClass} { cursor: url(${dataUrl}), auto }` }, 'head')
})

function setElementCursorIcon(elem: HTMLElement, cursorClass: keyof typeof iconClassFromCursorClass) {
  const iconClass = iconClassFromCursorClass[cursorClass]
  Object.keys(iconClassFromCursorClass).forEach(cursorClass => elem.classList.remove(cursorClass))
  if (iconClass) {
    appendCursorStyle(cursorClass)
    elem.classList.add(cursorClass)
  }
}

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
  window.open(location.href.replace(/\/editor.html.*/, '') + '?' + queryString)
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
    grid = new GridPlane('grids', scene, 32),

    lastSelection = new SelectionBox('select', scene),
    terrainCursor = new ObjectBoundary('terrain', scene),

    editorHistory = new EditorHistory()

  const watchObjectChange = check<AbstractMesh>((newObject, oldObject) => {
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
        toolbar.setStatePartial({ terrain })
      }
    }
  })

  const watchTerrainChange = check<Terrain>((newTerrain) => {
    if (terrainCursor.isVisible = !!newTerrain) {
      const { minimum, maximum } = newTerrain.sideMesh.getBoundingInfo(),
        { x, z } = minimum.add(maximum).scale(0.5)
      terrainCursor.renderingGroupId = 1
      terrainCursor.position.copyFromFloats(Math.floor(x) + 0.5, newTerrain.position.y, Math.floor(z) + 0.5)
    }
  })

  const toolbar = await renderReactComponent(({ object, terrain, panel, tileId, clsId, tileHeight }: {
    object: ObjectBase
    terrain: Terrain
    panel: string
    tileId: number
    clsId: number
    tileHeight: string
  }) => <div class="ui-toolbar">
    <div class="ui-top">
      <PanelTabs panels={ ['brushes', 'classes', object && 'object', 'layers', 'map'] } panel={ panel } />
    </div>
    <div class="ui-panels">
      <div class={{ 'panel-brushes': true, hidden: panel !== 'brushes' }}>
        <PanelBrushes tiles={ assets.tiles } tileHeight={ tileHeight } tileId={ tileId } />
      </div>
      <div class={{ 'panel-classes': true, hidden: panel !== 'classes' }}>
        <PanelClasses classes={ assets.classes } clsId={ clsId } />
      </div>
      <div class={{ 'panel-object': true, hidden: panel !== 'object' }}>
        { watchObjectChange(object) && null }
        {
          object && <div>
            <b>{ object.name }</b>
            <div class="float-right">
              <i class="action-icon fa fa-crosshairs" title="look at this"
                onClick={ _ => camera.followTarget.copyFrom(object.position)}></i> {' '}
              <i class="action-icon fa fa-trash" title="remove"
                onClick={ _ => editorHistory.commit(new RemoveObjectAction(map, object))}></i> {' '}
            </div>
            <div>({ object.position.x }, { object.position.y }, { object.position.z })</div>
          </div>
        }
        {
          object && object.renderConfig(data => {
            editorHistory.commit(new UpdateObjectAction(map, object, data))
            toolbar.setStatePartial({ object })
          })
        }
      </div>
      <div class={{ 'panel-layers': true, hidden: panel !== 'layers' }}>
        { watchTerrainChange(terrain) && null }
        <PanelLayers tiles={ assets.tiles } layers={ map.terrains } layerId={ terrain && terrain.name } />
      </div>
      <div class={{ 'panel-map': true, hidden: panel !== 'map' }}>
        <button onClick={ _ => playMapInNewWindow(map) }>Play</button> {' '}
        <br />
        <button onClick={ _ => promptDownloadText('map.json', map.toJSON())}>Download</button> {' '}
        <button onClick={ _ => EditorMap.upload() }>Upload</button> {' '}
        <br />
        <button onClick={ _ => EditorMap.reset() }>Reset</button>
      </div>
    </div>
    <div class="ui-info">
      <span id="cursorHoverInfo"></span>
      <br />
      <a href="javascript:void(0)" style={{ opacity: editorHistory.canUndo ? 1 : 0.2 }}
        onClick={ _ => editorHistory.undo() } title="undo (ctrl+Z)">
        <i class="fa fa-undo"></i>
      </a> {' '}
      <a href="javascript:void(0)" style={{ opacity: editorHistory.canRedo ? 1 : 0.2 }}
        onClick={ _ => editorHistory.redo() } title="redo (ctrl+Y)">
        <i class="fa fa-repeat"></i>
      </a> / {' '}
      <a href="javascript:void(0)" title="debug" onClick={ _ => toggleDebugLayer(scene)}>
        <i class="fa fa-info"></i>
      </a> / {' '}
      <a href="javascript:void(0)" title="help" onClick={ _ => toggleHelpDisplay()}>
        <i class="fa fa-question"></i>
      </a> / {' '}
      <span id="fpsCounterText"></span>
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
    terrain: map.activeTerrain,
  })

  // use shift to draw rectangles
  attachDragable(evt => {
    if (evt.target === canvas && toolbar.state.panel === 'brushes' && !keys.ctrlKey && keys.shiftKey) {
      const { x, z } = cursor.hover
      return toolbar.state.tileId === TILE_AUTO ? map.activeTerrain.getPixel(x, z).t : toolbar.state.tileId
    }
  }, _ => {
    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { minimum, maximum } = cursor
    lastSelection.position.copyFrom(maximum.add(minimum).scale(0.5))
    lastSelection.scaling.copyFrom(maximum.subtract(minimum))
  }, (_, startTileId) => {
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
  attachDragable(evt => {
    if (evt.target === canvas && toolbar.state.panel === 'brushes' && keys.ctrlKey && !keys.shiftKey) {
      const { x, z } = cursor.hover,
        t = toolbar.state.tileId === TILE_AUTO ? map.activeTerrain.getPixel(x, z).t : toolbar.state.tileId,
        h = toolbar.state.tileHeight && cursor.hover.y + parseInt(toolbar.state.tileHeight),
        selectedPixel = { t, h }
      editorHistory.push(new SetPixelAction(map.activeTerrain, x, z, selectedPixel))
      return selectedPixel
    }
  }, _ => {
    cursor.alpha = 0
    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, (_, selectedPixel) => {
    const { x, z } = cursor.hover
    editorHistory.push(new SetPixelAction(map.activeTerrain, x, z, selectedPixel))

    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    cursor.alpha = 1

    editorHistory.commit()
  })

  // use shift key to select objects
  attachDragable(_ => {
    return toolbar.state.panel === 'classes' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    // mouse down
  }, _ => {
    // mouse move
  }, _ => {
    const box = new BoundingBox(cursor.minimum, cursor.maximum),
      objects = Object.keys(map.objects).map(id => scene.getMeshByName(id) as ObjectBase),
      intersected = objects.filter(mesh => box.intersectsPoint(mesh.position)),
      index = intersected.indexOf(toolbar.state.object),
      object = intersected[(index + 1) % objects.length]
    toolbar.setStatePartial({ object })
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
    return scene.getMeshByName(id) as ObjectBase
  }

  // use ctrl key to create objects
  attachDragable(evt => {
    return evt.target === canvas && toolbar.state.panel === 'classes' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    toolbar.setStatePartial({ panel: 'object', object: createObjectFromActiveClass() })
  }, _ => {
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    pos.y = map.activeTerrain.getPixel(pos.x, pos.z).h
    editorHistory.push(new MoveObjectAction(map.activeTerrain, toolbar.state.object.name, pos))
  }, _ => {
    editorHistory.commit()
  })

  // drag from class toolbar
  attachDragable(evt => {
    const elem = evt.target as HTMLImageElement
    if (!keys.showCursor && elem.tagName.toLowerCase() === 'img') {
      const clsId = parseInt(elem.parentElement.getAttribute('class-id'))
      if (clsId > 0) {
        toolbar.setStatePartial({ clsId })
        return true
      }
    }
  }, _ => {
    cursor.isVisible = false
  }, evt => {
    if (evt.target === canvas && !cursor.isVisible) {
      cursor.isVisible = true
      toolbar.setStatePartial({ panel: 'object', object: createObjectFromActiveClass() })
    }
    if (cursor.isVisible) {
      const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
      pos.y = map.activeTerrain.getPixel(pos.x, pos.z).h
      editorHistory.push(new MoveObjectAction(map.activeTerrain, toolbar.state.object.name, pos))
    }
  }, _ => {
    cursor.isVisible = false
    editorHistory.commit()
  })

  // drag terrain cursor to move
  attachDragable(evt => {
    const ray = evt.target === canvas && scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
      picked = ray && ray.intersectsMesh(terrainCursor),
      { position } = getMousePickOnPlane(scene, evt.clientX, evt.clientY, 'y', terrainCursor.position.y)
    return picked && picked.hit && terrainCursor.position.subtract(position)
  }, _ => {
    camera.detachControl(canvas)
  }, (evt, start) => {
    const delta = map.activeTerrain.position.subtract(terrainCursor.position),
      { position } = getMousePickOnPlane(scene, evt.clientX, evt.clientY, 'y', terrainCursor.position.y)
    terrainCursor.position.copyFrom(start.add(position))
    editorHistory.push(new MoveLayerAction(map, terrainCursor.position.add(delta)))
    toolbar.forceUpdate()
  }, _ => {
    editorHistory.commit()
    camera.attachControl(canvas, true)
  })

  // drag object to move
  attachDragable(evt => {
    const ray = evt.target === canvas && scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
      picked = ray && scene.pickWithRay(ray, mesh => !!map.objects[mesh.name])
    if (picked.hit) {
      const object = picked.pickedMesh as any as ObjectBase
      toolbar.setStatePartial({ panel: 'object', object })
      return true
    }
  }, _ => {
    camera.detachControl(canvas)
  }, _ => {
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    editorHistory.push(new MoveObjectAction(map.activeTerrain, toolbar.state.object.name, pos))
    objectHoverCursor.position.copyFrom(pos)
  }, _ => {
    editorHistory.commit()
    camera.attachControl(canvas, true)
  })

  map.on('object-created', object => {
    toolbar.setStatePartial({ object })
  })

  map.on('object-removed', object => {
    if (toolbar.state.object === object) {
      toolbar.setStatePartial({ panel: 'classes', object: null })
    }
  })

  map.on('terrain-activated', terrain => {
    cursor.baseHeight = grid.position.y = terrain.position.y
    const object = toolbar.state.object
    if (object && map.objects[object.name].terrainId !== terrain.name) {
      toolbar.setStatePartial({ panel: 'layers', object: null })
    }
  })

  terrainEvents.on('batch-updated', () => {
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
    toolbar.setStatePartial({ terrain: map.terrains[layerId] })
  })

  toolbarActions.on('layer-selected', layerId => {
    editorHistory.commit(new SelectLayerAction(map, layerId))
    toolbar.setStatePartial({ terrain: map.terrains[layerId] })
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
      editorHistory.commit(new RemoveLayerAction(map))
      toolbar.setStatePartial({ terrain: map.activeTerrain })
    }
  })

  const objectHoverCursor = new ArrowBoundary('arrow', scene)
  objectHoverCursor.isVisible = false

  const cursorHoverInfo = document.getElementById('cursorHoverInfo') as HTMLDivElement
  canvas.addEventListener('mousemove', evt => {
    if (!keys.showCursor) {
      const ray = scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
        picked = scene.pickWithRay(ray, mesh => !!map.objects[mesh.name] || mesh === terrainCursor)
      if (objectHoverCursor.isVisible = picked.hit) {
        cursorHoverInfo.textContent = 'id: ' + picked.pickedMesh.name
        objectHoverCursor.position.copyFrom(picked.pickedMesh.position)
      }
      else {
        const { hover, isVisible, isKeyDown, minimum, maximum } = cursor
        cursorHoverInfo.textContent = `pos: ${hover.x}, ${hover.z}` +
          (isVisible && isKeyDown ? `: ${minimum.x}, ${minimum.z} ~ ${maximum.x}, ${maximum.z}` : '')
      }
    }
  })

  const cvMouseDownPos = new Vector3(-1, -1, 0)
  // click to select object or terrain
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
        const object = picked.pickedMesh as ObjectBase
        toolbar.setStatePartial({ panel: 'object', object })
      }
      else {
        const picked = scene.pickWithRay(ray, mesh => !!Terrain.getTerrainFromMesh(mesh))
        if (picked.hit) {
          map.activeTerrain = Terrain.getTerrainFromMesh(picked.pickedMesh)
          toolbar.setStatePartial({ terrain: map.activeTerrain })
        }
      }
    }
  })

  cursor.isVisible = false
  keyInput.on('showCursor', isDown => {
    (cursor.isVisible = isDown) ? camera.detachControl(canvas) : camera.attachControl(canvas, true)
  })

  const checkCursorStateChange = check<string[]>(keyStates => {
    const cursorClass = 'cursor-' + keyStates.join('') as keyof typeof iconClassFromCursorClass
    setElementCursorIcon(canvas, cursorClass)
  })

  keyInput.any.on('change', () => checkCursorStateChange([
    toolbar.state.panel === 'brushes' ? pixelHeightNames[toolbar.state.tileHeight] : toolbar.state.panel,
    keys.ctrlKey ? '-ctrl' : '',
    keys.shiftKey ? '-shift' : ''
  ]))

  keyInput.down.on('focus', () => camera.followTarget.copyFrom(cursor.hover))
  keyInput.down.on('undo',  () => editorHistory.undo())
  keyInput.down.on('redo',  () => editorHistory.redo())

  const fpsCounterText = document.getElementById('fpsCounterText'),
    computeFps = fpsCounter()
  scene.registerBeforeRender(() => {
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

  LoadingScreen.hide()
})()
