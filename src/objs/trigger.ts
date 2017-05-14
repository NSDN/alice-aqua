import {
  Mesh,
  AbstractMesh,
  Texture,
} from '../babylon'

import {
  VERTEX_BOX,
  CommonMaterial,
} from '../utils/babylon'

import {
  ObjectOptions,
} from '../game/objbase'

import Sensor, { } from './sensor'

export default class Trigger extends Sensor {
  protected readonly triggerOnBox: AbstractMesh
  protected readonly triggerOffBox: AbstractMesh

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    const scene = this.getScene()

    let cacheId = ''

    let boxOn = scene.getMeshByName(cacheId = 'cache/trigger/box/on') as Mesh
    if (!boxOn) {
      const box = boxOn = new Mesh(cacheId, scene)
      VERTEX_BOX.applyToMesh(box)
      box.isVisible = false
      box.scaling.copyFromFloats(1, 0.1, 1)
      const material = box.material = new CommonMaterial(cacheId + '-mat', scene)
      material.diffuseTexture = new Texture('assets/trigger-box.png', scene)
      material.emissiveColor = BABYLON.Color3.Red()
    }

    let boxOff = scene.getMeshByName(cacheId = 'cache/trigger/box/off') as Mesh
    if (!boxOff) {
      const box = boxOff = new Mesh(cacheId, scene)
      VERTEX_BOX.applyToMesh(boxOff)
      box.isVisible = false
      box.scaling.copyFromFloats(1, 0.2, 1)
      const material = box.material = new CommonMaterial(cacheId + '-mat', scene)
      material.diffuseTexture = new Texture('assets/trigger-box.png', scene)
    }

    this.triggerOnBox = boxOn.createInstance(this.name + '/box')
    this.triggerOnBox.isVisible = false
    this.triggerOffBox = boxOff.createInstance(this.name + '/box')
    this.triggerOffBox.isVisible = true
    this.triggerOnBox.parent = this.triggerOffBox.parent = this
  }

  protected fireTrigger(isOn: boolean) {
    this.triggerOnBox.isVisible = isOn
    this.triggerOffBox.isVisible = !isOn
    super.fireTrigger(isOn)
  }
}
