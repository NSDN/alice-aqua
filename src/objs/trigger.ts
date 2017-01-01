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
  appendElement,
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
    const updateTargetName = () => {
      const targetName = [].map.call(container.querySelectorAll('.config-item'), (elem: HTMLDivElement) => {
        const name = (elem.querySelector('select.name') as HTMLSelectElement).value,
          isNe = (elem.querySelector('select.is-ne') as HTMLSelectElement).value
        return name && (isNe + name)
      }).filter(target => !!target).join(',')
      save({ targetName })
    }
    const updateSelections = () => {
      container.innerHTML = ''
      const availNames = this.getScene().meshes.filter(mesh => (mesh as any as ObjectTriggerable).onTrigger).map(mesh => mesh.name),
        savedTargets = (this.targetName || '').split(',').filter(target => !!target).concat('')
      while (availNames.length && savedTargets.length) {
        const target = savedTargets.shift(),
          isNe = target[0] === '!' ? '!' : '',
          name = isNe ? target.substr(1) : target,
          item = appendElement('div', { className: 'config-item' }, container)

        const isNeSel = appendElement('select', { className: 'is-ne' }, item) as HTMLSelectElement
        appendElement('option', { innerHTML: 'on', value: '' }, isNeSel)
        appendElement('option', { innerHTML: 'off', value: '!' }, isNeSel)
        isNeSel.value = isNe
        isNeSel.addEventListener('change', _ => updateTargetName())

        const nameSel = appendElement('select', { className: 'name' }, item) as HTMLSelectElement
        availNames.forEach(name => appendElement('option', { innerHTML: name }, nameSel))
        appendElement('option', { innerHTML: '--', value: '' }, nameSel)
        nameSel.value = name
        nameSel.addEventListener('change', _ => (updateTargetName(), updateSelections()))

        availNames.splice(availNames.indexOf(target), 1)
      }
    }
    updateSelections()
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
      ; (this.targetName || '').split(',').forEach(target => {
        const isNe = target[0] === '!',
          name = isNe ? target.substr(1) : target,
          mesh = this.getScene().getMeshByName(name) as any as ObjectTriggerable
        if (mesh && mesh.onTrigger) {
          mesh.onTrigger(isNe ? !isOn : isOn)
        }
      })
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
