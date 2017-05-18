import {
  h,
} from 'preact'

import {
  createElement,
} from '../utils/dom'

import {
  EventEmitter,
} from '../utils'

import { TileDefine } from '../game/terrain'
import { ClassDefine } from '../game'

export interface LayerDefine {
  position: {
    x: number
    y: number
    z: number
  }
}

const THUMB_URL_CACHE = { } as { [key: string]: string },
  THUMB_CANVAS_TEMP = createElement('canvas') as HTMLCanvasElement
function tileThumbUrl(tile: TileDefine) {
  const { src, offsetX, offsetY, size, autoTileType } = tile,
    key = [src.id, offsetX, offsetY, size, autoTileType].join('/')
  if (!THUMB_URL_CACHE[key]) {
    const [width, height] = [32, 32]
    THUMB_CANVAS_TEMP.width = width
    THUMB_CANVAS_TEMP.height = height
    if (autoTileType === 'h5x3') {
      THUMB_CANVAS_TEMP.getContext('2d').drawImage(src, offsetX, offsetY, size / 2 * 3, size / 2 * 3, 0, 0, width, height)
    }
    else {
      THUMB_CANVAS_TEMP.getContext('2d').drawImage(src, offsetX, offsetY, size, size, 0, 0, width, height)
    }
    return THUMB_URL_CACHE[key] = THUMB_CANVAS_TEMP.toDataURL()
  }
  else {
    return THUMB_URL_CACHE[key]
  }
}
function clsThumbUrl(cls: ClassDefine) {
  const { src, offsetX, offsetY, width, height } = cls,
    key = [src.id, offsetX, offsetY, width, height].join('/')
  if (!THUMB_URL_CACHE[key]) {
    THUMB_CANVAS_TEMP.width = width
    THUMB_CANVAS_TEMP.height = height
    THUMB_CANVAS_TEMP.getContext('2d').drawImage(src, offsetX, offsetY, width, height, 0, 0, width, height)
    return THUMB_URL_CACHE[key] = THUMB_CANVAS_TEMP.toDataURL()
  }
  else {
    return THUMB_URL_CACHE[key]
  }
}

export const eventEmitter = new EventEmitter<{
  'panel-changed': string

  'tile-height-selected': string
  'tile-selected': number
  'class-selected': number

  'layer-added': void
  'layer-removed': void
  'layer-selected': string
  'layer-updated': Partial<LayerDefine>
}>()

export function PanelTabs({ panel, panels }: {
  panels: string[]
  panel: string
}) {
  return <span class="ui-tabs">
    {
      panels.filter(name => name).map(name => <a href="javascript:void(0)" key={ name }
        class={{ 'ui-tab': true, active: name === panel }}
        onClick={ _ => eventEmitter.emit('panel-changed', name) }>{ name }</a>)
    }
  </span>
}

export const TILE_AUTO = -1
export const TILE_NONE = 0
export function PanelBrushes({ tileHeight, tileId, tiles }: {
  tileHeight: string
  tileId: number
  tiles: TileDefine[]
}) {
  return <div>
    <div class="ui-brushes-height">
      {
        [
          ['+1',           'shift up', 'fa fa-arrow-up'],
          ['-1',         'shift down', 'fa fa-arrow-down'],
          [ '0',            'flatten', 'fa fa-arrows-h'],
          [  '', 'dont update height', 'fa fa-ban'],
        ].map(([height, title, icon]) => <span class={{ 'list-item': true, active: tileHeight === height }}
          title={ title } onClick={ _ => eventEmitter.emit('tile-height-selected', height) }>
          <i class={ icon }></i>
        </span>)
      }
    </div>
    <div class="ui-brushes">
      {
        [
          [TILE_AUTO, 'use tile from start', 'fa fa-question'],
          [TILE_NONE, 'don\'t update tiles', 'fa fa-ban'],
        ].map(([tid, title, icon]: [number, string, string]) => <span class={{ 'list-item': true, active: tid === tileId }}
          title={ title } onClick={ _ => eventEmitter.emit('tile-selected', tid) }>
          <i class={ icon }></i>
        </span>)
      }
      {
        tiles
        .filter(({ autoTileType }) => autoTileType === '' || autoTileType === 'h5x3' || autoTileType === 'h4x6')
        .map(tile => <span class={{ 'list-item': true, active: tileId === tile.tileId }}
          title={ 'tileId: ' + tile.tileId } onClick={ _ => eventEmitter.emit('tile-selected', tile.tileId) }>
          <img src={ tileThumbUrl(tile) } />
        </span>)
      }
    </div>
  </div>
}

export function PanelClasses({ clsId, classes }: {
  clsId: number
  classes: ClassDefine[]
}) {
  return <div>
    <div class="ui-classes">
      {
        Array.from(new Set(classes.map(cls => cls.group))).map(group => <div class="group">
          <div class="group-name">{ group }</div>
          {
            classes.filter(cls => cls.group === group).map(cls => <span class-id={ cls.clsId }
              class={{ 'list-item': true, active: clsId === cls.clsId }}>
              <img class="cls-icon no-select" src={ clsThumbUrl(cls) }
                title={ cls.title || `#${cls.clsId}` }
                onClick={ _ => eventEmitter.emit('class-selected', cls.clsId) } />
            </span>)
          }
        </div>)
      }
    </div>
  </div>
}

export function PanelLayers({ layerId, layers }: {
  layerId: string
  layers: { [id: string]: LayerDefine }
  tiles: TileDefine[]
}) {
  return layers[layerId] && <div>
    <div class="ui-layers">
      <div class="ui-layer-actions">
        <span onClick={ _ => eventEmitter.emit('layer-added', null) }>
          +Layer
        </span>
        <span class={{ hidden: Object.keys(layers).length <= 1 }}
          onClick={ _ => eventEmitter.emit('layer-removed', null) }>
          -Layer
        </span>
      </div>
      {
        Object.keys(layers || { }).map(id => <div class={{ 'ui-layer': true, active: id === layerId }}
          onClick={ _ => eventEmitter.emit('layer-selected', id) }>
          { id } ({ ['x', 'y', 'z'].map((a: 'x' | 'y' | 'z') => layers[id].position[a]).join(', ') })
        </div>)
      }
    </div>
    <div class="ui-layer-content">
      <div class="ui-layer-config config-position">
        <label>position: </label>
        {
          ['x', 'y', 'z'].map((a: 'x' | 'y' | 'z') => <input type="number" step="1"
            value={ '' + layers[layerId].position[a] } onChange={
              ({ target }) => {
                const position = { ...layers[layerId].position }
                position[a] = parseInt((target as HTMLInputElement).value)
                eventEmitter.emit('layer-updated', { position })
              }
            } />)
        }
      </div>
    </div>
  </div>
}
