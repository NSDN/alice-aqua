import {
  Scene,
  AbstractMesh,
  Mesh,
  Texture,
  DynamicTexture,
  StandardMaterial,
  Vector3,
  PhysicsImpostor,
  VertexData,
} from '../babylon'

import {
  getAutoTileImage,
  AUTO_TILE_NEIGHBORS,
} from '../utils/tiles'

import {
  getChunkGroundVertexData,
  StaticBoxImpostor,
} from '../utils/babylon'

import {
  throttle,
  memo,
  compressWithRLE,
  extractWithRLE,
  getBlocksFromHeightMap,
  EventEmitter,
} from '../utils'

export interface Chunk {
  tiles: number[]
  heights: number[]
  top: Mesh
  blocks: { [id: string]: PhysicsImpostor }
  texture: DynamicTexture
  vertices: {
    positions: number[],
    indices: number[],
    uvs: number[],
    normals: number[],
  }
  m0: number
  n0: number
  k: string
}

export interface TerrainData {
  unit: number
  size: number
  chunks: {
    [key: string]: {
      tiles: number[]
      heights: number[]
    }
  }
}

export interface TileDefine {
  src: HTMLImageElement
  tileId: number
  offsetX: number
  offsetY: number
  size: number
  autoTileType: string
  sideTileId: number
}

export const eventEmitter = new EventEmitter<{
  'tile-updated': { terrain: Terrain }
  'height-updated': { terrain: Terrain, chunk: Chunk }
  'chunk-loaded': { terrain: Terrain, chunk: Chunk }
  'position-updated': { terrain: Terrain, delta: Vector3 }
}>()

const push = [ ].push,
  getGroundVertexDataWithUVMemo = memo(getChunkGroundVertexData)

export default class Terrain extends EventEmitter<{
  'tile-updated': void
  'height-updated': Chunk
  'chunk-loaded': Chunk
  'position-updated': Vector3
}> {
  private static terrainFromChunkMesh = { } as { [meshId: string]: Terrain }
  static getTerrainFromMesh(mesh: AbstractMesh) {
    return Terrain.terrainFromChunkMesh[mesh.name]
  }

  private readonly sideMesh: Mesh

  private readonly tilesDefine: { [id: number]: TileDefine }
  private readonly data: { [key: string]: Chunk } = { }

  readonly unitSize: number
  readonly chunkSize: number
  readonly textureSize: number
  readonly chunkUnits: number
  readonly unitTexSize: number

  constructor(readonly name: string, readonly scene: Scene,
    tilesDefine: TileDefine[],
    restoreData = { } as TerrainData,
    readonly position = Vector3.Zero()) {
    super()

    this.unitSize = restoreData.unit || 1
    this.chunkSize = restoreData.size || 32
    this.textureSize = this.chunkSize * 16
    this.chunkUnits = Math.floor(this.chunkSize / this.unitSize)
    this.unitTexSize = Math.floor(this.textureSize / this.chunkUnits)

    this.tilesDefine = { }
    tilesDefine.forEach(tile => this.tilesDefine[tile.tileId] = tile)

    this.sideMesh = new Mesh(this.name + '/side', scene)
    this.sideMesh.position.copyFrom(this.position)
    this.sideMesh.receiveShadows = true
    Terrain.terrainFromChunkMesh[this.sideMesh.name] = this

    const sideMaterialId = 'cache/chunk/edge/' + this.chunkUnits
    this.sideMesh.material = scene.getMaterialByName(sideMaterialId) as StandardMaterial
    if (!this.sideMesh.material) {
      const material = this.sideMesh.material = new StandardMaterial(sideMaterialId, scene)
      material.diffuseTexture =
        new DynamicTexture('cache/chunk/edge/mat', this.edgeTextureCacheSize * this.unitTexSize, scene, true, Texture.NEAREST_SAMPLINGMODE)
      material.specularPower = 0.5
      material.specularColor.copyFromFloats(0.1, 0.1, 0.1)
      material.emissiveColor.copyFromFloats(0.8, 0.8, 0.8)
    }

    const edgeTextureCacheContainer = this.sideMesh.material as any as { edgeTextureCaches: any }
    this.edgeTextureCaches = edgeTextureCacheContainer.edgeTextureCaches || (edgeTextureCacheContainer.edgeTextureCaches = { })

    Object.keys(restoreData.chunks || { }).forEach(k => {
      const { tiles, heights } = restoreData.chunks[k]
      this.createChunkData(k, extractWithRLE(tiles), extractWithRLE(heights))
    })
  }

  readonly edgeTextureCacheSize = 16
  private readonly edgeTextureCaches: { [tileId: number]: [number, number, number, number] }
  private getEdgeTileTextureUV(tileId: number) {
    if (this.edgeTextureCaches[tileId]) {
      return this.edgeTextureCaches[tileId]
    }
    else {
      const { sideTileId } = this.tilesDefine[tileId],
        { src, offsetX, offsetY, size } = this.tilesDefine[sideTileId],
        index = Object.keys(this.edgeTextureCaches).length,
        i = Math.floor(index / this.edgeTextureCacheSize), j = index % this.edgeTextureCacheSize,
        material = this.sideMesh.material as StandardMaterial,
        texture = material.diffuseTexture as DynamicTexture,
        dc = texture.getContext()
      dc.drawImage(src, offsetX, offsetY, size, size,
        i * this.unitTexSize, j * this.unitTexSize, this.unitTexSize, this.unitTexSize)
      texture.update()
      const e = 1e-3, // this remove strange black edges
        u0 = i / this.edgeTextureCacheSize + e, u1 = (i + 1) / this.edgeTextureCacheSize - e,
        v0 = 1 - (j + 1) / this.edgeTextureCacheSize + e, v1 = 1 - j / this.edgeTextureCacheSize - e
      return this.edgeTextureCaches[tileId] = [u0, v1, u1, v1, u1, v0, u0, v0]
    }
  }

  private createChunkData(k: string,
      tiles = Array(this.chunkUnits * this.chunkUnits).fill(0) as number[],
      heights = Array(this.chunkUnits * this.chunkUnits).fill(0) as number[]) {
    const [i, j] = k.split('/').map(parseFloat),
      { chunkUnits, scene, chunkSize, textureSize } = this,
      [m0, n0] = [i * chunkUnits, j * chunkUnits],
      [x0, y0] = [i * chunkSize, j * chunkSize]

    const top = new Mesh(this.name + '/top/' + k, scene),
      { x, y, z } = this.position
    top.position.copyFromFloats(x0 + x, y, y0 + z)
    top.receiveShadows = true
    Terrain.terrainFromChunkMesh[top.name] = this

    const material = top.material = new StandardMaterial(this.name + '/mat/' + k, scene)
    material.specularColor.copyFromFloats(0, 0, 0)
    material.emissiveColor.copyFromFloats(0.8, 0.8, 0.8)
    const texture = material.diffuseTexture =
      new DynamicTexture(this.name + '/tex/' + k, textureSize, scene, true, Texture.NEAREST_SAMPLINGMODE)

    const blocks = { }
    const vertices = { positions: [] as number[], indices: [] as number[], normals: [] as number[], uvs: [] as number[] }

    for (let u = 0; u < chunkUnits; u ++) {
      for (let v = 0; v < chunkUnits; v ++) {
        this.chunkTextureToUpdate[ [m0 + u, n0 + v].join('/') ] = true
      }
    }
    this.chunkHeightToUpdate[k] = true
    this.throttleUpdate()

    this.emit('chunk-loaded', this.data[k])
    eventEmitter.emit('chunk-loaded', { terrain: this, chunk: this.data[k] })

    return this.data[k] = { tiles, heights, top, blocks, vertices, texture, m0, n0, k }
  }

  private getChunkDataIfExists(m: number, n: number) {
    const g = this.chunkUnits,
      i = Math.floor(m / g),
      j = Math.floor(n / g),
      k = [i, j].join('/'),
      u = m - i * g,
      v = n - j * g,
      c = u * g + v,
      d = this.data[k],
      t = d ? d.tiles[c] : 0,
      h = d ? d.heights[c] : 0,
      exists = !!d
    return { ...d, k, u, v, c, t, h, exists }
  }

  private getChunkData(m: number, n: number) {
    const data = this.getChunkDataIfExists(m, n)
    return data.exists ? data : this.createChunkData(data.k) && this.getChunkDataIfExists(m, n)
  }

  private drawTileTo(dc: CanvasRenderingContext2D, m: number, n: number, dx: number, dy: number) {
    const { t, h } = this.getChunkData(m, n),
      { unitTexSize } = this
    if (this.tilesDefine[t]) {
      const { src, offsetX, offsetY, size, autoTileType } = this.tilesDefine[t]
      if (autoTileType === 'h4x6' || autoTileType === 'h5x3') {
        const neighbors = AUTO_TILE_NEIGHBORS
            .map(([i, j]) => this.getChunkData(m + i, n + j))
            .reduce((s, p, j) => s + (p.t === t && p.h === h ? 1 << j : 0), 0)
        const { im, sx, sy } = getAutoTileImage(src, offsetX, offsetY, size, neighbors, autoTileType)
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

  private updateTexture(m: number, n: number) {
    const { texture, u, v } = this.getChunkData(m, n),
      { unitTexSize, textureSize } = this,
      dc = texture.getContext(),
      dx = u * unitTexSize,
      dy = textureSize - (v + 1) * unitTexSize

    dc.imageSmoothingEnabled = dc.webkitImageSmoothingEnabled = false
    this.drawTileTo(dc, m, n, dx, dy)
  }

  private getSideVertices(k: string) {
    const { chunkUnits, unitSize } = this,
      { heights, top, m0, n0 } = this.data[k],
      pixel = (u: number, v: number) => this.getChunkDataIfExists(m0 + u, n0 + v),
      h0 = Math.max(Math.min.apply(Math, heights) - 1, 0),
      chunkBlocks = getBlocksFromHeightMap(heights, chunkUnits, h0)

    const positions = [ ] as number[],
      normals = [ ] as number[],
      indices = [ ] as number[],
      uvs = [ ] as number[]
    chunkBlocks.forEach(([u0, u1, v0, v1, _h0, h1]) => {
      // top
      for (let u = u0, v = v1 - 1; u < u1; u ++) {
        const i = pixel(u, v), o = pixel(u, v + 1)
        if (i.h === h1) for (let h = o.h; h < i.h; h ++) {
          push.apply(indices,   [0, 1, 2, 0, 2, 3].map(v => v + positions.length / 3))
          push.apply(positions, [u, h + 1, v + 1, u + 1, h + 1, v + 1, u + 1, h, v + 1, u, h, v + 1].map(v => v * unitSize))
          push.apply(normals,   [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1])
          push.apply(uvs,       this.getEdgeTileTextureUV(h === i.h - 1 ? i.t : this.tilesDefine[i.t].sideTileId))
        }
      }
      // left
      for (let u = u0, v = v0; v < v1; v ++) {
        const i = pixel(u, v), o = pixel(u - 1, v)
        if (i.h === h1) for (let h = o.h; h < i.h; h ++) {
          push.apply(indices,   [0, 1, 2, 0, 2, 3].map(v => v + positions.length / 3))
          push.apply(positions, [u, h + 1, v, u, h + 1, v + 1, u, h, v + 1, u, h, v].map(v => v * unitSize))
          push.apply(normals,   [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0])
          push.apply(uvs,       this.getEdgeTileTextureUV(h === i.h - 1 ? i.t : this.tilesDefine[i.t].sideTileId))
        }
      }
      // bottom
      for (let u = u0, v = v0; u < u1; u ++) {
        const i = pixel(u, v), o = pixel(u, v - 1)
        if (i.h === h1) for (let h = o.h; h < i.h; h ++) {
          push.apply(indices,   [0, 2, 1, 0, 3, 2].map(v => v + positions.length / 3))
          push.apply(positions, [u, h + 1, v, u + 1, h + 1, v, u + 1, h, v, u, h, v].map(v => v * unitSize))
          push.apply(normals,   [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1])
          push.apply(uvs,       this.getEdgeTileTextureUV(h === i.h - 1 ? i.t : this.tilesDefine[i.t].sideTileId))
        }
      }
      // left
      for (let u = u1 - 1, v = v0; v < v1; v ++) {
        const i = pixel(u, v), o = pixel(u + 1, v)
        if (i.h === h1) for (let h = o.h; h < i.h; h ++) {
          push.apply(indices,   [0, 2, 1, 0, 3, 2].map(v => v + positions.length / 3))
          push.apply(positions, [u + 1, h + 1, v, u + 1, h + 1, v + 1, u + 1, h, v + 1, u + 1, h, v].map(v => v * unitSize))
          push.apply(normals,   [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0])
          push.apply(uvs,       this.getEdgeTileTextureUV(h === i.h - 1 ? i.t : this.tilesDefine[i.t].sideTileId))
        }
      }
    })

    const { x, y, z } = top.position.subtract(this.position)
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += x
      positions[i + 1] += y
      positions[i + 2] += z
    }

    return { positions, normals, indices, uvs }
  }

  private updateHeight(k: string) {
    const { chunkUnits, unitSize, scene } = this,
      { heights, top, blocks } = this.data[k],
      h0 = Math.max(Math.min.apply(Math, heights) - 1, 0),
      chunkBlocks = getBlocksFromHeightMap(heights, chunkUnits, h0)

    const topVd = { positions: [ ], normals: [ ], indices: [ ], uvs: [ ] } as VertexData
    chunkBlocks.forEach(([u0, u1, v0, v1, _, h1]) => {
      const i0 = topVd.positions.length / 3,
        vd = getGroundVertexDataWithUVMemo(u0, u1, v0, v1, h1)
      push.apply(topVd.positions, vd.positions.map(p => p * unitSize))
      push.apply(topVd.normals,   vd.normals)
      push.apply(topVd.indices,   vd.indices.map(i => i + i0))
      push.apply(topVd.uvs,       vd.uvs.map(v => v / chunkUnits))
    })
    Object.assign(new VertexData(), topVd).applyToMesh(top)
    // FIXME: babylonjs
    if (!topVd.indices.length) top.releaseSubMeshes()

    const keepInBlocks = { } as { [id: string]: boolean }
    chunkBlocks.forEach(([u0, u1, v0, v1, h0, h1]) => {
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

    this.chunkSideToUpdate[k] = true
    this.throttleUpdateSide()

    this.emit('height-updated', this.data[k])
    eventEmitter.emit('height-updated', { terrain: this, chunk: this.data[k] })
  }

  private throttleUpdateSide = throttle(this.batchUpdateSide.bind(this), 50)
  private chunkSideToUpdate = { } as { [index: string]: boolean }
  private batchUpdateSide() {
    Object.keys(this.chunkSideToUpdate).forEach(k => {
      this.data[k].vertices = this.getSideVertices(k)
    })
    this.chunkSideToUpdate = { }

    const vd = Object.assign(new VertexData(), { positions: [], normals: [], indices: [], uvs: [] })
    Object.keys(this.data).forEach(k => {
      const { vertices } = this.data[k]
      push.apply(vd.indices, vertices.indices.map(i => i + vd.positions.length / 3))
      push.apply(vd.positions, vertices.positions)
      push.apply(vd.normals, vertices.normals)
      push.apply(vd.uvs, vertices.uvs)
    })
    vd.applyToMesh(this.sideMesh)
    // FIXME: babylonjs
    if (!vd.indices.length) this.sideMesh.releaseSubMeshes()
  }

  private throttleUpdate = throttle(this.batchUpdateChunk.bind(this), 50)
  private chunkTextureToUpdate = { } as { [index: string]: boolean }
  private chunkHeightToUpdate = { } as { [index: string]: boolean }
  private batchUpdateChunk() {
    const texturesToRefresh = { } as { [key: string]: DynamicTexture }

    Object.keys(this.chunkTextureToUpdate).forEach(index => {
      const [m, n] = index.split('/').map(parseFloat)
      this.updateTexture(m, n)
      const { k, texture } = this.getChunkData(m, n)
      texturesToRefresh[k] = texture
    })
    this.chunkTextureToUpdate = { }

    Object.keys(this.chunkHeightToUpdate).forEach(k => {
      this.updateHeight(k)
    })
    this.chunkHeightToUpdate = { }

    Object.keys(texturesToRefresh).forEach(index => {
      const texture = texturesToRefresh[index]
      texture.update()
      this.emit('tile-updated', null)
      eventEmitter.emit('tile-updated', { terrain: this })
    })
  }
  private addTextureToUpdate(m: number, n: number, v: number, u: number) {
    this.chunkTextureToUpdate[ [m, n].join('/') ] = true
    const tileV = this.tilesDefine[v], tileU = this.tilesDefine[u]
    if ((tileV && tileV.autoTileType) || (tileU && tileU.autoTileType)) {
      AUTO_TILE_NEIGHBORS.forEach(([i, j]) => {
        const pixel = this.getChunkDataIfExists(m + i, n + j),
          tile = this.tilesDefine[pixel.t]
        if (tile && tile.autoTileType) {
          this.chunkTextureToUpdate[ [m + i, n + j].join('/') ] = true
        }
      })
    }
    this.throttleUpdate()
  }
  private addHeightToUpdate(m: number, n: number) {
    const addNeighbourToUpdate = (m: number, n: number) => {
      const { k, exists } = this.getChunkDataIfExists(m, n)
      if (exists) {
        this.chunkSideToUpdate[k] = true
      }
    }
    const { u, v, k } = this.getChunkData(m, n)
    this.chunkHeightToUpdate[k] = true
    addNeighbourToUpdate(u, v)
    u === 0 && addNeighbourToUpdate(m - 1, n)
    v === 0 && addNeighbourToUpdate(m, n - 1)
    u === this.chunkUnits && addNeighbourToUpdate(m + 1, n)
    v === this.chunkUnits && addNeighbourToUpdate(m, n + 1)
    this.throttleUpdate()
  }

  private _visibility = 1
  get visibility() {
    return this._visibility
  }
  set visibility(val) {
    this._visibility = this.sideMesh.visibility = val
    Object.keys(this.data).forEach(k => {
      this.data[k].top.visibility = val
    })
  }

  private _isVisible = true
  get isVisible() {
    return this._isVisible
  }
  set isVisible(val) {
    this._isVisible = this.sideMesh.isVisible = val
    Object.keys(this.data).forEach(k => {
      this.data[k].top.isVisible = val
    })
  }

  setPosition(position: Vector3) {
    const delta = position.subtract(this.position)
    Object.keys(this.data).forEach(k => {
      const { top, blocks } = this.data[k]
      top.position.addInPlace(delta)
      Object.keys(blocks).forEach(id => {
        blocks[id].setDeltaPosition(delta)
      })
    })
    this.position.copyFrom(position)
    this.sideMesh.position.copyFrom(position)
    this.emit('position-updated', delta)
    eventEmitter.emit('position-updated', { terrain: this, delta })
  }

  setPixel(x: number, z: number, p: { t?: number, h?: number | string }) {
    const m = Math.floor((x - this.position.x) / this.unitSize),
      n = Math.floor((z - this.position.z) / this.unitSize),
      { tiles, heights, c, t, h } = this.getChunkData(m, n)

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

    v = Math.max(v, 0)
    if (+v === v && h !== v) {
      heights[c] = v
      this.addHeightToUpdate(m, n)
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

  copyTextureTo(dc: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const { unitSize, unitTexSize } = this,
      [m, n, uc, vc] = [x, y, w, h].map(v => Math.floor(v / unitSize))
    dc.imageSmoothingEnabled = dc.webkitImageSmoothingEnabled = false
    for (let u = 0; u < uc; u ++) {
      for (let v = 0; v < vc; v ++) {
        const dx = u * unitTexSize,
          dy = h * unitTexSize - (v + 1) * unitTexSize
        this.drawTileTo(dc, m + u, n + v, dx, dy)
      }
    }
  }

  serialize() {
    const data: TerrainData = {
      unit: this.unitSize,
      size: this.chunkSize,
      chunks: { }
    }
    Object.keys(this.data).forEach(k => {
      const { tiles, heights } = this.data[k]
      data.chunks[k] = {
        tiles: compressWithRLE(tiles),
        heights: compressWithRLE(heights)
      }
    })
    return data
  }

  dispose() {
    Object.keys(this.data).forEach(k => {
      const { top, texture, blocks } = this.data[k]

      delete Terrain.terrainFromChunkMesh[top.name]
      top.dispose()

      texture.dispose()
      Object.keys(blocks).forEach(id => blocks[id].dispose())
      delete this.data[k]
    })

    new VertexData().applyToMesh(this.sideMesh)
    // FIXME: babylonjs
    this.sideMesh.releaseSubMeshes()
  }
}