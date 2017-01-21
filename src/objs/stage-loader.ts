import {
  ObjectOptions,
  ObjectEditable,
  ObjectTriggerable,
} from './'

import {
  appendConfigInput,
} from '../utils/dom'

import {
  EventEmitter,
} from '../utils'

import Sprite from './sprite'

export default class StageLoader extends Sprite implements ObjectEditable, ObjectTriggerable {
  static readonly eventEmitter = new EventEmitter<{ trigger: StageLoader }>()

  public stageURL = ''

  get offsetY() {
    return this.spriteBody.position.y - this.spriteBody.scaling.y / 2
  }
  set offsetY(val) {
    this.spriteBody.position.y = val + this.spriteBody.scaling.y / 2
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
  }

  attachEditorContent(container: HTMLElement, save: (args: Partial<StageLoader>) => void) {
    appendConfigInput('offsetY: ', this.offsetY, { type: 'number', step: 1 }, container, val => save({ offsetY: parseInt(val) }))
    appendConfigInput('stageURL: ', this.stageURL, { }, container, stageURL => save({ stageURL }))
  }

  onTrigger(isOn: boolean) {
    isOn && StageLoader.eventEmitter.emit('trigger', this)
  }
}
