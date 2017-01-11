import {
  InstancedMesh,
  Mesh,
  Material,
  AbstractMesh,
  ScreenSpaceCanvas2D,
} from '../babylon'

import {
  appendElement,
} from '../utils/dom'

export interface ObjectOptions {
  keys: any
  source: Mesh
  canvas2d: ScreenSpaceCanvas2D
  icon: {
    material: Material
    texSize: number
    offsetX: number
    offsetY: number
    width: number
    height: number
  }
}

export { appendElement } from '../utils/dom'

export function appendConfigItem(container: HTMLElement) {
  return appendElement('div', { className: 'config-item' }, container)
}

export function appendConfigElem(label: string, tag: string, attrs: any, container: HTMLElement) {
  const item = appendElement('div', { className: 'config-item' }, container)
  appendElement('label', { innerText: label }, item)
  return appendElement(tag, attrs, item)
}

export function appendSelectElem(label: string, val: string, options: any, container: HTMLElement) {
  const select = appendConfigElem(label, 'select', { }, container) as HTMLSelectElement
  if (Array.isArray(options)) {
    options.forEach(innerHTML => appendElement('option', { innerHTML }, select))
  }
  else {
    Object.keys(options).forEach(value => appendElement('option', { innerHTML: options[value], value }, select))
  }
  select.value = val
  return select
}

export interface ObjectTriggerable {
  onTrigger(isOn: boolean): void
}

export interface ObjectUsable {
  canBeUsedBy(mesh: AbstractMesh): boolean
  displayUsable(mesh: AbstractMesh, show: boolean): void
  useFrom(mesh: AbstractMesh): void
}

export interface ObjectElementBinder {
  bindToElement(container: HTMLElement, save: (args: Partial<ObjectElementBinder>) => void): void
}

export interface ObjectPlayListener {
  startPlaying(): void
  stopPlaying(): void
}

export default class ObjectBase extends InstancedMesh {
  constructor(name: string, readonly opts: ObjectOptions) {
    super(name, opts.source)
  }
}
