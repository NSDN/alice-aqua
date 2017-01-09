import {
  Scene,
  Mesh,
  Texture,
  DynamicTexture,
  StandardMaterial,
  Vector3,
  Color3,
  PhysicsImpostor,
  VertexData,
  AbstractMesh,
} from '../babylon'

import {
  getAutoTileImage,
  AUTO_TILE_NEIGHBORS,
} from './tiles'

import {
  getChunkGroundVertexData,
  getChunkSideVertexData,
  StaticBoxImpostor,
} from './babylon'

import {
  throttle,
  memo,
  getBlocksFromHeightMap,
  EventEmitter,
} from './'

export interface ChunkData {
  tiles: number[]
  heights: number[]
  top: Mesh
  side: Mesh
  blocks: { [id: string]: PhysicsImpostor | AbstractMesh }
  texture: DynamicTexture
  i: number
  j: number
  k: string
}

export interface SaveData {
  tiles: number[]
  heights: number[]
}

export interface TileDefine {
  tileId: number
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
  getGroundVertexDataWithUVMemo = memo(getChunkGroundVertexData),
  getSideVertexDataMemo = memo(getChunkSideVertexData)

export default class Chunks extends EventEmitter<{
  'tile-updated': string,
  'height-updated': ChunkData,
  'chunk-loaded': ChunkData,
}> {
  private readonly sideMaterial: StandardMaterial
  private readonly tilesDefine: { [id: number]: TileDefine }
  private readonly data: { [key: string]: ChunkData } = { }

  constructor(readonly scene: Scene,
    tilesDefine: TileDefine[],
    saveData = { } as { [key: string]: SaveData },
    readonly position = Vector3.Zero(),
    readonly unitSize = 1,
    readonly chunkSize = 16,
    readonly textureSize = 16 * 32,
    readonly minimumY = 0,
    readonly chunkUnits = Math.floor(chunkSize / unitSize),
    readonly unitTexSize = Math.floor(textureSize / chunkUnits)) {
    super()

    this.tilesDefine = { }
    // index tiles with tileId
    tilesDefine.forEach(tile => this.tilesDefine[tile.tileId] = tile)

    const sideMaterial = this.sideMaterial = new StandardMaterial('side', scene)
    sideMaterial.disableLighting = true
    sideMaterial.emissiveColor = Color3.White()
    const texture = sideMaterial.diffuseTexture = new Texture('assets/chunk_side.png', scene)
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE
    texture.uScale = texture.vScale = this.chunkUnits

    Object.keys(saveData).forEach(k => {
      const { tiles, heights } = saveData[k]
      this.createChunkData(k, tiles, heights)
    })
  }

  private createChunkData(k: string,
      tiles = Array(this.chunkUnits * this.chunkUnits).fill(0) as number[],
      heights = Array(this.chunkUnits * this.chunkUnits).fill(this.minimumY) as number[]) {
    const [i, j] = k.split('/').map(parseFloat),
      { chunkUnits, scene, chunkSize, textureSize } = this

    const top = new Mesh('chunk/top/' + k, scene),
      { x, y, z } = this.position
    top.position.copyFromFloats(i * chunkSize + x, y, j * chunkSize + z)

    const side = new Mesh('chunk/side/' + k, scene)
    side.material = this.sideMaterial
    side.parent = top

    const blocks = { }

    const material = top.material = new StandardMaterial('chunk/mat/' + k, scene)
    material.disableLighting = true
    material.emissiveColor = new Color3(1, 1, 1)

    const texture = material.diffuseTexture =
      new DynamicTexture('chunk/tex/' + k, textureSize, scene, true, Texture.NEAREST_SAMPLINGMODE)

    setImmediate(() => {
      for (let u = 0; u < chunkUnits; u ++) {
        for (let v = 0; v < chunkUnits; v ++) {
          this.updateTexture(i * chunkUnits + u, j * chunkUnits + v)
        }
      }
      texture.update()

      this.updateHeight(i * chunkUnits, j * chunkUnits)
      this.emit('height-updated', this.data[k])

      this.emit('chunk-loaded', this.data[k])
    })

    return this.data[k] = { tiles, heights, top, side, blocks, texture, i, j, k }
  }

  private getChunkData(m: number, n: number) {
    const g = this.chunkUnits,
      i = Math.floor(m / g),
      j = Math.floor(n / g),
      k = [i, j].join('/'),
      u = m - i * g,
      v = n - j * g,
      c = u * g + v,
      d = this.data[k] || this.createChunkData(k),
      t = d.tiles[c],
      h = d.heights[c]
    return { ...d, u, v, c, t, h }
  }

  private updateTexture(m: number, n: number) {
    const { texture, u, v, t, h } = this.getChunkData(m, n),
      { unitTexSize, textureSize } = this,
      dc = texture.getContext(),
      dx = u * unitTexSize,
      dy = textureSize - (v + 1) * unitTexSize

    if (this.tilesDefine[t]) {
      const { src, offsetX, offsetY, size, isAutoTile } = this.tilesDefine[t]
      if (isAutoTile) {
        const neighbors = AUTO_TILE_NEIGHBORS
            .map(([i, j]) => this.getChunkData(m + i, n + j))
            .reduce((s, p, j) => s + (p.t === t && p.h === h ? 1 << j : 0), 0)
        const { im, sx, sy } = getAutoTileImage(src, offsetX, offsetY, size, neighbors)
        dc.drawImage(im, sx, sy, size, size, dx, dy, unitTexSize, unitTexSize)
      }
      else {
        dc.drawImage(src, offsetX, offsetY, size, size, dx, dy, unitTexSize, unitTexSize)
      }
    }
    else {
      dc.fillStyle = 'rgb(180, 180, 180)'
      dc.fillRect(dx, dy, unitTexSize, unitTexSize)
    }
  }

  private updateHeight(m: number, n: number) {
    const { chunkUnits, unitSize, scene, minimumY } = this,
      { heights, top, side, blocks } = this.getChunkData(m, n),
      h0 = Math.max(Math.min.apply(Math, heights) - 1, minimumY),
      blks = getBlocksFromHeightMap(heights, chunkUnits, h0)

    const gvd = {
      positions: [ ] as number[],
      normals: [ ] as number[],
      indices: [ ] as number[],
      uvs: [ ] as number[]
    }
    blks.forEach(([u0, u1, v0, v1, , h1]) => {
      const i0 = gvd.positions.length / 3,
        vd = getGroundVertexDataWithUVMemo(u0, u1, v0, v1, h1)
      push.apply(gvd.positions, vd.positions.map(p => p * unitSize))
      push.apply(gvd.normals,   vd.normals)
      push.apply(gvd.indices,   vd.indices.map(i => i + i0))
      push.apply(gvd.uvs,       vd.uvs.map(v => v / chunkUnits))
    })
    Object.assign(new VertexData(), gvd).applyToMesh(top)
    // FIXME: babylonjs
    if (!gvd.indices.length) top.releaseSubMeshes()

    const svd = {
      positions: [ ] as number[],
      normals: [ ] as number[],
      indices: [ ] as number[],
      uvs: [ ] as number[],
    }
    blks.forEach(([u0, u1, v0, v1, h0, h1]) => {
      const g = chunkUnits,
        sides =
          (v1 === g || range(u0, u1).some(u => heights[u * g + v1]       < h1) ? 8 : 0) +
          (u0 === 0 || range(v0, v1).some(v => heights[(u0 - 1) * g + v] < h1) ? 4 : 0) +
          (v0 === 0 || range(u0, u1).some(u => heights[u * g + (v0 - 1)] < h1) ? 2 : 0) +
          (u1 === g || range(v0, v1).some(v => heights[u1 * g + v]       < h1) ? 1 : 0),
        i0 = svd.positions.length / 3,
        vd = getSideVertexDataMemo(u0, u1, v0, v1, h0, h1, sides)
      push.apply(svd.positions, vd.positions.map(p => p * unitSize))
      push.apply(svd.normals,   vd.normals)
      push.apply(svd.indices,   vd.indices.map(i => i + i0))
      push.apply(svd.uvs,       vd.uvs.map(v => v / chunkUnits))
    })
    Object.assign(new VertexData(), svd).applyToMesh(side)
    // FIXME: babylonjs
    if (!svd.indices.length) side.releaseSubMeshes()

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
      const texture = texturesToRefresh[index]
      texture.update()
      this.emit('tile-updated', index)
    })
  }
  private addTextureToUpdate(m: number, n: number, v: number, u: number) {
    this.chunkTextureToUpdate[ [m, n].join('/') ] = v
    const tileV = this.tilesDefine[v], tileU = this.tilesDefine[u]
    if ((tileV && tileV.isAutoTile) || (tileU && tileU.isAutoTile)) {
      AUTO_TILE_NEIGHBORS.forEach(([i, j]) => {
        const pixel = this.getChunkData(m + i, n + j),
          tile = this.tilesDefine[pixel.t]
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

  setPixel(x: number, z: number, p: { t?: number, h?: number | string }) {
    const m = Math.floor((x - this.position.x) / this.unitSize),
      n = Math.floor((z - this.position.z) / this.unitSize),
      { tiles, heights, k, c, t, h } = this.getChunkData(m, n)

    if (+p.t === p.t && t !== p.t) {
      tiles[c] = p.t
      this.addTextureToUpdate(m, n, p.t, t)
    }

    let v = h
    if (typeof p.h === 'string' && p.h) {
      v = h + parseFloat(p.h)
    }
    else if (typeof p.h === 'number') {
      v = p.h - this.position.y
    }

    v = Math.max(v, this.minimumY)
    if (+v === v && h !== v) {
      heights[c] = v
      this.addHeightToUpdate(m, n, k)
      this.addTextureToUpdate(m, n, t, t)
    }
    return { t: tiles[c], h: heights[c] + this.position.y }
  }

  getPixel(x: number, z: number) {
    const m = Math.floor((x - this.position.x) / this.unitSize),
      n = Math.floor((z - this.position.z) / this.unitSize),
      { t, h } = this.getChunkData(m, n)
    return { t, h: h + this.position.y }
  }

  serialize() {
    const saveData = { } as { [key: string]: SaveData }
    Object.keys(this.data).forEach(k => {
      const { tiles, heights } = this.data[k]
      saveData[k] = { tiles, heights }
    })
    return saveData
  }
}