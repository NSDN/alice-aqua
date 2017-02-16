import {
  appendElement,
} from '../utils/dom'

import {
  randomBytes,
  EventEmitter,
  watch,
} from '../utils'

export interface TileDefine {
  src: HTMLImageElement
  tileId: number
  offsetX: number
  offsetY: number
  size: number
  autoTileType: string
  sideTileId: number
}

export interface ClassDefine {
  clsId: number
  src: HTMLImageElement
  offsetX: number
  offsetY: number
  width: number
  height: number
  title: string
}

export interface LayerDefine {
  position: {
    x: number
    y: number
    z: number
  }
  sideTileId: number
}

function updateTabs(tab: Element) {
  const tabGroupName = tab.getAttribute('tab-group'),
    tabTargetName = tab.getAttribute('tab-target')
  for (const elem of document.querySelectorAll(`.ui-tab[tab-group="${tabGroupName}"]`)) {
    elem.classList.remove('active')
  }
  for (const elem of document.querySelectorAll(`.ui-tab[tab-group="${tabGroupName}"][tab-target="${tabTargetName}"]`)) {
    elem.classList.add('active')
  }
  for (const elem of document.querySelectorAll(`.ui-panel[tab-group="${tabGroupName}"]`)) {
    elem.classList.add('hidden')
  }
  for (const elem of document.querySelectorAll(`.ui-panel.panel-${tabTargetName}[tab-group="${tabGroupName}"]`)) {
    elem.classList.remove('hidden')
  }
}

export class Toolbar extends EventEmitter<{
  'panel-changed':  string
  'tile-selected':  void
  'layer-selected': string
  'layer-added':    string
  'layer-removed':  void
  'layer-updated':  Partial<LayerDefine>
}> {
  private updatePanel = watch((e: Element) => e, (newTab, oldTab) => {
    updateTabs(newTab)
    this._activePanel = newTab.getAttribute('tab-target')
    this.emit('panel-changed', oldTab && oldTab.getAttribute('tab-target'))
  })

  private readonly layerPositionInputs: HTMLInputElement[]
  private readonly layerSideTileInputs: HTMLDivElement
  private readonly layerRemoveButton: HTMLButtonElement
  private readonly layerTabList: HTMLDivElement
  syncLayerTabs(layers: { [id: string]: LayerDefine }, selectedId: string) {
    const { position: { x, y, z }, sideTileId } = layers[selectedId]
    this.layerPositionInputs.forEach((input, i) => input.value = '' + [x, y, z][i])

    const createdTabs = new Set<string>()
    for (const tab of this.layerTabList.querySelectorAll('.ui-layer')) {
      const layerId = tab.getAttribute('layer-id')
      if (!layers[layerId]) {
        tab.parentNode.removeChild(tab)
      }
      else {
        const { position: { x, y, z } } = layers[layerId]
        tab.textContent = `${layerId} (${x}, ${y}, ${z})`
        createdTabs.add(layerId)
        tab.classList[layerId === selectedId ? 'add' : 'remove']('active')
      }
    }

    for (const layerId in layers) {
      const { position: { x, y, z } } = layers[layerId]
      if (!createdTabs.has(layerId)) {
        const tab = appendElement('div', {
          className: 'ui-layer',
          textContent: `${layerId} (${x}, ${y}, ${z})`,
          attributes: { 'layer-id': layerId, 'tab-target': layerId }
        }, this.layerTabList)
        tab.addEventListener('click', _ => {
          this.emit('layer-selected', layerId)
        })
        tab.classList[layerId === selectedId ? 'add' : 'remove']('active')
      }
    }

    for (const tile of this.layerSideTileInputs.querySelectorAll('.ui-list-item')) {
      tile.classList[tile.getAttribute('tile-id') === '' + sideTileId ? 'add' : 'remove']('active')
    }

    this.layerRemoveButton.classList[Object.keys(layers).length <= 1 ? 'add' : 'remove']('hidden')
  }

  constructor(tiles: TileDefine[], classes: ClassDefine[]) {
    super()

    const tileList = document.querySelector('.ui-brushes')
    tiles.forEach(({ tileId, src, offsetX, offsetY, size, autoTileType }) => {
      const
        div = appendElement('div', {
          className: 'ui-list-item',
          title: `tileId: ${tileId}`,
          attributes: { 'item-type': 'tile', 'item-id': tileId }
        }, tileList) as HTMLDivElement,
        [width, height] = [32, 32],
        canvas = appendElement('canvas', { width, height }, div) as HTMLCanvasElement
      if (autoTileType === 'h5x3') {
        canvas.getContext('2d').drawImage(src, offsetX, offsetY, size / 2 * 3, size / 2 * 3, 0, 0, width, height)
      }
      else {
        canvas.getContext('2d').drawImage(src, offsetX, offsetY, size, size, 0, 0, width, height)
      }
    })

    const clsList = document.querySelector('.ui-classes')
    classes.forEach(({ clsId, src, offsetX, offsetY, width, height, title }) => {
      const
        div = appendElement('div', {
          className: 'ui-list-item',
          title: title || `clsId: ${clsId}`,
          attributes: { 'item-type': 'cls', 'item-id': clsId }
        }, clsList) as HTMLDivElement,
        canvas = appendElement('canvas', { width, height }, div) as HTMLCanvasElement
      canvas.getContext('2d').drawImage(src, offsetX, offsetY, width, height, 0, 0, width, height)
    })

    this.layerTabList = document.querySelector('.ui-layers') as HTMLDivElement

    this.layerRemoveButton = document.querySelector('.ui-layer-remove') as HTMLButtonElement
    this.layerRemoveButton.addEventListener('click', _ => {
      this.emit('layer-removed', null)
    })

    this.layerPositionInputs = 'x/y/z'.split('/').map((a: 'x' | 'y' | 'z') => {
      const input = document.querySelector('input.ui-layer-pos-' + a) as HTMLInputElement
      input.addEventListener('change', _ => {
        const [x, y, z] = this.layerPositionInputs.map(input => parseInt(input.value) || 0)
        this.emit('layer-updated', { position: { x, y, z } })
      })
      return input
    })

    this.layerSideTileInputs = document.querySelector('.ui-layer-sidetiles') as HTMLDivElement
    for (const sideTileId of new Set(tiles.map(tile => tile.sideTileId))) {
      const canvas = document.querySelector(`.ui-brushes .ui-list-item[item-id="${sideTileId}"] canvas`) as HTMLCanvasElement
      if (canvas) {
        const tile = appendElement('img', {
          src: canvas.toDataURL(),
          className: 'ui-list-item',
          attributes: { 'tile-id': sideTileId }
        }, this.layerSideTileInputs)
        tile.addEventListener('click', _ => {
          this.emit('layer-updated', { sideTileId })
        })
      }
    }

    document.querySelector('.ui-add-layer').addEventListener('click', _ => {
      this.emit('layer-added', 'Terrain/' + randomBytes())
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
        const itemType = elem.getAttribute('item-type')
        if (itemType === 'tile') {
          this.emit('tile-selected', null)
        }
      })
    }

    for (const elem of document.querySelectorAll('.ui-tab')) {
      elem.addEventListener('click', _ => this.updatePanel(elem))
    }
    setTimeout(_ => this.updatePanel(document.querySelector('.ui-tab[tab-target="brushes"]')), 100)
  }

  private _activePanel: string
  get activePanel() {
    return this._activePanel
  }

  get selectedTilePixel() {
    const tile = document.querySelector('.ui-brushes .ui-list-item.selected'),
      height = document.querySelector('.ui-brushes-height .ui-list-item.selected')
    return { t: tile.getAttribute('item-id'), h: height.getAttribute('height') }
  }

  get selectedClassIndex() {
    const div = document.querySelector('.ui-classes .ui-list-item.selected')
    return parseInt(div.getAttribute('item-id'))
  }
}
