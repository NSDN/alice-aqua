import {
  PhysicsImpostor,
  AbstractMesh,
  Mesh,
  StandardMaterial,
  Texture,
  DynamicTexture,
  Color3,
  Vector3,
  Scene,
  Ray,
  Quaternion,
  Tags,
  ParticleSystem,
} from '../babylon'

import {
  IPlayStartStopListener,
  ObjectOptions,
  ObjectBase,
} from '../game/objbase'

import {
  VERTEX_PLANE,
  VERTEX_SPHERE,
  FollowCamera,
  GamepadInput,
  ColorWireframeNoLightingMaterial,
  ColorNoLightingMaterial,
} from '../utils/babylon'

import Sprite from './sprite'

const DEFAULT_CONFIG = {
  width: 1,
  height: 1.8,
  mass: 5,
  restitution: 0,
  moveForce: 3,
  jumpForce: 20,
  minimumY: -10,
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
  jump: 'SPACE | PAD-A',
  crunch: 'C',
  switchPrev: 'PAD-LB',
  switchNext: 'Q | PAD-Y | PAD-RB',
  use: 'E | PAD-X',
}

export default class Player extends Mesh {
  static readonly PLAYER_TAG = 'player-tag'
  static getActive(scene: Scene) {
    return (scene as any as { currentActivePlayer: Player }).currentActivePlayer
  }

  private static input = new GamepadInput(KEY_MAP)

  readonly spriteBody: Mesh
  readonly playerHead: Mesh
  readonly shadow: AbstractMesh
  readonly particle: ParticleSystem
  readonly lastShadowDropPosition = Vector3.Zero()

  private isPlayerOnGround = false
  private isPlayerWalking = false
  private forwardDirection = new Vector3(0, 0, 1)

  private _isPlayerActive = false
  get isPlayerActive() {
    return this._isPlayerActive
  }
  set isPlayerActive(val) {
    if (val !== this._isPlayerActive) {
      const friction = val ? this.opts.dynamicFriction : this.opts.staticFriction
      this.physicsImpostor.setParam('friction', friction)
      this.playerHead.physicsImpostor && this.playerHead.physicsImpostor.dispose()
      this.playerHead.physicsImpostor = new PhysicsImpostor(this.playerHead, PhysicsImpostor.SphereImpostor)
      this.physicsImpostor.forceUpdate()
      this.shadow.scaling.copyFromFloats(val ? 1 : 0.5, 1, val ? 1 : 0.5)

      const withActivePlayer = this.getScene() as any as { currentActivePlayer: Player }
      if (val) {
        withActivePlayer.currentActivePlayer = this
      }
      else if (withActivePlayer.currentActivePlayer === this) {
        withActivePlayer.currentActivePlayer = null
      }
    }
    this._isPlayerActive = val
  }

  private canJumpFromPickedMesh(mesh: Mesh) {
    return mesh.isVisible && mesh !== this && mesh.parent !== this && mesh !== this.shadow
  }
  private pickFromBottom(x = 0, z = 0, dist = 0.1) {
    const origin = this.position.add(new Vector3(x, dist - this.opts.width / 2, z)),
      ray = new Ray(origin, new Vector3(0, -1, 0)),
      pick = this.getScene().pickWithRay(ray, mesh => this.canJumpFromPickedMesh(mesh), false)
    return pick
  }

  constructor(name: string, scene: Scene, readonly opts: Partial<typeof DEFAULT_CONFIG> & ObjectOptions) {
    super(name, scene)

    opts = this.opts = Object.assign({ }, DEFAULT_CONFIG, opts)

    VERTEX_SPHERE.applyToMesh(this)
    this.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    this.isVisible = false
    this.material = ColorWireframeNoLightingMaterial.getCached(scene, Color3.White())
    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.SphereImpostor, {
      mass: opts.mass,
      friction: opts.staticFriction,
      restitution: opts.restitution,
    })
    this.physicsImpostor.registerBeforePhysicsStep(_ => this.updatePlayerPhysics())

    let material = scene.getMaterialByName(name + '/mat') as StandardMaterial
    if (!material) {
      const texture =
        new Texture('assets/' + name + '.png', scene, false, true, Texture.NEAREST_SAMPLINGMODE)
      texture.hasAlpha = true
      texture.uScale = 24 / 256
      texture.vScale = 32 / 256

      material = new StandardMaterial(name + '/mat', scene)
      material.alpha = 1
      material.disableLighting = true
      material.emissiveColor = new Color3(1, 1, 1)
      material.diffuseTexture = texture
      material.backFaceCulling = false
    }

    const sprite = this.spriteBody = new Mesh(name + '/sprite', scene)
    VERTEX_PLANE.applyToMesh(sprite)
    sprite.billboardMode = Mesh.BILLBOARDMODE_Y
    sprite.position.copyFromFloats(0, opts.height / 2 - opts.width / 2, 0)
    sprite.scaling.copyFromFloats(opts.height / 32 * 24, opts.height, 1)
    sprite.material = material
    sprite.parent = this
    sprite.registerBeforeRender(_ => this.updatePlayerFrame())
    ObjectBase.enableShadowFor(sprite)

    const head = this.playerHead = new Mesh(name + '/head', scene)
    VERTEX_SPHERE.applyToMesh(head)
    head.position.copyFromFloats(0, opts.height - opts.width * Math.sqrt(2) / 2 - opts.width / 2, 0)
    head.scaling.copyFromFloats(opts.width, opts.width, opts.width)
    head.rotation.x = Math.PI / 4
    head.isVisible = false
    head.material = this.material
    head.parent = this

    const shadowCacheId = 'cache/player/shadow'
    let shadowCache = scene.getMeshByName(shadowCacheId) as Mesh
    if (!shadowCache) {
      shadowCache = new Mesh(shadowCacheId, scene)

      const positions = [0, 0, 0] as number[],
        indices = [ ] as number[]
      for (let i = 0, n = 32; i < n; i ++) {
        const i0 = positions.length / 3
        indices.push(0, i0 + 1, i0)
        const r = 0.3, a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2
        positions.push(r * Math.sin(a), 0, r * Math.cos(a), r * Math.sin(b), 0, r * Math.cos(b))
      }
      Object.assign(new BABYLON.VertexData(), { positions, indices }).applyToMesh(shadowCache)

      shadowCache.isVisible = false
      shadowCache.visibility = 0.2
      shadowCache.material = ColorNoLightingMaterial.getCached(scene, new Color3(0.2, 0.2, 0.2))
    }
    this.shadow = shadowCache.createInstance(this.name + '/shadow')

    const ps = this.particle = new ParticleSystem(this.name + '/particles', 20, scene)
    const particleTexture = ps.particleTexture = new DynamicTexture('player/dust', 1, scene, false),
      dc = particleTexture.getContext()
    dc.fillStyle = '#888'
    dc.fillRect(0, 0, 1, 1)
    particleTexture.update()
    ps.gravity = new Vector3(0, -5, 0)
    ps.emitter = this
    ps.minSize = 0.1
    ps.maxSize = 0.2
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.5
    ps.minEmitBox = new Vector3(-opts.width / 2, -opts.width / 2, -opts.width / 2)
    ps.maxEmitBox = new Vector3( opts.width / 2, -opts.width / 2 + 0.1,  opts.width / 2)
    ps.direction1 = new Vector3(0, 0, 1)
    ps.direction1 = new Vector3(1, 0, 0)

    const unBindKeys = Player.input.any.on('change', ({ name, down }) => {
      this._isPlayerActive && this.updatePlayerFromKey(name, down)
    })

    this.onDisposeObservable.add(_ => {
      this.isPlayerActive = false
      this.shadow.dispose()
      this.particle.dispose()
      this.physicsImpostor.dispose()
      unBindKeys()
    })

    const allPlayers = scene.getMeshesByTags(Player.PLAYER_TAG)
    allPlayers.forEach(mesh => (mesh as Player).isPlayerActive = false)
    Tags.AddTagsTo(this, Player.PLAYER_TAG)
    this.isPlayerActive = true

    // FIXME
    setImmediate(() => this.physicsImpostor.setLinearVelocity(Vector3.Zero()))
  }

  private updatePlayerPhysics() {
    const im = this.physicsImpostor
    im.setAngularVelocity(im.getAngularVelocity().multiplyByFloats(0, this.opts.angularDamping, 0))
    im.setLinearVelocity(im.getLinearVelocity().scale(this.opts.linearDamping))

    if (this.isPlayerActive) {
      const camera = this.getScene().activeCamera as FollowCamera
      if (camera && camera.target) {
        this.forwardDirection.copyFrom(camera.target.subtract(camera.position))
        camera.followTarget.copyFrom(this.position)
      }
      // FIXME: you can not update the physics in the loop
      setImmediate(() => {
        const vc = this.forwardDirection,
          keys = Player.input.state,
          leftStick = Player.input.leftStick,
          [dx, dz] = leftStick && new Vector3(leftStick.x, leftStick.y, 0).length() > 0.15 ?
            [leftStick.x, -leftStick.y] :
            [(keys.moveLeft ? -1 : 0) + (keys.moveRight ? 1 : 0), (keys.moveForward ? 1 : 0) + (keys.moveBack ? -1 : 0)]
        if (this._isPlayerActive && (this.isPlayerWalking = dx || dz)) {
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
    const material = this.spriteBody.material as StandardMaterial,
      texture = material.diffuseTexture as Texture,
      delta = this.position.subtract(this.getScene().activeCamera.position),
      offset = this.rotationQuaternion.toEulerAngles().y,
      angle = Math.PI * 4 - Math.atan2(delta.z, delta.x) - offset,
      vIndex = Math.floor(angle / (Math.PI * 2 / 8) + 0.5) + 1
    texture.vOffset = vIndex % 8 * 32 / 256
    if (this._isPlayerActive && this.isPlayerWalking) {
      const uIndex = Math.floor(this.frameIndex ++ / 10)
      texture.uOffset = uIndex % 4 * 24 / 256
    }

    const pickBottom = this.pickFromBottom(),
      posY = pickBottom.hit ? pickBottom.pickedPoint.y + 1e-4 : -1000
    this.shadow.position.copyFromFloats(this.position.x, posY, this.position.z)
    this.isPlayerOnGround = this.position.y - this.shadow.position.y < 1e-2
    if (pickBottom.hit && pickBottom.pickedPoint.y > this.lastShadowDropPosition.y + this.opts.minimumY) {
      this.lastShadowDropPosition.copyFrom(pickBottom.pickedPoint)
    }
    if (this.position.y < this.lastShadowDropPosition.y + this.opts.minimumY) {
      this.position.copyFrom(this.lastShadowDropPosition)
      this.position.y += 2
      this.physicsImpostor.setLinearVelocity(Vector3.Zero())
    }
  }

  protected updatePlayerFromKey(key: keyof typeof KEY_MAP, down: boolean) {
    if ((key === 'switchNext' || key === 'switchPrev') && !down) {
      const delta = key === 'switchNext' ? 1 : -1,
        allPlayers = this.getScene().getMeshesByTags(Player.PLAYER_TAG),
        nextPlayer = allPlayers[(allPlayers.indexOf(this) + delta + allPlayers.length) % allPlayers.length] as Player
      allPlayers.filter(mesh => mesh !== nextPlayer).forEach(mesh => (mesh as Player).isPlayerActive = false)
      setImmediate(_ => nextPlayer.isPlayerActive = true)
    }
    else if (key === 'jump' && down) {
      const v = this.physicsImpostor.getLinearVelocity()
      Array(6).fill(6).some((n, i) => {
        const a = i / n * Math.PI * 2, r = this.opts.width * 0.2,
          pick = this.pickFromBottom(Math.sin(a) * r, Math.cos(a) * r)
        if (pick.hit && pick.pickedMesh && pick.distance < 0.2 && v.y < 0.5) {
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

export class PlayerGenerator extends Sprite implements IPlayStartStopListener {
  private static playerReferenceCount = { } as { [playerName: string]: number }

  public playerName = ''

  onPlayStart() {
    const ref = PlayerGenerator.playerReferenceCount
    ref[this.playerName] = (ref[this.playerName] || 0) + 1

    let player = this.getScene().getMeshByName(this.playerName) as Player
    if (!player) {
      player = new Player(this.playerName, this.getScene(), this.opts)
      player.position.copyFrom(this.position.add(new Vector3(0, 3, 0)))
    }

    this.spriteBody.isVisible = false
  }

  onPlayStop() {
    const ref = PlayerGenerator.playerReferenceCount
    ref[this.playerName] = (ref[this.playerName] || 0) - 1

    if (ref[this.playerName] <= 0) {
      this.getScene().getMeshByName(this.playerName).dispose()
    }

    this.spriteBody.isVisible = true
  }
}
