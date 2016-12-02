import {
  Mesh,
  Scene,
  Vector2,
  Vector3,
  PhysicsImpostor,
  Material,
} from '../babylon'

import {
  VERTEX_GROUND,
} from '../utils'

export default class Ground extends Mesh {
  constructor(name, scene: Scene, size: Vector2, opts?: {
    ext?: any,
  }) {
    super(name, scene)

    VERTEX_GROUND.applyToMesh(this)
    this.scaling.copyFromFloats(size.x, 1, size.y)
    if (opts.ext) {
      Object.assign(this, opts.ext)
    }

    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.BoxImpostor)

    this.receiveShadows = true
  }
}
