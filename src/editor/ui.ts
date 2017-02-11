import {
  appendElement,
} from '../utils/dom'

import {
  TileDefine,
} from '../game/chunks'

import {
  EventEmitter,
  watch,
} from '../utils'

export interface ClassDefine {
  clsId: number
  src: HTMLImageElement
  offsetX: number
  offsetY: number
  width: number
  height: number
  title: string
}

export class UI extends EventEmitter<{
  'tile-selected': string,
  'panel-changed': string,
}> {
  private updatePanel = watch(x => x, (newPanel, oldPanel) => {
    for (const elem of document.querySelectorAll('.ui-panel')) {
      elem.classList.add('hidden')
    }
    for (const elem of document.querySelectorAll('.ui-tab')) {
      elem.classList.remove('active')
      document.body.classList.remove('on-panel-' + elem.getAttribute('tab-target'))
    }

    document.body.classList.add('on-panel-' + newPanel)
    for (const elem of document.querySelectorAll(`.ui-panel.panel-${newPanel}`)) {
      elem.classList.remove('hidden')
    }
    for (const elem of document.querySelectorAll(`.ui-tab[tab-target=${newPanel}]`)) {
      elem.classList.add('active')
    }

    this._activePanel = newPanel
    this.emit('panel-changed', oldPanel)
  })

  constructor(tiles: TileDefine[], classes: ClassDefine[]) {
    super()

    for (const elem of document.querySelectorAll('.ui-tab')) {
      elem.addEventListener('click', _ => this.updatePanel(elem.getAttribute('tab-target')))
    }

    setTimeout(_ => this.updatePanel('brushes'), 100)

    const tileList = document.querySelector('.ui-brushes')
    tiles.forEach(tile => {
      const { tileId, src, offsetX, offsetY, size } = tile,
        attrs = { className: 'ui-list-item', attributes: { tid: tileId } },
        div = appendElement('div', attrs, tileList) as HTMLDivElement,
        [width, height] = [32, 32],
        canvas = appendElement('canvas', { width, height }, div) as HTMLCanvasElement
      canvas.getContext('2d').drawImage(src, offsetX, offsetY, size, size, 0, 0, width, height)
    })

    const clsList = document.querySelector('.ui-classes')
    classes.forEach(cls => {
      const { clsId, src, offsetX, offsetY, width, height, title } = cls,
        attrs = { className: 'ui-list-item', attributes: { cid: clsId }, title },
        div = appendElement('div', attrs, clsList) as HTMLDivElement,
        canvas = appendElement('canvas', { width, height }, div) as HTMLCanvasElement
      canvas.getContext('2d').drawImage(src, offsetX, offsetY, width, height, 0, 0, width, height)
    })

    for (const elem of document.querySelectorAll('.ui-list')) {
      if (!elem.querySelector('.ui-list-item.selected')) {
        const item = elem.querySelector('.ui-list-item')
        item && item.classList.add('selected')
      }
    }

    for (const elem of document.querySelectorAll('.ui-list-item')) {
      elem.addEventListener('click', _ => {
        for (const selected of elem.parentElement.querySelectorAll('.ui-list-item.selected')) {
          selected.classList.remove('selected')
        }
        elem.classList.add('selected')
        this.emit('tile-selected', elem.getAttribute('tid'))
      })
    }
  }

  private _activePanel: string
  get activePanel() {
    return this._activePanel
  }

  get selectedTilePixel() {
    const tile = document.querySelector('.ui-brushes .ui-list-item.selected'),
      height = document.querySelector('.ui-brushes-height .ui-list-item.selected')
    return { t: tile.getAttribute('tid'), h: height.getAttribute('height') }
  }

  get selectedClassIndex() {
    const div = document.querySelector('.ui-classes .ui-list-item.selected')
    return parseInt(div.getAttribute('cid'))
  }
}
