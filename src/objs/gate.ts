import {
  AbstractMesh,
  Mesh,
  PhysicsImpostor,
  Vector3,
  StandardMaterial,
  Color3,
} from '../babylon'

import {
  VERTEX_BOX,
} from '../utils/babylon'

import ObjectBase, {
  ObjectOptions,
  ObjectElementBinder,
  ObjectTriggerable,
  appendSelectItem,
} from './object-base'

const
  openPosX   = [new Vector3(-1.5, 1, 0), new Vector3(1.5, 1,  0)],
  closedPosX = [new Vector3(-0.5, 1, 0), new Vector3(0.5, 1,  0)],
  openPosZ   = [new Vector3(0, 1, -1.5), new Vector3(0, 1,  1.5)],
  closedPoxZ = [new Vector3(0, 1, -0.5), new Vector3(0, 1,  0.5)]

export default class Gate extends ObjectBase implements ObjectElementBinder, ObjectTriggerable {
  public direction = 'x' as 'x' | 'z'
  public isOpen = false

  readonly blockLeft: AbstractMesh
  readonly blockRight: AbstractMesh
  readonly borderLeft: AbstractMesh
  readonly borderRight: AbstractMesh

  private creatBox(name: string) {
    const cacheId = 'cache/gate/block'
    let cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      cache = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(cache)
      cache.scaling.copyFromFloats(1.001, 2.001, 1.001)
      cache.isVisible = false
      const material = cache.material = new StandardMaterial(cacheId + '/mat', this.getScene())
      material.disableLighting = true
      material.emissiveColor = new Color3(1, 1, 1)
    }
    const box = cache.createInstance(this.name + '/' + name)
    box.parent = this
    box.physicsImpostor = new PhysicsImpostor(box, PhysicsImpostor.BoxImpostor)
    return box
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.ParticleImpostor)

    this.blockLeft = this.creatBox('block/left')
    this.blockRight = this.creatBox('block/right')
    this.borderLeft = this.creatBox('border/left')
    this.borderRight = this.creatBox('border/right')

    this.physicsImpostor.registerBeforePhysicsStep(_ => {
      const [posLeft, posRight] = this.direction === 'x' ? (this.isOpen ? openPosX : closedPosX) : (this.isOpen ? openPosZ : closedPoxZ)
      if (!posLeft.equalsWithEpsilon(this.blockLeft.position, 0.001) ||
          !posRight.equalsWithEpsilon(this.blockRight.position, 0.001)) {
        this.blockLeft.position.copyFrom(Vector3.Lerp(this.blockLeft.position, posLeft, 0.1))
        this.blockRight.position.copyFrom(Vector3.Lerp(this.blockRight.position, posRight, 0.1))

        const [left, right] = this.direction === 'x' ? openPosX : openPosZ
        this.borderLeft.position.copyFrom(left)
        this.borderRight.position.copyFrom(right)

        this.physicsImpostor.forceUpdate()
      }
    })
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Gate>) => void) {
    const select = appendSelectItem('direction: ', this.direction, ['x', 'z'], container)
    select.addEventListener('change', _ => save({ direction: select.value as any }))
  }

  onTrigger(isOn: boolean) {
    this.isOpen = isOn
  }
}
