import {
  Color3,
  Scene,
  LinesMesh,
  Mesh,
  StandardMaterial,
  DynamicTexture,
  Texture,
  VertexData,
  Vector3,
} from '../babylon'

import {
  VERTEX_GROUND,
  getBoundingVertexData,
  ColorWireframeNoLightingMaterial,
} from '../utils/babylon'

import {
  appendElement,
  drawIconFont,
  LocationSearch,
} from '../utils/dom'

import {
  debounce,
  deepClone,
  EventEmitter,
} from '../utils'

import {
  ObjectSaveData,
  MapSaveData,
  TerrainSaveData,
  Game,
} from '../game'

import {
  ObjectBase,
} from '../game/objbase'

import Terrain, {
  Chunk,
} from '../game/terrain'

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

export interface MapObjectData extends ObjectSaveData {
  terrainId: string
}

export class EditorMap extends EventEmitter<{
  'object-created': ObjectBase
  'object-removed': ObjectBase
  'terrain-activated': Terrain
  'tile-updated': { terrain: Terrain }
  'height-updated': { terrain: Terrain, chunk: Chunk }
  'chunk-loaded': { terrain: Terrain, chunk: Chunk }
  'terrain-moved': { terrain: Terrain, delta: Vector3 }
}> {
  readonly objects = { } as { [id: string]: MapObjectData }
  readonly terrains = { } as { [id: string]: Terrain }

  private constructor(private game: Game) {
    super()
  }

  private _activeTerrain: Terrain
  get activeTerrain() {
    return this._activeTerrain
  }
  set activeTerrain(terrain) {
    if (this._activeTerrain && this._activeTerrain !== terrain) {
      this._activeTerrain.visibility = 0.5
    }
    if (this._activeTerrain = terrain) {
      this._activeTerrain.isVisible = true
      this._activeTerrain.visibility = 1
      this.emit('terrain-activated', this._activeTerrain)
    }
  }

  createTerrianIfNotExists(id: string, data = { } as TerrainSaveData) {
    if (this.terrains[id]) {
      return this.terrains[id]
    }

    const { x, y, z } = data,
      { scene, assets } = this.game,
      terrain = new Terrain(id, scene, assets.tiles, data, new Vector3(x || 0, y || 0, z || 0))
    terrain.on('chunk-loaded', chunk => {
      this.emit('chunk-loaded', { terrain, chunk })
    })
    terrain.on('tile-updated', () => {
      this.emit('tile-updated', { terrain })
      this.saveDebounced()
    })
    terrain.on('height-updated', chunk => {
      this.emit('height-updated', { terrain, chunk })
      this.saveDebounced()
    })
    terrain.on('position-updated', delta => {
      this.emit('terrain-moved', { terrain, delta })
      this.saveDebounced()
    })
    terrain.visibility = 0.5
    return this.terrains[id] = terrain
  }

  createObject(id: string, clsId: number, position: Vector3, terrainId: string, args = { }) {
    this.destroyObject(id)
    const object = this.game.createObject(id, clsId, position, args)
    this.objects[id] = deepClone({ clsId, args, terrainId, ...position })
    this.emit('object-created', object)
    return object
  }
  destroyObject(id: string) {
    const object = this.game.scene.getMeshByName(id)
    delete this.objects[id]
    if (object) {
      this.emit('object-removed', object as ObjectBase)
      object.dispose()
    }
    return object
  }

  toJSON() {
    const mapData = { terrains: { }, objects: { } } as MapSaveData
    Object.keys(this.terrains).forEach(id => {
      const { x, y, z } = this.terrains[id].position,
        data = this.terrains[id].serialize()
      mapData.terrains[id] = { ...data, x, y, z }
    })
    Object.keys(this.objects).forEach(id => {
      const { x, y, z } = this.game.scene.getMeshByName(id).position,
        data = this.objects[id]
      mapData.objects[id] = { ...data, x, y, z }
    })
    return JSON.stringify(mapData)
  }

  saveDebounced = debounce(() => {
    const dataToSave = this.toJSON()
    localStorage.setItem('saved-map', dataToSave)
    console.log(`save chunk data ok (${dataToSave.length} bytes)`)
  }, 1000)

  static async load(game: Game) {
    let dataToLoad: string
    if (dataToLoad = LocationSearch.get('projSavedMap')) {
      console.log(`loaded from query string (${dataToLoad.length} bytes)`)
      history.pushState('', document.title, LocationSearch.get('projRestoreURL'))
      localStorage.setItem('saved-map', dataToLoad)
    }
    else if (dataToLoad = localStorage.getItem('saved-map')) {
      console.log(`loaded from localStorage (${dataToLoad.length} bytes)`)
    }

    let mapData = { } as MapSaveData
    try {
      Object.assign(mapData, JSON.parse(dataToLoad))
    }
    catch (err) {
      console.error(err)
    }

    const map = new EditorMap(game)
    Object.keys(mapData.terrains || { }).forEach(id => {
      map.createTerrianIfNotExists(id, mapData.terrains[id])
    })
    Object.keys(mapData.objects || { }).forEach(id => {
      const { clsId, x, y, z, terrainId, args } = mapData.objects[id] as MapObjectData
      map.createObject(id, clsId, new Vector3(x, y, z), terrainId, args)
    })

    return map
  }

  reset() {
    localStorage.setItem('saved-map', '{ }')
  }
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
       0.5, -0,  0.5,
       0.5, -0, -0.5,
      -0.5, -0, -0.5,
      -0.5, -0,  0.5,
    ]
    const indices = [
      0, 1, 2,
      1, 2, 3,
      2, 3, 0,
      3, 0, 1,
    ]
    Object.assign(new VertexData(), { positions, indices }).applyToMesh(this)

    this.material = ColorWireframeNoLightingMaterial.getCached(scene, Color3.Red())
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
