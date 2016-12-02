import {
  PhysicsImpostor,
  Mesh,
  StandardMaterial,
  Texture,
  Color3,
  Vector3,
  Vector2,
  ArcRotateCamera,
  Scene,
  AbstractMesh,
} from '../babylon'

import {
  VERTEX_BOX,
  VERTEX_SPHERE,
  VERTEX_PLANE,
} from '../utils'

import Sprite from './sprite'

export default class Player extends Mesh {
  isAnimating: boolean

  readonly playerBody: Mesh
  readonly playerSprite: Sprite

  constructor(name, scene: Scene, opts?: {
    ext?: any,

    width?: number,
    height?: number,

    mass?: number,
    friction?: number,
    resistution?: number,

    shadowRenderList?: AbstractMesh[],
  }) {
    super(name, scene)

    opts = Object.assign({
      width: 1.2,
      height: 2,

      mass: 1,
      friction: 0,
      resistution: 0,
    } as typeof opts, opts)

    if (!(opts.height > opts.width)) {
      throw 'height should be greater than body width'
    }

    // TODO: remove these magics
    const size = new Vector2(2 / 26 * 24, 2 / 26 * 32)
    const material = Object.assign(new StandardMaterial(name + '-mat', scene), {
      alpha: 1,
      disableLighting: true,
      emissiveColor: new Color3(1, 1, 1),
      diffuseTexture: Object.assign(new Texture('assets/' + name + '.png', scene,
          false, true, Texture.NEAREST_SAMPLINGMODE), {
        hasAlpha: true,
        uScale: 24 / 256,
        vScale: 32 / 256,
      })
    })

    const sprite = this.playerSprite = new Sprite(`${name}-sprite`, scene, size, {
      shadowRenderList: opts.shadowRenderList,
      ext: {
        parent: this,
        material
      },
    })

    var frameIndex = 0
    sprite.registerBeforeRender(mesh => {
      const texture = material.diffuseTexture as Texture,
        delta = this.position.subtract(scene.activeCamera.position),
        offset = this.rotationQuaternion.toEulerAngles().y,
        angle = Math.PI * 4 - Math.atan2(delta.z, delta.x) - offset,
        vIndex = Math.floor(angle / (Math.PI * 2 / 8) + 0.5) + 1
      texture.vOffset = vIndex % 8 * 32 / 256
      if (this.isAnimating) {
        const uIndex = Math.floor(frameIndex ++ / 10)
        texture.uOffset = uIndex % 4 * 24 / 256
      }
    })

    if (opts.ext) {
      Object.assign(this, opts.ext)
    }

    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.ParticleImpostor, {
      mass: opts.mass,
      friction: opts.friction,
      restitution: opts.resistution,
    })

    const body = this.playerBody = new Mesh(`${name}-body`, scene)
    VERTEX_SPHERE.applyToMesh(body)
    body.isVisible = false

    // FIXME: shift the body so that it will not collide with ParticleImpostor of parent
    body.position.copyFromFloats(0, opts.width / 2 + 1e-6, 0)
    body.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    body.parent = this
    body.physicsImpostor = new PhysicsImpostor(body, PhysicsImpostor.SphereImpostor)

    const head = new Mesh(`${name}-head`, scene)
    VERTEX_SPHERE.applyToMesh(head)
    head.isVisible = false
    head.position.copyFromFloats(0, opts.height - opts.width / 2, 0)
    head.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    head.parent = this
    head.physicsImpostor = new PhysicsImpostor(head, PhysicsImpostor.SphereImpostor)

    this.physicsImpostor.forceUpdate()
  }
}