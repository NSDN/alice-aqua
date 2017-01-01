import { ObjectElementBinder, ObjectPlayListener } from './objs/object-base'
import Player, { PlayerGenerator } from './objs/player'
import Cursor from './objs/cursor'
import Chunks, { ChunkData } from './utils/chunks'

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
  UI
} from './ui'

import {
  createScene,
  createFpsCounter,
  createKeyStates,
  createSkyBox,
  createObjectFrame,
  createSelectionBox,
  createGridPlane,
  loadAssets,
  loadSavedMap,
  TAGS,
} from './game'

import {
  watch,
} from './utils'

import {
  appendElement,
  attachDragable,
  LocationSearch,
} from './utils/dom'

interface Action {
  exec(): void
  revert(): void
}

class History {
  private history = [ ] as Action[][]
  private todos = [ ] as Action[][]
  undo() {
    const actions = this.history.pop()
    if (actions) {
      actions.reverse().forEach(a => a.revert())
      this.todos.unshift(actions)
    }
  }
  redo() {
    const actions = this.todos.shift()
    if (actions) {
      actions.forEach(a => a.exec())
      this.history.push(actions)
    }
  }
  push(actions: Action[]) {
    this.history.push(actions.slice())
    this.todos.length = 0
  }
}

; (async function() {
  const { scene, camera, canvas2d } = createScene(),
    { keys } = createKeyStates(),
    canvas = scene.getEngine().getRenderingCanvas(),

    map = await loadSavedMap(),
    objectsToRestore = { ...map.objectsData },
    objectsToSave = { ...map.objectsData },

    assets = await loadAssets(scene),

    source = createObjectFrame(scene),

    cursor = new Cursor('cursor', scene, (mesh: Mesh) => Tags.MatchesQuery(mesh, TAGS.block)),
    lastSelection = createSelectionBox(scene),

    chunks = new Chunks(scene, assets.tiles, map.chunksData),
    grid = createGridPlane(scene, chunks.chunkSize),

    ui = new UI(assets.tiles, assets.classes.map(cls => ({ ...cls, ...cls.icon }))),
    editorHistory = new History()

  let selectedPixel: { t: number, h: number },
    selectedObject: AbstractMesh,
    toolbarDragStarted: { x: number, y: number }

  class SetPixelAction implements Action {
    constructor(private readonly x: number, private readonly z: number, pixel: typeof selectedPixel,
      private readonly p = { ...pixel }, private readonly d = chunks.getPixel(x, z)) {
      this.exec()
    }
    exec() {
      chunks.setPixel(this.x, this.z, this.p)
    }
    revert() {
      chunks.setPixel(this.x, this.z, this.d)
    }
  }

  class MoveObjectAction implements Action {
    constructor(private readonly m: AbstractMesh,
        private readonly px: number, private readonly pz: number,
        private readonly dx = m.position.x, private readonly dz = m.position.z) {
      this.exec()
    }
    exec() {
      const { px, pz } = this
      this.m.position.copyFromFloats(px, chunks.getPixel(px, pz).h, pz)
    }
    revert() {
      const { dx, dz } = this
      this.m.position.copyFromFloats(dx, chunks.getPixel(dx, dz).h, dz)
    }
  }

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
      pixel = { t: selectedPixel.t, h: h && maximum.y - 1 + parseInt(h) },
      actions = [ ] as Action[]
    for (let m = minimum.x; m < maximum.x; m ++) {
      for (let n = minimum.z; n < maximum.z; n ++) {
        actions.push(new SetPixelAction(m, n, pixel))
      }
    }
    editorHistory.push(actions)
  })

  // use ctrl key to draw pixels
  const setPixelActions = [ ] as Action[]
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'brushes' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const { t, h } = ui.selectedTilePixel, { x, z } = cursor.hover
    selectedPixel = {
      t: t === '?' ? chunks.getPixel(x, z).t : t && parseInt(t),
      h: h && cursor.hover.y + parseInt(h)
    }
    setPixelActions.push(new SetPixelAction(x, z, selectedPixel))

    cursor.alpha = 0

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { x, z } = cursor.hover
    setPixelActions.push(new SetPixelAction(x, z, selectedPixel))

    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    cursor.alpha = 1

    editorHistory.push(setPixelActions)
    setPixelActions.length = 0
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
      objs = scene.getMeshesByTags(TAGS.object)
    selectedObject = objs.find(mesh => box.intersectsPoint(mesh.position))
  })

  // use ctrl key to create objects
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'objects' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const box = new BoundingBox(cursor.minimum, cursor.maximum),
      objs = scene.getMeshesByTags(TAGS.object)
    selectedObject = objs.find(mesh => box.intersectsPoint(mesh.position))
    if (!selectedObject) {
      const clsId = ui.selectedClassIndex,
        { clsName, args, icon, cls } = assets.classes.find(c => c.clsId === clsId),
        rnd = Math.floor(Math.random() * 0xffffffff + 0x100000000).toString(16).slice(1),
        id = ['object', clsName, rnd].join('/'),
        object = new cls(id, { icon, keys, source, canvas2d })
      object.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0, 0.5)))
      Object.assign(object, args)
      objectsToSave[id] = JSON.parse(JSON.stringify({ clsId, args }))

      Tags.AddTagsTo(object, TAGS.object)

      selectedObject = object
    }
  }, _ => {
    selectedObject.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0, 0.5)))
  }, _ => {
    map.saveDebounced(chunks, objectsToSave)
  })

  chunks.addEventListener('height-updated', (chunk: ChunkData) => {
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
    map.saveDebounced(chunks, objectsToSave)
  })
  chunks.addEventListener('tile-updated', () => {
    map.saveDebounced(chunks, objectsToSave)
  })

  chunks.addEventListener('chunk-loaded', (chunk: ChunkData) => {
    Tags.AddTagsTo(chunk.top, TAGS.block)
    Tags.AddTagsTo(chunk.side, TAGS.block)

    const pos = chunk.top.position, size = chunks.chunkSize,
      box = new BoundingBox(pos, pos.add(new Vector3(size, 0, size)))
    Object.keys(objectsToRestore).forEach(id => {
      const { x, y, z, clsId, args } = objectsToRestore[id]
      if (box.intersectsPoint(new Vector3(x, pos.y, z))) {
        const clsFound = assets.classes.find(s => s.clsId === clsId)
        if (clsFound) {
          const { icon, cls } = clsFound,
            object = new cls(id, { icon, keys, source, canvas2d })
          object.position.copyFromFloats(x, y, z)
          Object.assign(object, args)
          Tags.AddTagsTo(object, TAGS.object)
        }
        else {
          console.warn('class ' + clsId + ' is not found! Ignoring object #' + id)
        }
        delete objectsToRestore[id]
      }
    })
  })

  ui.addEventListener('tile-selected', () => {
    if (keys.ctrlKey || keys.shiftKey) {
      const { position, scaling } = lastSelection,
        minimum = position.subtract(scaling.scale(0.5)),
        maximum = position.add(scaling.scale(0.5)),
        pixel = ui.selectedTilePixel,
        actions = [ ] as Action[]
      for (let m = minimum.x; m < maximum.x; m ++) {
        for (let n = minimum.z; n < maximum.z; n ++) {
          actions.push(new SetPixelAction(m, n, pixel as any))
        }
      }
      editorHistory.push(actions)
    }
    canvas.focus()
  })

  ui.addEventListener('panel-changed', (oldPanel: string) => {
    if (ui.activePanel === 'play') {
      if (scene.getMeshesByTags(PlayerGenerator.PLAYER_GENERATOR_TAG).length === 0) {
        const { x, z } = camera.target,
          { h } = chunks.getPixel(x, z),
          player = new Player('remilia', scene, { keys, canvas2d })
        player.position.copyFromFloats(x, h + 2, z)
        Tags.AddTagsTo(player, 'auto-generated-player')
        console.warn('creating player from camera position...')
      }
      scene.getMeshesByTags(TAGS.object).forEach(mesh => {
        mesh.isVisible = false
        const listener = mesh as any as ObjectPlayListener
        listener.startPlaying && listener.startPlaying()
      })
    }
    if (oldPanel === 'play') {
      scene.getMeshesByTags('auto-generated-player').forEach(mesh => {
        mesh.dispose()
      })
      scene.getMeshesByTags(TAGS.object).forEach(mesh => {
        mesh.isVisible = true
        const listener = mesh as any as ObjectPlayListener
        listener.stopPlaying && listener.stopPlaying()
      })
    }

    grid.isVisible = ui.activePanel === 'brushes' || ui.activePanel === 'objects'
    lastSelection.isVisible = ui.activePanel === 'brushes'
    sky.setIsVisible(ui.activePanel === 'play')
    source.renderingGroupId = ui.activePanel === 'objects' ? 1 : 0
    canvas.focus()
  })

  const objectToolbar = document.getElementById('objectToolbar')
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'objects' && !keys.ctrlKey && !keys.shiftKey
  }, _ => {
    objectToolbar.style.display = 'none'
  }, _ => {
    // mouse move
  }, _ => {
    objectToolbar.style.display = selectedObject ? 'block' : 'none'
  })

  const moveObjectActions = [ ] as Action[]
  attachDragable(objectToolbar.querySelector('.move-object') as HTMLElement, evt => {
    toolbarDragStarted = { ...cursor.offset }

    cursor.offset.x = parseFloat(objectToolbar.style.left) - evt.clientX
    cursor.offset.y = parseFloat(objectToolbar.style.top) - evt.clientY
    cursor.updateFromPickTarget(evt)
  }, evt => {
    const { x, z } = cursor.hover.add(new Vector3(0.5, 0, 0.5))
    moveObjectActions.push(new MoveObjectAction(selectedObject, x, z))

    objectToolbar.style.left = (evt.clientX + cursor.offset.x) + 'px'
    objectToolbar.style.top = (evt.clientY + cursor.offset.y) + 'px'
  }, _ => {
    cursor.offset.x = toolbarDragStarted.x
    cursor.offset.y = toolbarDragStarted.y
    toolbarDragStarted = null

    editorHistory.push(moveObjectActions)
    moveObjectActions.length = 0

    map.saveDebounced(chunks, objectsToSave)
  })
  objectToolbar.querySelector('.focus-object').addEventListener('click', _ => {
    if (selectedObject) {
      camera.followTarget.copyFrom(selectedObject.position)
    }
  })
  objectToolbar.querySelector('.remove-object').addEventListener('click', _ => {
    delete objectsToSave[selectedObject.name]
    map.saveDebounced(chunks, objectsToSave)

    selectedObject.dispose()
    selectedObject = null
  })
  objectToolbar.querySelector('.cancel-select').addEventListener('click', _ => {
    selectedObject = null
  })

  const configDisplaySSAO = document.getElementById('configDisplaySSAO') as HTMLInputElement
  configDisplaySSAO.checked = !!localStorage.getItem('config-display-ssao')
  configDisplaySSAO.checked && new SSAORenderingPipeline('ssaopipeline', scene, 1, [camera])
  const configDisplaySkyBox = document.getElementById('configDisplaySkyBox') as HTMLInputElement
  configDisplaySkyBox.checked = !!localStorage.getItem('config-display-skybox')
  const sky = configDisplaySkyBox.checked && createSkyBox(scene)
  document.getElementById('configApplyDisplay').addEventListener('click', _ => {
    localStorage.setItem('config-display-ssao', configDisplaySSAO.checked ? '1' : '')
    localStorage.setItem('config-display-skybox', configDisplaySkyBox.checked ? '1' : '')
    location.reload()
  })

  const quaterPI = Math.PI / 4
  document.getElementById('playResetCameraAlpha').addEventListener('click', _ => {
    camera.followAlpha = Math.floor(camera.alpha / quaterPI) * quaterPI
  })
  document.getElementById('playSetCameraAlphaInc').addEventListener('click', _ => {
    camera.followAlpha = (Math.floor(camera.alpha / quaterPI + 0.1) + 1) * quaterPI
  })
  document.getElementById('playSetCameraAlphaDec').addEventListener('click', _ => {
    camera.followAlpha = (Math.floor(camera.alpha / quaterPI + 0.1) - 1) * quaterPI
  })

  document.getElementById('configDownloadMap').addEventListener('click', _ => {
    const s = map.toJSON(chunks, objectsToSave)
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
    const isDebugShown = (document.getElementById('DebugLayerOptions') || { } as Element).scrollHeight > 0
    isDebugShown ? scene.debugLayer.hide() : scene.debugLayer.show()
  })
  document.getElementById('docShowHelp').addEventListener('click', _ => {
    const isHelpShown = document.querySelector('.doc-help').scrollHeight > 0
    isHelpShown ? document.body.classList.remove('show-help') : document.body.classList.add('show-help')
  })
  document.getElementById('docHideHelp').addEventListener('click', _ => {
    document.body.classList.remove('show-help')
  })

  keys.on('key', watch(() => {
    return (ui.activePanel === 'brushes' || ui.activePanel === 'objects') && (keys.ctrlKey || keys.shiftKey)
  }, shouldDetachCamera => {
    (cursor.isVisible = shouldDetachCamera) ? camera.detachControl(canvas) : camera.attachControl(canvas, true)
  }, true))()
  keys.on('key', watch(() => {
    return (ui.activePanel === 'brushes' || ui.activePanel === 'objects') && keys.shiftKey && keys.focus
  }, focusCameraToCursor => {
    focusCameraToCursor && camera.followTarget.copyFrom(cursor.hover)
  }, false))
  keys.on('key', watch(() => {
    return (ui.activePanel === 'brushes' || ui.activePanel === 'objects') && keys.ctrlKey && keys.undo
  }, keyDown => {
    keyDown && editorHistory.undo()
  }, false))
  keys.on('key', watch(() => {
    return (ui.activePanel === 'brushes' || ui.activePanel === 'objects') && keys.ctrlKey && keys.redo
  }, keyDown => {
    keyDown && editorHistory.redo()
  }, false))

  const renderListeners = [
    watch(() => {
      return ui.activePanel === 'objects' && selectedObject
    }, (newObject, oldObject) => {
      objectToolbar.style.display = newObject ? 'block' : 'none'
      if (oldObject) {
        oldObject.showBoundingBox = false
        oldObject.getChildMeshes().forEach(child => child.showBoundingBox = false)
      }
      if (newObject) {
        newObject.showBoundingBox = true
        newObject.getChildMeshes().forEach(child => child.showBoundingBox = true)

        const { args } = objectsToSave[newObject.name],
          container = objectToolbar.querySelector('.object-settings')
        container.innerHTML = '<div>' + newObject.name + '</div>'

        const binder = newObject as any as ObjectElementBinder,
          elem = appendElement('div', { }, container)
        binder.bindToElement && binder.bindToElement(elem, ret => {
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
        if (selectedObject && !toolbarDragStarted && objectToolbar.style.display === 'block') {
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
        if (camera.beta < minBeta - 1e-3 && !cursor.isKeyDown) {
          camera.beta = camera.beta * 0.9 + minBeta * 0.1
        }
        const maxRadius = 40
        if (camera.radius > maxRadius + 1e-3 && !cursor.isKeyDown) {
          camera.radius = camera.radius * 0.9 + maxRadius * 0.1
        }
      },
    ]
  }

  const fpsCounterText = document.getElementById('fpsCounterText'),
    computeFps = createFpsCounter()
  scene.registerBeforeRender(() => {
    renderListeners.forEach(poll => poll())

    const cbs = panelListeners[ui.activePanel as keyof typeof panelListeners]
    cbs && cbs.forEach(poll => poll())

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

  setImmediate(() => {
    chunks.getPixel( 1,  1)
    chunks.getPixel(-1,  1)
    chunks.getPixel(-1, -1)
    chunks.getPixel( 1, -1)
  })

})()
