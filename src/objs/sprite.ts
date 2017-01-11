import {
  Mesh,
  AbstractMesh,
//  Scene,
  VertexData,
//  Tags,
//  SubMesh,
} from '../babylon'

import {
  getPlaneVertexDataFromRegion,
} from '../utils/babylon'

import ObjectBase, {
  ObjectOptions,
  ObjectElementBinder,
  appendConfigElem,
} from './'

/*
function getSpriteVertexData(scene: Scene, name: string): {
  positions: number[]
  indices: number[]
  normals: number[]
  uvs: number[]
} {
  const cacheKey = 'cache/sprite/vertex/' + name
  return scene[cacheKey] || (scene[cacheKey] = {
    positions: [],
    indices: [],
    normals: [],
    uvs: [],
  })
}
*/

export default class Sprite extends ObjectBase implements ObjectElementBinder {
  readonly spriteBody: AbstractMesh

  get spriteHeight() {
    return this.spriteBody.scaling.y
  }

  set spriteHeight(height: number) {
    this.spriteBody.position.copyFromFloats(0, height / 2, 0)
    const width = height / this.opts.icon.height * this.opts.icon.width
    this.spriteBody.scaling.copyFromFloats(width, height, width)
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    const { texSize, offsetX, offsetY, material } = opts.icon,
      scene = this.getScene(),
      matTag = ['cache/sprite', material.name].join('/'),
      cacheId = [matTag, texSize, offsetX, offsetY].join('/')

    let cache = scene.getMeshByName(cacheId) as Mesh
    if (!cache) {
      /*
      const vd = getSpriteVertexData(scene, material.name),
        vertexStart = vd.positions.length / 3,
        faceStart = vd.indices.length / 3,
        push = [ ].push,
        { positions, indices, normals, uvs } = getPlaneVertexDataFromRegion(texSize, opts.icon)
      push.apply(vd.positions, positions)
      push.apply(vd.indices, indices.map(i => vertexStart + i))
      push.apply(vd.normals, normals)
      push.apply(vd.uvs, uvs)

      const vertexData = Object.assign(new VertexData(), vd)
      cache = new Mesh(cacheId, scene)
      vertexData.applyToMesh(cache)
      cache.subMeshes = [ ]

      const subMesh = new SubMesh(0, 0, vd.positions.length / 3, faceStart, indices.length / 3, cache)
      cache.subMeshes.push(subMesh)
      cache.position.y = 0.5
      cache.material = material
      cache.isVisible = false

      scene.getMeshesByTags(matTag).forEach(mesh => vertexData.applyToMesh(mesh))
      Tags.AddTagsTo(cache, matTag)
      */
      cache = new Mesh(cacheId, scene)
      cache.position.y = 0.5
      cache.material = material
      cache.isVisible = false

      const vd = getPlaneVertexDataFromRegion(texSize, opts.icon)
      Object.assign(new VertexData(), vd).applyToMesh(cache)
    }

    const sprite = this.spriteBody = cache.createInstance(name + '/sprite')
    sprite.billboardMode = Mesh.BILLBOARDMODE_Y
    sprite.parent = this
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Sprite>) => void) {
    const max = this.opts.icon.height / 32 * 4,
      attrs = { type: 'range', min: 1, max, step: 1 },
      range = appendConfigElem('height: ', 'input', attrs, container) as HTMLInputElement
    range.value = this.spriteHeight as any
    range.addEventListener('change', _ => save({ spriteHeight: parseFloat(range.value) }))
  }
}