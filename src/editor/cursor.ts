import {
  Vector3,
  LinesMesh,
  Scene,
  Mesh,
} from '../babylon'

import {
  getBoundingVertexData,
} from '../utils/babylon'

const CURSOR_NORMALS = [
  new Vector3( 1,  0,  0),
  new Vector3(-1,  0,  0),
  new Vector3( 0,  1,  0),
  new Vector3( 0, -1,  0),
  new Vector3( 0,  0,  1),
  new Vector3( 0,  0, -1),
]

export function getMousePickOnMeshOrPlane(scene: Scene, px: number, py: number, h: number, filter: (mesh: Mesh) => boolean) {
  const ray = scene.createPickingRay(px, py, null, scene.activeCamera),
    picked = scene.pickWithRay(ray, filter),
    [position, normal] = picked.hit && picked.pickedPoint.y > -0.1 ?
      [picked.pickedPoint, picked.getNormal(true, false)] :
      [ray.origin.add(ray.direction.scale((h - ray.origin.y) / ray.direction.y)), new Vector3(0, 1, 0)]
  position.copyFromFloats(Math.floor(position.x + 0.001), Math.floor(position.y + 0.001), Math.floor(position.z + 0.001))

  const { x, y, z } = normal,
    max = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)),
    norm = CURSOR_NORMALS[ [x, -x, y, -y, z, -z].indexOf(max) ]
  return { position, norm }
}

export function getMousePickOnPlane(scene: Scene, px: number, py: number, axis: 'x' | 'y' | 'z', val: number) {
  const ray = scene.createPickingRay(px, py, null, scene.activeCamera),
    scale = (val - ray.origin[axis]) / ray.direction[axis],
    position = ray.origin.add(ray.direction.scale(scale))
  position.copyFromFloats(Math.floor(position.x + 0.001), Math.floor(position.y + 0.001), Math.floor(position.z + 0.001))
  return { position }
}

const VECTOR_ONE = new Vector3(1, 1, 1),
  VECTOR_HALF = new Vector3(0.5, 0.5, 0.5),
  DIRECTIONS = {
    // rotation/Math.PI*2, delta, axis, xyz
    '1/0/0' : [new Vector3(  0, 0, -1), new Vector3(  1,  1,  1), 'x', ['y', 'x', 'z']],
    '-1/0/0': [new Vector3(  0, 0,  1), new Vector3( -1,  1,  1), 'x', ['y', 'x', 'z']],
    '0/1/0' : [new Vector3(  0, 0,  0), new Vector3(  1,  1,  1), 'y', ['x', 'y', 'z']],
    '0/-1/0': [new Vector3(  0, 0, -2), new Vector3(  1, -1,  1), 'y', ['x', 'y', 'z']],
    '0/0/1' : [new Vector3(  1, 0,  0), new Vector3(  1,  1,  1), 'z', ['x', 'z', 'y']],
    '0/0/-1': [new Vector3( -1, 0,  0), new Vector3(  1,  1, -1), 'z', ['x', 'z', 'y']],
  } as  {
    [dir: string]: [Vector3, Vector3, 'x' | 'y' | 'z', ('x' | 'y' | 'z')[]]
  }

export default class Cursor extends LinesMesh {
  readonly offset = { x: 0, y: 0}
  readonly hover = Vector3.Zero()
  readonly minimum = Vector3.Zero()
  readonly maximum = new Vector3(1, 1, 1)
  readonly start = Vector3.Zero()

  private _direction = ''
  private _isKeyDown = false
  get isKeyDown() {
    return this._isKeyDown
  }

  public baseHeight = 0

  constructor(
    name: string,
    readonly scene: Scene,
    readonly pickFilter: (mesh: Mesh) => boolean) {
    super(name, scene)

    getBoundingVertexData(0.3, 0.3, 0.3, true).applyToMesh(this)
    this.position.copyFrom(VECTOR_HALF)

    const canvas = scene.getEngine().getRenderingCanvas()
    canvas.addEventListener('mousedown', evt => {
      this._isKeyDown = true
      this.updateFromPickTarget(evt)
    })

    window.addEventListener('mousemove', evt => {
      if (evt.target === canvas) {
        this._isKeyDown ? this.updateWithMouseDown(evt) : this.updateFromPickTarget(evt)
      }
    })

    window.addEventListener('mouseup', _ => {
      this._isKeyDown = false
    })
  }

  updateFromPickTarget(evt: MouseEvent) {
    const { norm, position } = getMousePickOnMeshOrPlane(this.scene,
      evt.clientX + this.offset.x, evt.clientY + this.offset.y, this.baseHeight, this.pickFilter)
    this._direction = [norm.x, norm.y, norm.z].join('/')

    const [rot, delta] = DIRECTIONS[this._direction],
      start = Vector3.Minimize(position, position.add(delta))
    this.hover.copyFrom(start)
    this.rotation.copyFrom(rot.scale(Math.PI / 2))

    this.position.copyFrom(start.add(VECTOR_HALF))
    this.scaling.copyFrom(VECTOR_ONE)

    this.minimum.copyFrom(start)
    this.maximum.copyFrom(start.add(VECTOR_ONE))
    this.start.copyFrom(start)
  }

  private updateWithMouseDown(evt: MouseEvent) {
    const [, , axis, [i, j, k]] = DIRECTIONS[this._direction],
      { position } = getMousePickOnPlane(this.scene,
        evt.clientX + this.offset.x, evt.clientY + this.offset.y, axis, this.start[axis])
    this.hover.copyFrom(position)

    this.minimum.copyFrom(Vector3.Minimize(this.start, position))
    this.maximum.copyFrom(Vector3.Maximize(this.start, position).add(VECTOR_ONE))

    this.position.copyFrom(this.minimum.add(this.maximum).scale(0.5))
    const scaling = this.maximum.subtract(this.minimum)
    this.scaling.copyFromFloats(scaling[i], scaling[j], scaling[k])
  }
}
