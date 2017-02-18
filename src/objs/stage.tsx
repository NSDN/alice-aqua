import {
  h,
} from 'preact'

import {
  ITriggerable,
} from '../game/objbase'

import Sprite from './sprite'

class SpriteWithOffset extends Sprite {
  get offsetY() {
    return this.spriteBody.position.y - this.spriteBody.scaling.y / 2
  }
  set offsetY(val) {
    this.spriteBody.position.y = val + this.spriteBody.scaling.y / 2
  }

  renderConfig(save: (args: Partial<StageLoader>) => void) {
    return [
      <div>
        <label>offsetY: </label>
        <input type="number" step={ 1 } value={ this.offsetY as any }
          onChange={ ({ target }) => save({ offsetY: parseInt((target as HTMLInputElement).value) }) } />
      </div>
    ]
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

  renderConfig(save: (args: Partial<StageLoader>) => void) {
    return super.renderConfig(save).concat([
      <div>
        <label>stageURL: </label>
        <input value={ this.stageURL }
          onChange={ ({ target }) => save({ stageURL: (target as HTMLInputElement).value }) } />
      </div>
    ])
  }

  onTrigger(isOn: boolean) {
    const url = this.stageURL,
      position = this.position.add(new BABYLON.Vector3(0, this.offsetY, 0))
    isOn && StageLoader.eventEmitter.emit('load-stage', { url, position })
  }
}
