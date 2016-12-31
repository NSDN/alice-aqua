import {
  PhysicsImpostor,
  Mesh,
  StandardMaterial,
  Texture,
  Color3,
  Vector3,
  Vector2,
  Scene,
  Ray,
  Quaternion,
  Tags,
  ScreenSpaceCanvas2D,
} from '../babylon'

import {
  ObjectOptions,
  ObjectPlayListener,
  ObjectUsable,
} from './object-base'

import {
  VERTEX_DUMMY,
  VERTEX_PLANE,
  VERTEX_GROUND,
  VERTEX_SPHERE,
  FollowCamera,
} from '../utils/babylon'

import Sprite from './sprite'

export default class Player extends Mesh {
  static readonly PLAYER_TAG = 'player-tag'
  static readonly PLAYER_BODY_TAG = 'player-body'

  readonly spriteBody: Mesh
  readonly playerBody: Mesh
  readonly playerHead: Mesh
  readonly shadow: Mesh
  readonly usableMark: Mesh
  readonly lastShadowDropPosition = Vector3.Zero()

  private isPlayerAnimating = false
  private isActivePlayer = false
  private forwardDirection = new Vector3(0, 0, 1)

  private pickFromBottom(dist = 0.1) {
    const origin = this.position.add(new Vector3(0, dist, 0)),
      ray = new Ray(origin, new Vector3(0, -1, 0)),
      filter = (mesh: Mesh) => mesh.isVisible && mesh.parent !== this && mesh !== this.shadow,
      pick = this.getScene().pickWithRay(ray, filter, false)
    return pick
  }

  private canPickMeshAsUsable(mesh: Mesh) {
    const usable = mesh as any as ObjectUsable
    return mesh.isVisible && usable.canBeUsedBy && usable.canBeUsedBy(this)
  }

  private pickUsableFromCenter() {
    const origin = new Vector3(0, this.opts.height / 2, 0),
      ray = Ray.Transform(new Ray(origin, new Vector3(0, 0, 1), this.opts.width * 0.6), this.worldMatrixFromCache),
      pick = this.getScene().pickWithRay(ray, mesh => this.canPickMeshAsUsable(mesh), false)
    return pick
  }

  constructor(name: string, scene: Scene, private opts: {
    canvas2d: ScreenSpaceCanvas2D
    keys: {
      moveLeft: boolean
      moveRight: boolean
      moveForward: boolean
      moveBack: boolean
      jump: boolean
      switch: boolean
      use: boolean
    }
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

      if (this.position.y < this.opts.minimumY) setImmediate(() => {
        this.position.copyFrom(this.lastShadowDropPosition)
        this.position.y += 2
        this.physicsImpostor.setLinearVelocity(Vector3.Zero())
      })

      if (this.isActivePlayer) {
        const camera = scene.activeCamera as FollowCamera
        if (camera && camera.target) {
          this.forwardDirection.copyFrom(camera.target.subtract(camera.position))
          camera.followTarget.copyFrom(this.position)
        }
        setImmediate(_ => this.update())
      }
    })
    this.physicsImpostor.registerAfterPhysicsStep(impostor => {
      if (this.isDisposed()) {
        setImmediate(() => impostor.dispose())
      }
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

    let frameIndex = 0
    sprite.registerBeforeRender(_ => {
      const texture = material.diffuseTexture as Texture,
        delta = this.position.subtract(scene.activeCamera.position),
        offset = this.rotationQuaternion.toEulerAngles().y,
        angle = Math.PI * 4 - Math.atan2(delta.z, delta.x) - offset,
        vIndex = Math.floor(angle / (Math.PI * 2 / 8) + 0.5) + 1
      texture.vOffset = vIndex % 8 * 32 / 256
      if (this.isPlayerAnimating) {
        const uIndex = Math.floor(frameIndex ++ / 10)
        texture.uOffset = uIndex % 4 * 24 / 256
      }

      const pickBottom = this.pickFromBottom(),
        posY = pickBottom.hit ? pickBottom.pickedPoint.y + 1e-4 : -1000
      this.shadow.position.copyFromFloats(this.position.x, posY, this.position.z)
      if (pickBottom.hit && pickBottom.pickedPoint.y > this.opts.minimumY) {
        this.lastShadowDropPosition.copyFrom(pickBottom.pickedPoint)
      }

      if (this.isActivePlayer) {
        const pick = this.pickUsableFromCenter(),
          mesh = pick.hit && pick.pickedMesh,
          usable = mesh as any as ObjectUsable,
          canBeUsed = usable && usable.canBeUsedBy && usable.canBeUsedBy(this) || false,
          markPos = canBeUsed ? mesh.position.add(mesh.scaling.multiplyByFloats(0, 0.5, 0)) : new Vector3(0, 10000, 0)
        this.usableMark.position.copyFrom(markPos)
      }
    })

    const body = this.playerBody = new Mesh(name + '/body', scene)
    VERTEX_SPHERE.applyToMesh(body)
    body.position.copyFromFloats(0, opts.width / 2 + 1e-4, 0)
    body.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    body.isVisible = false
    body.parent = this
    body.physicsImpostor = new PhysicsImpostor(body, PhysicsImpostor.SphereImpostor)
    Tags.AddTagsTo(body, Player.PLAYER_BODY_TAG)

    const head = this.playerHead = new Mesh(name + '/head', scene)
    VERTEX_DUMMY.applyToMesh(head)
    head.position.copyFromFloats(0, opts.height - opts.width / 2, 0)
    head.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    head.isVisible = false
    head.parent = this
    head.physicsImpostor = new PhysicsImpostor(head, PhysicsImpostor.SphereImpostor)

    this.physicsImpostor.forceUpdate()

    const shadow = this.shadow = new Mesh(name + '/shadow', scene)
    VERTEX_GROUND.applyToMesh(shadow)
    const shadowMaterial = shadow.material = new StandardMaterial(name + '/shadow/mat', scene)
    shadowMaterial.alpha = 1
    shadowMaterial.disableLighting = true
    shadowMaterial.emissiveColor = Color3.White()
    const shadowTexture = shadowMaterial.diffuseTexture = new Texture('assets/shadow.png', scene)
    shadowTexture.hasAlpha = true

    // FIXME: babylonjs issue
    // shadow.parent = this
    shadow.registerAfterRender(_ => {
      if (this.isDisposed()) {
        shadow.dispose()
      }
    })

    const allPlayers = scene.getMeshesByTags(Player.PLAYER_TAG)
    allPlayers.forEach(mesh => (mesh as Player).isActivePlayer = false)
    Tags.AddTagsTo(this, Player.PLAYER_TAG)
    this.isActivePlayer = true

    const markId = 'mark/player/usable'
    this.usableMark = scene.getMeshByName(markId) as Mesh
    if (!this.usableMark) {
      this.usableMark = new Mesh(markId, scene)
      this.usableMark.position.copyFromFloats(0, 10000, 0)
      new BABYLON.Group2D({
        parent: this.opts.canvas2d,
        trackNode: this.usableMark,
        children: [
          new BABYLON.Rectangle2D({
            width: 150,
            height: 30,
            fill: '#404080FF',
            children: [
              new BABYLON.Text2D('press [ E ] to use', {
                marginAlignment: 'v: center, h: center'
              })
            ]
          })
        ]
      })
    }
  }

  protected update() {
    const keys = this.opts.keys

    if (keys.use) {
      const pick = this.pickUsableFromCenter(),
        mesh = pick.hit && pick.pickedMesh as any as ObjectUsable
      mesh && mesh.useFrom && mesh.useFrom(this)
      keys.use = false
    }

    if (keys.switch) {
      const allPlayers = this.getScene().getMeshesByTags(Player.PLAYER_TAG)
      allPlayers.forEach(mesh => (mesh as Player).isActivePlayer = false)
      const nextPlayer = allPlayers[(allPlayers.indexOf(this) + 1) % allPlayers.length] as Player
      nextPlayer.isActivePlayer = true
      keys.switch = false
    }

    this.isPlayerAnimating = this.isActivePlayer &&
      (keys.moveLeft || keys.moveRight || keys.moveForward || keys.moveBack || keys.jump)
    if (!this.isPlayerAnimating) {
      return
    }

    const
      vc = this.forwardDirection,
      mf = this.opts.moveForce,
      dz = keys.moveForward ? 1 : keys.moveBack ? -1 : 0,
      dx = keys.moveLeft ? -1 : keys.moveRight ? 1 : 0,
      ay = Math.atan2(dx, dz) + Math.atan2(vc.x, vc.z),
      fx = dx || dz ? mf * Math.sin(ay) : 0,
      fz = dx || dz ? mf * Math.cos(ay) : 0,
      im = this.physicsImpostor

    let fy = 0
    if (keys.jump) {
      const pick = this.pickFromBottom()
      if (pick.hit && pick.pickedMesh &&
          pick.distance < 0.2 && im.getLinearVelocity().y < 0.01) {
        im.setLinearVelocity(im.getLinearVelocity().multiplyByFloats(1, 0, 1))
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
}

export class PlayerGenerator extends Sprite implements ObjectPlayListener {
  static readonly PLAYER_GENERATOR_TAG = 'player-generator'

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    Tags.AddTagsTo(this, PlayerGenerator.PLAYER_GENERATOR_TAG)
  }

  private activePlayer = null as Player
  startPlaying() {
    if (this.activePlayer) {
      this.activePlayer.dispose()
    }
    this.activePlayer = new Player(this._playerName, this.getScene(), this.opts)
    this.activePlayer.position.copyFrom(this.position.add(new Vector3(0, 2, 0)))
    this.spriteBody.isVisible = false
  }
  stopPlaying() {
    this.activePlayer.dispose()
    this.activePlayer = null
    this.spriteBody.isVisible = true
  }

  private _playerName = ''
  set playerName(val: string) {
    this._playerName = val

    const uniqueTag = 'player-' + val,
      generators = this.getScene().getMeshesByTags(uniqueTag)
    generators.forEach(mesh => mesh.dispose())
    Tags.AddTagsTo(this, uniqueTag)
  }
}
