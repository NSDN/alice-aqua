import {
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  StandardMaterial,
  Color3,
  AbstractMesh,
} from '../babylon'

import {
  VERTEX_SPHERE,
  VERTEX_BOX,
} from '../utils/babylon'

import ObjectBase, {
  ObjectOptions,
  ObjectElementBinder,
  ObjectTriggerable,
  ObjectPlayListener,
  appendSelectItem,
} from './object-base'

import Box from './box'
import Player from './player'

export default class Trigger extends ObjectBase implements ObjectElementBinder, ObjectPlayListener {
  public targetName: string
  private readonly triggerSensor: AbstractMesh
  private readonly triggerOnBox: AbstractMesh
  private readonly triggerOffBox: AbstractMesh

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    let cacheId

    let sphereCache = this.getScene().getMeshByName(cacheId = 'cache/trigger/sensor') as Mesh
    if (!sphereCache) {
      sphereCache = new Mesh(cacheId, this.getScene())
      VERTEX_SPHERE.applyToMesh(sphereCache)
      sphereCache.isVisible = false
      sphereCache.scaling.copyFromFloats(0.5, 0.5, 0.5)
    }
    const sphere = this.triggerSensor = sphereCache.createInstance(this.name + '/sensor')
    sphere.isVisible = false
    sphere.parent = this
    this.triggerSensor.actionManager = new ActionManager(this.getScene())

    let boxOn = this.getScene().getMeshByName(cacheId = 'cache/trigger/box/on') as Mesh
    if (!boxOn) {
      const box = boxOn = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(box)
      box.isVisible = false
      box.scaling.copyFromFloats(1, 0.1, 1)
      const material = box.material = new StandardMaterial('cache/trigger/box/on', this.getScene())
      material.disableLighting = true
      material.emissiveColor = new Color3(1, 0.5, 0.5)
    }
    let boxOff = this.getScene().getMeshByName(cacheId = 'cache/trigger/box/off') as Mesh
    if (!boxOff) {
      const box = boxOff = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(boxOff)
      box.isVisible = false
      box.scaling.copyFromFloats(1, 0.2, 1)
      const material = box.material = new StandardMaterial('cache/trigger/box/off', this.getScene())
      material.disableLighting = true
      material.emissiveColor = new Color3(0.8, 0.8, 0.8)
    }
    this.triggerOnBox = boxOn.createInstance(this.name + '/box')
    this.triggerOnBox.isVisible = false
    this.triggerOffBox = boxOff.createInstance(this.name + '/box')
    this.triggerOffBox.isVisible = true
    this.triggerOnBox.parent = this.triggerOffBox.parent = this
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Trigger>) => void) {
    const options = this.getScene().meshes
      .filter(mesh => (mesh as any as ObjectTriggerable).onTrigger)
      .map(mesh => mesh.name)
    const select = appendSelectItem('targetName: ', this.targetName, options, container)
    select.addEventListener('change', _ => save({ targetName: select.value as any }))
  }

  private triggerMeshes = [] as AbstractMesh[]
  private fireTrigger(mesh: AbstractMesh, isOn: boolean) {
    const lastLength = this.triggerMeshes.length
    if (isOn && this.triggerMeshes.indexOf(mesh) === -1) {
      this.triggerMeshes = this.triggerMeshes.concat(mesh)
    }
    else if (!isOn && this.triggerMeshes.indexOf(mesh) !== -1) {
      this.triggerMeshes = this.triggerMeshes.filter(m => m !== mesh)
    }
    this.triggerMeshes = this.triggerMeshes.filter(m => !m._isDisposed)
    if ((lastLength === 0 && this.triggerMeshes.length > 0) || (lastLength > 0 && this.triggerMeshes.length === 0)) {
      this.triggerOnBox.isVisible = isOn
      this.triggerOffBox.isVisible = !isOn
      const mesh = this.getScene().getMeshByName(this.targetName) as any as ObjectTriggerable
      if (mesh && mesh.onTrigger) {
        mesh.onTrigger(isOn)
      }
    }
  }
  private registerTrigger() {
    this.getScene().getMeshesByTags(Player.PLAYER_BODY_TAG + ' || ' + Box.BOX_TAG).forEach(mesh => {
      this.triggerSensor.actionManager.registerAction(new ExecuteCodeAction({
        trigger: ActionManager.OnIntersectionEnterTrigger,
        parameter: mesh,
      }, () => this.fireTrigger(mesh, true)))
      this.triggerSensor.actionManager.registerAction(new ExecuteCodeAction({
        trigger: ActionManager.OnIntersectionExitTrigger,
        parameter: mesh,
      }, () => this.fireTrigger(mesh, false)))
    })
  }

  startPlaying() {
    setImmediate(() => this.registerTrigger())
  }

  stopPlaying() {
    this.triggerOnBox.isVisible = false
    this.triggerOffBox.isVisible = true
  }
}
