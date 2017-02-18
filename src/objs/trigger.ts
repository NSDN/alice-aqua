import {
  Mesh,
  AbstractMesh,
} from '../babylon'

import {
  VERTEX_BOX,
  ColorNoLightingMaterial,
} from '../utils/babylon'

import {
  ObjectOptions,
} from '../game/objbase'

import Sensor, {
  TRIGGER_OFF_COLOR,
  TRIGGER_ON_COLOR
} from './sensor'

export default class Trigger extends Sensor {
  protected readonly triggerOnBox: AbstractMesh
  protected readonly triggerOffBox: AbstractMesh

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    let cacheId = ''

    let boxOn = this.getScene().getMeshByName(cacheId = 'cache/trigger/box/on') as Mesh
    if (!boxOn) {
      const box = boxOn = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(box)
      box.isVisible = false
      box.scaling.copyFromFloats(1, 0.1, 1)
      box.material = ColorNoLightingMaterial.getCached(this.getScene(), TRIGGER_ON_COLOR)
    }

    let boxOff = this.getScene().getMeshByName(cacheId = 'cache/trigger/box/off') as Mesh
    if (!boxOff) {
      const box = boxOff = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(boxOff)
      box.isVisible = false
      box.scaling.copyFromFloats(1, 0.2, 1)
      box.material = ColorNoLightingMaterial.getCached(this.getScene(), TRIGGER_OFF_COLOR)
    }

    this.triggerOnBox = boxOn.createInstance(this.name + '/box')
    this.triggerOnBox.isVisible = false
    this.triggerOffBox = boxOff.createInstance(this.name + '/box')
    this.triggerOffBox.isVisible = true
    this.triggerOnBox.parent = this.triggerOffBox.parent = this
  }

  public onTrigger(isOn: boolean, mesh: AbstractMesh) {
    if (mesh === this) {
      this.triggerOnBox.isVisible = isOn
      this.triggerOffBox.isVisible = !isOn
    }
    super.onTrigger(isOn, mesh)
  }
}
