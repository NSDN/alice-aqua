import {
  AbstractMesh,
} from '../babylon'

import {
  ObjectUsable,
  ObjectOptions,
} from '../game/objbase'

import {
  EventEmitter,
} from '../utils'

import Sprite from './sprite'

export default class BulletinBoard extends Sprite implements ObjectUsable {
  static eventEmitter = new EventEmitter<{ use: { target: BulletinBoard, by: AbstractMesh } }>()

  public textContent = '...'

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)
    Object.assign(this.spriteBody, {
      canBeUsedBy: this.canBeUsedBy.bind(this),
      displayUsable: this.displayUsable.bind(this),
      useFrom: this.useFrom.bind(this),
    } as ObjectUsable)
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

  useFrom(mesh: AbstractMesh) {
    BulletinBoard.eventEmitter.emit('use', { target: this, by: mesh })
  }
}