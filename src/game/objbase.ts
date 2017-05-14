import {
  InstancedMesh,
  Mesh,
  Material,
  Vector3,
  Tags,
  Scene,
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
  onTrigger(isOn: boolean): void
}

export interface IPlayStartStopListener {
  onPlayStart(): void
  onPlayStop(): void
}

interface ObjectEvents {
  'load-stage': {
    url: string
    position: Vector3
  }
  'fire-trigger': {
    targetName: string
    targetIsOn: boolean
  }
}

const OBJECT_SHADOW_TAG = 'object-has-shadow'

export class ObjectBase extends InstancedMesh {
  static readonly eventEmitter = new EventEmitter<ObjectEvents>()

  static enableShadowFor(obj: any) {
    Tags.AddTagsTo(obj, OBJECT_SHADOW_TAG)
  }

  static getShadowEnabled(scene: Scene) {
    return scene.getMeshesByTags(OBJECT_SHADOW_TAG)
  }

  constructor(name: string, readonly opts: ObjectOptions) {
    super(name, opts.source)
  }

  renderConfig(_save: (args: Partial<ObjectBase>) => void) {
    return [ ] as JSX.Element[]
  }
}
