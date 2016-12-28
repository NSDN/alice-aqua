import {
  Mesh,
  StandardMaterial,
  Color3,
  Vector3,
  AbstractMesh,
  Tags,
  PhysicsImpostor,
} from '../babylon'

import {
  Vector3Map,
  VERTEX_BOX,
  StaticBoxImpostor,
} from '../utils/babylon'

import {
  debounce,
  watch,
} from '../utils'

import ObjectBase, {
  ObjectElementBinder,
  ObjectOptions,
  appendElement,
  appendConfigItem,
} from './object-base'

export default class Slope extends ObjectBase implements ObjectElementBinder {
  static readonly TARGET_TAG = 'slope-target'
  static readonly GROUND_TAG = 'slope-ground'
  static readonly CACHE_ID = 'cache/slope/ground'

  private groundMesh: AbstractMesh
  private groundImpostor: PhysicsImpostor

  public direction: 'x' | 'z' = 'x'
  public targetName = ''

  private createGroundCache(cacheId: string) {
    const ground = new Mesh(cacheId, this.getScene())
    VERTEX_BOX.applyToMesh(ground)
    ground.isVisible = false

    const material = ground.material = new StandardMaterial(cacheId + '/mat', this.getScene())
    material.disableLighting = true
    material.emissiveColor = new Color3(0.8, 0.8, 0.8)

    return ground
  }

  private createGroundMesh() {
    const cacheId = 'cache/slope/ground',
      cache = (this.getScene().getMeshByName(cacheId) as Mesh) || this.createGroundCache(cacheId),
      groundMesh = cache.createInstance(this.name + '/ground')

    groundMesh.parent = this
    Tags.AddTagsTo(groundMesh, Slope.GROUND_TAG)

    return groundMesh
  }

  private clearGroundAndImpostor() {
    this.groundMesh && this.groundMesh.dispose()
    this.groundImpostor && this.groundImpostor.dispose()
    this.groundMesh = this.groundImpostor = null
  }

  private updateGroundImpostor = debounce(() => {
    this.groundImpostor && this.groundImpostor.dispose()
    this.groundImpostor = null
    if (this.groundMesh) {
      const position = this.groundMesh.getAbsolutePosition().clone(),
        rotation = this.groundMesh.rotation.clone(),
        scaling = this.groundMesh.scaling.clone()
      this.groundImpostor = new StaticBoxImpostor({ position, rotation, scaling }, this.getScene())
    }
  }, 500)

  private updateGroundMesh(target: AbstractMesh) {
    const p0 = Vector3Map(this.position, Math.floor),
      p1 = Vector3Map(target.position, Math.floor),
      min = Vector3.Minimize(p0, p1),
      max = Vector3.Maximize(p0, p1).add(new Vector3(1, 0, 1)),
      delta = max.subtract(min),
      center = max.add(min).scale(0.5),
      [dir, axis] = this.direction === 'z' ? 'zx' : 'xz'
    if (delta[dir] > 2) {
      const dist = delta[dir] - 2,
        angle = Math.atan2(delta.y, dist),
        thickness = Math.cos(angle),
        ground = this.groundMesh || (this.groundMesh = this.createGroundMesh())
      ground.position.copyFrom(center.subtract(this.position))
      ground.position.y -= 0.5 * thickness / Math.cos(angle)
      ground.rotation[dir] = 0
      ground.rotation[axis] = Math.PI / 2 - angle * Math.sign((p0.y - p1.y) * (p0[dir] - p1[dir])) * (dir === 'x' ? -1 : 1)
      ground.scaling[dir] = thickness
      ground.scaling[axis] = delta[axis]
      ground.scaling.y = Math.sqrt(dist * dist + delta.y * delta.y)
      ground.scaling.y += thickness * delta.y / dist
      this.updateGroundImpostor()
    }
    else {
      this.clearGroundAndImpostor()
    }
  }

  constructor(name: string, source: Mesh, opts: ObjectOptions) {
    super(name, source, opts)

    const scene = source.getScene()

    const watchTargetMeshChange = watch((targetMesh: AbstractMesh) => {
      const p0 = Vector3Map(this.position, Math.floor),
        p1 = Vector3Map(targetMesh.position, Math.floor)
      return [p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, this.direction]
    }, () => {
      this.updateGroundMesh(targetMesh)
    })

    let targetMesh: AbstractMesh, listener: () => void
    scene.registerBeforeRender(listener = () => {
      if (!targetMesh || targetMesh.name !== this.targetName) {
        targetMesh = this.targetName && scene.getMeshByName(this.targetName)
      }
      if (targetMesh) {
        watchTargetMeshChange(targetMesh)
      }
      else if (this.groundMesh || this.groundImpostor) {
        this.clearGroundAndImpostor()
      }
    })

    this.onDispose = () => {
      scene.unregisterBeforeRender(listener)
      this.clearGroundAndImpostor()
    }

    Tags.AddTagsTo(this, Slope.TARGET_TAG)
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Slope>) => void) {
    {
      const select = appendConfigItem('target: ', 'select', { }, container) as HTMLSelectElement
      appendElement('option', { innerHTML: '--', value: '' }, select)
      this.getScene().getMeshesByTags(Slope.TARGET_TAG, (mesh: Slope) => {
        if (mesh !== this && mesh.targetName !== this.name) {
          appendElement('option', { innerHTML: mesh.name }, select)
        }
      })
      select.value = this.targetName
      select.addEventListener('change', _ => save({ targetName: select.value }))
    }
    {
      const select = appendConfigItem('direction: ', 'select', { }, container) as HTMLSelectElement
      appendElement('option', { innerHTML: 'x', value: 'x' }, select)
      appendElement('option', { innerHTML: 'z', value: 'z' }, select)
      select.value = this.direction
      select.addEventListener('change', _ => save({ direction: select.value as any }))
    }
  }
}
