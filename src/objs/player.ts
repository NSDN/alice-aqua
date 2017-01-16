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
  ObjectElementBinder,
} from './'

import {
  VERTEX_PLANE,
  VERTEX_GROUND,
  VERTEX_SPHERE,
//  VERTEX_DUMMY,
  FollowCamera,
} from '../utils/babylon'

import Sprite from './sprite'

const DEFAULT_CONFIG = {
  width: 1,
  height: 1.8,
  mass: 5,
  restitution: 0,
  moveForce: 3.5,
  jumpForce: 16,
  minimumY: -5,
  angularDamping: 0.9,
  linearDamping: 0.98,
}

export default class Player extends Mesh {
  static readonly PLAYER_TAG = 'player-tag'

  readonly spriteBody: Mesh
  readonly shadow: Mesh
  readonly lastShadowDropPosition = Vector3.Zero()

  private isPlayerAnimating = false
  private isPlayerOnGround = false
  private forwardDirection = new Vector3(0, 0, 1)
  private usableObject = null as ObjectUsable

  private _isPlayerActive = false
  get isPlayerActive() {
    return this._isPlayerActive
  }
  set isPlayerActive(val) {
    if (val !== this._isPlayerActive) {
      this.physicsImpostor.setParam('friction', val ? 0 : 1)
      this.physicsImpostor.forceUpdate()
    }
    this._isPlayerActive = val
  }

  private canJumpFromPickedMesh(mesh: Mesh) {
    return mesh.isVisible && mesh.visibility === 1 &&
      mesh !== this && mesh.parent !== this && mesh !== this.shadow
  }
  private pickFromBottom(dist = 0.1) {
    const origin = this.position.add(new Vector3(0, dist - this.opts.width / 2, 0)),
      ray = new Ray(origin, new Vector3(0, -1, 0)),
      pick = this.getScene().pickWithRay(ray, mesh => this.canJumpFromPickedMesh(mesh), false)
    return pick
  }

  private canUsePickedMesh(mesh: Mesh) {
    const usable = mesh as any as ObjectUsable
    return mesh.isVisible && usable.canBeUsedBy && usable.canBeUsedBy(this)
  }
  private pickUsableFromCenter() {
    const origin = new Vector3(0, this.opts.height / 2 - this.opts.width / 2, 0),
      ray = Ray.Transform(new Ray(origin, new Vector3(0, 0, 1), this.opts.width * 0.6), this.worldMatrixFromCache),
      pick = this.getScene().pickWithRay(ray, mesh => this.canUsePickedMesh(mesh), false)
    return pick
  }

  constructor(name: string, scene: Scene, private opts: Partial<typeof DEFAULT_CONFIG> & {
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
  }) {
    super(name, scene)

    opts = this.opts = Object.assign({ }, DEFAULT_CONFIG, opts)

    VERTEX_SPHERE.applyToMesh(this)
    this.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    this.isVisible = false

    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.SphereImpostor, {
      mass: opts.mass,
      friction: 0,
      restitution: opts.restitution,
    })

    this.physicsImpostor.registerBeforePhysicsStep(impostor => {
      const angularDamping = impostor.getAngularVelocity().multiplyByFloats(0, opts.angularDamping, 0)
      impostor.setAngularVelocity(angularDamping)

      const groundDamping = this.isPlayerOnGround ? 0.7 : 1,
        linearDamping = impostor.getLinearVelocity().scale(opts.linearDamping).multiplyByFloats(groundDamping, 1, groundDamping)
      impostor.setLinearVelocity(linearDamping)

      if (this.position.y < this.opts.minimumY) setImmediate(() => {
        this.position.copyFrom(this.lastShadowDropPosition)
        this.position.y += 2
        this.physicsImpostor.setLinearVelocity(Vector3.Zero())
      })

      if (this.isPlayerActive) {
        const camera = scene.activeCamera as FollowCamera
        if (camera && camera.target) {
          this.forwardDirection.copyFrom(camera.target.subtract(camera.position))
          camera.followTarget.copyFrom(this.position)
        }
        setImmediate(_ => this.update())
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
    sprite.position.copyFromFloats(0, opts.height / 2 - opts.width / 2, 0)
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
      this.isPlayerOnGround = this.position.y - this.shadow.position.y < 1e-2
      if (pickBottom.hit && pickBottom.pickedPoint.y > this.opts.minimumY) {
        this.lastShadowDropPosition.copyFrom(pickBottom.pickedPoint)
      }

      const pick = this.isPlayerActive && this.pickUsableFromCenter(),
        mesh = pick && pick.hit && pick.pickedMesh,
        usable = mesh as any as ObjectUsable,
        usableObject = usable && usable.canBeUsedBy && usable.canBeUsedBy(this) && usable
      if (this.usableObject !== usableObject) {
        if (this.usableObject) {
          this.usableObject.displayUsable(this, false)
        }
        if (this.usableObject = usableObject) {
          this.usableObject.displayUsable(this, true)
        }
      }
    })

    /*
    const head = new Mesh(name + '/head', scene)
    VERTEX_DUMMY.applyToMesh(head)
    head.position.copyFromFloats(0, opts.height - opts.width * Math.sqrt(2) / 2 - opts.width / 2, 0)
    head.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    head.rotation.x = Math.PI / 4
    head.isVisible = false
    head.parent = this
    head.physicsImpostor = new PhysicsImpostor(head, PhysicsImpostor.BoxImpostor)
    */

    this.physicsImpostor.forceUpdate()

    const shadow = this.shadow = new Mesh(name + '/shadow', scene)
    VERTEX_GROUND.applyToMesh(shadow)
    const shadowMaterial = shadow.material = new StandardMaterial(name + '/shadow/mat', scene)
    shadowMaterial.alpha = 1
    shadowMaterial.disableLighting = true
    shadowMaterial.emissiveColor = Color3.White()
    const shadowTexture = shadowMaterial.diffuseTexture = new Texture('assets/shadow.png', scene)
    shadowTexture.hasAlpha = true

    this.onDisposeObservable.add(_ => {
      if (this.usableObject) {
        this.usableObject.displayUsable(this, false)
      }
      shadow.dispose()
    })

    const allPlayers = scene.getMeshesByTags(Player.PLAYER_TAG)
    allPlayers.forEach(mesh => (mesh as Player).isPlayerActive = false)
    Tags.AddTagsTo(this, Player.PLAYER_TAG)
    this.isPlayerActive = true
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
      allPlayers.forEach(mesh => (mesh as Player).isPlayerActive = false)
      const nextPlayer = allPlayers[(allPlayers.indexOf(this) + 1) % allPlayers.length] as Player
      nextPlayer.isPlayerActive = true
      keys.switch = false
    }

    this.isPlayerAnimating = this.isPlayerActive &&
      (keys.moveLeft || keys.moveRight || keys.moveForward || keys.moveBack || keys.jump)
    if (this.isPlayerAnimating) {
      const vc = this.forwardDirection,
        mf = this.opts.moveForce * (this.isPlayerOnGround ? 1 : 0.08),
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
          fy = this.opts.jumpForce
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
}

export class PlayerGenerator extends Sprite implements ObjectPlayListener, ObjectElementBinder {
  static readonly PLAYER_GENERATOR_TAG = 'player-generator'

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    Tags.AddTagsTo(this, PlayerGenerator.PLAYER_GENERATOR_TAG)
  }

  private player = null as Player
  startPlaying() {
    if (this.player) {
      this.player.dispose()
    }
    this.player = new Player(this._playerName, this.getScene(), this.opts)
    this.player.position.copyFrom(this.position.add(new Vector3(0, 3, 0)))
    this.spriteBody.isVisible = false
  }
  stopPlaying() {
    this.player.dispose()
    this.player = null
    this.spriteBody.isVisible = true
  }

  private _playerName = ''
  set playerName(val: string) {
    this._playerName = val

    const uniqueTag = 'player-gen-' + val,
      generators = this.getScene().getMeshesByTags(uniqueTag)
    generators.forEach(mesh => mesh.dispose())
    Tags.AddTagsTo(this, uniqueTag)
  }

  bindToElement(_container: HTMLElement, _save: (args: Partial<PlayerGenerator>) => void) {
    // do nothing
  }
}
