import {
  Mesh,
  Scene,
  Texture,
  StandardMaterial,
  Color3,
  AbstractMesh,
  VertexData,
  Material,
  InstancedMesh,
} from '../babylon'

import {
  VERTEX_PLANE,
  getPlaneVertexDataWithUV,
} from '../utils/babylon'

import {
  ArrayHash
} from '../utils'

export default class Sprite extends InstancedMesh {
  readonly spriteBody: AbstractMesh

  get spriteHeight() {
    return this.spriteBody.scaling.y
  }

  set spriteHeight(height: number) {
    this.spriteBody.position.copyFromFloats(0, height / 2, 0)
    const width = height / this.opts.height * this.opts.width
    this.spriteBody.scaling.copyFromFloats(width, height, width)
  }

  constructor(name: string, source: Mesh, readonly opts: {
    material: Material
    texSize: number
    offsetX: number
    offsetY: number
    width: number
    height: number
  }) {
    super(name, source)

    const { material, texSize, offsetX, offsetY, width, height } = opts,
      cacheId = ['cache/sprite', texSize, offsetX, offsetY].join('/'),
      scene = source.getScene()

    let cache = scene.getMeshByName(cacheId) as Mesh
    if (!cache) {
      const sprite = cache = new Mesh(cacheId, scene),
        u0 = offsetX / texSize,
        v0 = 1 - (offsetY + height) / texSize,
        u1 = u0 + width / texSize,
        v1 = v0 + height / texSize,
        vd = Object.assign(new VertexData(), getPlaneVertexDataWithUV(u0, u1, v0, v1))
      vd.applyToMesh(sprite)

      sprite.material = material
      sprite.isVisible = false
    }

    const sprite = this.spriteBody = cache.createInstance(name + '/sprite')
    sprite.billboardMode = Mesh.BILLBOARDMODE_Y
    sprite.parent = this
  }
}