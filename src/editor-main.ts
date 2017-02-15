import {
  Mesh,
  Vector3,
  Ray,
  BoundingBox,
  Tags,
  Matrix,
  AbstractMesh,
} from './babylon'

import {
  Game,
} from './game'

import {
  IEditable
} from './game/objbase'

import {
  SelectionBox,
  GridPlane,
  ObjectBoundary,
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
  UpdateLayerSideTileAction,
  RemoveLayerAction,
  EditorHistory,
} from './editor/history'

import {
  Toolbar
} from './editor/toolbar'

import {
  queryStringSet,
  watch,
  memo,
  sleep,
  randomBytes,
  fpsCounter,
} from './utils'

import {
  appendElement,
  attachDragable,
  LocationSearch,
  LoadingScreen,
  KeyEmitter,
  checkFontsLoaded,
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

; (async function() {
  await checkFontsLoaded()

  let game: Game
  try {
    game = await Game.load(updateLoadingScreenProgress)
    game.objectSource = new ObjectBoundary('frame', game.scene)
  }
  catch (err) {
    LoadingScreen.update(`create game failed: ${err && err.message || err}`)
    throw err
  }

  const { scene, camera, assets } = game,
    canvas = scene.getEngine().getRenderingCanvas(),

    keyInput = new KeyEmitter(KEY_MAP),
    keys = keyInput.state,

    map = await EditorMap.load(game),

    cursor = new Cursor('cursor', scene, (mesh: Mesh) => Tags.MatchesQuery(mesh, 'terrain-' + map.activeTerrain.name)),
    lastSelection = new SelectionBox('select', scene),

    grid = new GridPlane('grids', scene, 32),

    editorHistory = new EditorHistory(),
    toolbar = new Toolbar(assets.tiles, assets.classes)

  toolbar.syncLayerTabs(map.terrains, map.activeTerrain.name)
  grid.position.y = cursor.baseHeight = map.activeTerrain.position.y

  let selectedPixel: { t: number, h: number },
    selectedObject: AbstractMesh

  // use shift to draw rectangles
  attachDragable(evt => {
    return evt.target === canvas && toolbar.activePanel === 'brushes' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    const { t } = toolbar.selectedTilePixel, { x, z } = cursor.hover
    selectedPixel = { t: t === '?' ? map.activeTerrain.getPixel(x, z).t : t && parseInt(t), h: 0 }

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { minimum, maximum } = cursor
    lastSelection.position.copyFrom(maximum.add(minimum).scale(0.5))
    lastSelection.scaling.copyFrom(maximum.subtract(minimum))
  }, _ => {
    const { minimum, maximum } = cursor, { h } = toolbar.selectedTilePixel,
      pixel = { t: selectedPixel.t, h: h && maximum.y - 1 + parseInt(h) }
    for (let m = minimum.x; m < maximum.x; m ++) {
      for (let n = minimum.z; n < maximum.z; n ++) {
        editorHistory.push(new SetPixelAction(map.activeTerrain, m, n, pixel))
      }
    }
    editorHistory.commit()
  })

  // use ctrl key to draw pixels
  attachDragable(evt => {
    return evt.target === canvas && toolbar.activePanel === 'brushes' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const { t, h } = toolbar.selectedTilePixel, { x, z } = cursor.hover
    selectedPixel = {
      t: t === '?' ? map.activeTerrain.getPixel(x, z).t : t && parseInt(t),
      h: h && cursor.hover.y + parseInt(h)
    }
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
  attachDragable(_ => {
    return toolbar.activePanel === 'objects' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    // mouse down
  }, _ => {
    // mouse move
  }, _ => {
    const box = new BoundingBox(cursor.minimum, cursor.maximum),
      objects = Object.keys(map.objects).map(id => scene.getMeshByName(id)),
      intersected = objects.filter(mesh => box.intersectsPoint(mesh.position)),
      index = intersected.indexOf(selectedObject as Mesh)
    selectedObject = intersected[(index + 1) % objects.length]
  })

  // use ctrl key to create objects
  attachDragable(evt => {
    return evt.target === canvas && toolbar.activePanel === 'objects' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const clsId = toolbar.selectedClassIndex,
      { clsName, args } = assets.classes.find(c => c.clsId === clsId),
      id = [clsName, randomBytes()].join('/'),
      pos = cursor.hover.add(new Vector3(0.5, 0, 0.5)),
      uniqueTag = args.editorSingletonId as string
    if (uniqueTag) scene.getMeshesByTags(uniqueTag).forEach(object => {
      editorHistory.push(new RemoveObjectAction(map, object))
    })
    editorHistory.push(new CreateObjectAction(map, id, clsId, pos, map.activeTerrain.name))
    if (uniqueTag) {
      Tags.AddTagsTo(scene.getMeshByName(id), uniqueTag)
    }
  }, _ => {
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    pos.y = map.activeTerrain.getPixel(pos.x, pos.z).h
    editorHistory.push(new MoveObjectAction(map.activeTerrain, selectedObject.name, pos))
  }, _ => {
    editorHistory.commit()

    map.saveDebounced()
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
  })

  map.on('height-updated', ({ terrain, chunk }) => {
    const pos = chunk.top.position, size = terrain.chunkSize,
      box = new BoundingBox(pos, pos.add(new Vector3(size, 0, size)))
    Object.keys(map.objects)
      .filter(id => map.objects[id].terrainId === terrain.name)
      .map(id => scene.getMeshByName(id))
      .forEach(mesh => {
        const { x, y, z } = mesh.position
        if (box.intersectsPoint(new Vector3(x, pos.y, z))) {
          const height = terrain.getPixel(x, z).h,
            origin = new Vector3(x, Math.max(y, height) + 0.1, z),
            direction = new Vector3(0, -1, 0),
            picked = scene.pickWithRay(new Ray(origin, direction), cursor.pickFilter)
          mesh.position.y = picked.hit && picked.getNormal().y > 0.9 ? picked.pickedPoint.y : height
        }
      })
  })

  map.on('terrain-moved', ({ terrain, delta }) => {
    Object.keys(map.objects)
      .filter(id => map.objects[id].terrainId === terrain.name)
      .map(id => scene.getMeshByName(id))
      .forEach(mesh => mesh.position.addInPlace(delta))
    if (terrain === map.activeTerrain) {
      cursor.baseHeight = grid.position.y = terrain.position.y
    }
  })

  map.on('chunk-loaded', ({ terrain, chunk }) => {
    Tags.AddTagsTo(chunk.top,  'terrain-' + terrain.name)
    Tags.AddTagsTo(chunk.edge, 'terrain-' + terrain.name)
    Tags.AddTagsTo(chunk.side, 'terrain-' + terrain.name)
  })

  toolbar.on('tile-selected', () => {
    if (keys.showCursor) {
      const { position, scaling } = lastSelection,
        minimum = position.subtract(scaling.scale(0.5)),
        maximum = position.add(scaling.scale(0.5)),
        pixel = toolbar.selectedTilePixel
      for (let m = minimum.x; m < maximum.x; m ++) {
        for (let n = minimum.z; n < maximum.z; n ++) {
          editorHistory.push(new SetPixelAction(map.activeTerrain, m, n, pixel as any))
        }
      }
      editorHistory.commit()
    }
  })

  toolbar.on('panel-changed', () => {
    lastSelection.isVisible = toolbar.activePanel === 'brushes'
    game.objectSource.renderingGroupId = toolbar.activePanel === 'objects' ? 1 : 0
  })

  toolbar.on('layer-added', id => {
    editorHistory.commit(new AddLayerAction(map, toolbar, id))
    map.saveDebounced()
  })

  toolbar.on('layer-selected', id => {
    editorHistory.commit(new SelectLayerAction(map, toolbar, id))
  })

  toolbar.on('layer-updated', ({ position, sideTileId }) => {
    if (position) {
      const { x, y, z } = position
      editorHistory.push(new MoveLayerAction(map, toolbar, new Vector3(x, y, z)))
    }
    if (sideTileId) {
      editorHistory.push(new UpdateLayerSideTileAction(map, toolbar, sideTileId))
    }
    editorHistory.commit()
    map.saveDebounced()
  })

  toolbar.on('layer-removed', () => {
    if (Object.keys(map.terrains).length > 1) {
      Object.keys(map.objects)
        .filter(id => {
          const layerId = map.objects[id].terrainId
          return layerId === map.activeTerrain.name || !map.terrains[layerId]
        })
        .forEach(id => {
          editorHistory.push(new RemoveObjectAction(map, scene.getMeshByName(id)))
        })
      editorHistory.push(new RemoveLayerAction(map, toolbar))
      editorHistory.commit()
      map.saveDebounced()
    }
  })

  const objectToolbar = document.getElementById('objectToolbar')
  attachDragable(evt => {
    return evt.target === canvas && toolbar.activePanel === 'objects' && !keys.ctrlKey && !keys.shiftKey
  }, _ => {
    objectToolbar.classList.add('dragging')
  }, _ => {
    // mouse move
  }, _ => {
    objectToolbar.classList.remove('dragging')
  })

  let toolbarDragStarted: { x: number, y: number }
  attachDragable(objectToolbar.querySelector('.move-object') as HTMLElement, evt => {
    toolbarDragStarted = { ...cursor.offset }

    cursor.offset.x = parseFloat(objectToolbar.style.left) - evt.clientX
    cursor.offset.y = parseFloat(objectToolbar.style.top) - evt.clientY
    cursor.updateFromPickTarget(evt)
  }, evt => {
    cursor.updateFromPickTarget(evt)
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    editorHistory.push(new MoveObjectAction(map.activeTerrain, selectedObject.name, pos))

    objectToolbar.style.left = (evt.clientX + cursor.offset.x) + 'px'
    objectToolbar.style.top = (evt.clientY + cursor.offset.y) + 'px'
  }, _ => {
    cursor.offset.x = toolbarDragStarted.x
    cursor.offset.y = toolbarDragStarted.y
    toolbarDragStarted = null

    editorHistory.commit()

    map.saveDebounced()
  })
  objectToolbar.querySelector('.focus-object').addEventListener('click', _ => {
    camera.followTarget.copyFrom(selectedObject.position)
  })
  objectToolbar.querySelector('.remove-object').addEventListener('click', _ => {
    editorHistory.commit(new RemoveObjectAction(map, selectedObject))
    map.saveDebounced()
  })
  objectToolbar.querySelector('.cancel-select').addEventListener('click', _ => {
    selectedObject = null
  })

  const objectHoverCursor = game.objectSource.createInstance('object-hover')
  objectHoverCursor.scaling.copyFromFloats(1.15, 1.15, 1.15)
  objectHoverCursor.isVisible = false
  const objectHoverInfo = document.getElementById('objectHoverInfo') as HTMLDivElement
  canvas.addEventListener('mousemove', evt => {
    if (objectHoverCursor.isVisible = toolbar.activePanel === 'objects') {
      const ray = scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
        picked = scene.pickWithRay(ray, mesh => !!map.objects[mesh.name])
      if (objectHoverCursor.isVisible = picked.hit) {
        objectHoverInfo.innerHTML = '#' + picked.pickedMesh.name
        objectHoverCursor.position.copyFrom(picked.pickedMesh.position)
      }
      else {
        objectHoverInfo.innerHTML = 'move cursor over an object to see its name'
      }
    }
  })

  const brushHoverInfo = document.getElementById('brushHoverInfo') as HTMLDivElement
  canvas.addEventListener('mousemove', _ => {
    if (toolbar.activePanel === 'brushes') {
      const { hover, isVisible, isKeyDown, minimum, maximum } = cursor
      brushHoverInfo.innerHTML = `${hover.x}, ${hover.z}` +
        (isVisible && isKeyDown ? `: ${minimum.x}, ${minimum.z} ~ ${maximum.x}, ${maximum.z}` : '')
    }
  })

  document.getElementById('configPlayInNewWindow').addEventListener('click', _ => {
    const history = [{ url: 'data:text/json;charset=utf-8,' + encodeURIComponent(map.toJSON()) }],
      queryDict = { 'stage-history': JSON.stringify(history), 'stage-start': 'play' },
      queryString = queryStringSet(location.search.replace(/^\?/, ''), queryDict)
    location.href = location.href.replace(/\/editor.html.*/, '') + '?' + queryString
  })

  document.getElementById('configDownloadMap').addEventListener('click', _ => {
    const s = map.toJSON()
    const a = appendElement('a', {
      href: 'data:text/json;charset=utf-8,' + encodeURIComponent(s),
      target: '_blank',
      download: 'map.json',
    }) as HTMLLinkElement
    a.click()
    a.parentNode.removeChild(a)
  })
  document.getElementById('configUploadMap').addEventListener('click', _ => {
    const f = appendElement('input', { type: 'file', className: 'hidden' }) as HTMLInputElement
    f.addEventListener('change', _ => {
      const r = new FileReader(),
        u = location.href.split(location.host).pop()
      r.onload = _ => LocationSearch.set({ projSavedMap: r.result, projRestoreURL: u })
      r.readAsText(f.files[0])
    })
    f.click()
    f.parentNode.removeChild(f)
  })
  document.getElementById('configResetMap').addEventListener('click', _ => {
    map.reset()
    location.reload()
  })

  document.getElementById('docShowDebug').addEventListener('click', _ => {
    scene.debugLayer.isVisible() ? scene.debugLayer.hide() : scene.debugLayer.show()
  })
  document.getElementById('docShowHelp').addEventListener('click', _ => {
    const isHelpShown = document.querySelector('.doc-help').scrollHeight > 0
    isHelpShown ? document.body.classList.remove('show-help') : document.body.classList.add('show-help')
  })
  document.getElementById('docHideHelp').addEventListener('click', _ => {
    document.body.classList.remove('show-help')
  })

  for (const elem of document.querySelectorAll('#docActionUndo, #docActionRedo')) {
    elem.classList.add('disabled')
  }
  editorHistory.on('change', _ => {
    document.getElementById('docActionUndo').classList[editorHistory.canUndo ? 'remove' : 'add']('disabled')
    document.getElementById('docActionRedo').classList[editorHistory.canRedo ? 'remove' : 'add']('disabled')
    map.saveDebounced()
  })
  document.getElementById('docActionUndo').addEventListener('click', _ => {
    editorHistory.undo()
  })
  document.getElementById('docActionRedo').addEventListener('click', _ => {
    editorHistory.redo()
  })

  cursor.isVisible = false
  keyInput.any.on('change', watch(() => keys.showCursor, shouldDetachCamera => {
    (cursor.isVisible = shouldDetachCamera) ? camera.detachControl(canvas) : camera.attachControl(canvas, true)
  }, false))

  keyInput.any.on('change', watch(() => [
    toolbar.activePanel === 'brushes' ? pixelHeightNames[toolbar.selectedTilePixel.h] : toolbar.activePanel,
    keys.ctrlKey ? '-ctrl' : '',
    keys.shiftKey ? '-shift' : ''
  ], keyStates => {
    const cursorClass = 'cursor-' + keyStates.join(''),
      iconClass = iconClassFromCursorClass[cursorClass]
    Object.keys(iconClassFromCursorClass).forEach(cursorClass => canvas.classList.remove(cursorClass))
    if (iconClass) {
      appendCursorStyle(cursorClass)
      canvas.classList.add(cursorClass)
    }
  }))

  keyInput.down.on('focus', () => camera.followTarget.copyFrom(cursor.hover))
  keyInput.down.on('undo',  () => editorHistory.undo())
  keyInput.down.on('redo',  () => editorHistory.redo())

  scene.registerBeforeRender(watch(() => {
    return toolbar.activePanel === 'objects' && selectedObject
  }, (newObject, oldObject) => {
    newObject ? objectToolbar.classList.remove('hidden') : objectToolbar.classList.add('hidden')
    if (oldObject) {
      oldObject.showBoundingBox = false
      oldObject.getChildMeshes().forEach(child => child.showBoundingBox = false)
    }
    if (newObject) {
      newObject.showBoundingBox = true
      newObject.getChildMeshes().forEach(child => child.showBoundingBox = true)

      const container = objectToolbar.querySelector('.object-settings')
      container.innerHTML = `<div><b>#${newObject.name}</b></div>`

      const binder = newObject as any as IEditable,
        content = appendElement('table', { }, container)
      binder.attachEditorContent && binder.attachEditorContent(content, update => {
        editorHistory.push(new UpdateObjectAction(map, newObject, update))
        map.saveDebounced()
      })
    }
    editorHistory.commit()
  }))

  const fpsCounterText = document.getElementById('fpsCounterText'),
    computeFps = fpsCounter()
  scene.registerBeforeRender(() => {
    fpsCounterText.textContent = computeFps().toFixed(1) + 'fps'

    if (toolbar.activePanel === 'objects' && selectedObject && !toolbarDragStarted) {
      const src = selectedObject.position,
        viewport = camera.viewport.toGlobal(canvas.width, canvas.height),
        pos = Vector3.Project(src, Matrix.Identity(), scene.getTransformMatrix(), viewport)
      objectToolbar.style.left = pos.x + 'px'
      objectToolbar.style.top = pos.y + 'px'
    }

    if (cursor.isVisible) {
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
