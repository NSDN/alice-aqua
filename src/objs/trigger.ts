import {
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  StandardMaterial,
  Color3,
  AbstractMesh,
  DynamicTexture,
  Texture,
  Scene,
} from '../babylon'

import {
  VERTEX_SPHERE,
  VERTEX_BOX,
  VERTEX_PLANE,
} from '../utils/babylon'

import ObjectBase, {
  ObjectOptions,
  ObjectElementBinder,
  ObjectTriggerable,
  ObjectPlayListener,
  appendElement,
  appendConfigItem,
} from './object-base'

const TRIGGER_ON_COLOR = new Color3(1, 0.5, 0.5),
  TRIGGER_OFF_COLOR = new Color3(0.8, 0.8, 0.8)

class TriggerLocker extends Mesh {
  private timeBegin = 0
  private timeEnd = 0
  setTimeout(timeout: number) {
    this.timeBegin = Date.now()
    this.timeEnd = this.timeBegin + timeout
    this.isVisible = true
  }

  constructor(name: string, scene: Scene) {
    super(name, scene)
    VERTEX_PLANE.applyToMesh(this)
    this.billboardMode = Mesh.BILLBOARDMODE_Y

    const material = this.material = new StandardMaterial(this.name + '/mat', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()

    const size = 32,
      texture = material.diffuseTexture =
        new DynamicTexture(this.name + '/tex', size, scene, false, Texture.NEAREST_SAMPLINGMODE),
      cx = size / 2,
      cy = size / 2,
      r  = size * 0.4,
      s  = -Math.PI / 2,
      dc = texture.getContext()
    texture.hasAlpha = true
    this.registerBeforeRender(_ => {
      if (this.timeEnd > this.timeBegin) {
        const now = Date.now()
        if (now > this.timeEnd) {
          this.timeEnd = this.timeBegin
        }
        else {
          const val = (this.timeEnd - now) / (this.timeEnd - this.timeBegin)
          dc.clearRect(0, 0, size, size)

          dc.beginPath()
          dc.arc(cx, cy, r, 0, Math.PI * 2)
          dc.strokeStyle = TRIGGER_OFF_COLOR.toHexString()
          dc.lineWidth = 5
          dc.stroke()

          dc.beginPath()
          dc.arc(cx, cy, r, s, s + val * Math.PI * 2)
          dc.strokeStyle = TRIGGER_ON_COLOR.toHexString()
          dc.lineWidth = 3
          dc.stroke()

          texture.update()
        }
      }
      else {
        this.isVisible = false
      }
    })
  }
}

export default class Trigger extends ObjectBase implements ObjectElementBinder, ObjectPlayListener {
  public targetName = ''
  public autoResetTimeout = 0
  public listenTags = [] as string[]

  protected readonly triggerSensor: AbstractMesh
  protected readonly triggerOnBox: AbstractMesh
  protected readonly triggerOffBox: AbstractMesh

  private showLockerSprite(timeout: number) {
    const spriteId = 'trigger/lock/sprite',
      sprite = (this.getScene().getMeshByName(spriteId) as TriggerLocker) || new TriggerLocker(spriteId, this.getScene())
    sprite.position.copyFrom(this.position)
    sprite.position.y += 2
    sprite.setTimeout(timeout)
  }

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
      material.emissiveColor = TRIGGER_ON_COLOR
    }

    let boxOff = this.getScene().getMeshByName(cacheId = 'cache/trigger/box/off') as Mesh
    if (!boxOff) {
      const box = boxOff = new Mesh(cacheId, this.getScene())
      VERTEX_BOX.applyToMesh(boxOff)
      box.isVisible = false
      box.scaling.copyFromFloats(1, 0.2, 1)
      const material = box.material = new StandardMaterial('cache/trigger/box/off', this.getScene())
      material.disableLighting = true
      material.emissiveColor = TRIGGER_OFF_COLOR
    }

    this.triggerOnBox = boxOn.createInstance(this.name + '/box')
    this.triggerOnBox.isVisible = false
    this.triggerOffBox = boxOff.createInstance(this.name + '/box')
    this.triggerOffBox.isVisible = true
    this.triggerOnBox.parent = this.triggerOffBox.parent = this
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Trigger>) => void) {
    const attrs = { type: 'number', style: { width: '100px' } },
      resetInput = appendConfigItem('autoReset(ms):', 'input', attrs, container)
    resetInput.value = this.autoResetTimeout
    resetInput.addEventListener('change', _ => save({ autoResetTimeout: parseInt(resetInput.value) || 0 }))

    const selectionContainer = appendElement('div', { }, container)
    const saveTargetName = () => {
      const targetName = [].map.call(selectionContainer.querySelectorAll('.config-item'), (elem: HTMLDivElement) => {
        const name = (elem.querySelector('select.name') as HTMLSelectElement).value,
          isNe = (elem.querySelector('select.is-ne') as HTMLSelectElement).value
        return name && (isNe + name)
      }).filter(target => !!target).join(',')
      save({ targetName })
    }
    const updateSelections = () => {
      selectionContainer.innerHTML = ''
      const availNames = this.getScene().meshes.filter(mesh => (mesh as any as ObjectTriggerable).onTrigger).map(mesh => mesh.name),
        savedTargets = (this.targetName || '').split(',').filter(target => !!target).concat('')
      while (availNames.length && savedTargets.length) {
        const target = savedTargets.shift(),
          isNe = target[0] === '!' ? '!' : '',
          name = isNe ? target.substr(1) : target,
          item = appendElement('div', { className: 'config-item' }, selectionContainer)

        const isNeSel = appendElement('select', { className: 'is-ne' }, item) as HTMLSelectElement
        appendElement('option', { innerHTML: 'on', value: '' }, isNeSel)
        appendElement('option', { innerHTML: 'off', value: '!' }, isNeSel)
        isNeSel.value = isNe
        isNeSel.addEventListener('change', _ => saveTargetName())

        const nameSel = appendElement('select', { className: 'name' }, item) as HTMLSelectElement
        availNames.forEach(name => appendElement('option', { innerHTML: name }, nameSel))
        appendElement('option', { innerHTML: '--', value: '' }, nameSel)
        nameSel.value = name
        nameSel.addEventListener('change', _ => (saveTargetName(), updateSelections()))

        availNames.splice(availNames.indexOf(target), 1)
      }
    }
    updateSelections()
  }

  private isTriggerLocked = false
  private fireTrigger(isOn: boolean) {
    if (this.isTriggerLocked) {
      return
    }
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
    if (isOn && this.autoResetTimeout > 0) {
      this.isTriggerLocked = true
      this.showLockerSprite(this.autoResetTimeout)
      setTimeout(_ => {
        this.isTriggerLocked = false
        this.fireTrigger(false)
      }, this.autoResetTimeout)
    }
  }

  protected triggerMeshes = [] as AbstractMesh[]
  private checkTrigger(mesh: AbstractMesh, isOn: boolean) {
    const lastLength = this.triggerMeshes.length
    if (isOn && this.triggerMeshes.indexOf(mesh) === -1) {
      this.triggerMeshes = this.triggerMeshes.concat(mesh)
    }
    else if (!isOn && this.triggerMeshes.indexOf(mesh) !== -1) {
      this.triggerMeshes = this.triggerMeshes.filter(m => m !== mesh)
    }
    this.triggerMeshes = this.triggerMeshes.filter(m => !m._isDisposed)
    if ((lastLength === 0 && this.triggerMeshes.length > 0) || (lastLength > 0 && this.triggerMeshes.length === 0)) {
      this.fireTrigger(isOn)
    }
  }
  private registerTrigger() {
    this.getScene().getMeshesByTags(this.listenTags.join(' || ')).forEach(mesh => {
      this.triggerSensor.actionManager.registerAction(new ExecuteCodeAction({
        trigger: ActionManager.OnIntersectionEnterTrigger,
        parameter: mesh,
      }, () => this.checkTrigger(mesh, true)))
      this.triggerSensor.actionManager.registerAction(new ExecuteCodeAction({
        trigger: ActionManager.OnIntersectionExitTrigger,
        parameter: mesh,
      }, () => this.checkTrigger(mesh, false)))
    })
  }

  startPlaying() {
    // wait until other objects are created
    setImmediate(() => this.registerTrigger())
  }

  stopPlaying() {
    this.triggerMeshes.slice().forEach(mesh => this.checkTrigger(mesh, false))
  }
}
