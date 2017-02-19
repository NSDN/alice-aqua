import {
  Mesh,
  Scene,
  VertexData,
  ArcRotateCamera,
  Color3,
  Vector3,
  StandardMaterial,
  DynamicTexture,
  Texture,
  AbstractMesh,
} from '../babylon'

import {
  getPlaneVertexDataFromRegion,
} from '../utils/babylon'

import {
  randomRange,
} from '../utils'

function createSkyCloud(box: Mesh) {
  const scene = box.getScene(),
    cloud = new Mesh('cache/sky/cloud', scene),
    region = { offsetX: 1, offsetY: 0, width: 174, height: 143 },
    vertexData = getPlaneVertexDataFromRegion(512, region)
  Object.assign(new VertexData(), vertexData).applyToMesh(cloud)
  cloud.isVisible = false
  const cloudMaterial = cloud.material = new StandardMaterial('cloud', scene)
  cloudMaterial.disableLighting = true
  const cloudTexture = cloudMaterial.diffuseTexture = new Texture('assets/clouds.png', scene)
  cloudTexture.hasAlpha = true
  return cloud
}

function createSkyFarMountains(box: Mesh) {
  const scene = box.getScene(),
    mounts = Mesh.CreateTube('sky/mounts',
      [Vector3.Zero(), Vector3.Up()], 1, 16, null, Mesh.NO_CAP, scene, false, Mesh.BACKSIDE),
    r = 0.8 * 0.5,
    h = Math.sqrt(0.5 * 0.5 - r * r) * 0.8 * 2
  mounts.scaling.copyFromFloats(r, h, r)
  mounts.position.y = -h / 2
  mounts.parent = box

  const material = mounts.material = new StandardMaterial('sky/mounts', scene)
  material.disableLighting = true

  const size = 256,
    texture = material.diffuseTexture =
      new DynamicTexture('sky/mounts', size, scene, false, Texture.NEAREST_SAMPLINGMODE),
    dc = texture.getContext()
  dc.fillStyle = '#ffffff'
  dc.strokeStyle = '#dddddd'
  dc.fillRect(0, 0.7 * size, size, size)
  Array(30).fill(0).forEach(_ => {
    const x = randomRange(0, size),
      y = randomRange(0.2, 0.5) * size,
      w = randomRange(0.02, 0.04) * size
    dc.fillRect(x, y, w, size - y)
    dc.strokeRect(x, y, w, size)
  })
  texture.hasAlpha = true
  texture.update()

  return mounts
}

export default class Skybox extends Mesh {
  private readonly mounts = null as AbstractMesh
  private readonly cloud = null as Mesh

  constructor(name: string, scene: Scene) {
    super(name, scene)

    VertexData.CreateSphere({
      segments: 3,
      diameter: 1,
      sideOrientation: Mesh.BACKSIDE,
    }).applyToMesh(this)

    this.scaling.scaleInPlace(256)

    const material = this.material = new StandardMaterial('skybox', scene)
    material.emissiveColor = Color3.White()
    material.disableLighting = true
    material.diffuseTexture = new DynamicTexture('skytex', 64, scene, false),

    this.cloud = createSkyCloud(this)
    const clouds = Array(20).fill(0).map((_, i) => {
      const c = this.cloud.createInstance('sky/cloud/' + i),
        r = randomRange(0.6, 0.9) * 0.5,
        y = randomRange(-0.5, 1.0) * 0.1,
        q = Math.sqrt(r * r - y * y),
        v = randomRange(0.1, 1.0) * 0.001,
        t = randomRange(0.0, 100),
        w = randomRange(0.1, 0.3),
        h = randomRange(0.02, 0.08)
      c.position.copyFromFloats(q * Math.sin(t), y, q * Math.cos(t))
      c.scaling.copyFromFloats(w, h, 1)
      c.parent = this
      return { c, y, q, t, v }
    })

    this.mounts = createSkyFarMountains(this)

    this.registerBeforeRender(_ => {
      const { x, z } = (scene.activeCamera as ArcRotateCamera).target.multiplyByFloats(1, 0, 1)
      this.position.x = x
      this.position.z = z
      clouds.forEach(d => {
        d.c.position.copyFromFloats(d.q * Math.sin(d.t), d.y, d.q * Math.cos(d.t))
        d.c.rotation.y = d.t
        d.t += d.v
      })
    })

    const { r, g, b } = scene.clearColor
    this.setThemeColor(new Color3(r, g, b))
  }

  setThemeColor(themeColor: Color3) {
    const material = this.material as StandardMaterial,
      texture = material.diffuseTexture as DynamicTexture,
      size = texture.getSize().width,
      dc = texture.getContext(),
      grad = dc.createLinearGradient(0, 0, 0, size)

    const skyTopColor = Color3.White()
    const skyGrads = [
      // from bottom to top
      [0.0, themeColor.scale(0.3)],
      [0.4, themeColor],
      [0.7, skyTopColor],
      [1.0, skyTopColor],
    ] as [number, Color3][]
    skyGrads.forEach(([pos, color]) => grad.addColorStop(pos, color.toHexString()))
    dc.fillStyle = grad
    dc.fillRect(0, 0, size, size)
    texture.update()

    ; (this.mounts.material as StandardMaterial).emissiveColor = themeColor
    ; (this.cloud.material as StandardMaterial).emissiveColor = Color3.Lerp(themeColor, Color3.White(), 0.7)
  }

  setIsVisible(isVisible: boolean) {
    this.isVisible = isVisible
    this.mounts.isVisible = isVisible
    this.cloud.instances.forEach(c => c.isVisible = isVisible)
  }
}