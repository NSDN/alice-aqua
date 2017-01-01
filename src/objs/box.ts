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

  constructor(name: string, source: Mesh, private generator: BoxGenerator) {
    super(name, source)

    const origin = generator.position.add(new Vector3(0, 2, 0))
    this.position.copyFrom(origin)

    const params = { mass: generator.boxMass, friction: 0 }
    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.BoxImpostor, params),
    this.physicsImpostor.registerBeforePhysicsStep(impostor => {
      const v = impostor.getLinearVelocity(), a = impostor.getAngularVelocity()

      if (this.position.y < -10) setImmediate(() => {
        this.position.copyFrom(origin)
        impostor.setLinearVelocity(Vector3.Zero())
      })

      const threshold = generator.velocityThreshold
      if (threshold > 0) {
        const velocity = v.multiplyByFloats(1, 0.5, 1).length()
        if (velocity < threshold) {
          const f = Math.sqrt(velocity / threshold), vf = 0.1 + 0.9 * f,
            af = 0.9 + 0.1 * vf, ay = 0.1 + 0.9 * vf
          v.multiplyInPlace(new Vector3(vf, 1, vf))
          a.multiplyInPlace(new Vector3(af, ay, af))
        }
      }

      impostor.setLinearVelocity(v.scale(0.98))
      impostor.setAngularVelocity(a.scale(0.98))
    })
  }

  canBeUsedBy(mesh: AbstractMesh) {
    return mesh.name === 'flandre'
  }

  useFrom(mesh: AbstractMesh) {
    if (mesh.name === 'flandre') {
      const direction = this.position.subtract(mesh.position).multiplyByFloats(1, 0, 1).normalize()
      this.physicsImpostor.applyImpulse(direction.scale(150 * 5 / this.generator.boxMass), this.position)
    }
  }
}

export class BoxGenerator extends Sprite implements ObjectPlayListener {
  public boxMass = 5
  public velocityThreshold = 0

  startPlaying() {
    const { material, texSize, offsetX, offsetY, width, height } = this.opts.icon,
      cacheId = ['cache/box', material.name, offsetX, offsetY].join('/')

    let cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      const u0 = offsetX / texSize,
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
