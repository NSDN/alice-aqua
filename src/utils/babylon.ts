import {
  VertexData,
  Scene,
  Vector3,
  PhysicsImpostor,
  ArcRotateCamera,
} from '../babylon'

export function Vector3Map(vec: Vector3, fn: (x: number) => number) {
  return new Vector3(fn(vec.x), fn(vec.y), fn(vec.z))
}

export const VERTEX_BOX      = VertexData.CreateBox({ })
export const VERTEX_SPHERE   = VertexData.CreateSphere({ segments: 6, slice: 4 })
export const VERTEX_PLANE    = VertexData.CreatePlane({ })
export const VERTEX_GROUND   = VertexData.CreateGround({ })
export const VERTEX_CYLINDER = VertexData.CreateCylinder({ height: 1, diameter: 1 })
export const VERTEX_DUMMY    = Object.assign(new VertexData(), { position: [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5] })

type N = number

export function getPlaneVertexDataFromRegion(texSize: N, region: { offsetX: N, offsetY: N, width: N, height: N }) {
  const { offsetX, offsetY, width, height } = region,
    u0 = offsetX / texSize,
    v0 = 1 - (offsetY + height) / texSize,
    u1 = u0 + width / texSize,
    v1 = v0 + height / texSize
  return Object.assign(new VertexData(), getPlaneVertexDataWithUV(u0, u1, v0, v1))
}

export function getPlaneVertexDataWithUV(u0: N, u1: N, v0: N, v1: N) {
  const positions = [
     0.5,  0.5, 0,
    -0.5,  0.5, 0,
    -0.5, -0.5, 0,
     0.5, -0.5, 0,
  ]
  const normals = [
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ]
  const indices = [
    0, 1, 2, 0, 2, 3,
  ]
  const uvs = [
    u1, v1,
    u0, v1,
    u0, v0,
    u1, v0,
  ]
  return { positions, normals, indices, uvs }
}

export function getChunkGroundVertexData(u0: N, u1: N, v0: N, v1: N, h: N) {
  const positions = [
    u1, h, v1,
    u0, h, v1,
    u0, h, v0,
    u1, h, v0,
  ]
  const normals = [
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ]
  const indices = [
    0, 1, 2, 0, 2, 3,
  ]
  const uvs = [
    u1, v1,
    u0, v1,
    u0, v0,
    u1, v0,
  ]
  return { positions, normals, indices, uvs }
}

const SIDE_VERTEX_MAP: { [v: string]: [N[], N[]] } = {
  [0b1111]: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3]],
  [0b1110]: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2]],
  [0b1101]: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 3]],
  [0b1011]: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 2, 3]],
  [0b0111]: [[0, 1, 2, 3, 4, 5, 6, 7], [1, 2, 3]],
  [0b1010]: [[0, 1, 2, 3, 4, 5, 6, 7], [0, 2]],
  [0b0101]: [[0, 1, 2, 3, 4, 5, 6, 7], [1, 3]],
  [0b1100]: [[0, 1, 2, 3, 4, 5], [0, 1]],
  [0b0110]: [[2, 3, 4, 5, 6, 7], [0, 1]],
  [0b0011]: [[4, 5, 6, 7, 0, 1], [0, 1]],
  [0b1001]: [[6, 7, 0, 1, 2, 3], [0, 1]],
  [0b1000]: [[0, 1, 2, 3], [0]],
  [0b0100]: [[2, 3, 4, 5], [0]],
  [0b0010]: [[4, 5, 6, 7], [0]],
  [0b0001]: [[6, 7, 0, 1], [0]],
  [0b0000]: [[], []],
}
const SIDE_POS = [
  1, 5, 3,
  1, 4, 3,
  0, 5, 3,
  0, 4, 3,
  0, 5, 2,
  0, 4, 2,
  1, 5, 2,
  1, 4, 2,
]
const SIDE_NORM = [
   0.5,  0.5, 0,
   0.5,  0.5, 0,
  -0.5,  0.5, 0,
  -0.5,  0.5, 0,
  -0.5, -0.5, 0,
  -0.5, -0.5, 0,
   0.5, -0.5, 0,
   0.5, -0.5, 0,
]
const SIDE_IDX = [
  1, 3, 2, 1, 2, 0,
  3, 5, 4, 3, 4, 2,
  5, 7, 6, 5, 6, 4,
  7, 1, 0, 7, 0, 6,
]

export function getChunkSideVertexData(_u0: N, _u1: N, _v0: N, _v1: N, _h0: N, _h1: N, sides: number) {
  const [vs, fs] = SIDE_VERTEX_MAP[sides],
    positions = [ ] as N[],
    normals = [ ] as N[],
    indices = [ ] as N[]
  vs.forEach(i => {
    for (let n = i * 3, j = n; j < n + 3; j ++) {
      positions.push(arguments[ SIDE_POS[j] ])
      normals.push(SIDE_NORM[j])
    }
  })
  fs.forEach(i => {
    for (let n = i * 6, j = n; j < n + 6; j ++) {
      indices.push(SIDE_IDX[j])
    }
  })
  return { positions, normals, indices }
}

export function getBoundingVertexData(sx: N, sy: N, sz: N, addCross: boolean) {
  const arr = [
    [[ sx,  .5,  .5], [ .5,  .5,  .5], [ .5,  .5,  sz]],
    [[ .5,  sy,  .5], [ .5,  .5,  .5]],
    [[-sx,  .5,  .5], [-.5,  .5,  .5], [-.5,  .5,  sz]],
    [[-.5,  sy,  .5], [-.5,  .5,  .5]],
    [[-sx,  .5, -.5], [-.5,  .5, -.5], [-.5,  .5, -sz]],
    [[-.5,  sy, -.5], [-.5,  .5, -.5]],
    [[ sx,  .5, -.5], [ .5,  .5, -.5], [ .5,  .5, -sz]],
    [[ .5,  sy, -.5], [ .5,  .5, -.5]],
    [[ sx, -.5,  .5], [ .5, -.5,  .5], [ .5, -.5,  sz]],
    [[ .5, -sy,  .5], [ .5, -.5,  .5]],
    [[-sx, -.5,  .5], [-.5, -.5,  .5], [-.5, -.5,  sz]],
    [[-.5, -sy,  .5], [-.5, -.5,  .5]],
    [[-sx, -.5, -.5], [-.5, -.5, -.5], [-.5, -.5, -sz]],
    [[-.5, -sy, -.5], [-.5, -.5, -.5]],
    [[ sx, -.5, -.5], [ .5, -.5, -.5], [ .5, -.5, -sz]],
    [[ .5, -sy, -.5], [ .5, -.5, -.5]],
  ]
  if (addCross) {
    const tx = 0.5 - sx, tz = 0.5 - sz
    arr.push([[-tx, -.5,  tz], [tx, -.5, -tz]])
    arr.push([[-tx, -.5, -tz], [tx, -.5,  tz]])
  }
  const lines = arr.map(vecs => vecs.map(vec => Vector3.FromArray(vec)))
  return VertexData.CreateLineSystem({ lines })
}

export class StaticBoxImpostor extends PhysicsImpostor {
  constructor(opts: { position: Vector3, scaling: Vector3, rotation?: Vector3 }, scene: Scene) {
    // https://github.com/BabylonJS/Babylon.js/blob/master/src/Physics/babylon.physicsImpostor.ts#L174
    PhysicsImpostor.DEFAULT_OBJECT_SIZE.copyFrom(opts.scaling)
    // https://github.com/BabylonJS/Babylon.js/blob/master/src/Physics/babylon.physicsImpostor.ts#L70
    super(opts as any, PhysicsImpostor.BoxImpostor, { mass: 0 }, scene)
  }
}

export class FollowCamera extends ArcRotateCamera {
  public readonly followTarget = Vector3.Zero()
  constructor(name, alpha, beta, radius, target, scene) {
    super(name, alpha, beta, radius, target, scene)
    this.followTarget.copyFrom(target)
    this.getScene().registerAfterRender(() => {
      if (!this.followTarget.equalsWithEpsilon(this.target, 0.1)) {
        const cameraDirection = this.target.subtract(this.position)
        this.setTarget(Vector3.Lerp(this.target, this.followTarget, 0.1))
        this.setPosition(this.target.subtract(cameraDirection))
      }
    })
  }
}
