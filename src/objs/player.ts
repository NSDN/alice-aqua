import {
  PhysicsImpostor,
  AbstractMesh,
  Mesh,
  StandardMaterial,
  Texture,
  DynamicTexture,
  Color3,
  Vector3,
  Vector2,
  Scene,
  Ray,
  Quaternion,
  Tags,
  ParticleSystem,
} from '../babylon'

import {
  ObjectOptions,
  ObjectPlayListener,
  ObjectUsable,
  ObjectEditable,
} from './'

import {
  KeyEmitter,
} from '../utils/dom'

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
  moveForce: 3,
  jumpForce: 20,
  minimumY: -5,
  angularDamping: 0.9,
  linearDamping: 0.97,
  dynamicFriction: 0,
  staticFriction: 1,
}

const KEY_MAP = {
  moveForward: 'W',
  moveBack: 'S',
  moveLeft: 'A',
  moveRight: 'D',
  jump: 'SPACE',
  crunch: 'C',
  switch: 'Q',
  use: 'E'
}

export default class Player extends Mesh {
  static readonly PLAYER_TAG = 'player-tag'
  private static keyInput = new KeyEmitter(KEY_MAP)

  readonly spriteBody: Mesh
  readonly shadow: AbstractMesh
  readonly particle: ParticleSystem
  readonly lastShadowDropPosition = Vector3.Zero()

  private isPlayerOnGround = false
  private forwardDirection = new Vector3(0, 0, 1)
  private usableObject = null as ObjectUsable

  private _isPlayerActive = false
  get isPlayerActive() {
    return this._isPlayerActive
  }
  set isPlayerActive(val) {
    if (val !== this._isPlayerActive) {
      const friction = val ? this.opts.dynamicFriction : this.opts.staticFriction
      this.physicsImpostor.setParam('friction', friction)
      this.physicsImpostor.forceUpdate()
    }
    this._isPlayerActive = val
  }

  private canJumpFromPickedMesh(mesh: Mesh) {
    return mesh.isVisible && mesh.visibility === 1 &&
      mesh !== this && mesh.parent !== this && mesh !== this.shadow
  }
  private pickFromBottom(x = 0, z = 0, dist = 0.1) {
    const origin = this.position.add(new Vector3(x, dist - this.opts.width / 2, z)),
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

  constructor(name: string, scene: Scene, private opts: Partial<typeof DEFAULT_CONFIG>) {
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
    this.physicsImpostor.registerBeforePhysicsStep(_ => this.updatePlayerPhysics())

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
    sprite.registerBeforeRender(_ => this.updatePlayerFrame())

    /*
    const head = new Mesh(name + '/head', scene)
    VERTEX_DUMMY.applyToMesh(head)
    head.position.copyFromFloats(0, opts.height - opts.width * Math.sqrt(2) / 2 - opts.width / 2, 0)
    head.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    head.rotation.x = Math.PI / 4
    head.isVisible = false
    head.parent = this
    head.physicsImpostor = new PhysicsImpostor(head, PhysicsImpostor.BoxImpostor)

    this.physicsImpostor.forceUpdate()
    */

    const shadowCacheId = 'cache/player/shadow'
    let shadowCache = scene.getMeshByName(shadowCacheId) as Mesh
    if (!shadowCache) {
      shadowCache = new Mesh(shadowCacheId, scene)
      shadowCache.isVisible = false
      VERTEX_GROUND.applyToMesh(shadowCache)
      const shadowMaterial = shadowCache.material = new StandardMaterial('cache/player/shadow/mat', scene)
      shadowMaterial.alpha = 1
      shadowMaterial.disableLighting = true
      shadowMaterial.emissiveColor = Color3.White()
      const shadowSize = 32,
        shadowTexture = shadowMaterial.diffuseTexture = new DynamicTexture('cache/player/shadow/tex', shadowSize, scene, false),
        dc = shadowTexture.getContext(),
        x = shadowSize / 2, y = shadowSize / 2, r = shadowSize / 2,
        grad = dc.createRadialGradient(x, y, r * 0.1, x, y, r)
      grad.addColorStop(0, 'black')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      dc.fillStyle = grad
      dc.arc(x, y, r, 0, Math.PI * 2)
      dc.fill()
      shadowTexture.update()
      shadowTexture.hasAlpha = true
    }
    this.shadow = shadowCache.createInstance(this.name + '/shadow')

    const ps = this.particle = new ParticleSystem(this.name + '/particles', 20, scene)
    ps.particleTexture = new Texture('assets/Flare.png', scene)
    ps.gravity = new Vector3(0, -5, 0)
    ps.emitter = this
    ps.minSize = 0.2
    ps.maxSize = 0.4
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.5
    ps.minEmitBox = new Vector3(-opts.width / 2, -opts.width / 2, -opts.width / 2)
    ps.maxEmitBox = new Vector3( opts.width / 2, -opts.width / 2 + 0.1,  opts.width / 2)
    ps.direction1 = new Vector3(0, 0, 1)
    ps.direction1 = new Vector3(1, 0, 0)

    const onKeyChange = (key: { name: keyof typeof KEY_MAP, down: boolean }) => {
      if (this.isPlayerActive) {
        this.updatePlayerFromKey(key.name, key.down)
      }
    }

    Player.keyInput.any.on('change', onKeyChange)
    this.onDisposeObservable.add(_ => {
      this.usableObject && this.usableObject.displayUsable(this, false)
      this.shadow.dispose()
      this.particle.dispose()
      Player.keyInput.any.off('change', onKeyChange)
    })

    const allPlayers = scene.getMeshesByTags(Player.PLAYER_TAG)
    allPlayers.forEach(mesh => (mesh as Player).isPlayerActive = false)
    Tags.AddTagsTo(this, Player.PLAYER_TAG)
    this.isPlayerActive = true
  }

  private updatePlayerPhysics() {
    const im = this.physicsImpostor
    im.setAngularVelocity(im.getAngularVelocity().multiplyByFloats(0, this.opts.angularDamping, 0))
    im.setLinearVelocity(im.getLinearVelocity().scale(this.opts.linearDamping))

    if (this.position.y < this.opts.minimumY) setImmediate(() => {
      this.position.copyFrom(this.lastShadowDropPosition)
      this.position.y += 2
      this.physicsImpostor.setLinearVelocity(Vector3.Zero())
    })

    if (this.isPlayerActive) {
      const camera = this.getScene().activeCamera as FollowCamera
      if (camera && camera.target) {
        this.forwardDirection.copyFrom(camera.target.subtract(camera.position))
        camera.followTarget.copyFrom(this.position)
      }
      // you can not update the physics in the loop
      setImmediate(() => {
        const vc = this.forwardDirection,
          keys = Player.keyInput.state,
          dz = (keys.moveForward ? 1 : 0) + (keys.moveBack ? -1 : 0),
          dx = (keys.moveLeft ? -1 : 0) + (keys.moveRight ? 1 : 0)
        if (this._isPlayerActive && (dx || dz)) {
          const mf = this.opts.moveForce * (this.isPlayerOnGround ? 1 : 0.08),
            ay = Math.atan2(dx, dz) + Math.atan2(vc.x, vc.z),
            fx = mf * Math.sin(ay), fz = mf * Math.cos(ay)
          this.applyImpulse(new Vector3(fx, 0, fz), this.position)
          // rotate to face to the right direction
          const qc = Quaternion.RotationAxis(new Vector3(0, 1, 0), ay)
          this.rotationQuaternion = Quaternion.Slerp(this.rotationQuaternion, qc, 0.1)
        }
      })
    }
  }

  private frameIndex = 0
  private updatePlayerFrame() {
    if (this._isPlayerActive) {
      const material = this.spriteBody.material as StandardMaterial,
        texture = material.diffuseTexture as Texture,
        delta = this.position.subtract(this.getScene().activeCamera.position),
        offset = this.rotationQuaternion.toEulerAngles().y,
        angle = Math.PI * 4 - Math.atan2(delta.z, delta.x) - offset,
        vIndex = Math.floor(angle / (Math.PI * 2 / 8) + 0.5) + 1
      texture.vOffset = vIndex % 8 * 32 / 256
      const keys = Player.keyInput.state
      if (keys.moveLeft || keys.moveRight || keys.moveForward || keys.moveBack) {
        const uIndex = Math.floor(this.frameIndex ++ / 10)
        texture.uOffset = uIndex % 4 * 24 / 256
      }
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
  }

  protected updatePlayerFromKey(key: keyof typeof KEY_MAP, down: boolean) {
    if (key === 'use' && !down) {
      const pick = this.pickUsableFromCenter(),
        mesh = pick.hit && pick.pickedMesh as any as ObjectUsable
      mesh && mesh.useFrom && mesh.useFrom(this)
    }
    else if (key === 'switch' && !down) {
      const allPlayers = this.getScene().getMeshesByTags(Player.PLAYER_TAG)
      allPlayers.forEach(mesh => (mesh as Player).isPlayerActive = false)
      const nextPlayer = allPlayers[(allPlayers.indexOf(this) + 1) % allPlayers.length] as Player
      setImmediate(_ => nextPlayer.isPlayerActive = true)
    }
    else if (key === 'jump' && down) {
      const v = this.physicsImpostor.getLinearVelocity()
      Array(6).fill(6).some((n, i) => {
        const a = i / n * Math.PI * 2, r = this.opts.width * 0.2,
          pick = this.pickFromBottom(Math.sin(a) * r, Math.cos(a) * r)
        if (pick.hit && pick.pickedMesh && pick.distance < 0.2 && v.y < 0.1) {
          this.applyJumpImpulse(new Vector3(0, this.opts.jumpForce, 0))
          return true
        }
      })
    }
  }

  public applyJumpImpulse(force: Vector3) {
    const v = this.physicsImpostor.getLinearVelocity()
    this.physicsImpostor.setLinearVelocity(v.multiplyByFloats(1, 0, 1))
    this.applyImpulse(force, this.position)
    this.particle.manualEmitCount = this.particle.getCapacity()
    this.particle.start()
  }
}

export class PlayerGenerator extends Sprite implements ObjectPlayListener, ObjectEditable {
  static readonly PLAYER_GENERATOR_TAG = 'player-generator'
  private static playerReferenceCount = { } as { [playerName: string]: number }

  public playerName = ''

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    Tags.AddTagsTo(this, PlayerGenerator.PLAYER_GENERATOR_TAG)
  }

  startPlaying() {
    const ref = PlayerGenerator.playerReferenceCount
    ref[this.playerName] = (ref[this.playerName] || 0) + 1

    let player = this.getScene().getMeshByName(this.playerName) as Player
    if (!player) {
      player = new Player(this.playerName, this.getScene(), this.opts)
      player.position.copyFrom(this.position.add(new Vector3(0, 3, 0)))
    }

    this.spriteBody.isVisible = false
  }
  stopPlaying() {
    const ref = PlayerGenerator.playerReferenceCount
    ref[this.playerName] = (ref[this.playerName] || 0) - 1

    if (ref[this.playerName] <= 0) {
      this.getScene().getMeshByName(this.playerName).dispose()
    }

    this.spriteBody.isVisible = true
  }

  attachEditorContent(_container: HTMLElement, _save: (args: Partial<PlayerGenerator>) => void) {
    // do nothing
  }
}
