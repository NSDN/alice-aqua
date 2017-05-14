import {
  Vector3,
} from '../babylon'

import {
  debounce,
  deepClone,
  EventEmitter,
} from '../utils'

import {
  requestUploadingText,
  LocationSearch,
} from '../utils/dom'

import {
  ObjectSaveData,
  MapSaveData,
  TerrainSaveData,
  Game,
} from '../game'

import {
  ObjectBase,
} from '../game/objbase'

import Terrain from '../game/terrain'

export interface MapObjectData extends ObjectSaveData {
  terrainId: string
}

export default class EditorMap extends EventEmitter<{
  'object-created': ObjectBase
  'object-removed': ObjectBase
  'terrain-activated': Terrain
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

  static upload() {
    const projRestoreURL = location.href.split(location.host).pop()
    requestUploadingText().then(projSavedMap => LocationSearch.set({ projSavedMap, projRestoreURL }))
  }

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
    for (const id of Object.keys(mapData.terrains || { })) {
      const terrain = map.createTerrianIfNotExists(id, mapData.terrains[id])
      await new Promise(resolve => terrain.once('loaded', resolve as any))
    }
    for (const id of Object.keys(mapData.objects || { })) {
      const { clsId, x, y, z, terrainId, args } = mapData.objects[id] as MapObjectData
      map.createObject(id, clsId, new Vector3(x, y, z), terrainId, args)
    }

    return map
  }

  static reset() {
    localStorage.setItem('saved-map', '{ }')
    location.reload()
  }
}