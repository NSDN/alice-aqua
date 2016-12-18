import {
  Mesh,
  Scene,
  Texture,
  StandardMaterial,
  Color3,
  AbstractMesh,
  VertexData,
  Material,
} from '../babylon'

import {
  VERTEX_PLANE,
  getPlaneVertexDataWithUV,
} from '../utils/babylon'

import {
  ArrayHash
} from '../utils'

const meshCache = new ArrayHash<Material, { [key: string]: Mesh }>()

export default class Sprite extends Mesh {
  readonly spriteBody: AbstractMesh

  get spriteHeight() {
    return this.spriteBody.scaling.y
  }

  set spriteHeight(height: number) {
    this.spriteBody.position.copyFromFloats(0, height / 2, 0)
    const width = height / this.opts.height * this.opts.width
    this.spriteBody.scaling.copyFromFloats(width, height, width)
  }

  constructor(name: string, scene: Scene, readonly opts: {
    material: Material
    texSize: number
    offsetX: number
    offsetY: number
    width: number
    height: number
  }) {
    super(name, scene)

    const { material, texSize, offsetX, offsetY, width, height } = opts,
      cache = meshCache.get(material) || meshCache.set(material, { }),
      key = ['sprite', texSize, offsetX, offsetY].join('/')

    if (!cache[key]) {
      const sprite = cache[key] = new Mesh(key + '/cache', scene),
        u0 = offsetX / texSize,
        v0 = 1 - (offsetY + height) / texSize,
        u1 = u0 + width / texSize,
        v1 = v0 + height / texSize,
        vd = Object.assign(new VertexData(), getPlaneVertexDataWithUV(u0, u1, v0, v1))
      vd.applyToMesh(sprite)

      sprite.material = material
      sprite.isVisible = false
    }

    const sprite = this.spriteBody = cache[key].createInstance(name + '/sprite')
    sprite.billboardMode = Mesh.BILLBOARDMODE_Y
    sprite.parent = this
  }
}