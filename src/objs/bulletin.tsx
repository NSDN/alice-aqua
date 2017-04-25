import {
  h,
} from 'preact'

import Sprite from './sprite'

export default class BulletinBoard extends Sprite {
  public dialogContent = { } as {
    [name: string]: {
      text: string
      options: { [title: string]: string }
    }
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