import {
  Color3,
  Scene,
  LinesMesh,
  Mesh,
  StandardMaterial,
  DynamicTexture,
  Texture,
  VertexData,
} from '../babylon'

import {
  VERTEX_GROUND,
  getBoundingVertexData,
} from '../utils/babylon'

import {
  appendElement,
  drawIconFont,
} from '../utils/dom'

export function createDataURLFromIconFontAndSub(mainClass: string, subClass: string, size: number = 32, color = '#333') {
  const attrs = { width: size, height: size },
    canvas = appendElement('canvas', attrs) as HTMLCanvasElement,
    dc = canvas.getContext('2d')
  dc.fillStyle = color

  drawIconFont(dc, mainClass, size * 0.1, size * 0.1, size * 0.8)
  if (subClass) {
    drawIconFont(dc, subClass, 0, 0, size * 0.5)
  }

  const url = canvas.toDataURL()
  canvas.parentNode.removeChild(canvas)
  return url
}

export class SelectionBox extends LinesMesh {
  constructor(name: string, scene: Scene) {
    super(name, scene)
    this.scaling.copyFromFloats(0, 0, 0)
    getBoundingVertexData(0.3, 0.3, 0.3, false).applyToMesh(this)
    this.color = new Color3(1, 0.5, 0.5)
    this.renderingGroupId = 1
  }
}

export class ObjectBoundary extends Mesh {
  constructor(name: string, scene: Scene) {
    super(name, scene)

    const positions = [
       0.5, -0.01,  0.5,
       0.5, -0.01, -0.5,
      -0.5, -0.01, -0.5,
      -0.5, -0.01,  0.5,
    ]
    const indices = [
      0, 1, 2,
      1, 2, 3,
      2, 3, 0,
      3, 0, 1,
    ]
    Object.assign(new VertexData(), { positions, indices }).applyToMesh(this)

    const material = this.material = new StandardMaterial(name + '/mat', scene)
    material.wireframe = true
    material.emissiveColor = new Color3(1, 0.5, 0.5)
    material.disableLighting = true

    this.isVisible = false
  }
}

export class GridPlane extends Mesh {
  constructor(name: string, scene: Scene, count: number) {
    super(name, scene)
    const pixel = 32, size = count * pixel, repeat = 2

    VERTEX_GROUND.applyToMesh(this)
    this.position.y = -0.001
    this.scaling.copyFromFloats(count * repeat, 1, count * repeat)

    const material = this.material = new StandardMaterial(name + '/grid', scene)
    material.disableLighting = true
    material.emissiveColor = Color3.White()

    const texture = material.diffuseTexture = new DynamicTexture(name + '/grid', size, scene, true),
      dc = texture.getContext()
    dc.strokeStyle = '#aaaaaa'
    dc.lineWidth = 3
    dc.strokeRect(0, 0, size, size)
    dc.strokeStyle = '#666666'
    dc.lineWidth = 1
    for (let v = 0; v < size; v += pixel) {
      dc.moveTo(0, v)
      dc.lineTo(size, v)
      dc.stroke()
      dc.moveTo(v, 0)
      dc.lineTo(v, size)
      dc.stroke()
    }
    texture.hasAlpha = true
    texture.uScale = texture.vScale = repeat
    texture.wrapU = texture.wrapV = Texture.WRAP_ADDRESSMODE
    texture.update()
  }
}
