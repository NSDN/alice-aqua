import {
  IEditable,
  ITriggerable,
} from '../game/objbase'

import {
  appendConfigInput,
} from '../utils/dom'

import Sprite from './sprite'

class SpriteWithOffset extends Sprite implements IEditable {
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

export class StageEntry extends SpriteWithOffset {
  startPlaying() {
    this.spriteBody.isVisible = false
  }
  stopPlaying() {
    this.spriteBody.isVisible = true
  }
}

export class StageLoader extends StageEntry implements ITriggerable {
  public stageURL = ''

  attachEditorContent(container: HTMLElement, save: (args: Partial<StageLoader>) => void) {
    super.attachEditorContent(container, save)
    appendConfigInput('stageURL: ', this.stageURL, { }, container, stageURL => save({ stageURL }))
  }

  onTrigger(isOn: boolean) {
    const url = this.stageURL,
      position = this.position.add(new BABYLON.Vector3(0, this.offsetY, 0))
    isOn && StageLoader.eventEmitter.emit('load-stage', { url, position })
  }
}
