import {
  Mesh,
  Vector3,
  Ray,
  BoundingBox,
  Tags,
  Matrix,
  AbstractMesh,
  SSAORenderingPipeline,
} from './babylon'

import {
  Game,
} from './game'

import {
  ObjectEditable
} from './game/objbase'

import Chunks from './game/chunks'
import Cursor from './editor/cursor'

import {
  SelectionBox,
  GridPlane,
  ObjectBoundary,
  createDataURLFromIconFontAndSub,
  loadSavedMap,
} from './editor'

import {
  SetPixelAction,
  MoveObjectAction,
  CreateObjectAction,
  RemoveObjectAction,
  UpdateObjectAction,
  EditorHistory,
} from './editor/history'

import {
  UI
} from './editor/ui'

import {
  queryStringSet,
  watch,
  memo,
  randomBytes,
  fpsCounter,
} from './utils'

import {
  appendElement,
  attachDragable,
  LocationSearch,
  LoadingScreen,
  KeyEmitter,
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

export const TAGS = {
  object: 'tag-object',
  block: 'tag-block',
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

; (async function() {
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

    map = await loadSavedMap(),

    cursor = new Cursor('cursor', scene, (mesh: Mesh) => Tags.MatchesQuery(mesh, TAGS.block)),
    lastSelection = new SelectionBox('select', scene),

    chunks = new Chunks('chunk', scene, assets.tiles, map.chunksData),
    grid = new GridPlane('grids', scene, chunks.chunkSize),

    ui = new UI(assets.tiles, assets.classes),
    editorHistory = new EditorHistory(),

    objectManager = {
      create(id: string, clsId: number, position: Vector3, args = { }) {
        objectManager.destroy(id)
        try {
          const object = game.createObject(id, clsId, position, args)
          map.objectsData[id] = JSON.parse(JSON.stringify({ clsId, args }))
          Tags.AddTagsTo(object, TAGS.object)
          selectedObject = object
        }
        catch (err) {
          console.warn(`restore object failed: ${err && err.message || err}`)
        }
      },
      destroy(id: string) {
        const object = scene.getMeshByName(id)
        if (object) {
          object.dispose()
        }
        if (selectedObject === object) {
          selectedObject = null
        }
        delete map.objectsData[id]
      }
    }

  let selectedPixel: { t: number, h: number },
    selectedObject: AbstractMesh,
    toolbarDragStarted: { x: number, y: number }

  // use shift to draw rectangles
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'brushes' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    const { t } = ui.selectedTilePixel, { x, z } = cursor.hover
    selectedPixel = { t: t === '?' ? chunks.getPixel(x, z).t : t && parseInt(t), h: 0 }

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { minimum, maximum } = cursor
    lastSelection.position.copyFrom(maximum.add(minimum).scale(0.5))
    lastSelection.scaling.copyFrom(maximum.subtract(minimum))
  }, _ => {
    const { minimum, maximum } = cursor, { h } = ui.selectedTilePixel,
      pixel = { t: selectedPixel.t, h: h && maximum.y - 1 + parseInt(h) }
    for (let m = minimum.x; m < maximum.x; m ++) {
      for (let n = minimum.z; n < maximum.z; n ++) {
        editorHistory.push(new SetPixelAction(chunks, m, n, pixel))
      }
    }
    editorHistory.commit()
  })

  // use ctrl key to draw pixels
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'brushes' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const { t, h } = ui.selectedTilePixel, { x, z } = cursor.hover
    selectedPixel = {
      t: t === '?' ? chunks.getPixel(x, z).t : t && parseInt(t),
      h: h && cursor.hover.y + parseInt(h)
    }
    editorHistory.push(new SetPixelAction(chunks, x, z, selectedPixel))

    cursor.alpha = 0

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { x, z } = cursor.hover
    editorHistory.push(new SetPixelAction(chunks, x, z, selectedPixel))

    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    cursor.alpha = 1

    editorHistory.commit()
  })

  // use shift key to select objects
  attachDragable(_ => {
    return ui.activePanel === 'objects' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    // mouse down
  }, _ => {
    // mouse move
  }, _ => {
    const box = new BoundingBox(cursor.minimum, cursor.maximum),
      objs = scene.getMeshesByTags(TAGS.object).filter(mesh => box.intersectsPoint(mesh.position)),
      index = objs.indexOf(selectedObject as Mesh)
    selectedObject = objs[(index + 1) % objs.length]
  })

  // use ctrl key to create objects
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'objects' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const clsId = ui.selectedClassIndex,
      { clsName, args } = assets.classes.find(c => c.clsId === clsId),
      id = ['object', clsName, randomBytes()].join('/'),
      pos = cursor.hover.add(new Vector3(0.5, 0, 0.5)),
      uniqueTag = args.editorSingletonId as string
    if (uniqueTag) scene.getMeshesByTags(uniqueTag).forEach(object => {
      editorHistory.push(new RemoveObjectAction(objectManager, object, map.objectsData[object.name]))
    })
    editorHistory.push(new CreateObjectAction(objectManager, id, clsId, pos))
    if (uniqueTag) {
      Tags.AddTagsTo(scene.getMeshByName(id), uniqueTag)
    }
  }, _ => {
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    editorHistory.push(new MoveObjectAction(chunks, selectedObject.name, pos))
  }, _ => {
    editorHistory.commit()

    map.saveDebounced(chunks)
  })

  chunks.on('height-updated', chunk => {
    const pos = chunk.top.position, size = chunks.chunkSize,
      box = new BoundingBox(pos, pos.add(new Vector3(size, 0, size)))
    scene.getMeshesByTags(TAGS.object).forEach(mesh => {
      const { x, y, z } = mesh.position
      if (box.intersectsPoint(new Vector3(x, pos.y, z))) {
        const height = chunks.getPixel(x, z).h,
          origin = new Vector3(x, Math.max(y, height) + 0.1, z),
          direction = new Vector3(0, -1, 0),
          picked = scene.pickWithRay(new Ray(origin, direction), cursor.pickFilter)
        mesh.position.y = picked.hit && picked.getNormal().y > 0.9 ? picked.pickedPoint.y : height
      }
    })
    map.saveDebounced(chunks)
  })
  chunks.on('tile-updated', () => {
    map.saveDebounced(chunks)
  })

  chunks.on('chunk-loaded', chunk => {
    Tags.AddTagsTo(chunk.top, TAGS.block)
    Tags.AddTagsTo(chunk.side, TAGS.block)
  })

  ui.on('tile-selected', () => {
    if (keys.showCursor) {
      const { position, scaling } = lastSelection,
        minimum = position.subtract(scaling.scale(0.5)),
        maximum = position.add(scaling.scale(0.5)),
        pixel = ui.selectedTilePixel
      for (let m = minimum.x; m < maximum.x; m ++) {
        for (let n = minimum.z; n < maximum.z; n ++) {
          editorHistory.push(new SetPixelAction(chunks, m, n, pixel as any))
        }
      }
      editorHistory.commit()
    }
  })

  camera.lowerBetaSoftLimit = camera.lowerBetaLimit
  camera.upperRadiusSoftLimit = camera.upperRadiusLimit
  ui.on('panel-changed', () => {
    lastSelection.isVisible = ui.activePanel === 'brushes'
    game.objectSource.renderingGroupId = ui.activePanel === 'objects' ? 1 : 0
  })

  const objectToolbar = document.getElementById('objectToolbar')
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'objects' && !keys.ctrlKey && !keys.shiftKey
  }, _ => {
    objectToolbar.classList.add('dragging')
  }, _ => {
    // mouse move
  }, _ => {
    objectToolbar.classList.remove('dragging')
  })

  attachDragable(objectToolbar.querySelector('.move-object') as HTMLElement, evt => {
    toolbarDragStarted = { ...cursor.offset }

    cursor.offset.x = parseFloat(objectToolbar.style.left) - evt.clientX
    cursor.offset.y = parseFloat(objectToolbar.style.top) - evt.clientY
    cursor.updateFromPickTarget(evt)
  }, evt => {
    const pos = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    editorHistory.push(new MoveObjectAction(chunks, selectedObject.name, pos))

    objectToolbar.style.left = (evt.clientX + cursor.offset.x) + 'px'
    objectToolbar.style.top = (evt.clientY + cursor.offset.y) + 'px'
  }, _ => {
    cursor.offset.x = toolbarDragStarted.x
    cursor.offset.y = toolbarDragStarted.y
    toolbarDragStarted = null

    editorHistory.commit()

    map.saveDebounced(chunks)
  })
  objectToolbar.querySelector('.focus-object').addEventListener('click', _ => {
    camera.followTarget.copyFrom(selectedObject.position)
  })
  objectToolbar.querySelector('.remove-object').addEventListener('click', _ => {
    editorHistory.commit(new RemoveObjectAction(objectManager, selectedObject, map.objectsData[selectedObject.name]))
    map.saveDebounced(chunks)
  })
  objectToolbar.querySelector('.cancel-select').addEventListener('click', _ => {
    selectedObject = null
  })

  const configDisplaySSAO = document.getElementById('configDisplaySSAO') as HTMLInputElement
  configDisplaySSAO.checked = !!localStorage.getItem('config-display-ssao')
  configDisplaySSAO.checked && new SSAORenderingPipeline('ssaopipeline', scene, 1, [camera])
  document.getElementById('configApplyDisplay').addEventListener('click', _ => {
    localStorage.setItem('config-display-ssao', configDisplaySSAO.checked ? '1' : '')
    location.reload()
  })

  document.getElementById('configOpenNewWindow').addEventListener('click', _ => {
    const history = [{ url: 'data:text/json;charset=utf-8,' + encodeURIComponent(map.toJSON(chunks)) }],
      queryDict = { 'stage-history': JSON.stringify(history), 'stage-start': 'play' },
      queryString = queryStringSet(location.search.replace(/^\?/, ''), queryDict)
    location.href = location.href.replace(/\/editor.html.*/, '') + '?' + queryString
  })

  const objectHoverCursor = game.objectSource.createInstance('object-hover')
  objectHoverCursor.scaling.copyFromFloats(1.15, 1.15, 1.15)
  objectHoverCursor.isVisible = false
  const objectHoverInfo = document.getElementById('objectHoverInfo') as HTMLDivElement
  canvas.addEventListener('mousemove', evt => {
    if (objectHoverCursor.isVisible = ui.activePanel === 'objects') {
      const ray = scene.createPickingRay(evt.clientX, evt.clientY, null, scene.activeCamera),
        picked = scene.pickWithRay(ray, mesh => Tags.MatchesQuery(mesh, TAGS.object))
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
    if (ui.activePanel === 'brushes') {
      const { hover, isVisible, isKeyDown, minimum, maximum } = cursor
      brushHoverInfo.innerHTML = `${hover.x}, ${hover.z}` +
        (isVisible && isKeyDown ? `: ${minimum.x}, ${minimum.z} ~ ${maximum.x}, ${maximum.z}` : '')
    }
  })

  document.getElementById('configDownloadMap').addEventListener('click', _ => {
    const s = map.toJSON(chunks)
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
    ui.activePanel === 'brushes' ? pixelHeightNames[ui.selectedTilePixel.h] : ui.activePanel,
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

  const renderListeners = [
    watch(() => {
      return ui.activePanel === 'objects' && selectedObject
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

        const binder = newObject as any as ObjectEditable,
          content = appendElement('table', { }, container)
        binder.attachEditorContent && binder.attachEditorContent(content, update => {
          editorHistory.push(new UpdateObjectAction(map.objectsData, newObject, update))
          map.saveDebounced(chunks)
        })
      }
      editorHistory.commit()
    }),
    () => {
      if (ui.activePanel === 'objects' && selectedObject && !toolbarDragStarted) {
        const src = selectedObject.position,
          viewport = camera.viewport.toGlobal(canvas.width, canvas.height),
          pos = Vector3.Project(src, Matrix.Identity(), scene.getTransformMatrix(), viewport)
        objectToolbar.style.left = pos.x + 'px'
        objectToolbar.style.top = pos.y + 'px'
      }
    }
  ]

  const fpsCounterText = document.getElementById('fpsCounterText'),
    computeFps = fpsCounter()
  scene.registerBeforeRender(() => {
    renderListeners.forEach(poll => poll())

    fpsCounterText.textContent = computeFps().toFixed(1) + 'fps'

    if (cursor.isVisible) {
      const { x, z } = cursor.hover, g = chunks.chunkSize,
        p = grid.position, s = grid.scaling
      if (x < p.x - s.x / 2) grid.position.x -= g
      if (x > p.x + s.x / 2) grid.position.x += g
      if (z < p.z - s.z / 2) grid.position.z -= g
      if (z > p.z + s.z / 2) grid.position.z += g
    }
  })

  Object.keys(map.objectsData).forEach(id => {
    const { x, y, z, clsId, args } = map.objectsData[id]
    objectManager.create(id, clsId, new Vector3(x, y, z), args)
  })
  selectedObject = null

  await new Promise(resolve => setTimeout(resolve, 800))
  LoadingScreen.hide()
})()
