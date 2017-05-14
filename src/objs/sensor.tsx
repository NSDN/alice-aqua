import { h } from 'preact'

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
  ObjectBase,
  ObjectOptions,
  IObjectTriggerable,
  IPlayStartStopListener,
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

export default class Sensor extends ObjectBase implements IObjectTriggerable, IPlayStartStopListener {
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
      cache.isVisible = false
      cache.material = ColorWireframeNoLightingMaterial.getCached(this.getScene(), Color3.Red())
      cache.scaling.copyFromFloats(0.5, 0.5, 0.5)
    }

    const sensor = cache.createInstance(this.name + '/sensor')
    sensor.parent = this
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

  renderConfig(save: (args: Partial<Sensor>) => void) {
    const availTargets = this.getScene().meshes
        .filter(mesh => (mesh as any as IObjectTriggerable).onTrigger && mesh !== this)
        .map(mesh => mesh.name),
      savedTargets = (this.targetName || '').split(',')
        .filter(target => availTargets.indexOf(target) >= 0)
        .filter(target => !!target).concat(''),
      targetInputs = Array.from(new Set(savedTargets)).map(target => {
        const isNe = target[0] === '!' ? '!' : '',
          name = isNe ? target.substr(1) : target
        return { isNe, name }
      }),
      saveTargets = () => {
        const targetName = targetInputs.map(({ isNe, name }) => isNe + name).join(',')
        save({ targetName })
      }
    return [<table>
      <tr>
        <td>reset: </td>
        <td>
          <input type="number" style={{ width: 100 }}
            value={ this.autoResetTimeout.toString() }
            onChange={ evt => save({ autoResetTimeout: parseFloat((evt.target as HTMLInputElement).value) }) } />
          ms
        </td>
      </tr>
      <tr>
        <td>shape: </td>
        <td>
          <select
            value={ this.sensorShape }
            onChange={ evt => save({ sensorShape: (evt.target as HTMLInputElement).value as any }) }>
          {
            Sensor.sensorTypes.map(type => <option>{ type }</option>)
          }
          </select>
        </td>
      </tr>
      <tr>
        <td>size: </td>
        <td>
        {
          [0, 1, 2].map(i => <input type="number" min={ 0.1 } step={ 0.1 } style={{ width: 50 }}
            value={ this.sensorSize[i].toString() }
            onChange={ ({ target }) => {
                const sensorSize = this.sensorSize
                sensorSize[i] = parseFloat((target as HTMLInputElement).value)
                save({ sensorSize })
              }
            } />)
        }
        </td>
      </tr>
      {
        targetInputs.map(target => <tr key={ target.name }>
          <td>
            <select value={ target.isNe ? 'on' : 'off' }
              onChange={ evt => {
                  target.isNe = (evt.target as HTMLSelectElement).value === 'off' ? '!' : ''
                  saveTargets()
                }
              }>
              <option>on</option>
              <option>off</option>
            </select>
          </td>
          <td>
            <select value={ target.name }
              onChange={ evt => {
                  target.name = (evt.target as HTMLSelectElement).value
                  saveTargets()
                }
              }>
              <option value="">--</option>
              {
                availTargets.map(name => <option>{ name }</option>)
              }
            </select>
          </td>
        </tr>)
      }
    </table>]
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
        mesh = this.getScene().getMeshByName(name) as any as IObjectTriggerable
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
    this.triggerSensor.actionManager && this.triggerSensor.actionManager.dispose()
    this.triggerSensor.actionManager = null
    this.getScene().getMeshesByTags(this.triggerOnTag).forEach(mesh => {
      Tags.RemoveTagsFrom(mesh, this.triggerOnTag)
    })
    this.fireTrigger(false)
  }
  private registerTrigger() {
    this.triggerSensor.actionManager && this.triggerSensor.actionManager.dispose()
    this.triggerSensor.actionManager = new ActionManager(this.getScene())
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

  onPlayStart() {
    // wait until other objects are created
    setImmediate(() => this.registerTrigger())
    this.triggerSensor.isVisible = false
  }

  onPlayStop() {
    this.clearTriggered()
    this.triggerSensor.isVisible = true
  }
}
