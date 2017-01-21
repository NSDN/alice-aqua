import Chunks from '../game/chunks'

import {
  Vector3,
  AbstractMesh,
} from '../babylon'

import {
  ObjectSaveData,
} from '../game'

import {
  EventEmitter,
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
  constructor(private readonly chunks: Chunks,
    private readonly x: number, private readonly z: number, pixel: { t: number, h: number },
    private readonly p = { ...pixel }, private readonly d = chunks.getPixel(x, z)) {
    this.exec()
  }
  exec() {
    this.chunks.setPixel(this.x, this.z, this.p)
  }
  revert() {
    this.chunks.setPixel(this.x, this.z, this.d)
  }
}

export class MoveObjectAction implements EditorAction {
  constructor(private readonly chunks: Chunks,
      private readonly id: string, pos: Vector3,
      readonly newPos = pos.clone(),
      readonly oldPos = chunks.scene.getMeshByName(id).position.clone()) {
    this.exec()
  }
  exec() {
    const { x, z } = this.newPos,
      mesh = this.chunks.scene.getMeshByName(this.id)
    mesh && mesh.position.copyFromFloats(x, this.chunks.getPixel(x, z).h, z)
  }
  revert() {
    const { x, z } = this.oldPos,
      mesh = this.chunks.scene.getMeshByName(this.id)
    mesh && mesh.position.copyFromFloats(x, this.chunks.getPixel(x, z).h, z)
  }
}

export class UpdateObjectAction implements EditorAction {
  constructor(private readonly objectsData: { [key: string]: ObjectSaveData },
    object: AbstractMesh, update: any,
    private readonly newArgs = JSON.parse(JSON.stringify(update)),
    private readonly oldArgs = JSON.parse(JSON.stringify(objectsData[object.name].args)),
    private readonly repArgs = { },
    private readonly id = object.name,
    private readonly scene = object.getScene()) {
    for (const k in newArgs) {
      if (!(k in oldArgs)) {
        repArgs[k] = JSON.parse(JSON.stringify(object[k]))
      }
    }
    this.exec()
  }
  exec() {
    Object.assign(this.objectsData[this.id].args, this.newArgs)
    Object.assign(this.scene.getMeshByName(this.id), this.newArgs)
  }
  revert() {
    this.objectsData[this.id].args = this.oldArgs
    Object.assign(this.scene.getMeshByName(this.id), this.oldArgs, this.repArgs)
  }
}

export interface ObjectManager {
  create(id: string, clsId: number, position: Vector3, restoreArgs?: any)
  destroy(id: string)
}

export class CreateObjectAction implements EditorAction {
  constructor(private readonly objs: ObjectManager,
      private readonly id: string, private readonly clsId: number, pos: Vector3,
      private readonly position = pos.clone()) {
    this.exec()
  }
  exec() {
    this.objs.create(this.id, this.clsId, this.position)
  }
  revert() {
    this.objs.destroy(this.id)
  }
}

export class RemoveObjectAction implements EditorAction {
  constructor(private readonly objs: ObjectManager,
      object: AbstractMesh,
      data: { clsId: number, args: any },
      private readonly id = object.name,
      private readonly clsId = data.clsId,
      private readonly args = JSON.parse(JSON.stringify(data.args)),
      private readonly position = object.position.clone()) {
    this.exec()
  }
  exec() {
    this.objs.destroy(this.id)
  }
  revert() {
    this.objs.create(this.id, this.clsId, this.position, this.args)
  }
}
