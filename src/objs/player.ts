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
  Ray,
  Quaternion,
} from '../babylon'

import {
  VERTEX_DUMMY,
  VERTEX_PLANE,
  VERTEX_GROUND,
} from '../utils/babylon'

export default class Player extends Mesh {
  readonly spriteBody: Mesh
  readonly playerBody: Mesh
  readonly playerHead: Mesh
  readonly shadow: Mesh
  readonly lastShadowDropPosition = Vector3.Zero()

  private isAnimating = false
  private forwardDirection = new Vector3(0, 0, 1)

  private pickFromBottom(dist = 0.1) {
    const origin = this.position.add(new Vector3(0, dist, 0)),
      ray = new Ray(origin, new Vector3(0, -1, 0)),
      filter = (mesh: Mesh) => mesh.isVisible && mesh.parent !== this,
      pick = this.scene.pickWithRay(ray, filter, false)
    return pick
  }

  constructor(name: string, private scene: Scene, public keyStates: {
    moveLeft: boolean
    moveRight: boolean
    moveForward: boolean
    moveBack: boolean
    jump: boolean
  }, private opts = { } as {
    width?: number
    height?: number
    mass?: number
    friction?: number
    restitution?: number
    moveForce?: number
    jumpForce?: number
    minimumY?: number
    angularDamping?: Vector3
    linearDamping?: Vector3
  }) {
    super(name, scene)

    opts = this.opts = Object.assign({
      width: 1,
      height: 1.8,
      mass: 1,
      friction: 0,
      restitution: 0,
      moveForce: 0.5,
      jumpForce: 2.5,
      minimumY: -10,
    }, opts)

    // physics
    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.ParticleImpostor, {
      mass: opts.mass,
      friction: opts.friction,
      restitution: opts.restitution,
    })

    const angularDamping = this.opts.angularDamping || new Vector3(0, 0.8, 0),
      linearDamping = this.opts.linearDamping || new Vector3(0.8, 0.99, 0.8)
    this.physicsImpostor.registerBeforePhysicsStep(impostor => {
      impostor.setAngularVelocity(impostor.getAngularVelocity().multiply(angularDamping))
      impostor.setLinearVelocity(impostor.getLinearVelocity().multiply(linearDamping))
      setImmediate(_ => this.update())
    })

    // TODO: remove these magics
    const size = new Vector2(opts.height / 26 * 24, opts.height / 26 * 32)
    const texture = 
      new Texture('assets/' + name + '.png', scene, false, true, Texture.NEAREST_SAMPLINGMODE)
    texture.hasAlpha = true
    texture.uScale = 24 / 256
    texture.vScale = 32 / 256

    const material = new StandardMaterial(name + '/mat', scene)
    material.alpha = 1
    material.disableLighting = true
    material.emissiveColor = new Color3(1, 1, 1)
    material.diffuseTexture = texture

    const sprite = this.spriteBody = new Mesh(name + '/sprite', scene)
    VERTEX_PLANE.applyToMesh(sprite)
    sprite.billboardMode = Mesh.BILLBOARDMODE_Y
    sprite.position.copyFromFloats(0, opts.height / 2, 0)
    sprite.scaling.copyFromFloats(size.x, size.y, size.x)
    sprite.material = material
    sprite.parent = this

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
      const pick = this.pickFromBottom(),
        posY = pick.hit ? pick.pickedPoint.y + 0.001 : -1000
      shadow.position.copyFromFloats(0, posY - this.position.y, 0)
      if (pick.hit && pick.pickedPoint.y > this.opts.minimumY) {
        this.lastShadowDropPosition.copyFrom(pick.pickedPoint)
      }
    })

    const body = this.playerBody = new Mesh(name + '/body', scene)
    VERTEX_DUMMY.applyToMesh(body)
    body.position.copyFromFloats(0, opts.width / 2 + 1e-4, 0)
    body.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    body.isVisible = false
    body.parent = this
    body.physicsImpostor = new PhysicsImpostor(body, PhysicsImpostor.SphereImpostor)

    const head = this.playerHead = new Mesh(name + '/head', scene)
    VERTEX_DUMMY.applyToMesh(head)
    head.position.copyFromFloats(0, opts.height - opts.width / 2, 0)
    head.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    head.isVisible = false
    head.parent = this
    head.physicsImpostor = new PhysicsImpostor(head, PhysicsImpostor.SphereImpostor)

    const shadow = this.shadow = new Mesh(name + '/shadow', scene)
    VERTEX_GROUND.applyToMesh(shadow)
    const shadowMaterial = shadow.material = new StandardMaterial(name + '/shadow/mat', scene)
    shadowMaterial.alpha = 1
    shadowMaterial.disableLighting = true
    shadowMaterial.emissiveColor = Color3.White()
    const shadowTexture = shadowMaterial.diffuseTexture = new Texture('assets/shadow.png', scene)
    shadowTexture.hasAlpha = true
    shadow.parent = this

    this.physicsImpostor.forceUpdate()
  }

  private update() {
    if (this.position.y < this.opts.minimumY) {
      this.position.copyFrom(this.lastShadowDropPosition)
      this.position.y += 2
      this.physicsImpostor.setLinearVelocity(Vector3.Zero())
    }

    const keys = this.keyStates
    this.isAnimating = keys.moveLeft || keys.moveRight ||
      keys.moveForward || keys.moveBack || keys.jump
    if (!this.keyStates || !this.forwardDirection || !this.isAnimating) {
      return
    }

    const
      vc = this.forwardDirection,
      mf = this.opts.moveForce,
      dz = keys.moveForward ? 1 : keys.moveBack ? -1 : 0,
      dx = keys.moveLeft ? -1 : keys.moveRight ? 1 : 0,
      ay = Math.atan2(dx, dz) + Math.atan2(vc.x, vc.z),
      fx = dx || dz ? mf * Math.sin(ay) : 0,
      fz = dx || dz ? mf * Math.cos(ay) : 0

    var fy = 0
    if (keys.jump) {
      const pick = this.pickFromBottom()
      if (pick.hit && pick.pickedMesh && pick.distance < 0.2) {
        fy = this.opts.jumpForce,
        keys.jump = false
      }
    }

    if (fx || fy || fz) {
      this.applyImpulse(new Vector3(fx, fy, fz), this.position)
    }

    // rotate to face to the right direction
    if (dx || dz) {
      const qc = Quaternion.RotationAxis(new Vector3(0, 1, 0), ay)
      this.rotationQuaternion = Quaternion.Slerp(this.rotationQuaternion, qc, 0.1)
    }
  }

  public updateForward(forwordDirection: Vector3) {
    this.forwardDirection.copyFrom(forwordDirection)
  }
}