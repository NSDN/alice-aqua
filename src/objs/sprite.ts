import {
  Mesh,
  AbstractMesh,
  VertexData,
} from '../babylon'

import {
  getPlaneVertexDataFromRegion,
} from '../utils/babylon'

import {
  appendConfigInput,
} from '../utils/dom'

import {
  ObjectBase,
  ObjectOptions,
  ObjectEditable,
} from './'

export default class Sprite extends ObjectBase implements ObjectEditable {
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

  attachEditorContent(container: HTMLElement, save: (args: Partial<Sprite>) => void) {
    const attrs = { type: 'range', min: 1, max: this.opts.icon.height / 32 * 4, step: 1 }
    appendConfigInput('height: ', this.spriteHeight, attrs, container, val => save({ spriteHeight: parseFloat(val) }))
  }
}