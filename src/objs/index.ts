import {
  InstancedMesh,
  Mesh,
  Material,
  AbstractMesh,
  ScreenSpaceCanvas2D,
  Vector3,
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

export function appendConfigLine(label: HTMLElement, input: HTMLElement, container: HTMLElement) {
  const tr = appendElement('tr', { className: 'config-line' }, container)

  const td1 = appendElement('td', { }, tr) as HTMLTableDataCellElement
  label.parentNode && label.parentNode.removeChild(label)
  td1.appendChild(label)

  const td2 = appendElement('td', { }, tr) as HTMLTableDataCellElement
  input.parentNode && input.parentNode.removeChild(label)
  td2.appendChild(input)

  return tr
}

export function appendConfigElement(label: string, tag: string, attrs: any, container: HTMLElement) {
  const input = appendElement(tag, attrs, null)
  appendConfigLine(appendElement('label', { innerText: label }, null), input, container)
  return input
}

export function appendSelectOptions(label: string, val: string, options: any, container: HTMLElement) {
  const select = appendConfigElement(label, 'select', { }, container) as HTMLSelectElement
  if (Array.isArray(options)) {
    options.forEach(innerHTML => appendElement('option', { innerHTML }, select))
  }
  else {
    Object.keys(options).forEach(value => appendElement('option', { innerHTML: options[value], value }, select))
  }
  select.value = val
  return select
}

export function appendVectorInputs(label: string, val: Vector3, container: HTMLElement, attrs: any, onChange: (inputs: HTMLInputElement[]) => void) {
  attrs = { type: 'number', style: { width: '30%', maxWidth: '40px' }, ...attrs }
  const div = appendConfigElement(label, 'div', { }, container)
  const inputs = 'x/y/z'.split('/').map(a => {
    const input = appendElement('input', attrs, div) as HTMLInputElement
    input.placeholder = a
    input.value = val[a] + ''
    input.addEventListener('change', _ => onChange(inputs))
    return input
  })
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
