import {
  Mesh,
  AbstractMesh,
  VertexData,
} from '../babylon'

import {
  getPlaneVertexDataFromRegion,
} from '../utils/babylon'

import ObjectBase, {
  ObjectOptions,
  ObjectElementBinder,
  appendConfigElement,
} from './'

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
      cacheId = ['cache/sprite', material.name, texSize, offsetX, offsetY].join('/')

    let cache = scene.getMeshByName(cacheId) as Mesh
    if (!cache) {
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
      range = appendConfigElement('height: ', 'input', attrs, container) as HTMLInputElement
    range.value = this.spriteHeight as any
    range.addEventListener('change', _ => save({ spriteHeight: parseFloat(range.value) }))
  }
}