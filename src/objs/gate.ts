import {
  VERTEX_BOX
} from '../utils'

import {
  Mesh,
  Scene,
  PhysicsImpostor,
  Vector3,
  Material,
  Color3
} from '../babylon'

export default class Gate extends Mesh {
  isOpen = false

  static defaultWidth = 4.4
  static defaultHeight = 3.2
  static defaultBorder = 1.1
  static defaultThickness = 1

  addBox(name, size: Vector3, position: Vector3, hasPhysics: boolean, parent = this) {
    const box = new Mesh(name, this.getScene())
    VERTEX_BOX.applyToMesh(box)
    box.scaling.copyFrom(size)
    box.position.copyFrom(position)
    box.parent = parent
    if (hasPhysics) {
      box.physicsImpostor = new PhysicsImpostor(box, PhysicsImpostor.BoxImpostor, { mass: 0 })
    }
    return box
  }

  constructor(name, scene: Scene, opts?: {
    ext?: any,
    width?: number,
    height?: number,
    border?: number,
    thickness?: number,
    speed?: number,
    panelMaterial?: Material,
  }) {
    super(name, scene)

    opts = Object.assign({
      width:  Gate.defaultWidth,
      height: Gate.defaultHeight,
      border: Gate.defaultBorder,
      thickness: Gate.defaultThickness,
      speed: 0.02,
    } as typeof opts, opts)

    if (opts.ext) {
      Object.assign(this, opts.ext)
    }

    this.physicsImpostor = new PhysicsImpostor(this, PhysicsImpostor.ParticleImpostor)

    const left = this.addBox(`${name}-left`,
      new Vector3(opts.border, opts.height - opts.border, opts.thickness),
      new Vector3(-opts.width / 2 + opts.border / 2, (opts.height - opts.border) / 2, 0),
      true)

    const right = this.addBox(`${name}-right`,
      new Vector3(opts.border, opts.height - opts.border, opts.thickness),
      new Vector3(opts.width / 2 - opts.border / 2, (opts.height - opts.border) / 2, 0),
      true)

    const top = this.addBox(`${name}-top`,
      new Vector3(opts.width, opts.border, opts.thickness),
      new Vector3(0, opts.height - opts.border / 2, 0),
      true)

    left.material = right.material = top.material = this.material

    this.physicsImpostor.forceUpdate()

    const panelWidth = opts.width / 2 - opts.border,
      panelCount = Math.ceil(panelWidth / opts.border),
      panelOffsets = [ ] as { from: number, to: number }[]
    for (var i = 0; i < panelCount; i ++) {
      const from = opts.border * (i + 0.5),
        to = opts.width / 2 - opts.border / 2 - 0.001
      panelOffsets.push({ from, to })
      panelOffsets.push({ from: -from, to: -to })
    }

    panelOffsets.forEach((offset, index) => {
      const panel = this.addBox(`${name}-panel-${index}`,
        new Vector3(opts.border, opts.height - opts.border, opts.thickness * 0.5),
        new Vector3(offset.from, (opts.height - opts.border) / 2, 0),
        false)
      panel.material = opts.panelMaterial

      const body = this.addBox(`${name}-panel-body-${index}`,
        new Vector3(opts.border, opts.height - opts.border, opts.thickness * 0.5),
        new Vector3(offset.from, (opts.height - opts.border) / 2, 0).add(this.position),
        true, null)
      body.isVisible = false

      const min = Math.min(offset.from, offset.to),
        max = Math.max(offset.from, offset.to)
      panel.registerBeforeRender(mesh => {
        const target = this.isOpen ? offset.to : offset.from,
          value = panel.position.x + opts.width / 4 * opts.speed * (panel.position.x > target ? -1 : 1)
        panel.position.x = Math.min(Math.max(min, value), max)
        panel.getWorldMatrix().decompose(new Vector3(1, 1, 1), body.rotationQuaternion, body.position)
      })
    })
  }
}