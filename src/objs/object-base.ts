import {
  InstancedMesh,
  Mesh,
  Material,
  AbstractMesh,
} from '../babylon'

import {
  appendElement,
} from '../utils/dom'

export interface ObjectOptions {
  clsName: string
  material: Material
  texSize: number
  offsetX: number
  offsetY: number
  width: number
  height: number
  keys: any
}

export { appendElement } from '../utils/dom'

export function appendConfigItem(label: string, tag: string, attrs: any, container: HTMLElement) {
  const item = appendElement('div', { className: 'config-item' }, container)
  appendElement('label', { innerText: label }, item)
  return appendElement(tag, attrs, item)
}

export function appendSelectItem(label: string, val: string, options: string[], container: HTMLElement) {
  const select = appendConfigItem(label, 'select', { }, container) as HTMLSelectElement
  options.forEach(innerHTML => appendElement('option', { innerHTML }, select))
  select.value = val
  return select
}

export interface ObjectTriggerable {
  onTrigger(isOn: boolean)
}

export interface ObjectUsable {
  canBeUsedBy(mesh: AbstractMesh): boolean
  useFrom(mesh: AbstractMesh)
}

export interface ObjectElementBinder {
  bindToElement(container: HTMLElement, save: (args: Partial<ObjectElementBinder>) => void): void
}

export interface ObjectPlayListener {
  startPlaying(): void
  stopPlaying(): void
}

export default class ObjectBase extends InstancedMesh {
  constructor(name: string, source: Mesh, readonly opts: ObjectOptions) {
    super(name, source)
  }
}
