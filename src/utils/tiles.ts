export const AUTO_TILE_MAP = [
  {
    dst: [0, 0],
    mask: [0, 1, 2],
    h4x6: [[0, 2], [1, 2], [0, 2], [2, 2], [0, 3], [2, 0], [0, 3], [1, 4]],
    h5x3: [[0, 0], [1, 0], [0, 0], [1, 0], [0, 1], [3, 0], [0, 1], [1, 1]],
  },
  {
    dst: [1, 0],
    mask: [2, 3, 4],
    h4x6: [[3, 2], [3, 3], [3, 2], [3, 4], [2, 2], [3, 0], [1, 2], [2, 4]],
    h5x3: [[2, 0], [2, 1], [2, 0], [2, 1], [1, 0], [4, 0], [1, 0], [1, 1]],
  },
  {
    dst: [1, 1],
    mask: [4, 5, 6],
    h4x6: [[3, 5], [2, 5], [3, 5], [1, 5], [3, 3], [3, 1], [3, 4], [2, 3]],
    h5x3: [[2, 2], [1, 2], [2, 2], [1, 2], [2, 1], [4, 1], [2, 1], [1, 1]],
  },
  {
    dst: [0, 1],
    mask: [6, 7, 0],
    h4x6: [[0, 5], [0, 4], [0, 5], [0, 3], [1, 5], [2, 1], [2, 5], [1, 3]],
    h5x3: [[0, 2], [0, 1], [0, 2], [0, 1], [1, 2], [3, 1], [1, 2], [1, 1]],
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

type TileCache = {
  [offset: string]: {
    canvas: HTMLCanvasElement,
    hasUsed: { [key: string]: boolean }
  }
}

// the size of autotile should be 2*3 tileSize
export function getAutoTileImage(source: HTMLImageElement,
    offsetX: number, offsetY: number,
    tileSize: number, neighbors: number, tileType: 'h4x6' | 'h5x3') {
  const srcCache = source as any as { autoTileCache: TileCache },
    cache = srcCache.autoTileCache = (srcCache.autoTileCache || { }),
    key = [offsetX, offsetY, tileSize].join('/')
  if (!cache[key]) {
    const canvas = document.createElement('canvas')
    canvas.width = tileSize
    canvas.height = 256 * tileSize
    const hasUsed = { }
    cache[key] = { canvas, hasUsed }
  }

  const { canvas, hasUsed } = cache[key],
    hw = tileSize / 2
  if (!hasUsed[neighbors]) {
    const dc = canvas.getContext('2d')
    AUTO_TILE_MAP.forEach(map => {
      const b = getMaskBits(neighbors, map.mask),
        [i, j] = map[tileType][b],
        sx = offsetX + i * hw,
        sy = offsetY + j * hw,
        [m, n] = map.dst,
        dx = m * hw,
        dy = n * hw + neighbors * tileSize
      dc.drawImage(source, sx, sy, hw, hw, dx, dy, hw, hw)
    })
    hasUsed[neighbors] = true
  }

  return { im: canvas, sx: 0, sy: neighbors * tileSize }
}
