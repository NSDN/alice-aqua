import Terrain from '../game/terrain'

import {
  EditorMap,
} from './'

import {
  Vector3,
  AbstractMesh,
} from '../babylon'

import {
  EventEmitter,
  deepClone,
} from '../utils'

export interface EditorAction {
  exec(): void
  revert(): void
}

export class EditorHistory extends EventEmitter<{ 'change': void }> {
  private dones = [ ] as EditorAction[][]
  private todos = [ ] as EditorAction[][]
  undo() {
    const actions = this.dones.pop()
    if (actions) {
      actions.slice().reverse().forEach(a => a.revert())
      this.todos.unshift(actions)
    }
    this.emit('change', null)
  }
  redo() {
    const actions = this.todos.shift()
    if (actions) {
      actions.forEach(a => a.exec())
      this.dones.push(actions)
    }
    this.emit('change', null)
  }

  private current = [ ] as EditorAction[]
  push(action: EditorAction) {
    this.current.push(action)
  }
  commit(action?: EditorAction) {
    if (action) {
      this.current.push(action)
    }
    if (this.current.length) {
      this.dones.push(this.current.slice())
      this.todos.length = this.current.length = 0
      this.emit('change', null)
    }
  }

  get canUndo() {
    return this.dones.length > 0
  }
  get canRedo() {
    return this.todos.length > 0
  }
}

export class SetPixelAction implements EditorAction {
  constructor(private readonly terrain: Terrain,
    private readonly x: number, private readonly z: number, pixel: { t: number, h: number | string },
    private readonly p = { ...pixel }, private readonly d = terrain.getPixel(x, z)) {
    this.exec()
  }
  exec() {
    this.terrain.setPixel(this.x, this.z, this.p)
  }
  revert() {
    this.terrain.setPixel(this.x, this.z, this.d)
  }
}

export class MoveObjectAction implements EditorAction {
  constructor(private readonly terrain: Terrain,
      private readonly id: string, pos: Vector3,
      readonly newPos = pos.clone(),
      readonly oldPos = terrain.scene.getMeshByName(id).position.clone()) {
    this.exec()
  }
  exec() {
    const { x, z } = this.newPos,
      mesh = this.terrain.scene.getMeshByName(this.id)
    mesh && mesh.position.copyFromFloats(x, this.terrain.getPixel(x, z).h, z)
  }
  revert() {
    const { x, z } = this.oldPos,
      mesh = this.terrain.scene.getMeshByName(this.id)
    mesh && mesh.position.copyFromFloats(x, this.terrain.getPixel(x, z).h, z)
  }
}

export class UpdateObjectAction implements EditorAction {
  constructor(private readonly map: EditorMap,
    object: AbstractMesh, update: any,
    private readonly id = object.name,
    private readonly newArgs = deepClone(update),
    private readonly oldArgs = deepClone(map.objects[id].args),
    private readonly repArgs = { } as any,
    private readonly scene = object.getScene()) {
    const objArgs = object as any
    for (const k in newArgs) {
      if (!(k in oldArgs)) {
        repArgs[k] = deepClone(objArgs[k])
      }
    }
    this.exec()
  }
  exec() {
    Object.assign(this.map.objects[this.id].args, this.newArgs)
    Object.assign(this.scene.getMeshByName(this.id), this.newArgs)
  }
  revert() {
    this.map.objects[this.id].args = this.oldArgs
    Object.assign(this.scene.getMeshByName(this.id), this.oldArgs, this.repArgs)
  }
}

export class CreateObjectAction implements EditorAction {
  constructor(private readonly map: EditorMap,
      private readonly id: string,
      private readonly clsId: number,
      pos: Vector3,
      private readonly terrainId = map.activeTerrain.name,
      private readonly position = pos.clone()) {
    this.exec()
  }
  exec() {
    this.map.createObject(this.id, this.clsId, this.position, this.terrainId)
  }
  revert() {
    this.map.destroyObject(this.id)
  }
}

export class RemoveObjectAction implements EditorAction {
  constructor(private readonly map: EditorMap,
      object: AbstractMesh,
      private readonly id = object.name,
      private readonly data = deepClone(map.objects[id]),
      private readonly position = object.position.clone()) {
    this.exec()
  }
  exec() {
    this.map.destroyObject(this.id)
  }
  revert() {
    this.map.createObject(this.id, this.data.clsId, this.position, this.data.terrainId, this.data.args)
  }
}

export class AddLayerAction implements EditorAction {
  constructor(private readonly map: EditorMap,
      private readonly id: string,
      private readonly oldTerrain = map.activeTerrain) {
    this.exec()
  }
  exec() {
    this.map.activeTerrain = this.map.createTerrianIfNotExists(this.id)
  }
  revert() {
    this.map.terrains[this.id].dispose()
    this.map.activeTerrain = this.oldTerrain
    delete this.map.terrains[this.id]
  }
}

export class MoveLayerAction implements EditorAction {
  constructor(map: EditorMap,
      pos: Vector3,
      private readonly terrain = map.activeTerrain,
      private readonly newPos = pos.clone(),
      private readonly oldPos = terrain.position.clone()) {
    this.exec()
  }
  exec() {
    this.terrain.setPosition(this.newPos)
  }
  revert() {
    this.terrain.setPosition(this.oldPos)
  }
}

export class SelectLayerAction implements EditorAction {
  constructor(private readonly map: EditorMap,
      id: string,
      private readonly newTerrain = map.terrains[id],
      private readonly oldTerrain = map.activeTerrain) {
    this.exec()
  }
  exec() {
    this.map.activeTerrain = this.newTerrain
  }
  revert() {
    this.map.activeTerrain = this.oldTerrain
  }
}

export class RemoveLayerAction implements EditorAction {
  constructor(private readonly map: EditorMap,
      terrain = map.activeTerrain,
      private readonly oldTerrainData = deepClone({ ...terrain.serialize(), ...terrain.position, id: terrain.name }),
      private readonly newTerrainName = Object.keys(map.terrains).filter(id => id !== terrain.name).pop()) {
    this.exec()
  }
  exec() {
    this.map.terrains[this.oldTerrainData.id].dispose()
    delete this.map.terrains[this.oldTerrainData.id]
    this.map.activeTerrain = this.map.terrains[this.newTerrainName]
  }
  revert() {
    this.map.activeTerrain = this.map.createTerrianIfNotExists(this.oldTerrainData.id, this.oldTerrainData)
  }
}

