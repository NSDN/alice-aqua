import Player from './objs/player'
import Cursor from './objs/cursor'
import Slope from './objs/slope'
import ObjectGenerator from './objs/object-generator'

import Chunks, { ChunkData } from './utils/chunks'

import {
  Mesh,
  Vector3,
  Ray,
  BoundingBox,
  Tags,
  Matrix,
  InstancedMesh,
  AbstractMesh,
} from './babylon'

import {
  UI
} from './ui'

import {
  createScene,
  createFpsCounter,
  createKeyStates,
  createObjectFrame,
  createSelectionBox,
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

; (async function() {
  const { scene, camera } = createScene(),
    { keys } = createKeyStates(),
    map = await loadSavedMap(),
    assets = await loadAssets(scene),
    frame = createObjectFrame(scene),
    lastSelection = createSelectionBox(scene),
    canvas = scene.getEngine().getRenderingCanvas()

  const tags = [TAGS.block, Slope.GROUND_TAG].join(' || '),
    cursor = new Cursor('cursor', scene, (mesh: Mesh) => Tags.MatchesQuery(mesh, tags))

  // use shift to draw rectangles
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'brushes' && !keys.ctrlKey && keys.shiftKey
  }, _ => {
    const { t, h } = ui.selectedTilePixel,
      { x, z } = cursor.hover
    selectedPixel = {
      t: t < 0 ? chunks.getPixel(x, z).t : t,
      h: h && cursor.hover.y + parseInt(h)
    }

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { minimum, maximum } = cursor
    lastSelection.position.copyFrom(maximum.add(minimum).scale(0.5))
    lastSelection.scaling.copyFrom(maximum.subtract(minimum))
  }, _ => {
    const { minimum, maximum } = cursor,
      { h } = ui.selectedTilePixel,
      pixel = { t: selectedPixel.t, h: h && maximum.y - 1 + parseInt(h) }
    for (let m = minimum.x; m < maximum.x; m ++) {
      for (let n = minimum.z; n < maximum.z; n ++) {
        chunks.setPixel(m, n, pixel)
      }
    }
  })

  let selectedPixel: { t: number, h: number }
  // use ctrl key to draw pixels
  attachDragable(evt => {
    return evt.target === canvas && ui.activePanel === 'brushes' && keys.ctrlKey && !keys.shiftKey
  }, _ => {
    const { t, h } = ui.selectedTilePixel,
      { x, z } = cursor.hover
    selectedPixel = {
      t: t < 0 ? chunks.getPixel(x, z).t : t,
      h: h && cursor.hover.y + parseInt(h)
    }
    chunks.setPixel(x, z, selectedPixel)

    lastSelection.scaling.copyFromFloats(1, 1, 1)
    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
    const { x, z } = cursor.hover
    chunks.setPixel(x, z, selectedPixel)

    lastSelection.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0.5, 0.5)))
  }, _ => {
  })

  let selectedObject: AbstractMesh
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
      const index = ui.selectedClassIndex,
        { clsId, clsName, args, opts, cls } = assets.classes[index],
        rnd = Math.floor(Math.random() * 0xffffffff + 0x100000000).toString(16).slice(1),
        id = ['object', clsName, rnd].join('/'),
        object = new (cls as any)(id, frame, opts) as InstancedMesh
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

  const chunks = new Chunks(scene, assets.tiles, map.chunksData)
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
        mesh.position.y = picked.hit ? picked.pickedPoint.y : height
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
        { opts, cls } = assets.classes.find(s => s.clsId === clsId)
      if (box.intersectsPoint(new Vector3(x, pos.y, z))) {
        const object = new (cls as any)(id, frame, opts) as InstancedMesh
        object.position.copyFromFloats(x, y, z)
        Object.assign(object, args)

        Tags.AddTagsTo(object, TAGS.object)

        delete objectsToRestore[id]
      }
    })
  })

  const ui = new UI(assets.tiles, assets.classes.map(cls => cls.opts))
  ui.addEventListener('tile-selected', () => {
    if (keys.ctrlKey || keys.shiftKey) {
      const { position, scaling } = lastSelection,
        minimum = position.subtract(scaling.scale(0.5)),
        maximum = position.add(scaling.scale(0.5)),
        pixel = ui.selectedTilePixel
      for (let m = minimum.x; m < maximum.x; m ++) {
        for (let n = minimum.z; n < maximum.z; n ++) {
          chunks.setPixel(m, n, pixel)
        }
      }
      cameraTarget.copyFrom(lastSelection.position)
    }
    canvas.focus()
  })

  let playerObject: Player
  ui.addEventListener('panel-changed', (oldPanel: string) => {
    const removeObjTag = 'remove-exit-play-mode'
    if (ui.activePanel === 'play') {
      scene.getMeshesByTags(TAGS.object).forEach(mesh => mesh.isVisible = false)

      const { x, z } = camera.target,
        { h } = chunks.getPixel(x, z)
      playerObject = new Player('remilia', scene, keys)
      playerObject.position.copyFromFloats(x, h + 2, z)
      playerObject.spriteBody.registerBeforeRender(_ => {
        playerObject.updateForward(cameraDirection)
        cameraTarget.copyFrom(playerObject.position)
      })
      Tags.AddTagsTo(playerObject, removeObjTag)

      scene.getMeshesByTags(TAGS.object).forEach(mesh => {
        if (mesh instanceof ObjectGenerator) {
          mesh.createMeshObjects().forEach(object => Tags.AddTagsTo(object, removeObjTag))
        }
      })
    }
    if (oldPanel === 'play') {
      scene.getMeshesByTags(removeObjTag).forEach(mesh => mesh.dispose())
      scene.getMeshesByTags(TAGS.object).forEach( mesh => mesh.isVisible = true)
    }

    lastSelection.isVisible = ui.activePanel === 'brushes'
    frame.renderingGroupId = ui.activePanel === 'objects' ? 1 : 0
    canvas.focus()
  })

  const showDebugLayer = document.getElementById('showDebugLayer') as HTMLInputElement
  showDebugLayer && showDebugLayer.addEventListener('click', _ => {
    showDebugLayer.checked ? scene.debugLayer.show() : scene.debugLayer.hide()
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

  let toolbarDragStarted = null as { x: number, y: number }
  attachDragable(objectToolbar.querySelector('.move-object') as HTMLElement, evt => {
    toolbarDragStarted = { ...cursor.offset }
    cursor.offset.x = parseFloat(objectToolbar.style.left) - evt.clientX
    cursor.offset.y = parseFloat(objectToolbar.style.top) - evt.clientY
  }, evt => {
    selectedObject.position.copyFrom(cursor.hover.add(new Vector3(0.5, 0, 0.5)))
    objectToolbar.style.left = (evt.clientX + cursor.offset.x) + 'px'
    objectToolbar.style.top = (evt.clientY + cursor.offset.y) + 'px'
  }, _ => {
    cursor.offset.x = toolbarDragStarted.x
    cursor.offset.y = toolbarDragStarted.y
    toolbarDragStarted = null
    map.saveDebounced(chunks, objectsToSave)
  })
  objectToolbar.querySelector('.focus-object').addEventListener('click', _ => {
    if (selectedObject) {
      cameraTarget.copyFrom(selectedObject.position)
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

  const configRotateCamera = document.getElementById('configRotateCamera') as HTMLInputElement
  configRotateCamera && configRotateCamera.addEventListener('click', function tick() {
    if (configRotateCamera.checked) {
      camera.alpha += 0.02
      setTimeout(tick, 20)
    }
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

  const renderListeners = [
    watch(() => {
      return (ui.activePanel === 'brushes' || ui.activePanel === 'objects') && (keys.ctrlKey || keys.shiftKey)
    }, shouldDetachCamera => {
      cursor.isVisible = shouldDetachCamera
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
          { binder } = assets.classes.find(c => c.clsId === clsId),
          container = objectToolbar.querySelector('.object-config')
        container.innerHTML = ''

        appendElement('div', { innerHTML: newObject.name }, container)
        binder && binder(appendElement('div', { }, container), newObject, ret => {
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
        if (camera.beta < minBeta && !cursor.isKeyDown) {
          camera.beta = camera.beta * 0.9 + minBeta * 0.1
        }
        const maxRadius = 40
        if (camera.radius > maxRadius && !cursor.isKeyDown) {
          camera.radius = camera.radius * 0.9 + maxRadius * 0.1
        }
      },
    ]
  }

  const cameraTarget = Vector3.Zero(),
    cameraDirection = Vector3.Zero(),
    fpsCounterText = document.getElementById('fpsCounterText'),
    computeFps = createFpsCounter()
  scene.registerBeforeRender(() => {
    cameraDirection.copyFrom(camera.target.subtract(camera.position))
    camera.setTarget(Vector3.Lerp(camera.target, cameraTarget, 0.1))
    camera.setPosition(camera.target.subtract(cameraDirection))

    renderListeners.forEach(poll => poll())
    const cbs = panelListeners[ui.activePanel]
    cbs && cbs.forEach(poll => poll())

    fpsCounterText.textContent = computeFps().toFixed(1) + 'fps'
  })

  setImmediate(() => {
    chunks.getPixel( 1,  1)
    chunks.getPixel(-1,  1)
    chunks.getPixel(-1, -1)
    chunks.getPixel( 1, -1)
  })

})()
