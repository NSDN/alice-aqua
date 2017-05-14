import {
  InstancedMesh,
  Mesh,
  Material,
  AbstractMesh,
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
  icon: ObjectIcon
  clock: ObjectClock
  source: Mesh
}

export interface IObjectTriggerable {
  onTrigger(isOn: boolean, by?: AbstractMesh): void
}

export interface IPlayStartStopListener {
  onPlayStart(): void
  onPlayStop(): void
}

interface ObjectEvents {
  'load-stage': {
    url: string,
    position: Vector3
  }
}

export class ObjectBase extends InstancedMesh {
  static readonly eventEmitter = new EventEmitter<ObjectEvents>()

  constructor(name: string, readonly opts: ObjectOptions) {
    super(name, opts.source)
  }

  renderConfig(_save: (args: Partial<ObjectBase>) => void) {
    return [ ] as JSX.Element[]
  }
}
