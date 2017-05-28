import {
  VertexData,
  Scene,
  Vector3,
  Color3,
  PhysicsImpostor,
  ArcRotateCamera,
  StandardMaterial,
  Xbox360Button,
  Xbox360Dpad,
} from '../babylon'

import {
  softClamp,
  EventEmitter,
} from './'

import {
  KeyEmitter,
} from './dom'

export function Vector3Map(vec: Vector3, fn: (x: number, a?: 'x' | 'y' | 'z') => number) {
  return new Vector3(fn(vec.x, 'x'), fn(vec.y, 'y'), fn(vec.z, 'z'))
}

export const VERTEX_BOX      = VertexData.CreateBox({ })
export const VERTEX_SPHERE   = VertexData.CreateSphere({ segments: 8 })
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
  return getPlaneVertexDataWithUV(u0, u1, v0, v1)
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
    indices = [ ] as N[],
    uvs = [ ] as N[]
  vs.forEach(i => {
    const n = i * 3
    for (let j = n; j < n + 3; j ++) {
      positions.push(arguments[ SIDE_POS[j] ])
      normals.push(SIDE_NORM[j])
    }
    uvs.push(arguments[ SIDE_POS[n] ] + arguments[ SIDE_POS[n + 2] ])
    uvs.push(arguments[ SIDE_POS[n + 1] ])
  })
  fs.forEach(i => {
    for (let n = i * 6, j = n; j < n + 6; j ++) {
      indices.push(SIDE_IDX[j])
    }
  })
  return { positions, normals, indices, uvs }
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

export function getMousePickOnPlane(scene: Scene, px: number, py: number, axis: 'x' | 'y' | 'z', val: number) {
  const ray = scene.createPickingRay(px, py, null, scene.activeCamera),
    scale = (val - ray.origin[axis]) / ray.direction[axis],
    position = ray.origin.add(ray.direction.scale(scale))
  position.copyFromFloats(Math.floor(position.x + 0.001), Math.floor(position.y + 0.001), Math.floor(position.z + 0.001))
  return { position }
}

export class StaticBoxImpostor extends PhysicsImpostor {
  constructor(opts: { position: Vector3, scaling: Vector3, rotation?: Vector3 }, scene: Scene) {
    // https://github.com/BabylonJS/Babylon.js/blob/master/src/Physics/babylon.physicsImpostor.ts#L174
    const position = opts.position.clone(),
      scaling = opts.scaling.clone(),
      rotation = opts.rotation ? opts.rotation.clone() : Vector3.Zero()
    PhysicsImpostor.DEFAULT_OBJECT_SIZE.copyFrom(opts.scaling)
    // https://github.com/BabylonJS/Babylon.js/blob/master/src/Physics/babylon.physicsImpostor.ts#L70
    super({ position, scaling, rotation } as any, PhysicsImpostor.BoxImpostor, { mass: 0, friction: 0 }, scene)
  }
}

export class ColorNoLightingMaterial extends StandardMaterial {
  static getCached(scene: Scene, color: Color3) {
    const name = 'cache/nolighting/' + color.toHexString(),
      dict = scene as any as { [color: string]: ColorNoLightingMaterial }
    return dict[name] || (dict[name] = new ColorNoLightingMaterial(name, scene, color))
  }
  constructor(name: string, scene: Scene, color = Color3.White()) {
    super(name, scene)
    this.disableLighting = true
    this.emissiveColor = color
  }
}

export class ColorWireframeNoLightingMaterial extends ColorNoLightingMaterial {
  static getCached(scene: Scene, color: Color3) {
    const name = 'cache/wireframe-nolighting/' + color.toHexString(),
      dict = scene as any as { [color: string]: ColorWireframeNoLightingMaterial }
    return dict[name] || (dict[name] = new ColorWireframeNoLightingMaterial(name, scene, color))
  }
  constructor(name: string, scene: Scene, color: Color3) {
    super(name, scene, color)
    this.wireframe = true
  }
}

const Pi2 = Math.PI * 2
function roundInPi2(a: number) {
  while (a < 0) a += Pi2
  while (a > Pi2) a -= Pi2
  return a
}
function nearestAngle(a: number, b: number) {
  return Math.abs(a - b) <= Math.PI ? a :
    a > b ? a - Pi2 : a + Pi2
}

export class FollowCamera extends ArcRotateCamera {
  public readonly followTarget = Vector3.Zero()
  public readonly followSpeed = new Vector3(0.1, 0.1, 0.1)
  public followAlpha = undefined as number | undefined
  public lowerBetaSoftLimit = 0
  public upperBetaSoftLimit = 1 / 0
  public lowerRadiusSoftLimit = 0
  public upperRadiusSoftLimit = 1 / 0
  public rotationSensibility = 15
  public rotationDeadZone = 0.15
  public zoomSensibility = 1
  public zoomDeadZone = 0.15

  updateRotation({ x, y }: { x: number, y: number }) {
    if (Math.abs(x) > this.rotationDeadZone) {
      this.alpha += x / this.rotationSensibility * 0.5
    }
    if (Math.abs(y) > this.rotationDeadZone) {
      this.beta += y / this.rotationSensibility
    }
  }

  updateDistance(d: number) {
    if (Math.abs(d) > this.zoomDeadZone) {
      this.radius += d / this.zoomSensibility
    }
  }

  constructor(name: string, alpha: number, beta: number, radius: number, target: Vector3, scene: Scene) {
    super(name, alpha, beta, radius, target, scene)

    this.inputs.removeByType('ArcRotateCameraGamepadInput')
    this.inputs.removeByType('ArcRotateCameraKeyboardMoveInput')

    this.followTarget.copyFrom(target)

    let isMouseDown = false
    window.addEventListener('mousedown', _ => isMouseDown = true)
    window.addEventListener('mouseup', _ => isMouseDown = false)

    this.getScene().registerAfterRender(() => {
      if (this.followAlpha !== undefined) {
        const alpha = roundInPi2(this.followAlpha)
        if (Math.abs(this.alpha - alpha) > 1e-2) {
          this.alpha = roundInPi2(this.alpha * 0.9 + nearestAngle(alpha, this.alpha) * 0.1)
        }
        else {
          this.followAlpha = undefined
        }
      }

      if (!isMouseDown) {
        if (!this.followTarget.equalsWithEpsilon(this.target, 0.1)) {
          const cameraDirection = this.target.subtract(this.position),
            b = this.target, e = this.followTarget
          this.setTarget(Vector3Map(this.followSpeed, (f, a) => b[a] * (1 - f) + e[a] * f))
          this.setPosition(this.target.subtract(cameraDirection))
        }
        this.beta = softClamp(this.beta, this.lowerBetaSoftLimit, this.upperBetaSoftLimit)
        this.radius = softClamp(this.radius, this.lowerRadiusSoftLimit, this.upperRadiusSoftLimit)
      }
    })
  }
}

const GAMEPAD_MAP = {
  [Xbox360Button.A]: 'A',
  [Xbox360Button.B]: 'B',
  [Xbox360Button.X]: 'X',
  [Xbox360Button.Y]: 'Y',
  [Xbox360Button.LB]: 'LB',
  [Xbox360Button.RB]: 'RB',
}

const GAMEDPAD_MAP = {
  [Xbox360Dpad.Up]: 'UP',
  [Xbox360Dpad.Down]: 'DOWN',
  [Xbox360Dpad.Left]: 'LEFT',
  [Xbox360Dpad.Right]: 'RIGHT',
}

const gamepadEvents = new EventEmitter<{
  connect: BABYLON.Xbox360Pad
  down: string
  up: string
}>()

let activeGamepad: BABYLON.Xbox360Pad
new BABYLON.Gamepads(gamepad => {
  gamepadEvents.emit('connect', activeGamepad = gamepad as BABYLON.Xbox360Pad)
  console.log(`gamepad "${activeGamepad.id}" connected`)
  if (gamepad instanceof BABYLON.Xbox360Pad) {
    gamepad.onbuttondown(b => {
      const k = GAMEPAD_MAP[b]
      k && gamepadEvents.emit('down', 'PAD-' + k)
    })
    gamepad.onbuttonup(b => {
      const k = GAMEPAD_MAP[b]
      k && gamepadEvents.emit('up', 'PAD-' + k)
    })
    gamepad.ondpaddown(b => {
      const k = GAMEDPAD_MAP[b]
      k && gamepadEvents.emit('down', 'PAD-' + k)
    })
    gamepad.ondpadup(b => {
      const k = GAMEDPAD_MAP[b]
      k && gamepadEvents.emit('up', 'PAD-' + k)
    })
  }
  else if (gamepad instanceof BABYLON.GenericPad) {
    gamepad.onbuttondown(b => {
      const k = GAMEPAD_MAP[b]
      k && gamepadEvents.emit('down', 'PAD-' + k)
    })
    gamepad.onbuttonup(b => {
      const k = GAMEPAD_MAP[b]
      k && gamepadEvents.emit('up', 'PAD-' + k)
    })
  }
})

export class GamepadInput<KM> extends KeyEmitter<KM> {
  public gamepad: BABYLON.Xbox360Pad

  get leftStick() {
    return this.gamepad && this.gamepad.leftStick
  }
  get rightStick() {
    return this.gamepad && this.gamepad.rightStick
  }
  get leftTrigger() {
    return this.gamepad && this.gamepad.leftTrigger
  }
  get rightTrigger() {
    return this.gamepad && this.gamepad.rightTrigger
  }

  constructor(map: KM) {
    super(map)
    this.gamepad = activeGamepad
    gamepadEvents.on('connect', gamepad => this.gamepad = gamepad)
    gamepadEvents.on('down', button => this.keyEvents.emit(button, { isDown: true, event: null }))
    gamepadEvents.on('up', button => this.keyEvents.emit(button, { isDown: false, event: null }))
  }
}

export class CommonMaterial extends StandardMaterial {
  constructor(name: string, scene: Scene) {
    super(name, scene)
    this.specularPower = 0.5
    this.specularColor.copyFromFloats(0.1, 0.1, 0.1)
    this.emissiveColor.copyFromFloats(0.8, 0.8, 0.8)
  }
}
