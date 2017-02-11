import {
  Scene,
  Mesh,
  ActionManager,
  ExecuteCodeAction,
  Color3,
  AbstractMesh,
  StandardMaterial,
  DynamicTexture,
  Tags,
} from '../babylon'

import {
  VERTEX_PLANE,
  VERTEX_SPHERE,
  VERTEX_BOX,
  ColorWireframeNoLightingMaterial,
} from '../utils/babylon'

import {
  appendElement,
  appendConfigRow,
  appendConfigInput,
  appendSelectOptions,
  appendVectorInputs,
} from '../utils/dom'

import {
  ObjectBase,
  ObjectOptions,
  ObjectEditable,
  ObjectTriggerable,
  ObjectPlayListener,
} from '../game/objbase'

export const TRIGGER_ON_COLOR = new Color3(1, 0.5, 0.5),
  TRIGGER_OFF_COLOR = Color3.White().scale(0.8)

class TriggerLocker extends Mesh {
  private timeBegin = 0
  private timeEnd = 0
  setTimeout(timeout: number) {
    this.timeBegin = this.opts.clock.tickNow
    this.timeEnd = this.timeBegin + timeout
    this.isVisible = true
  }

  constructor(name: string, scene: Scene, private opts: ObjectOptions) {
    super(name, scene)
    VERTEX_PLANE.applyToMesh(this)
    this.billboardMode = Mesh.BILLBOARDMODE_Y

    const material = this.material = new StandardMaterial(this.name + '/mat', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()

    const size = 32,
      texture = material.diffuseTexture =
        new DynamicTexture(this.name + '/tex', size, scene, false, DynamicTexture.NEAREST_SAMPLINGMODE),
      cx = size / 2,
      cy = size / 2,
      r  = size * 0.4,
      s  = -Math.PI / 2,
      dc = texture.getContext()
    texture.hasAlpha = true
    this.registerBeforeRender(_ => {
      if (this.timeEnd > this.timeBegin) {
        const now = this.opts.clock.tickNow
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

export default class Sensor extends ObjectBase implements ObjectEditable, ObjectPlayListener, ObjectTriggerable {
  private showLockerSprite(timeout: number) {
    const spriteId = 'trigger/lock/sprite',
      sprite = (this.getScene().getMeshByName(spriteId) as TriggerLocker) ||
        new TriggerLocker(spriteId, this.getScene(), this.opts)
    sprite.position.copyFrom(this.position)
    sprite.position.y += 2
    sprite.setTimeout(timeout)
  }

  private _targetName = ''
  get targetName() {
    return this._targetName
  }
  set targetName(val) {
    this._targetName = val
    setImmediate(_ => this.clearTriggered())
  }

  static sensorTypes = ['sphere', 'box'] as ('sphere' | 'box')[]
  private getSensorMesh(type: typeof Sensor.sensorTypes[0]) {
    const cacheId = 'cache/sensor/' + type,
      vertex = type === 'box' ? VERTEX_BOX : VERTEX_SPHERE

    let cache = this.getScene().getMeshByName(cacheId) as Mesh
    if (!cache) {
      cache = new Mesh(cacheId, this.getScene())
      vertex.applyToMesh(cache)
      cache.material = ColorWireframeNoLightingMaterial.getCached(this.getScene(), Color3.Red())
      cache.scaling.copyFromFloats(0.5, 0.5, 0.5)
    }

    const sensor = cache.createInstance(this.name + '/sensor')
    sensor.parent = this
    sensor.actionManager = new ActionManager(this.getScene())
    return sensor
  }

  private _sensorShape = 'sphere' as typeof Sensor.sensorTypes[0]
  get sensorShape() {
    return this._sensorShape
  }
  set sensorShape(val) {
    if (this._sensorShape !== val) {
      this.triggerSensor.dispose()
      this.triggerSensor = this.getSensorMesh(val)
      this._sensorShape = val
    }
  }

  get sensorSize() {
    const { x, y, z } = this.triggerSensor.scaling
    return [x, y, z]
  }
  set sensorSize(val) {
    const [x, y, z] = val
    this.triggerSensor.scaling.copyFromFloats(x, y, z)
  }

  public autoResetTimeout = 0
  public listenTags = [] as string[]

  protected triggerSensor: AbstractMesh
  protected readonly triggerOnTag: string

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    this.triggerSensor = this.getSensorMesh('sphere')
    this.triggerOnTag = 'mesh-trigger-on' + this.name
  }

  attachEditorContent(container: HTMLElement, save: (args: Partial<Sensor>) => void) {
    const attrs = { type: 'number', style: { width: '100px' } }
    appendConfigInput('reset (ms): ', this.autoResetTimeout, attrs, container, value => {
      save({ autoResetTimeout: parseInt(value) || 0 })
    })

    appendSelectOptions('shape: ', this.sensorShape, Sensor.sensorTypes, container, (sensorShape: any) => {
      save({ sensorShape })
    })

    const [x, y, z] = this.sensorSize
    appendVectorInputs('size: ', { x, y, z }, container, { min: 1, step: 1 }, (x, y, z) => {
      save({ sensorSize: [x, y, z].map(v => Math.max(1, parseInt(v))) })
    })

    const rows = [ ] as HTMLElement[]
    const saveTargetName = () => {
      const targetName = rows.map(elem => {
        const name = (elem.querySelector('select.name') as HTMLSelectElement).value,
          isNe = (elem.querySelector('select.is-ne') as HTMLSelectElement).value
        return name && (isNe + name)
      }).filter(target => !!target).join(',')
      save({ targetName })
    }

    const updateSelections = () => {
      rows.forEach(elem => elem.parentNode.removeChild(elem))
      rows.length = 0

      const availNames = this.getScene().meshes
          .filter(mesh => (mesh as any as ObjectTriggerable).onTrigger && mesh !== this)
          .map(mesh => mesh.name),
        savedTargets = (this.targetName || '').split(',').filter(target => !!target).concat('')
      while (availNames.length && savedTargets.length) {
        const target = savedTargets.shift(),
          isNe = target[0] === '!' ? '!' : '',
          name = isNe ? target.substr(1) : target

        const isNeSel = appendElement('select', { className: 'is-ne' }, null) as HTMLSelectElement
        appendElement('option', { innerHTML: 'on', value: '' }, isNeSel)
        appendElement('option', { innerHTML: 'off', value: '!' }, isNeSel)
        isNeSel.value = isNe
        isNeSel.addEventListener('change', _ => saveTargetName())

        const nameSel = appendElement('select', { className: 'name' }, null) as HTMLSelectElement
        availNames.forEach(name => appendElement('option', { innerHTML: name }, nameSel))
        appendElement('option', { innerHTML: '--', value: '' }, nameSel)
        nameSel.value = name
        nameSel.addEventListener('change', _ => (saveTargetName(), updateSelections()))

        const tr = appendConfigRow(isNeSel, nameSel, container) as HTMLTableRowElement
        tr.classList.add('.trigger-config-line')
        rows.push(tr)

        availNames.splice(availNames.indexOf(target), 1)
      }
    }
    updateSelections()
  }

  public onTrigger(isOn: boolean, mesh: AbstractMesh) {
    if (mesh !== this) {
      this.opts.clock.timeout(() => this.fireTrigger(isOn), 500)
    }
  }

  private isTriggerLocked = false
  private fireTrigger(isOn: boolean) {
    if (this.isTriggerLocked) {
      return
    }
    this.onTrigger(isOn, this)
    ; (this._targetName || '').split(',').forEach(target => {
      const isNe = target[0] === '!',
        name = isNe ? target.substr(1) : target,
        mesh = this.getScene().getMeshByName(name) as any as ObjectTriggerable
      if (mesh && mesh.onTrigger) {
        mesh.onTrigger(isNe ? !isOn : isOn, this)
      }
    })
    if (isOn && this.autoResetTimeout > 0) {
      this.isTriggerLocked = true
      this.showLockerSprite(this.autoResetTimeout)
      this.opts.clock.timeout(() => {
        this.isTriggerLocked = false
        this.fireTrigger(false)
      }, this.autoResetTimeout)
    }
  }

  private checkTrigger(mesh: AbstractMesh, isOn: boolean) {
    const triggered = this.getScene().getMeshesByTags(this.triggerOnTag)
    isOn ? Tags.AddTagsTo(mesh, this.triggerOnTag) : Tags.RemoveTagsFrom(mesh, this.triggerOnTag)
    if ((triggered.length === 0 && isOn) || (triggered.length === 1 && triggered[0] === mesh && !isOn)) {
      this.fireTrigger(isOn)
    }
  }
  private clearTriggered() {
    this.getScene().getMeshesByTags(this.triggerOnTag).forEach(mesh => {
      Tags.RemoveTagsFrom(mesh, this.triggerOnTag)
    })
    this.fireTrigger(false)
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
    this.triggerSensor.isVisible = false
  }

  stopPlaying() {
    this.clearTriggered()
    this.triggerSensor.isVisible = true
  }
}
