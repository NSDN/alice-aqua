import { h } from 'preact'

import {
  AbstractMesh,
  Mesh,
  Color3,
  Vector3,
  PhysicsImpostor,
} from '../babylon'

import {
  VERTEX_BOX,
  ColorNoLightingMaterial,
} from '../utils/babylon'

import {
  ObjectBase,
  ObjectOptions,
  IObjectTriggerable,
} from '../game/objbase'

export default class Block extends ObjectBase implements IObjectTriggerable {
  public triggerSpeed = 0.02

  private _blockSize = new Vector3(1, 1, 1)
  get blockSize() {
    const { x, y, z } = this._blockSize
    return [x, y, z]
  }
  set blockSize(arr: number[]) {
    const size = Vector3.FromArray(arr),
      block = this.blockBody
    if (!size.equals(this._blockSize)) {
      this._blockSize.copyFrom(size)
      block.scaling.copyFrom(size.scale(0.99))
      block.physicsImpostor.forceUpdate()
      this.updateBlockPosition()
    }
  }

  private _blockOffset = Vector3.Zero()
  get blockOffset() {
    const { x, y, z } = this._blockOffset
    return [x, y, z]
  }
  set blockOffset(arr: number[]) {
    this._blockOffset.copyFrom(Vector3.FromArray(arr))
    this.updateBlockPosition()
  }

  private _triggerOffset = Vector3.Zero()
  get triggerOffset() {
    const { x, y, z } = this._triggerOffset
    return [x, y, z]
  }
  set triggerOffset(arr: number[]) {
    this._triggerOffset.copyFrom(Vector3.FromArray(arr))
  }

  private readonly blockBody: AbstractMesh
  private updateBlockPosition = () => {
    const currentOffset = Vector3.Lerp(Vector3.Zero(), this._triggerOffset, this.currentProgress),
      center = this.position.add(this._blockSize.scale(0.5)).add(new Vector3(-0.5, 0, -0.5))
    this.blockBody.position.copyFrom(center.add(this._blockOffset).add(currentOffset))
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    const cacheId = 'cache/block/body',
      scene = this.getScene()

    let cache = scene.getMeshByName(cacheId) as Mesh
    if (!cache) {
      cache = new Mesh(cacheId, scene)
      VERTEX_BOX.applyToMesh(cache)
      cache.material = ColorNoLightingMaterial.getCached(scene, Color3.White().scale(0.8))
      cache.isVisible = false
    }

    const block = this.blockBody = cache.createInstance(this.name + '/block')
    block.physicsImpostor = new PhysicsImpostor(block, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 1 })
    block.physicsImpostor.registerBeforePhysicsStep(_ => {
      if (this.currentProgress !== this.targetProgress) {
        const progress = this.currentProgress + Math.sign(this.targetProgress - this.currentProgress) * this.triggerSpeed
        this.currentProgress = Math[progress > this.currentProgress ? 'min' : 'max'](this.targetProgress, progress)
        setImmediate(this.updateBlockPosition)
      }
    })

    this.registerAfterWorldMatrixUpdate(this.updateBlockPosition)
    this.onDisposeObservable.add(_ => block.dispose())
  }

  renderConfig(_save: (args: Partial<Block>) => void) {
    /*
    const attrs = { type: 'number', min: 0.005, max: 0.05, step: 0.005 }
    appendConfigInput('speed', this.triggerSpeed, attrs, container, val => save({ triggerSpeed: parseInt(val) }))
    appendVectorInputs('size: ', this._blockSize, container, { min: 1, step: 1 }, (x, y, z) => {
      save({ blockSize: [x, y, z].map(v => Math.max(parseInt(v), 1)) })
    })
    appendVectorInputs('offset: ', this._blockOffset, container, { step: 1 }, (x, y, z) => {
      save({ blockOffset: [x, y, z].map(parseFloat) })
    })
    appendVectorInputs('trigger: ', this._triggerOffset, container, { step: 1 }, (x, y, z) => {
      save({ triggerOffset: [x, y, z].map(parseFloat) })
    })
    */
    return [<div>TODO:</div>]
  }

  private currentProgress = 0
  private targetProgress = 0
  onTrigger(isOn: boolean) {
    this.targetProgress = isOn ? 1 : 0
  }
}
