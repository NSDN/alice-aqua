import {
  Mesh,
  Material,
  Color3,
  Texture,
  Vector2,
  Vector3,
  Scene,
  AbstractMesh,
  PhysicsImpostor,
} from '../babylon'

import {
  VERTEX_PLANE,
  VERTEX_SPHERE,
  VERTEX_BOX,
} from '../utils'

export default class Sprite extends Mesh {
  constructor(name, scene: Scene, size: Vector2, opts?: {
    ext?: any,
    shadowRenderList?: AbstractMesh[],
  }) {
    super(name, scene)

    VERTEX_PLANE.applyToMesh(this)
    this.billboardMode = Mesh.BILLBOARDMODE_Y
    this.position.copyFromFloats(0, size.y / 2, 0)
    this.scaling.copyFromFloats(size.x, size.y, size.x)

    if (opts && opts.ext) {
      Object.assign(this, opts.ext)
    }

    if (opts && opts.shadowRenderList) {
      opts.shadowRenderList.push(this);
    }
  }
}