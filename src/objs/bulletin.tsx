import {
  h,
} from 'preact'

import {
  AbstractMesh,
} from '../babylon'

import {
  IUsable,
  ObjectOptions,
} from '../game/objbase'

import Sprite from './sprite'

export default class BulletinBoard extends Sprite implements IUsable {
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

  renderConfig(save: (args: Partial<BulletinBoard>) => void) {
    const dialogContent = { ...this.dialogContent }
    function renameDialog(oldName: string, newName: string) {
      const dialog = dialogContent[oldName] || { text: '', options: { } }
      delete dialogContent[oldName]
      dialogContent[newName] = dialog
      save({ dialogContent })
    }
    function renameOption(name: string, oldTitle: string, newTitle: string) {
      const next = dialogContent[name].options[oldTitle]
      delete dialogContent[name].options[oldTitle]
      dialogContent[name].options[newTitle] = next
      save({ dialogContent })
    }
    return Object.keys(dialogContent).map(name => {
      return <div key={ name }>
        <div>
          <input value={ name } placeholder="title name"
            onChange={ ({ target }) => renameDialog(name, (target as HTMLInputElement).value) } />
          <textarea placeholder="text content"
            onChange={ ({ target }) => (dialogContent[name].text = (target as HTMLTextAreaElement).value) && save({ dialogContent }) }>
            { dialogContent[name].text }
          </textarea>
        </div>
        <div>
        {
          Object.keys(dialogContent[name].options).sort().map(title => {
            return <input value={ title }
              onChange={ ({ target }) => renameOption(name, title, (target as HTMLInputElement).value) }/>
          })
        }
        </div>
      </div>
    }).concat(<div key="new">
        <div>
          <input id="newDialogTitleInput" value="" placeholder="new title name" />
          <button onClick={ () => renameDialog('', (document.querySelector('#newDialogTitleInput') as HTMLInputElement).value) }>Add</button>
        </div>
    </div>)
  }
}