import Chunks from './utils/chunks'

import {
  Vector3,
  Color3,
  Scene,
  AbstractMesh,
  LinesMesh,
  Mesh,
  StandardMaterial,
  DynamicTexture,
  Texture,
} from './babylon'

import {
  VERTEX_GROUND,
  getBoundingVertexData,
} from './utils/babylon'

import {
  appendElement,
  drawIconFont,
} from './utils/dom'

export function createDataURLFromIconFontAndSub(className: string, subText: string, size: number = 24, color = '#333') {
  const attrs = { width: size, height: size },
    canvas = appendElement('canvas', attrs) as HTMLCanvasElement,
    dc = canvas.getContext('2d')
  dc.fillStyle = color
  dc.textAlign = 'center'
  dc.textBaseline = 'middle'

  drawIconFont(dc, className, size / 2, size / 2, size)
  if (subText) {
    dc.font = `${size * 0.8}px arial`
    dc.fillText(subText, size * 0.2, size * 0.2)
  }

  const url = canvas.toDataURL()
  canvas.parentNode.removeChild(canvas)
  return url
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

export class GridPlane extends Mesh {
  constructor(name: string, scene: Scene, count: number) {
    super(name, scene)

    const pixel = 32, size = count * pixel, repeat = 2,
      texture = new DynamicTexture('grid', size, scene, true),
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

    const grid = new Mesh('grid', scene)
    VERTEX_GROUND.applyToMesh(grid)
    grid.scaling.copyFromFloats(count * repeat, 1, count * repeat)
    grid.position.y = 0.001

    const material = grid.material = new StandardMaterial(name + '/grid', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()
    material.diffuseTexture = texture
  }
}

export interface EditorAction {
  exec(): void
  revert(): void
}

export class EditorHistory {
  private history = [ ] as EditorAction[][]
  private todos = [ ] as EditorAction[][]
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
  push(actions: EditorAction[]) {
    this.history.push(actions.slice())
    this.todos.length = 0
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
      private readonly newPos = pos.clone(),
      private readonly oldPos = chunks.scene.getMeshByName(id).position.clone()) {
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
