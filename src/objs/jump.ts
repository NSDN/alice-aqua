import Trigger from './trigger'

import {
  Color3,
  Vector3,
  AbstractMesh,
  Mesh,
  StandardMaterial,
  DynamicTexture,
} from '../babylon'

import {
  ObjectOptions,
  ObjectElementBinder,
  ObjectTriggerable,
  appendElement,
  appendConfigItem,
} from './object-base'

import {
  drawIconFont,
} from '../utils/dom'

export default class Jump extends Trigger implements ObjectElementBinder, ObjectTriggerable {
  get upForce() {
    return this._upForce
  }
  set upForce(val) {
    this._upForce = val
    this.updateJumpArrow()
  }

  get sideForce() {
    return this._sideForce
  }
  set sideForce(val) {
    this._sideForce = val
    this.updateJumpArrow()
  }

  get sideDirection() {
    return this._sideDirection
  }
  set sideDirection(val) {
    this._sideDirection = val
    this.updateJumpArrow()
  }

  private _upForce = 5
  private _sideForce = 0
  private _sideDirection = 'x' as 'x' | '-x' | 'z' | '-z'
  private jumpArrow: AbstractMesh

  private updateJumpArrow() {
    const [, , a] = Jump.SIDE_DIRS[this._sideDirection]
    this.jumpArrow.rotation.y = a * Math.PI
    this.jumpArrow.rotation.x = Math.atan2(this.sideForce, this.upForce)
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    this.targetName = name
    this.triggerSensor.scaling.scaleInPlace(0.2)

    const cacheId = 'cache/jump/arrow'
    let cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      cache = Mesh.CreatePlane(cacheId, 1, this.getScene(), false, Mesh.DOUBLESIDE)
      cache.scaling.copyFromFloats(1, 1, 1).scaleInPlace(0.8)
      cache.position.y = 0.4
      cache.isVisible = false

      const material = cache.material = new StandardMaterial(cacheId + '/mat', this.getScene())
      material.emissiveColor = Color3.White()
      material.disableLighting = true

      const size = 16,
        texture = material.diffuseTexture =
          new DynamicTexture(cacheId + '/text', size, this.getScene(), false, DynamicTexture.NEAREST_SAMPLINGMODE)

      const dc = texture.getContext()
      dc.fillStyle = '#333'
      drawIconFont(dc, 'fa fa-arrow-up', 0, 0, size)

      texture.hasAlpha = true
      texture.update()
    }

    const arrow = this.jumpArrow = cache.createInstance(this.name + '/arrow')
    arrow.isVisible = true
    arrow.parent = this
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Jump>) => void) {
    const attrs = { type: 'number', min: 0, style: { width: '100px' } },
      up = appendConfigItem('up:', 'input', attrs, container) as HTMLInputElement
    up.value = this.upForce as any
    up.addEventListener('change', _ => save({ upForce: parseFloat(up.value) || 0 }))

    const item = appendElement('div', { className: 'config-item' }, container)

    const dirSel = appendElement('select', { }, item) as HTMLSelectElement
    'x/-x/z/-z'.split('/').forEach(innerHTML => appendElement('option', { innerHTML }, dirSel))
    dirSel.value = this.sideDirection
    dirSel.addEventListener('change', _ => save({ sideDirection: dirSel.value as any }))

    const side = appendElement('input', attrs, item) as HTMLInputElement
    side.value = this.sideForce as any
    side.addEventListener('change', _ => save({ sideForce: parseFloat(side.value) || 0 }))
  }

  static readonly SIDE_DIRS = {
     'x': [ 1,  0, 0.5],
    '-x': [-1,  0, 1.5],
     'z': [ 0,  1, 0.0],
    '-z': [ 0, -1, 1.0],
  }

  onTrigger(isOn: boolean) {
    const mesh = this.triggerMeshes[0]
    if (isOn && mesh && mesh.physicsImpostor) {
      const name = mesh.parent && mesh.parent.name
      if (name === 'remilia') {
        mesh.physicsImpostor.setLinearVelocity(Vector3.Zero())
        const { sideDirection, sideForce, upForce } = this,
          [x, z] = Jump.SIDE_DIRS[sideDirection],
          dir = new Vector3(x * sideForce, upForce, z * sideForce)
        mesh.applyImpulse(dir, mesh.position)
      }
    }
  }
}