import {
  ObjectEditable,
  ObjectTriggerable,
  ObjectPlayListener,
} from '../game/objbase'

import {
  appendConfigInput,
} from '../utils/dom'

import {
  EventEmitter,
} from '../utils'

import Sprite from './sprite'

class SpriteWithOffset extends Sprite implements ObjectEditable {
  get offsetY() {
    return this.spriteBody.position.y - this.spriteBody.scaling.y / 2
  }
  set offsetY(val) {
    this.spriteBody.position.y = val + this.spriteBody.scaling.y / 2
  }

  attachEditorContent(container: HTMLElement, save: (args: Partial<StageLoader>) => void) {
    appendConfigInput('offsetY: ', this.offsetY, { type: 'number', step: 1 }, container, val => save({ offsetY: parseInt(val) }))
  }
}

export class StageEntry extends SpriteWithOffset implements ObjectPlayListener {
  startPlaying() {
    this.spriteBody.isVisible = false
  }
  stopPlaying() {
    this.spriteBody.isVisible = true
  }
}

export class StageLoader extends StageEntry implements ObjectTriggerable {
  static readonly eventEmitter = new EventEmitter<{ trigger: StageLoader }>()

  public stageURL = ''

  attachEditorContent(container: HTMLElement, save: (args: Partial<StageLoader>) => void) {
    super.attachEditorContent(container, save)
    appendConfigInput('stageURL: ', this.stageURL, { }, container, stageURL => save({ stageURL }))
  }

  onTrigger(isOn: boolean) {
    isOn && StageLoader.eventEmitter.emit('trigger', this)
  }
}
