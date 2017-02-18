import { h } from 'preact'
import Trigger from './trigger'
import Player from './player'

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
  ITriggerable,
} from '../game/objbase'

import {
  drawIconFont,
} from '../utils/dom'

export default class Jump extends Trigger implements ITriggerable {
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

  renderConfig(save: (args: Partial<Jump>) => void) {
    return [
      <div>
        <label>up: </label>
        <input type="number" min={ 0 } style={{ width: 100 }}
          value={ this.upForce.toString() } onChange={ evt => save({ upForce: parseFloat((evt.target as HTMLInputElement).value) }) } />
      </div>,
      <div>
        <select value={ this.sideDirection } onChange={ evt => save({ sideDirection: (evt.target as HTMLSelectElement).value as any }) }>
          <option>x</option>
          <option>-x</option>
          <option>z</option>
          <option>-z</option>
        </select>
        <input type="number" min={ 0 } style={{ width: 100 }}
          value={ this.sideForce.toString() } onChange={ evt => save({ sideForce: parseFloat((evt.target as HTMLInputElement).value) }) } />
      </div>
    ]
  }

  static readonly SIDE_DIRS = {
     'x': [ 1,  0, 0.5],
    '-x': [-1,  0, 1.5],
     'z': [ 0,  1, 0.0],
    '-z': [ 0, -1, 1.0],
  }

  onTrigger(isOn: boolean, mesh: AbstractMesh) {
    if (mesh === this) {
      const mesh = this.getScene().getMeshesByTags(this.triggerOnTag)[0]
      if (isOn && mesh instanceof Player && mesh.name === 'remilia') {
        mesh.physicsImpostor.setLinearVelocity(Vector3.Zero())
        const { sideDirection, sideForce, upForce } = this,
          [x, z] = Jump.SIDE_DIRS[sideDirection]
        mesh.applyJumpImpulse(new Vector3(x * sideForce, upForce, z * sideForce))
      }
    }
    super.onTrigger(isOn, mesh)
  }
}
