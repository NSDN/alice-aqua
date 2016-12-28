import {
  appendElement,
} from './utils/dom'

import {
  TileDefine,
} from './utils/chunks'

import {
  EventEmitter,
} from './utils'

export interface ClassDefine {
  clsName: string,
  src: HTMLImageElement
  offsetX: number
  offsetY: number
  width: number
  height: number
}

type Events = 'tile-selected' | 'panel-changed'

export class UI extends EventEmitter<Events> {
  constructor(tiles: TileDefine[], classes: ClassDefine[],
      private panel = document.querySelector('.ui-panel-selector') as HTMLSelectElement,
      private brushHeight = document.querySelector('.ui-brush-height') as HTMLSelectElement) {
    super()

    this.panel.addEventListener('change', _ => {
      for (const elem of document.querySelectorAll('.ui-panel')) {
        elem.classList.add('hidden')
      }
      for (const elem of document.querySelectorAll('.ui-panel.panel-' + this.panel.value)) {
        elem.classList.remove('hidden')
      }
      for (const option of this.panel.childNodes) {
        document.body.classList.remove('on-panel-' + (option as HTMLOptionElement).value)
      }
      document.body.classList.add('on-panel-' + this.panel.value)

      if (this.panel['last-value'] !== this.panel.value) {
        this.emit('panel-changed', this.panel['last-value'])
        this.panel['last-value'] = this.panel.value
      }
    })

    setTimeout(_ => this.panel.dispatchEvent(new Event('change')), 100)

    const tileList = document.querySelector('.ui-brushes')
    tiles.forEach((tile, index) => {
      const { src, offsetX, offsetY, size } = tile,
        attrs = { className: 'ui-list-item', attributesToSet: { index } },
        div = appendElement('div', attrs, tileList) as HTMLDivElement,
        [width, height] = [32, 32],
        canvas = appendElement('canvas', { width, height }, div) as HTMLCanvasElement
      canvas.getContext('2d').drawImage(src, offsetX, offsetY, size, size, 0, 0, width, height)
    })

    const clsList = document.querySelector('.ui-classes')
    classes.forEach((cls, index) => {
      const { src, offsetX, offsetY, width, height, clsName } = cls,
        attrs = { className: 'ui-list-item', attributesToSet: { index }, title: clsName },
        div = appendElement('div', attrs, clsList) as HTMLDivElement,
        canvas = appendElement('canvas', { width, height }, div) as HTMLCanvasElement
      canvas.getContext('2d').drawImage(src, offsetX, offsetY, width, height, 0, 0, width, height)
    })

    ; [tileList, clsList].forEach(elem => {
      if (!elem.querySelector('.ui-list-item.selected')) {
        const item = elem.querySelector('.ui-list-item')
        item && item.classList.add('selected')
      }
    })

    for (const elem of document.querySelectorAll('.ui-list-item')) {
      elem.addEventListener('click', _ => {
        for (const selected of elem.parentElement.querySelectorAll('.ui-list-item.selected')) {
          selected.classList.remove('selected')
        }
        elem.classList.add('selected')
        this.emit('tile-selected')
      })
    }
  }

  get activePanel() {
    return this.panel.value
  }

  set activePanel(val) {
    this.panel.value = val
    this.panel.dispatchEvent(new Event('change'))
  }

  get selectedTilePixel() {
    const div = document.querySelector('.ui-brushes .ui-list-item.selected')
    return { t: parseInt(div.getAttribute('index')), h: this.brushHeight.value }
  }

  get selectedClassIndex() {
    const div = document.querySelector('.ui-classes .ui-list-item.selected'),
      index = div && div.getAttribute('index')
    return index && parseInt(index)
  }
}
