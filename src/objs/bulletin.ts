import * as YAML from 'js-yaml'

import {
  AbstractMesh,
} from '../babylon'

import {
  IUsable,
  ObjectOptions,
  IEditable,
} from '../game/objbase'

import {
  appendConfigElement,
} from '../utils/dom'

import Sprite from './sprite'

export default class BulletinBoard extends Sprite implements IUsable, IEditable {
  public dialogContent = { } as {
    [name: string]: {
      text: string
      options: { [title: string]: string }
    }
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    Object.assign(this.spriteBody, {
      canBeUsedBy: this.canBeUsedBy.bind(this),
      displayUsable: this.displayUsable.bind(this),
      useFrom: this.useFrom.bind(this),
    } as IUsable)
  }

  canBeUsedBy(_mesh: AbstractMesh) {
    return true
  }

  displayUsable(_mesh: AbstractMesh, show: boolean) {
    const canvas = this.opts.canvas,
      markCache = canvas as any as {
        bulletinBoardMarkCache: {
          mark: BABYLON.Group2D,
          text: BABYLON.Text2D
        }
      }

    if (!markCache.bulletinBoardMarkCache) {
      const text = new BABYLON.Text2D('press [ E ] to read', {
        marginAlignment: 'v: center, h: center'
      })
      const mark = new BABYLON.Group2D({
        trackNode: this,
        parent: canvas,
        children: [
          new BABYLON.Rectangle2D({
            width: 150,
            height: 30,
            fill: '#404080FF',
            children: [ text ]
          })
        ]
      })
      markCache.bulletinBoardMarkCache = { text, mark }
    }

    const { mark } = markCache.bulletinBoardMarkCache
    mark.levelVisible = show
    // TODO:
    mark.opacity = show ? 1 : 0
  }

  useFrom(_mesh: AbstractMesh) {
    BulletinBoard.eventEmitter.emit('read-bulletin-content', this.dialogContent)
  }

  attachEditorContent(container: HTMLElement, save: (args: Partial<BulletinBoard>) => void) {
    const text = appendConfigElement('yaml', 'textarea', { rows: 5, cols: 30 }, container) as HTMLTextAreaElement
    text.value = YAML.safeDump(this.dialogContent)
    text.addEventListener('change', () => save({ dialogContent: YAML.safeLoad(text.value) }))
  }
}