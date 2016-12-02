import {
  Scene,
  Mesh,
  Vector3,
  Color3,
  Material,
  AbstractMesh,
  ActionManager,
  ExecuteCodeAction,
  PhysicsImpostor,
} from '../babylon'

import {
  VERTEX_BOX,
  VERTEX_PLANE,
} from '../utils'

import Trigger from './trigger'

export default class TriggerBoard extends Mesh {
  readonly triggerMesh: Trigger

  constructor(name, scene: Scene, meshes: AbstractMesh[], opts?: {
    ext?: any,
    size?: number,
    height?: number,
    triggerSize?: number,
    enter?: (count?: number, evt?: BABYLON.ActionEvent) => void,
    exit?: (count?: number, evt?: BABYLON.ActionEvent) => void,
  }) {
    super(name, scene)

    opts = Object.assign({
      size: 2,
      height: 0.1,
      triggerSize: 0.5,
    } as typeof opts, opts)

    if (opts.ext) {
      Object.assign(this, opts.ext)
    }

    const mesh = new Mesh(`${name}-mesh`, scene)
    VERTEX_BOX.applyToMesh(mesh)
    mesh.position.copyFromFloats(0, opts.height / 2, 0)
    mesh.scaling.copyFromFloats(opts.size, opts.height, opts.size)
    mesh.parent = this
    mesh.material = this.material

    this.triggerMesh = new Trigger(`${name}-trigger`, scene, meshes, {
      enter: (count, evt) => {
        opts.enter && opts.enter(count, evt)
        mesh.position.y = 0
      },
      exit: (count, evt) => {
        opts.exit && opts.exit(count, evt)
        if (count === 0) {
          mesh.position.y = opts.height / 2
        }
      },
      ext: {
        parent: this,
        isVisible: false,
        position: new Vector3(0, opts.height / 2, 0),
        scaling: new Vector3(opts.triggerSize, 1, opts.triggerSize)
      },
    })
  }
}