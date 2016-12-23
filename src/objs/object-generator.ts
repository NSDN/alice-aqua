import {
  InstancedMesh,
  Mesh,
  StandardMaterial,
  Vector3,
  Vector4,
  PhysicsImpostor,
} from '../babylon'

export default class ObjectGenerator extends InstancedMesh {
  constructor(name: string, source: Mesh, readonly opts: {
    offsetX: number
    offsetY: number
    width: number
    height: number
    texSize: number
    material: StandardMaterial
  }) {
    super(name, source)
  }
  createMeshObjects() {
    const id = 'cache/box'

    let cache = this.getScene().getMeshByName(id) as Mesh
    if (!cache) {
      const { material, texSize } = this.opts,
        [offsetX, offsetY, width, height] = [512, 256, 64, 64],
        uv = new Vector4(offsetX / texSize, 1 - (offsetY + height) / texSize,
          (offsetX + width) / texSize, 1 - offsetY / texSize),
        faceUV = Array(6).fill(uv)
      cache = BABYLON.MeshBuilder.CreateBox(id, { faceUV }, this.getScene())
      cache.scaling.copyFromFloats(2, 2, 2)
      cache.material = this.opts.material
      cache.isVisible = false
    }

    const box = cache.createInstance(this.name + '/box')
    box.position.copyFrom(this.position.add(new Vector3(0, 2, 0)))

    const opts = { mass: 2, friction: 0 },
      impostor = box.physicsImpostor = new PhysicsImpostor(box, PhysicsImpostor.BoxImpostor, opts)
    impostor.registerBeforePhysicsStep(impostor => {
      impostor.setLinearVelocity(impostor.getLinearVelocity().multiplyByFloats(0.95, 0.95, 0.95))
      impostor.setAngularVelocity(impostor.getAngularVelocity().multiplyByFloats(0.95, 0.95, 0.95))
    })

    return [box]
  }
}
