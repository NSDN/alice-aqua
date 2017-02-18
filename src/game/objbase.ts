import {
  InstancedMesh,
  Mesh,
  Material,
  AbstractMesh,
  ScreenSpaceCanvas2D,
  Vector3,
} from '../babylon'

import {
  EventEmitter,
} from '../utils'

export interface ObjectIcon {
  material: Material
  texSize: number
  offsetX: number
  offsetY: number
  width: number
  height: number
}

export interface ObjectClock {
  tickNow: number
  timeout: (fn: Function, delay: number) => (() => void)
}

export interface ObjectOptions {
  canvas: ScreenSpaceCanvas2D
  icon: ObjectIcon
  clock: ObjectClock
  source: Mesh
}

export interface ITriggerable {
  onTrigger(isOn: boolean, by?: AbstractMesh): void
}

export interface IUsable {
  canBeUsedBy(mesh: AbstractMesh): boolean
  displayUsable(mesh: AbstractMesh, show: boolean): void
  useFrom(mesh: AbstractMesh): void
}

interface ObjectEvents {
  'load-stage': {
    url: string,
    position: Vector3
  }
  'read-bulletin-content': {
    [name: string]: {
      text: string
      options: { [title: string]: string }
    }
  }
}

export class ObjectBase extends InstancedMesh {
  static readonly eventEmitter = new EventEmitter<ObjectEvents>()

  constructor(name: string, readonly opts: ObjectOptions) {
    super(name, opts.source)
  }
  startPlaying() {
  }
  stopPlaying() {
  }
  renderConfig(_save: (args: Partial<ObjectBase>) => void) {
    return [ ] as JSX.Element[]
  }
}
