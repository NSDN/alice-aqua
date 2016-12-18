import {
  Mesh,
  Scene,
  Texture,
  StandardMaterial,
  Color3,
  Vector3,
  AbstractMesh,
  VertexData,
  Material,
  Tags,
  Ray,
  PhysicsImpostor,
} from '../babylon'

import {
  Vector3Map,
  getSideVertexData,
  VERTEX_GROUND,
  VERTEX_DUMMY,
  VERTEX_BOX,
  WireframeNoLightingMaterial,
} from '../utils/babylon'

import {
  ArrayHash,
  debounce,
} from '../utils'

const groundCache = new ArrayHash<Scene, Mesh>()

export default class Slope extends Mesh {
  static readonly TARGET_TAG = 'slope-target'
  static readonly BLOCK_TAG = 'slope-block'

  private groundMesh: AbstractMesh
  private targetMesh: AbstractMesh
  private blockMesh: Mesh

  get targetName() {
    if (this.targetMesh) {
      return this.targetMesh.name
    }
  }

  set targetName(val: string) {
    this.targetMesh = val && this.scene.getMeshByName(val) as Mesh

    const material = this.material as WireframeNoLightingMaterial
    material.emissiveColor = this.targetMesh ? new Color3(0.8, 0.8, 0.8) : Color3.Black()

    this.groundMesh.isVisible = !!this.targetMesh
    if (this.blockMesh && !this.targetMesh) {
      this.blockMesh.dispose()
      this.blockMesh = null
    }
  }

  getGroundMesh() {
    return this.groundMesh
  }

  private getDirection() {
    const dx = this.targetMesh.position.x - this.position.x,
      origin = this.position.add(new Vector3(dx / 2, 0.1, 0)),
      ray = new Ray(origin, new Vector3(0, -1, 0)),
      pick = this.scene.pickWithRay(ray, mesh => true, false)
    return pick.hit && pick.pickedPoint.y === this.position.y ? 'z' : 'x'
  }

  private updateBlockMesh = debounce(() => {
    this.blockMesh && this.blockMesh.dispose()
    const block = this.blockMesh = new Mesh(this.name + '/box', this.scene)
    VERTEX_DUMMY.applyToMesh(block)
    block.isVisible = false
    block.position.copyFrom(this.groundMesh.getAbsolutePosition())
    block.scaling.copyFrom(this.groundMesh.scaling)
    block.rotation.copyFrom(this.groundMesh.rotation)
    block.physicsImpostor = new PhysicsImpostor(block, PhysicsImpostor.BoxImpostor)
    block.physicsImpostor.registerAfterPhysicsStep(impostor => {
      this.isDisposed() && setImmediate(() => block.dispose())
    })
    Tags.AddTagsTo(block, Slope.BLOCK_TAG)
  }, 500)

  private updateGroundMesh() {
    const ground = this.groundMesh,
      p0 = Vector3Map(this.position, Math.floor),
      p1 = Vector3Map(this.targetMesh.position, Math.floor),
      min = Vector3.Minimize(p0, p1),
      max = Vector3.Maximize(p0, p1).add(new Vector3(1, 0, 1)),
      delta = max.subtract(min),
      center = max.add(min).scale(0.5),
      [dir, axis] = this.getDirection() === 'z' ? 'zx' : 'xz'
    if (delta[dir] > 2) {
      const dist = delta[dir] - 2,
        thickness = 1,
        angle = Math.atan2(delta.y, dist)
      ground.position.copyFrom(center.subtract(this.position))
      ground.position.y -= 0.5 * thickness / Math.cos(angle)
      ground.rotation[dir] = 0
      ground.rotation[axis] = Math.PI / 2 - angle * Math.sign((p0.y - p1.y) * (p0[dir] - p1[dir])) * (dir === 'x' ? -1 : 1)
      ground.scaling[dir] = thickness
      ground.scaling[axis] = delta[axis]
      ground.scaling.y = Math.sqrt(dist * dist + delta.y * delta.y)
      ground.scaling.y += thickness * delta.y / dist
      this.updateBlockMesh()
    }
    else {
      ground.scaling.copyFromFloats(0, 0, 0)
    }
  }

  constructor(name: string, readonly scene: Scene) {
    super(name, scene)
    VERTEX_GROUND.applyToMesh(this)
    this.material = new WireframeNoLightingMaterial(name + '/mat', scene, Color3.Black())

    let groundCached = groundCache.get(scene)
    if (!groundCached) {
      const ground = new Mesh('slope/ground/cache', scene)
      ground.isVisible = false
      VERTEX_BOX.applyToMesh(ground)
      const material = ground.material = new StandardMaterial('slope/ground/mat', scene)
      material.disableLighting = true
      material.emissiveColor = new Color3(0.8, 0.8, 0.8)
      groundCached = groundCache.set(scene, ground)
    }
    this.groundMesh = groundCached.createInstance(name + '/ground')
    this.groundMesh.isVisible = false
    this.groundMesh.scaling.copyFromFloats(0, 0, 0)
    this.groundMesh.parent = this

    let lastPositions: string
    this.registerBeforeRender(mesh => {
      if (this.targetMesh) {
        const p0 = Vector3Map(this.position, Math.floor),
          p1 = Vector3Map(this.targetMesh.position, Math.floor),
          positions = [p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, this.targetMesh.name].join('/')
        if (positions !== lastPositions && (lastPositions = positions)) {
          this.updateGroundMesh()
        }
      }
    })

    Tags.AddTagsTo(this, Slope.TARGET_TAG)
  }
}
