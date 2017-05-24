import {
  Mesh,
  Vector3,
  Vector4,
  PhysicsImpostor,
  MeshBuilder,
  Tags,
  InstancedMesh,
} from '../babylon'

import {
  randomBytes,
} from '../utils'

import {
  IPlayStartStopListener,
} from '../game/objbase'

import Sprite from './sprite'

export default class Box extends InstancedMesh {
  static readonly BOX_TAG = 'generated-box'

  constructor(name: string, source: Mesh, generator: BoxGenerator) {
    super(name, source)

    const origin = generator.position.add(generator.spriteBody.position).add(new Vector3(0, 2, 0))
    this.position.copyFrom(origin)

    const params = { mass: generator.boxMass, friction: 1 }
    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.BoxImpostor, params)
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
          const f = Math.sqrt(velocity / threshold),
            vf = 0.1 + 0.9 * f,
            af = 0.9 + 0.1 * vf,
            ay = 0.1 + 0.9 * vf
          v.multiplyInPlace(new Vector3(vf, 1, vf))
          a.multiplyInPlace(new Vector3(af, ay, af))
        }
      }

      impostor.setLinearVelocity(v.scale(0.98))
      impostor.setAngularVelocity(a.scale(0.98))
    })
  }
}

export class BoxGenerator extends Sprite implements IPlayStartStopListener {
  public boxMass = 5
  public velocityThreshold = 0
  private boxName = ''

  set spriteHeight(val: number) {
    super.spriteHeight = val
    this.spriteBody.position.x = this.spriteBody.position.z = Math.floor(val) % 2 === 0 ? 0.5 : 0
  }
  get spriteHeight() {
    return super.spriteHeight
  }

  onPlayStart() {
    const { material, texSize, offsetX, offsetY, width, height } = this.opts.icon,
      cacheId = ['cache/box', material.name, offsetX, offsetY, this.spriteHeight].join('/')

    let cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      const u0 = offsetX / texSize,
        v0 = 1 - (offsetY + height) / texSize,
        u1 = (offsetX + width) / texSize,
        v1 = 1 - offsetY / texSize,
        faceUV = Array(6).fill(new Vector4(u0, v0, u1, v1)),
        size = this.spriteHeight
      cache = MeshBuilder.CreateBox(cacheId, { size, faceUV }, this.getScene())
      cache.material = material
      cache.isVisible = false
    }

    let box = this.getScene().getMeshByName(this.boxName)
    box && box.dispose()
    this.boxName = 'box/' + randomBytes()

    box = new Box(this.boxName, cache, this)
    Tags.AddTagsTo(box, Box.BOX_TAG)
    Sprite.enableShadowFor(box)

    this.spriteBody.isVisible = false
  }

  onPlayStop() {
    const box = this.getScene().getMeshByName(this.boxName)
    box && box.dispose()
    this.spriteBody.isVisible = true
  }
}
