import {
  Mesh,
  Vector3,
  Vector4,
  PhysicsImpostor,
  MeshBuilder,
  Tags,
  AbstractMesh,
  InstancedMesh,
} from '../babylon'

import {
  ObjectPlayListener,
  ObjectUsable,
} from './object-base'

import Sprite from './sprite'

export default class Box extends InstancedMesh implements ObjectUsable {
  static readonly BOX_TAG = 'generated-box'

  constructor(name: string, source: Mesh, gen: BoxGenerator) {
    super(name, source)

    const origin = gen.position.add(new Vector3(0, 2, 0))
    this.position.copyFrom(origin)

    const opts = { mass: 10, friction: 0 }
    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.BoxImpostor, opts),
    this.physicsImpostor.registerBeforePhysicsStep(impostor => {
      impostor.setLinearVelocity(impostor.getLinearVelocity().scale(0.98))
      impostor.setAngularVelocity(impostor.getAngularVelocity().scale(0.98))
      if (this.position.y < -10) setImmediate(() => {
        this.position.copyFrom(origin)
        impostor.setLinearVelocity(Vector3.Zero())
      })
    })
  }

  canBeUsedBy(mesh: AbstractMesh) {
    return mesh.name === 'flandre'
  }

  useFrom(mesh: AbstractMesh) {
    if (mesh.name === 'flandre') {
      const direction = this.position.subtract(mesh.position).multiplyByFloats(1, 0, 1).normalize()
      this.physicsImpostor.applyImpulse(direction.scale(30 * 10), this.position)
    }
  }
}

export class BoxGenerator extends Sprite implements ObjectPlayListener {
  startPlaying() {
    const cacheId = 'cache/box'

    let cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      const { material, texSize, offsetX, offsetY, width, height } = this.opts.icon,
        u0 = offsetX / texSize,
        v0 = 1 - (offsetY + height) / texSize,
        u1 = (offsetX + width) / texSize,
        v1 = 1 - offsetY / texSize,
        faceUV = Array(6).fill(new Vector4(u0, v0, u1, v1))
      cache = MeshBuilder.CreateBox(cacheId, { faceUV }, this.getScene())
      cache.scaling.copyFromFloats(1.9, 1.9, 1.9)
      cache.material = material
      cache.isVisible = false
    }

    Tags.AddTagsTo(new Box(this.name + '/box', cache, this), Box.BOX_TAG)

    this.spriteBody.isVisible = false
  }

  stopPlaying() {
    this.getScene().getMeshesByTags(Box.BOX_TAG).forEach(mesh => mesh.dispose())
    this.spriteBody.isVisible = true
  }
}
