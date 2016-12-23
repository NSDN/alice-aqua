import {
  VertexData,
  Scene,
  Vector3,
  Mesh,
  Color3,
  StandardMaterial,
  PhysicsImpostor,
} from '../babylon'

import {
  ArrayHash,
  throttle,
} from './'

export function Vector3Map(vec: Vector3, fn: (x: number) => number) {
  return new Vector3(fn(vec.x), fn(vec.y), fn(vec.z))
}

export const VERTEX_BOX      = VertexData.CreateBox({ })
export const VERTEX_SPHERE   = VertexData.CreateSphere({ })
export const VERTEX_PLANE    = VertexData.CreatePlane({ })
export const VERTEX_GROUND   = VertexData.CreateGround({ })
export const VERTEX_CYLINDER = VertexData.CreateCylinder({ height: 1, diameter: 1 })
export const VERTEX_DUMMY   = new VertexData()
VERTEX_DUMMY.positions = [-0.5, -0.5, -0.5, 0.5, 0.5, 0.5]

type N = number

export function getGroundVertexDataWithUV(u0: N, u1: N, v0: N, v1: N, h: N) {
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

const SIDE_VERTEX_MAP: { [v: string]: [N[], N[]] } = {
  '1111': [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3]],
  '1110': [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2]],
  '1101': [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 3]],
  '1011': [[0, 1, 2, 3, 4, 5, 6, 7], [0, 2, 3]],
  '0111': [[0, 1, 2, 3, 4, 5, 6, 7], [1, 2, 3]],
  '1010': [[0, 1, 2, 3, 4, 5, 6, 7], [0, 2]],
  '0101': [[0, 1, 2, 3, 4, 5, 6, 7], [1, 3]],
  '1100': [[0, 1, 2, 3, 4, 5], [0, 1]],
  '0110': [[2, 3, 4, 5, 6, 7], [0, 1]],
  '0011': [[4, 5, 6, 7, 0, 1], [0, 1]],
  '1001': [[6, 7, 0, 1, 2, 3], [0, 1]],
  '1000': [[0, 1, 2, 3], [0]],
  '0100': [[2, 3, 4, 5], [0]],
  '0010': [[4, 5, 6, 7], [0]],
  '0001': [[6, 7, 0, 1], [0]],
  '0000': [[], []],
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

export function getSideVertexData(u0: N, u1: N, v0: N, v1: N, h0: N, h1: N, sides: string) {
  const [vs, fs] = SIDE_VERTEX_MAP[sides],
    positions = [ ] as N[],
    normals = [ ] as N[],
    indices = [ ] as N[]
  vs.forEach(i => {
    for (var n = i * 3, j = n; j < n + 3; j ++) {
      positions.push(arguments[ SIDE_POS[j] ])
      normals.push(SIDE_NORM[j])
    }
  })
  fs.forEach(i => {
    for (var n = i * 6, j = n; j < n + 6; j ++) {
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

export class WireframeNoLightingMaterial extends StandardMaterial {
  constructor(name: string, scene: Scene, color?: Color3) {
    super(name, scene)
    this.emissiveColor = color || new Color3(1, 1, 1)
    this.wireframe = true
    this.disableLighting = true
  }
}

export class StaticBoxImpostor extends PhysicsImpostor {
  constructor(opts: { position: Vector3, scaling: Vector3, rotation?: Vector3 }, scene: Scene) {
    // https://github.com/BabylonJS/Babylon.js/blob/master/src/Physics/babylon.physicsImpostor.ts#L174
    PhysicsImpostor.DEFAULT_OBJECT_SIZE.copyFrom(opts.scaling)
    // https://github.com/BabylonJS/Babylon.js/blob/master/src/Physics/babylon.physicsImpostor.ts#L70
    super(opts as any, PhysicsImpostor.BoxImpostor, { mass: 0 }, scene)
  }
}
