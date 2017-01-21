import {
  Color3,
  Scene,
  LinesMesh,
  Mesh,
  StandardMaterial,
  DynamicTexture,
  Texture,
  VertexData,
} from '../babylon'

import {
  VERTEX_GROUND,
  getBoundingVertexData,
} from '../utils/babylon'

import {
  appendElement,
  drawIconFont,
  LocationSearch,
} from '../utils/dom'

import {
  debounce,
} from '../utils'

import {
  SavedMap,
} from '../game'

import Chunks from '../game/chunks'

export function createDataURLFromIconFontAndSub(mainClass: string, subClass: string, size: number = 32, color = '#333') {
  const attrs = { width: size, height: size },
    canvas = appendElement('canvas', attrs) as HTMLCanvasElement,
    dc = canvas.getContext('2d')
  dc.fillStyle = color

  drawIconFont(dc, mainClass, size * 0.1, size * 0.1, size * 0.8)
  if (subClass) {
    drawIconFont(dc, subClass, 0, 0, size * 0.5)
  }

  const url = canvas.toDataURL()
  canvas.parentNode.removeChild(canvas)
  return url
}

export async function loadSavedMap() {
  const toJSON = function(chunks: Chunks) {
    const chunksData = chunks.serialize(),
      objectsData = savedMap.objectsData
    Object.keys(objectsData).forEach(id => {
      const { clsId, args } = objectsData[id],
        { x, y, z } = chunks.scene.getMeshByName(id).position
      objectsData[id] = { args, clsId, x, y, z }
    })
    return JSON.stringify({ objectsData, chunksData })
  }

  const saveDebounced = debounce((chunks: Chunks) => {
    const dataToSave = toJSON(chunks)
    localStorage.setItem('saved-map', dataToSave)
    console.log(`save chunk data ok (${dataToSave.length} bytes)`)
  }, 1000)

  const reset = () => {
    localStorage.setItem('saved-map', '{ }')
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

  savedMap = Object.assign({ chunksData: { }, objectsData: { } } as SavedMap, savedMap)
  return { saveDebounced, reset, toJSON, ...savedMap }
}

export class SelectionBox extends LinesMesh {
  constructor(name: string, scene: Scene) {
    super(name, scene)
    this.scaling.copyFromFloats(0, 0, 0)
    getBoundingVertexData(0.3, 0.3, 0.3, false).applyToMesh(this)
    this.color = new Color3(1, 0.5, 0.5)
    this.renderingGroupId = 1
  }
}

export class ObjectBoundary extends Mesh {
  constructor(name: string, scene: Scene) {
    super(name, scene)

    const positions = [
       0.5, -0.01,  0.5,
       0.5, -0.01, -0.5,
      -0.5, -0.01, -0.5,
      -0.5, -0.01,  0.5,
    ]
    const indices = [
      0, 1, 2,
      1, 2, 3,
      2, 3, 0,
      3, 0, 1,
    ]
    Object.assign(new VertexData(), { positions, indices }).applyToMesh(this)

    const material = this.material = new StandardMaterial(name + '/mat', scene)
    material.wireframe = true
    material.emissiveColor = new Color3(1, 0.5, 0.5)
    material.disableLighting = true

    this.isVisible = false
  }
}

export class GridPlane extends Mesh {
  constructor(name: string, scene: Scene, count: number) {
    super(name, scene)
    const pixel = 32, size = count * pixel, repeat = 2

    VERTEX_GROUND.applyToMesh(this)
    this.position.y = -0.001
    this.scaling.copyFromFloats(count * repeat, 1, count * repeat)

    const material = this.material = new StandardMaterial(name + '/grid', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()

    const texture = material.diffuseTexture = new DynamicTexture(name + '/grid', size, scene, true),
      dc = texture.getContext()
    dc.strokeStyle = '#aaaaaa'
    dc.lineWidth = 3
    dc.strokeRect(0, 0, size, size)
    dc.strokeStyle = '#666666'
    dc.lineWidth = 1
    for (let v = 0; v < size; v += pixel) {
      dc.moveTo(0, v)
      dc.lineTo(size, v)
      dc.stroke()
      dc.moveTo(v, 0)
      dc.lineTo(v, size)
      dc.stroke()
    }
    texture.hasAlpha = true
    texture.uScale = texture.vScale = repeat
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE
    texture.update()
  }
}
