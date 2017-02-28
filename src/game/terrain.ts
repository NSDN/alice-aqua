import {
  Scene,
  AbstractMesh,
  Mesh,
  Texture,
  DynamicTexture,
  StandardMaterial,
  Vector3,
  Color3,
  PhysicsImpostor,
  VertexData,
} from '../babylon'

import {
  getAutoTileImage,
  AUTO_TILE_NEIGHBORS,
} from '../utils/tiles'

import {
  getChunkGroundVertexData,
  getChunkSideVertexData,
  StaticBoxImpostor,
  ColorNoLightingMaterial,
} from '../utils/babylon'

import {
  arrayRange,
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
  edge: Mesh
  side: Mesh
  blocks: { [id: string]: PhysicsImpostor }
  texture: DynamicTexture
  m0: number
  n0: number
  k: string
}

export interface TerrainData {
  unit: number
  size: number
  sideTileId: number
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

const push = [ ].push,
  getGroundVertexDataWithUVMemo = memo(getChunkGroundVertexData),
  getSideVertexDataMemo = memo(getChunkSideVertexData)

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

  static readonly eventEmitter = new EventEmitter<{
    'tile-updated': { terrain: Terrain }
    'height-updated': { terrain: Terrain, chunk: Chunk }
    'chunk-loaded': { terrain: Terrain, chunk: Chunk }
    'position-updated': { terrain: Terrain, delta: Vector3 }
  }>()

  private readonly edgeMaterial: StandardMaterial
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

    const edgeMaterialId = 'cache/chunk/edge/' + this.chunkUnits
    this.edgeMaterial = scene.getMaterialByName(edgeMaterialId) as StandardMaterial
    if (!this.edgeMaterial) {
      this.edgeMaterial = new ColorNoLightingMaterial(edgeMaterialId, scene)
      this.edgeMaterial.diffuseTexture =
        new DynamicTexture('cache/chunk/edge/mat', this.edgeTextureCacheSize * this.unitTexSize, scene, true, Texture.NEAREST_SAMPLINGMODE)
      this.edgeMaterial.diffuseTexture.hasAlpha = true
    }

    this.sideTileId = restoreData.sideTileId || tilesDefine[0].sideTileId

    Object.keys(restoreData.chunks || { }).forEach(k => {
      const { tiles, heights } = restoreData.chunks[k]
      this.createChunkData(k, extractWithRLE(tiles), extractWithRLE(heights))
    })
  }

  private _sideTileId = 1
  get sideTileId() {
    return this._sideTileId
  }
  set sideTileId(val) {
    if (this._sideTileId !== val) {
      this._sideTileId = val
      Object.keys(this.data).forEach(k => {
        this.data[k].side.material = this.getSideMaterial()
      })
    }
  }

  private getSideMaterial() {
    const { sideTileId } = this,
      sideMaterialId = ['cache/chunk/side', sideTileId, this.unitTexSize, this.chunkUnits].join('/')
    let sideMaterial = this.scene.getMaterialByName(sideMaterialId) as StandardMaterial
    if (!sideMaterial) {
      sideMaterial = new ColorNoLightingMaterial(sideMaterialId, this.scene)
      const texture = sideMaterial.diffuseTexture =
        new DynamicTexture('cache/' + this.name + '/side/mat', this.unitTexSize, this.scene, true, Texture.NEAREST_SAMPLINGMODE),
        { src, offsetX, offsetY, size } = this.tilesDefine[sideTileId]
      texture.getContext().drawImage(src, offsetX, offsetY, size, size, 0, 0, this.unitTexSize, this.unitTexSize)
      texture.update()
      texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE
      texture.uScale = texture.vScale = this.chunkUnits
    }
    return sideMaterial
  }

  readonly edgeTextureCacheSize = 16
  private edgeTextureCaches = { } as { [tileId: number]: [number, number, number, number] }
  private getEdgeTileTextureUV(tileId: number) {
    if (this.edgeTextureCaches[tileId]) {
      return this.edgeTextureCaches[tileId]
    }
    else {
      const { sideTileId } = this.tilesDefine[tileId] || { sideTileId: this._sideTileId },
        { src, offsetX, offsetY, size } = this.tilesDefine[sideTileId] || this.tilesDefine[this._sideTileId],
        index = Object.keys(this.edgeTextureCaches).length,
        i = Math.floor(index / this.edgeTextureCacheSize), j = index % this.edgeTextureCacheSize,
        texture = this.edgeMaterial.diffuseTexture as DynamicTexture,
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
    Terrain.terrainFromChunkMesh[top.name] = this

    const edge = new Mesh(this.name + '/edge/' + k, scene)
    edge.material = this.edgeMaterial
    edge.parent = top
    Terrain.terrainFromChunkMesh[edge.name] = this

    const side = new Mesh(this.name + '/side/' + k, scene)
    side.material = this.getSideMaterial()
    side.parent = top
    Terrain.terrainFromChunkMesh[side.name] = this

    const blocks = { }

    const material = top.material = new StandardMaterial(this.name + '/mat/' + k, scene)
    material.disableLighting = true
    material.emissiveColor = new Color3(1, 1, 1)

    const texture = material.diffuseTexture =
      new DynamicTexture(this.name + '/tex/' + k, textureSize, scene, true, Texture.NEAREST_SAMPLINGMODE)

    setImmediate(() => {
      for (let u = 0; u < chunkUnits; u ++) {
        for (let v = 0; v < chunkUnits; v ++) {
          this.updateTexture(m0 + u, n0 + v)
        }
      }
      texture.update()

      this.updateHeight(m0, n0)

      this.emit('chunk-loaded', this.data[k])
      Terrain.eventEmitter.emit('chunk-loaded', { terrain: this, chunk: this.data[k] })
    })

    return this.data[k] = { tiles, heights, top, edge, side, blocks, texture, m0, n0, k }
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
      t = d && d.tiles[c],
      h = d && d.heights[c],
      exists = !!d
    return { ...d, k, u, v, c, t, h, exists }
  }

  private getChunkData(m: number, n: number) {
    const data = this.getChunkDataIfExists(m, n)
    return data.exists ? data : this.createChunkData(data.k) && this.getChunkDataIfExists(m, n)
  }

  private updateTexture(m: number, n: number) {
    const { texture, u, v, t, h } = this.getChunkData(m, n),
      { unitTexSize, textureSize } = this,
      dc = texture.getContext(),
      dx = u * unitTexSize,
      dy = textureSize - (v + 1) * unitTexSize

    dc.imageSmoothingEnabled = dc.webkitImageSmoothingEnabled = false
    if (this.tilesDefine[t]) {
      const { src, offsetX, offsetY, size, autoTileType } = this.tilesDefine[t]
      if (autoTileType) {
        const neighbors = AUTO_TILE_NEIGHBORS
            .map(([i, j]) => this.getChunkData(m + i, n + j))
            .reduce((s, p, j) => s + (p.t === t && p.h === h ? 1 << j : 0), 0)
        const { im, sx, sy } = getAutoTileImage(src, offsetX, offsetY, size, neighbors, autoTileType as any)
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
    const { chunkUnits, unitSize, scene } = this,
      { heights, top, edge, side, blocks, m0, n0 } = this.getChunkData(m, n),
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

    const edgeVd = { positions: [ ], normals: [ ], indices: [ ], uvs: [ ] } as VertexData
    const pixelFromUV = (u: number, v: number) => this.getChunkDataIfExists(m0 + u, n0 + v),
      g = chunkUnits,
      edges = chunkBlocks.map(([u0, u1, v0, v1]) => ({
        top:    arrayRange(u0, u1).map(u => ({ u, v: v1, o: pixelFromUV(u,     v1), i: pixelFromUV(u, v1 - 1) })),
        left:   arrayRange(v0, v1).map(v => ({ u: u0, v, o: pixelFromUV(u0 - 1, v), i: pixelFromUV(u0,     v) })),
        bottom: arrayRange(u0, u1).map(u => ({ u, v: v0, o: pixelFromUV(u, v0 - 1), i: pixelFromUV(u,     v0) })),
        right:  arrayRange(v0, v1).map(v => ({ u: u1, v, o: pixelFromUV(u1,     v), i: pixelFromUV(u1 - 1, v) })),
      }))

    chunkBlocks.forEach(([u0, u1, v0, v1, _h0, h1], index) => {
      const { top, left, bottom, right } = edges[index]
      top.filter(({ i, o }) => i.h === h1 && (v1 === g || o.h < h1)).forEach(({ u, v, i }) => {
        push.apply(edgeVd.indices,   [0, 1, 2, 0, 2, 3].map(v => v + edgeVd.positions.length / 3))
        push.apply(edgeVd.positions, [u, h1, v, u + 1, h1, v, u + 1, h1 - 1, v + 0.01, u, h1 - 1, v + 0.01].map(v => v * unitSize))
        push.apply(edgeVd.normals,   [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0])
        push.apply(edgeVd.uvs,       this.getEdgeTileTextureUV(i.t))
      })
      left.filter(({ i, o }) => i.h === h1 && (u0 === 0 || o.h < h1)).forEach(({ u, v, i }) => {
        push.apply(edgeVd.indices,   [0, 1, 2, 0, 2, 3].map(v => v + edgeVd.positions.length / 3))
        push.apply(edgeVd.positions, [u, h1, v, u, h1, v + 1, u - 0.01, h1 - 1, v + 1, u - 0.01, h1 - 1, v].map(v => v * unitSize))
        push.apply(edgeVd.normals,   [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0])
        push.apply(edgeVd.uvs,       this.getEdgeTileTextureUV(i.t))
      })
      bottom.filter(({ i, o }) => i.h === h1 && (v0 === 0 || o.h < h1)).forEach(({ u, v, i }) => {
        push.apply(edgeVd.indices,   [0, 2, 1, 0, 3, 2].map(v => v + edgeVd.positions.length / 3))
        push.apply(edgeVd.positions, [u, h1, v, u + 1, h1, v, u + 1, h1 - 1, v - 0.01, u, h1 - 1, v - 0.01].map(v => v * unitSize))
        push.apply(edgeVd.normals,   [0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0])
        push.apply(edgeVd.uvs,       this.getEdgeTileTextureUV(i.t))
      })
      right.filter(({ i, o }) => i.h === h1 && (u1 === g || o.h < h1)).forEach(({ u, v, i }) => {
        push.apply(edgeVd.indices,   [0, 2, 1, 0, 3, 2].map(v => v + edgeVd.positions.length / 3))
        push.apply(edgeVd.positions, [u, h1, v, u, h1, v + 1, u + 0.01, h1 - 1, v + 1, u + 0.01, h1 - 1, v].map(v => v * unitSize))
        push.apply(edgeVd.normals,   [-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0])
        push.apply(edgeVd.uvs,       this.getEdgeTileTextureUV(i.t))
      })
    })
    Object.assign(new VertexData(), edgeVd).applyToMesh(edge)
    // FIXME: babylonjs
    if (!edgeVd.indices.length) edge.releaseSubMeshes()

    const sideVd = { positions: [ ], normals: [ ], indices: [ ], uvs: [ ] } as VertexData
    chunkBlocks.forEach(([u0, u1, v0, v1, h0, h1], index) => {
      const { top, left, bottom, right } = edges[index],
        sides =
          (v1 === g || top   .some(({ o }) => o.h < h1) ? 8 : 0) +
          (u0 === 0 || left  .some(({ o }) => o.h < h1) ? 4 : 0) +
          (v0 === 0 || bottom.some(({ o }) => o.h < h1) ? 2 : 0) +
          (u1 === g || right .some(({ o }) => o.h < h1) ? 1 : 0),
        vd = getSideVertexDataMemo(u0, u1, v0, v1, h0, h1, sides)
      push.apply(sideVd.indices,   vd.indices.map(i => i + sideVd.positions.length / 3))
      push.apply(sideVd.positions, vd.positions.map(p => p * unitSize))
      push.apply(sideVd.normals,   vd.normals)
      push.apply(sideVd.uvs,       vd.uvs.map(v => v / chunkUnits))
    })
    Object.assign(new VertexData(), sideVd).applyToMesh(side)
    // FIXME: babylonjs
    if (!sideVd.indices.length) side.releaseSubMeshes()

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

    this.emit('height-updated', this.getChunkData(m, n))
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
    })
    this.chunkHeightToUpdate = { }

    Object.keys(texturesToRefresh).forEach(index => {
      const texture = texturesToRefresh[index]
      texture.update()
      this.emit('tile-updated', null)
      Terrain.eventEmitter.emit('tile-updated', { terrain: this })
    })
  }
  private addTextureToUpdate(m: number, n: number, v: number, u: number) {
    this.chunkTextureToUpdate[ [m, n].join('/') ] = v
    const tileV = this.tilesDefine[v], tileU = this.tilesDefine[u]
    if ((tileV && tileV.autoTileType) || (tileU && tileU.autoTileType)) {
      AUTO_TILE_NEIGHBORS.forEach(([i, j]) => {
        const pixel = this.getChunkData(m + i, n + j),
          tile = this.tilesDefine[pixel.t]
        if (tile && tile.autoTileType) {
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

  private _visibility = 1
  get visibility() {
    return this._visibility
  }
  set visibility(val) {
    this._visibility = val
    Object.keys(this.data).forEach(k => {
      const { top, edge, side } = this.data[k]
      // a simple hack to grid of flashing
      const threshold = 0.8
      edge.visibility = val > threshold ? (val - threshold) / (1 - threshold) : 0
      top.visibility = side.visibility = val > threshold ? 1 : val / threshold
    })
  }

  private _isVisible = true
  get isVisible() {
    return this._isVisible
  }
  set isVisible(val) {
    this._isVisible = val
    Object.keys(this.data).forEach(k => {
      const { top, edge, side } = this.data[k]
      top.isVisible = edge.isVisible = side.isVisible = val
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
    this.emit('position-updated', delta)
    Terrain.eventEmitter.emit('position-updated', { terrain: this, delta })
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

    v = Math.max(v, 0)
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
    const data: TerrainData = {
      unit: this.unitSize,
      size: this.chunkSize,
      sideTileId: this.sideTileId,
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
      const { top, edge, side, texture, blocks } = this.data[k]

      delete Terrain.terrainFromChunkMesh[top.name]
      top.dispose()
      delete Terrain.terrainFromChunkMesh[edge.name]
      edge.dispose()
      delete Terrain.terrainFromChunkMesh[side.name]
      side.dispose()

      texture.dispose()
      Object.keys(blocks).forEach(id => blocks[id].dispose())
      delete this.data[k]
    })
  }
}