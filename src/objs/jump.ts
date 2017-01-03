import Trigger from './trigger'
import Box from './box'

import {
  Vector3,
} from '../babylon'

import {
  ObjectOptions,
  ObjectElementBinder,
  ObjectTriggerable,
} from './object-base'

export default class Jump extends Trigger implements ObjectElementBinder, ObjectTriggerable {
  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    this.targetName = name
    this.triggerSensor.scaling.scaleInPlace(0.2)
  }

  bindToElement(_container: HTMLElement, _save: (args: Partial<Jump>) => void) {
  }

  onTrigger(isOn: boolean) {
    const mesh = this.triggerMeshes[0]
    if (isOn && mesh && mesh.physicsImpostor) {
      mesh.physicsImpostor.setLinearVelocity(mesh.physicsImpostor.getLinearVelocity().multiplyByFloats(1, 0, 1))
      const force = mesh instanceof Box ? 20 : 5
      mesh.applyImpulse(new Vector3(0, force, 0), mesh.position)
    }
  }
}
