import { h } from 'preact'
import Trigger from './trigger'
import Player from './player'

import {
  Vector3,
  AbstractMesh,
  Mesh,
} from '../babylon'

import {
  ColorNoLightingMaterial,
} from '../utils/babylon'

import {
  ObjectOptions,
} from '../game/objbase'

export default class Jump extends Trigger {
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

  public autoResetTimeout = 1000

  private _upForce = 50
  private _sideForce = 0
  private _sideDirection = 'x' as 'x' | '-x' | 'z' | '-z'
  private jumpBase: AbstractMesh
  private jumpArrow: AbstractMesh

  private updateJumpArrow() {
    const [, , a] = Jump.SIDE_DIRS[this._sideDirection]
    this.jumpBase.rotation.y = a * Math.PI
    this.jumpBase.rotation.x = Math.atan2(this.sideForce, this.upForce)
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    this.targetName = name

    this.jumpBase = new Mesh(this.name + '/base', this.getScene())
    this.jumpBase.parent = this

    const cacheId = 'cache/jump/arrow'
    let cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      const positions = [-0.5, 0.2, 0.21, 0.4],
        radius = [0.2, 0.2, 0.4, 0]
      cache = Mesh.CreateTube(cacheId, positions.map(x => new Vector3(0, x, 0)), 0, 12,
        index => radius[index], Mesh.NO_CAP, this.getScene())
      cache.material = ColorNoLightingMaterial.getCached(this.getScene(),
        BABYLON.Color3.FromHexString('#ff8888'))
      cache.isVisible = false
    }

    const arrow = this.jumpArrow = cache.createInstance(this.name + '/arrow')
    arrow.isVisible = true
    arrow.parent = this.jumpBase
  }

  renderConfig(save: (args: Partial<Jump>) => void) {
    return [
      <table>
        <tr>
          <td>up: </td>
          <td>
            <input type="number" min={ 0 } style={{ width: 100 }}
              value={ this.upForce.toString() }
              onChange={ evt => save({ upForce: parseFloat((evt.target as HTMLInputElement).value) }) } />
          </td>
        </tr>
        <tr>
          <td>
            <select value={ this.sideDirection }
              onChange={ evt => save({ sideDirection: (evt.target as HTMLSelectElement).value as any }) }>
              <option>x</option>
              <option>-x</option>
              <option>z</option>
              <option>-z</option>
            </select>
          </td>
          <td>
            <input type="number" min={ 0 } style={{ width: 100 }}
              value={ this.sideForce.toString() }
              onChange={ evt => save({ sideForce: parseFloat((evt.target as HTMLInputElement).value) }) } />
          </td>
        </tr>
      </table>
    ]
  }

  static readonly SIDE_DIRS = {
     'x': [ 1,  0, 0.5],
    '-x': [-1,  0, 1.5],
     'z': [ 0,  1, 0.0],
    '-z': [ 0, -1, 1.0],
  }

  protected fireTrigger(isOn: boolean) {
    const mesh = this.getScene().getMeshesByTags(this.triggerOnTag)[0]
    if (isOn && mesh instanceof Player) {
      mesh.physicsImpostor.setLinearVelocity(Vector3.Zero())
      const { sideDirection, sideForce, upForce } = this,
        [x, z] = Jump.SIDE_DIRS[sideDirection]
      mesh.applyJumpImpulse(new Vector3(x * sideForce, upForce, z * sideForce))
    }
    this.jumpArrow.position.y = isOn ? 0.5 : 0
    super.fireTrigger(isOn)
  }
}
