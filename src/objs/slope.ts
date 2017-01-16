import {
  Mesh,
  Color3,
  Vector3,
  AbstractMesh,
  Tags,
  PhysicsImpostor,
} from '../babylon'

import {
  Vector3Map,
  VERTEX_BOX,
  ColorNoLightingMaterial,
  StaticBoxImpostor,
} from '../utils/babylon'

import ObjectBase, {
  ObjectElementBinder,
  ObjectOptions,
  appendSelectOptions,
} from './'

export default class Slope extends ObjectBase implements ObjectElementBinder {
  static readonly TARGET_TAG = 'slope-target'
  static readonly GROUND_TAG = 'slope-ground'

  private _direction: 'x' | 'z' = 'x'
  get direction() {
    return this._direction
  }
  set direction(val) {
    if (this._direction !== val) {
      this._direction = val
      this.updateGroundMesh()
    }
  }

  private _targetName = ''
  get targetName() {
    return this._targetName
  }
  set targetName(newTarget) {
    if (this._targetName !== newTarget) {
      const oldTarget = this._targetName
      this._targetName = newTarget
      setImmediate(_ => {
        const oldMesh = this.getScene().getMeshByName(oldTarget)
        oldMesh && oldMesh.unregisterAfterWorldMatrixUpdate(this.updateGroundMesh)
        const newMesh = this.getScene().getMeshByName(newTarget)
        newMesh && newMesh.registerAfterWorldMatrixUpdate(this.updateGroundMesh)
      })
    }
  }

  private groundMesh: AbstractMesh
  private groundImposter: PhysicsImpostor
  private updateGroundMesh = () => {
    const target = this.getScene().getMeshByName(this._targetName),
      p0 = Vector3Map(this.position, Math.floor),
      p1 = Vector3Map((target || this).position, Math.floor),
      min = Vector3.Minimize(p0, p1),
      max = Vector3.Maximize(p0, p1).add(new Vector3(1, 0, 1)),
      delta = max.subtract(min),
      center = max.add(min).scale(0.5),
      ground = this.groundMesh,
      dir = this._direction,
      axis = dir === 'z' ? 'x' : 'z'
    if (delta[dir] > 2) {
      const length = delta[dir] - 2,
        angle = Math.atan2(delta.y, length),
        thickness = Math.cos(angle)
      ground.position.copyFrom(center)
      ground.position.y -= 0.5 * thickness / Math.cos(angle)
      ground.rotation[dir] = 0
      ground.rotation[axis] = Math.PI / 2 - angle * Math.sign((p0.y - p1.y) * (p0[dir] - p1[dir])) * (dir === 'x' ? -1 : 1)
      ground.scaling[dir] = thickness
      ground.scaling[axis] = delta[axis]
      ground.scaling.y = Math.sqrt(length * length + delta.y * delta.y)
      ground.scaling.y += thickness * delta.y / length
      ground.isVisible = true
    }
    else {
      ground.isVisible = false
    }
    this.physicsImpostor && this.physicsImpostor.dispose()
    this.physicsImpostor = ground.isVisible && new StaticBoxImpostor(ground, this.getScene())
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    const cacheId = 'cache/slope/ground',
      scene = this.getScene()

    let cache = scene.getMeshByName(cacheId) as Mesh
    if (!cache) {
      cache = new Mesh(cacheId, scene)
      VERTEX_BOX.applyToMesh(cache)
      cache.isVisible = false
      cache.material = ColorNoLightingMaterial.getCached(scene, Color3.White().scale(0.8))
    }

    this.groundMesh = cache.createInstance(this.name + '/ground')
    Tags.AddTagsTo(this.groundMesh, Slope.GROUND_TAG)

    this.registerAfterWorldMatrixUpdate(this.updateGroundMesh)
    Tags.AddTagsTo(this, Slope.TARGET_TAG)

    this.onDisposeObservable.add(_ => {
      this.groundMesh.dispose()
      this.groundImposter && this.groundImposter.dispose()
    })
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Slope>) => void) {
    const options = { '': '--' }
    this.getScene().getMeshesByTags(Slope.TARGET_TAG, (mesh: Slope) => {
      mesh !== this && mesh.targetName !== this.name && (options[mesh.name] = mesh.name)
    })

    const tarSel = appendSelectOptions('target: ', this.targetName, options, container)
    tarSel.addEventListener('change', _ => save({ targetName: tarSel.value }))

    const dirSel = appendSelectOptions('direction: ', this.direction, ['x', 'z'], container)
    dirSel.addEventListener('change', _ => save({ direction: dirSel.value as any }))
  }
}
