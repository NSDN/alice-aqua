import {
  Scene,
  Mesh,
  MeshBuilder,
  Texture,
  DynamicTexture,
  StandardMaterial,
  Vector2,
  Vector3,
  Vector4,
  Color3,
  Color4,
  PhysicsImpostor,
  VertexData,
  AbstractMesh,
  Quaternion,
} from '../babylon'

import {
  getAutoTileImage,
  AUTO_TILE_NEIGHBORS,
} from './tiles'

import {
  WireframeNoLightingMaterial,
  getGroundVertexDataWithUV,
  getSideVertexData,
  VERTEX_DUMMY,
  VERTEX_GROUND,
  StaticBoxImpostor,
} from './babylon'

import {
  throttle,
  memo,
  getBlocksFromHeightMap,
  EventEmitter,
} from './'

export interface ChunkData {
  top: Mesh
  side: Mesh
  blocks: { [id: string]: PhysicsImpostor | Mesh | AbstractMesh }
  texture: DynamicTexture
  i: number
  j: number
  k: string
}

export interface SaveData{
  tiles: number[],
  heights: number[]
}

export interface TileDefine {
  src: HTMLImageElement
  offsetX: number
  offsetY: number
  size: number
  isAutoTile: boolean
}

function range(begin: number, end: number) {
  return Array(end - begin).fill(begin).map((b, i) => b + i)
}

const push = [ ].push,
  getGroundVertexDataWithUVMemo = memo(getGroundVertexDataWithUV),
  getSideVertexDataMemo = memo(getSideVertexData)

type Events = 'height-updated' | 'tile-updated' | 'chunk-loaded'

export default class Chunks extends EventEmitter<Events> {
  private readonly chunkGrids: number
  private readonly texturePixel: number
  private readonly sideMaterial: StandardMaterial
  private data: { [key: string]: ChunkData } = { }

  constructor(readonly scene: Scene,
    readonly tiles: TileDefine[],
    readonly saveData = { } as { [key: string]: SaveData },
    readonly gridSize = 1,
    readonly chunkSize = 16,
    readonly textureSize = 16 * 32) {
    super()

    this.chunkGrids = Math.floor(chunkSize / gridSize)
    this.texturePixel = Math.floor(textureSize / this.chunkGrids)

    const sideMaterial = this.sideMaterial = new StandardMaterial('side', scene)
    sideMaterial.disableLighting = true
    sideMaterial.emissiveColor = new Color3(0.8, 0.8, 0.8)
  }

  private getChunkData(m: number, n: number) {
    const { chunkSize, chunkGrids, gridSize, scene, textureSize, texturePixel } = this,
      i = Math.floor(m / chunkGrids),
      j = Math.floor(n / chunkGrids),
      k = [i, j].join('/'),
      u = m - i * chunkGrids,
      v = n - j * chunkGrids,
      c = u * chunkGrids + v

    if (!this.data[k]) {
      const json = this.saveData[k] || (this.saveData[k] = { } as SaveData),
        tiles    = json.tiles       || (json.tiles = Array(chunkGrids * chunkGrids).fill(0)),
        heights  = json.heights     || (json.heights = tiles.map(t => 0))

      const top = new Mesh('chunk/top/' + k, scene)
      top.position.copyFromFloats(i * chunkSize, 0, j * chunkSize)

      const side = new Mesh('chunk/side/' + k, scene)
      side.material = this.sideMaterial
      side.parent = top

      const blocks = { }

      const material = top.material = new StandardMaterial('chunk/mat/' + k, scene)
      material.disableLighting = true
      material.emissiveColor = new Color3(1, 1, 1)

      const texture = material.diffuseTexture =
        new DynamicTexture('chunk/tex/' + k, textureSize, scene, true, Texture.NEAREST_SAMPLINGMODE)

      this.data[k] = { top, side, blocks, texture, i, j, k }

      setImmediate(() => {
        for (let u = 0; u < chunkGrids; u ++) {
          for (let v = 0; v < chunkGrids;v ++) {
            this.updateTexture(i * chunkGrids + u, j * chunkGrids + v)
          }
        }
        texture.update()

        this.updateHeight(m, n)

        this.emit('chunk-loaded', this.data[k])
      })
    }

    const { tiles, heights } = this.saveData[k], t = tiles[c], h = heights[c]
    return { ...this.data[k], tiles, heights, u, v, c, t, h }
  }

  private updateTexture(m: number, n: number) {
    const { texture, i, j, u, v, t, h } = this.getChunkData(m, n),
      { texturePixel, textureSize } = this,
      dc = texture.getContext(),
      dx = u * texturePixel,
      dy = textureSize - (v + 1) * texturePixel

    const { src, offsetX, offsetY, size, isAutoTile } = this.tiles[0]
    dc.drawImage(src, offsetX, offsetY, size, size, dx, dy, size, size)

    if (this.tiles[t]) {
      const { src, offsetX, offsetY, size, isAutoTile } = this.tiles[t]
      if (isAutoTile) {
        const neighbors = AUTO_TILE_NEIGHBORS
            .map(([i, j]) => this.getPixel(m + i, n + j))
            .reduce((s, p, j) => s + (p.t === t && p.h === h ? 1 << j : 0), 0)
        const { im, sx, sy } = getAutoTileImage(src, offsetX, offsetY, size, neighbors)
        dc.drawImage(im, sx, sy, size, size, dx, dy, texturePixel, texturePixel)
      }
      else {
        dc.drawImage(src, offsetX, offsetY, size, size, dx, dy, texturePixel, texturePixel)
      }
    }
  }

  private updateHeight(m: number, n: number) {
    const { chunkGrids, gridSize, chunkSize, scene } = this,
      { heights, top, side, blocks, k } = this.getChunkData(m, n),
      blks = getBlocksFromHeightMap(heights, chunkGrids)

    const gvd = { positions: [ ], normals: [ ], indices: [ ], uvs: [ ] }
    blks.forEach(([u0, u1, v0, v1, h0, h1]) => {
      const i0 = gvd.positions.length / 3,
        vd = getGroundVertexDataWithUVMemo(u0, u1, v0, v1, h1)
      push.apply(gvd.positions, vd.positions.map(p => p * gridSize))
      push.apply(gvd.normals,   vd.normals)
      push.apply(gvd.indices,   vd.indices.map(i => i + i0))
      push.apply(gvd.uvs,       vd.uvs.map(v => v / chunkGrids))
    })
    Object.assign(new VertexData(), gvd).applyToMesh(top)

    const svd = { positions: [ ], normals: [ ], indices: [ ] }
    blks.forEach(([u0, u1, v0, v1, h0, h1]) => {
      const g = chunkGrids,
        sides = [
          v1 === g || range(u0, u1).some(u => heights[u * g + v1]     < h1) ? 1: 0,
          u0 === 0 || range(v0, v1).some(v => heights[(u0-1) * g + v] < h1) ? 1: 0,
          v0 === 0 || range(u0, u1).some(u => heights[u * g + (v0-1)] < h1) ? 1: 0,
          u1 === g || range(v0, v1).some(v => heights[u1 * g + v]     < h1) ? 1: 0,
        ].join(''),
        i0 = svd.positions.length / 3,
        vd = getSideVertexDataMemo(u0, u1, v0, v1, h0, h1, sides)
      push.apply(svd.positions, vd.positions.map(p => p * gridSize))
      push.apply(svd.normals,   vd.normals)
      push.apply(svd.indices,   vd.indices.map(i => i + i0))
    })
    Object.assign(new VertexData(), svd).applyToMesh(side)

    const keepInBlocks = { } as { [id: string]: boolean }
    blks.forEach(([u0, u1, v0, v1, h0, h1]) => {
      const id = ['chunk', 'block', u0, u1, v0, v1, h0, h1].join('/')
      if (!blocks[id]) {
        const p0 = new Vector3(u0, h0, v0).add(top.position),
          p1 = new Vector3(u1, h1, v1).add(top.position),
          position = p0.add(p1).scale(0.5),
          scaling = p1.subtract(p0)
        blocks[id] = new StaticBoxImpostor({ position, scaling }, scene)
      }
      keepInBlocks[id] = true
    })

    if (Math.min.apply(Math, heights) < 0) {
      const id = ['chunk', 'water', k].join('/')
      if (!blocks[id]) {
        const cacheId = 'cache/chunk/water'

        let cache = scene.getMeshByName(cacheId) as Mesh
        if (!cache) {
          // TODO: 
          const mesh = cache = new Mesh(cacheId, scene)
          VERTEX_GROUND.applyToMesh(mesh)
          mesh.scaling.copyFromFloats(chunkSize, 1, chunkSize)
          mesh.visibility = 0.8
          mesh.isVisible = false
          const material = mesh.material = new StandardMaterial('water', scene)
          material.emissiveColor = new Color3(91/255, 176/255, 226/255)
        }

        const water = cache.createInstance(id)
        water.position.copyFrom(top.position.add(new Vector3(chunkSize / 2, -0.2, chunkSize / 2)))
      }
      keepInBlocks[id] = true
    }

    Object.keys(blocks).filter(id => !keepInBlocks[id]).forEach(id => {
      blocks[id].dispose()
      delete blocks[id]
    })
  }

  private throttleUpdate = throttle(this.batchUpdateChunk.bind(this), 50)
  private chunkTextureToUpdate = { } as { [index: string]: number }
  private chunkHeightToUpdate = { } as { [index: string]: string }
  private batchUpdateChunk() {
    const texturesToRefresh = { } as { [key: string]: DynamicTexture }

    Object.keys(this.chunkTextureToUpdate).forEach(index => {
      const [m, n] = index.split('/').map(parseFloat)
      this.updateTexture(m, n)
      const { k, texture } = this.getChunkData(m, n)
      texturesToRefresh[k] = texture
    })
    this.chunkTextureToUpdate = { }

    Object.keys(this.chunkHeightToUpdate).forEach(index => {
      const mn = this.chunkHeightToUpdate[index],
        [m, n] = mn.split('/').map(parseFloat)
      this.updateHeight(m, n)
      this.emit('height-updated', this.getChunkData(m, n))
    })
    this.chunkHeightToUpdate = { }

    Object.keys(texturesToRefresh).forEach(index => {
      texturesToRefresh[index].update()
      this.emit('tile-updated', index)
    })
  }
  private addTextureToUpdate(m: number, n: number, v: number, u: number) {
    this.chunkTextureToUpdate[ [m, n].join('/') ] = v
    const tileV = this.tiles[v], tileU = this.tiles[u]
    if ((tileV && tileV.isAutoTile) || (tileU && tileU.isAutoTile)) {
      AUTO_TILE_NEIGHBORS.forEach(([i, j]) => {
        const pixel = this.getPixel(m + i, n + j),
          tile = this.tiles[pixel.t]
        if (tile && tile.isAutoTile) {
          this.chunkTextureToUpdate[ [m + i, n + j].join('/') ] = pixel.t
        }
      })
    }
    this.throttleUpdate()
  }
  private addHeightToUpdate(m: number, n: number, k: string) {
    this.chunkHeightToUpdate[k] = [m, n].join('/')
    this.throttleUpdate()
  }

  setPixel(m: number, n: number, p: { t?: number, h?: number | string }) {
    [m, n] = [Math.floor(m / this.gridSize), Math.floor(n / this.gridSize)]
    const { tiles, heights, k, c, t, h } = this.getChunkData(m, n)

    if (+p.t === p.t && t !== p.t) {
      tiles[c] = p.t
      this.addTextureToUpdate(m, n, p.t, t)
    }
    if (typeof p.h === 'string' && p.h) {
      p.h = h + parseFloat(p.h)
    }
    if (+p.h === p.h && h !== p.h) {
      heights[c] = Math.max(p.h, -1)
      this.addHeightToUpdate(m, n, k)
      this.addTextureToUpdate(m, n, t, t)
    }
    return { t, h }
  }

  getPixel(m: number, n: number) {
    [m, n] = [Math.floor(m / this.gridSize), Math.floor(n / this.gridSize)]
    const { k, c, t, h } = this.getChunkData(m, n)
    return { t, h }
  }

  serialize() {
    return this.saveData
  }
}