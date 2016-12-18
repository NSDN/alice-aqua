import {
  ArrayHash
} from './index'

export const AUTO_TILE_MAP = [
  {
    dst: [0, 0],
    mask: [0, 1, 2],
    src: [[0, 2], [1, 2], [0, 2], [2, 2], [0, 3], [2, 0], [0, 3], [1, 4]],
  },
  {
    dst: [1, 0],
    mask: [2, 3, 4],
    src: [[3, 2], [3, 3], [3, 2], [3, 4], [2, 2], [3, 0], [1, 2], [2, 4]],
  },
  {
    dst: [1, 1],
    mask: [4, 5, 6],
    src: [[3, 5], [2, 5], [3, 5], [1, 5], [3, 3], [3, 1], [3, 4], [2, 3]],
  },
  {
    dst: [0, 1],
    mask: [6, 7, 0],
    src: [[0, 5], [0, 4], [0, 5], [0, 3], [1, 5], [2, 1], [2, 5], [1, 3]],
  },
]

export const AUTO_TILE_NEIGHBORS = [
  [-1,  0],
  [-1,  1],
  [ 0,  1],
  [ 1,  1],
  [ 1,  0],
  [ 1, -1],
  [ 0, -1],
  [-1, -1],
]

function getMaskBits(neighbors: number, mask: number[]) {
  return mask.reduce((s, i, j) => s + (neighbors & (1 << i) ? (1 << j) : 0), 0)
}

const tileCaches = new ArrayHash<HTMLImageElement, { [offset: string]: {
  canvas: HTMLCanvasElement,
  dict: { [key: string]: boolean }
} }>()

// the size of autotile should be 2*3 tileSize
export function getAutoTileImage(source: HTMLImageElement,
    offsetX: number, offsetY: number,
    tileSize: number, neighbors: number) {
  const cache = tileCaches.get(source) || tileCaches.set(source, { }),
    key = [offsetX, offsetY, tileSize].join('/')
  if (!cache[key]) {
    const canvas = document.createElement('canvas')
    canvas.width = tileSize
    canvas.height = 256 * tileSize
    const dict = { }
    cache[key] = { canvas, dict }
  }

  const { canvas, dict } = cache[key],
    hw = tileSize / 2
  if (!dict[key + neighbors]) {
    const dc = canvas.getContext('2d')
    AUTO_TILE_MAP.forEach(({ dst, mask, src }) => {
      const b = getMaskBits(neighbors, mask),
        [i, j] = src[b],
        sx = offsetX + i * hw,
        sy = offsetY + j * hw,
        [m, n] = dst,
        dx = m * hw,
        dy = n * hw + neighbors * tileSize
      dc.drawImage(source, sx, sy, hw, hw, dx, dy, hw, hw)
    })
    dict[key + neighbors] = true
  }

  return { im: canvas, sx: 0, sy: neighbors * tileSize }
}
