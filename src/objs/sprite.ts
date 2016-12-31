import {
  Mesh,
  AbstractMesh,
} from '../babylon'

import {
  getPlaneVertexDataFromRegion,
} from '../utils/babylon'

import ObjectBase, {
  ObjectOptions,
  ObjectElementBinder,
  appendConfigItem,
} from './object-base'

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

  private createSpriteCache(cacheId: string) {
    const { material, texSize } = this.opts.icon,
      sprite = new Mesh(cacheId, this.getScene())

    getPlaneVertexDataFromRegion(texSize, this.opts.icon).applyToMesh(sprite)
    sprite.position.y = 0.5
    sprite.material = material
    sprite.isVisible = false

    return sprite
  }

  constructor(name: string, opts: ObjectOptions) {
    super(name, opts)

    const { texSize, offsetX, offsetY } = opts.icon,
      cacheId = ['cache/sprite', texSize, offsetX, offsetY].join('/'),
      cache = (this.getScene().getMeshByName(cacheId) as Mesh) || this.createSpriteCache(cacheId),
      sprite = this.spriteBody = cache.createInstance(name + '/sprite')
    sprite.billboardMode = Mesh.BILLBOARDMODE_Y
    sprite.parent = this
  }

  bindToElement(container: HTMLElement, save: (args: Partial<Sprite>) => void) {
    const max = this.opts.icon.height / 32 * 4,
      attrs = { type: 'range', min: 1, max, step: 1 },
      range = appendConfigItem('height: ', 'input', attrs, container) as HTMLInputElement
    range.value = this.spriteHeight as any
    range.addEventListener('change', _ => save({ spriteHeight: parseFloat(range.value) }))
  }
}