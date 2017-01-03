import {
  Mesh,
  PhysicsImpostor,
  Vector2,
  Vector3,
  Quaternion,
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

export default class Gate extends ObjectBase implements ObjectElementBinder, ObjectTriggerable {
  public direction = 'x' as 'x' | 'z'
  public isOpen = false

  private creatBox(name: string, cache: Mesh, args: { [dir: string]: { pos: Vector2, rotY: number }[] }) {
    const box = cache.createInstance(this.name + '/' + name)
    box.physicsImpostor = new PhysicsImpostor(box, PhysicsImpostor.BoxImpostor)
    box.physicsImpostor.registerBeforePhysicsStep(_ => {
      const arg = args[this.direction],
        { pos, rotY } = this.isOpen && arg.length > 1 ? arg[1] : arg[0],
        position = this.position.add(new Vector3(pos.x, box.scaling.y / 2, pos.y)),
        rotationQuaternion = Quaternion.RotationAxis(Vector3.Up(), rotY)
      if (!position.equalsWithEpsilon(box.position, 1e-3) ||
          rotationQuaternion.subtract(box.rotationQuaternion).length() > 1e-3) {
        setImmediate(() => {
          box.position.copyFrom(Vector3.Lerp(box.position, position, 0.1))
          box.rotationQuaternion.copyFrom(Quaternion.Slerp(box.rotationQuaternion, rotationQuaternion, 0.1))
        })
      }
      if (this._isDisposed) {
        setImmediate(() => box.dispose())
      }
    })

    setImmediate(() => box.position.copyFrom(this.position))
    return box
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    let cacheId: string, cache: Mesh

    cacheId = 'cache/gate/block'
    cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      cache = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(cache)
      cache.scaling.copyFromFloats(0.95, 1.8, 0.4)
      cache.isVisible = false
      const material = cache.material = new StandardMaterial(cacheId + '/mat', this.getScene())
      material.disableLighting = true
      material.emissiveColor = Color3.White().scale(0.9)
    }
    this.creatBox('block/left', cache, {
      x: [
        { pos: new Vector2(-0.50, 0), rotY: 0 },
        { pos: new Vector2(-1.25, 0), rotY: Math.PI / 2 },
      ],
      z: [
        { pos: new Vector2(0, -0.50), rotY: Math.PI / 2 },
        { pos: new Vector2(0, -1.25), rotY: 0 },
      ]
    })
    this.creatBox('block/right', cache, {
      x: [
        { pos: new Vector2( 0.50, 0), rotY: 0 },
        { pos: new Vector2( 1.25, 0), rotY: -Math.PI / 2 },
      ],
      z: [
        { pos: new Vector2(0,  0.50), rotY: -Math.PI / 2 },
        { pos: new Vector2(0,  1.25), rotY: 0 },
      ]
    })

    cacheId = 'cache/gate/border'
    cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      cache = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(cache)
      cache.scaling.copyFromFloats(1, 2, 0.5)
      cache.isVisible = false
      const material = cache.material = new StandardMaterial(cacheId + '/mat', this.getScene())
      material.disableLighting = true
      material.emissiveColor = Color3.White()
    }
    this.creatBox('border/left', cache, {
      x: [
        { pos: new Vector2(-1.25, 0), rotY: Math.PI / 2 },
      ],
      z: [
        { pos: new Vector2(0, -1.25), rotY: 0 },
      ]
    })
    this.creatBox('border/right', cache, {
      x: [
        { pos: new Vector2( 1.25, 0), rotY: Math.PI / 2 },
      ],
      z: [
        { pos: new Vector2(0,  1.25), rotY: 0 },
      ]
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
