import {
  Scene,
  Mesh,
  Vector3,
  PhysicsImpostor,
  Material,
  Texture,
  AbstractMesh,
} from '../babylon'

import {
  VERTEX_BOX
} from '../utils'

export default class Box extends Mesh {
  static defaultSize = 2

  constructor(name, scene: Scene, opts?: {
    ext?: any,
    size?: Vector3,
    mass?: number,
    friction?: number,
    restitution?: number,
    shadowRenderList?: AbstractMesh[],
  }) {
    super(name, scene)

    opts = Object.assign({
      mass: 5,
      friction: 0,
      restitution: 0,
      size: new Vector3(Box.defaultSize, Box.defaultSize, Box.defaultSize),
    } as typeof opts, opts)

    VERTEX_BOX.applyToMesh(this)
    this.scaling.copyFrom(opts.size)
    if (opts.ext) {
      Object.assign(this, opts.ext)
    }

    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.BoxImpostor, {
      mass: opts.mass,
      friction: opts.friction,
      restitution: opts.restitution,
    })

    if (opts.shadowRenderList) {
      opts.shadowRenderList.push(this)
    }
  }
}