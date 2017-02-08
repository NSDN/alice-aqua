import {
  EventEmitter,
} from './'

export interface ElementAttributes {
  attributes?: any
  style?: any
  [key: string]: any
}

export function createElement(tag: string, attrs = { } as ElementAttributes, children = [ ] as Element[]) {
  attrs = { ...attrs }
  const elem = document.createElement(tag)
  if (attrs.style) {
    'width/height/lineHeight/left/top/right/bottom'.split('/').forEach(name => {
      attrs.style[name] > 0 && (attrs.style[name] = attrs.style[name] + 'px')
    })
    Object.assign(elem.style, attrs.style)
    delete attrs.style
  }
  if (attrs.attributes) {
    for (const key in attrs.attributes) {
      elem.setAttribute(key, attrs.attributes[key])
    }
    delete attrs.attributes
  }
  Object.assign(elem, attrs)
  children.forEach((child: Element) => elem.appendChild(child))
  return elem
}

export function appendElement(tag: string, attrs = { } as ElementAttributes, parent = document.body as string | Element) {
  const elem = createElement(tag, attrs)
  if (typeof parent === 'string') {
    document.querySelector(parent).appendChild(elem)
  }
  else if (parent) {
    parent.appendChild(elem)
  }
  return elem
}

export function drawIconFont(dc: CanvasRenderingContext2D, className: string, x: number, y: number, size: number) {
  const attrs = { className, width: size, height: size, style: { fontSize: size + 'px' } },
    span = appendElement('i', attrs) as HTMLCanvasElement,
    style = getComputedStyle(span, ':before'),
    text = (style.content || '').replace(/"/g, '')
  dc.save()
  dc.textAlign = 'center'
  dc.textBaseline = 'middle'
  dc.font = style.font
  dc.fillText(text, x + size / 2, y + size / 2)
  dc.restore()
  span.parentNode.removeChild(span)
}

export function attachDragable(
  elemOrFilter: HTMLElement | ((evt: MouseEvent) => boolean),
  onDown:  (evt: MouseEvent) => void,
  onMove?: (evt: MouseEvent) => void,
  onUp?:   (evt: MouseEvent) => void) {

  function handleMouseDown(evt: MouseEvent) {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    if (typeof elemOrFilter !== 'function' || elemOrFilter(evt)) {
      onDown(evt)
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
  }

  function handleMouseMove(evt: MouseEvent) {
    onMove && onMove(evt)
  }

  function handleMouseUp(evt: MouseEvent) {
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
    onUp && onUp(evt)
  }

  const elem = typeof elemOrFilter !== 'function' ? elemOrFilter : window
  elem.addEventListener('mousedown', handleMouseDown)
  return () => {
    elem.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
}

export const LocationSearch = {
  get(key: string): string {
    return location.search.replace(/^\?/, '').split('&')
      .concat(key + '=')
      .find(pair => pair.startsWith(key + '=')).split('=').map(decodeURIComponent)
      .pop()
  },
  set(dict: any) {
    location.search = location.search.replace(/^\?/, '').split('&')
      .filter(pair => !(pair.split('=').shift() in dict))
      .concat(Object.keys(dict).map(key => key + '=' + encodeURIComponent(dict[key])))
      .join('&')
  },
}

export function appendConfigRow(label: HTMLElement, input: HTMLElement, container: HTMLElement) {
  const tr = appendElement('tr', { className: 'config-line' }, container)

  const td1 = appendElement('td', { }, tr) as HTMLTableDataCellElement
  label.parentNode && label.parentNode.removeChild(label)
  td1.appendChild(label)

  const td2 = appendElement('td', { }, tr) as HTMLTableDataCellElement
  input.parentNode && input.parentNode.removeChild(label)
  td2.appendChild(input)

  return tr
}

export function appendConfigElement(label: string | HTMLElement, tag: string, attrs: any, container: HTMLElement) {
  const input = appendElement(tag, attrs, null),
    elem = typeof label === 'string' ? appendElement('label', { innerText: label }, null) : label
  appendConfigRow(elem, input, container)
  return input
}

export function appendConfigInput(label: string | HTMLElement, value: any, attrs: any, container: HTMLElement, onChange: (value: string) => void) {
  const input = appendConfigElement(label, 'input', attrs, container) as HTMLInputElement
  input.value = value
  input.addEventListener('change', _ => onChange(input.value))
}

export function appendSelectOptions(label: string | HTMLElement, val: string, options: any, container: HTMLElement) {
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

export function appendVectorInputs(label: string | HTMLElement, val: { x: number, y: number, z: number },
    container: HTMLElement, attrs: any, onChange: (inputs: HTMLInputElement[]) => void) {
  attrs = { type: 'number', style: { width: '30%', maxWidth: '40px' }, ...attrs }
  const div = appendConfigElement(label, 'div', { }, container)
  const inputs = 'x/y/z'.split('/').map((a: 'x' | 'y' | 'z') => {
    const input = appendElement('input', attrs, div) as HTMLInputElement
    input.placeholder = a
    input.value = val[a] + ''
    input.addEventListener('change', _ => onChange(inputs))
    return input
  })
}

let loadingTimeout = 0
function checkLoaded() {
  const dots = [].slice.call(document.querySelectorAll('.screen .loading-dot')) as Element[],
    index = dots.findIndex(elem => elem.classList.contains('active'))
  dots.forEach(dot => dot.classList.remove('active'))
  dots[(index + 1) % dots.length].classList.add('active')

  loadingTimeout = 0
  if (document.querySelector('.screen.loading')) {
    loadingTimeout = setTimeout(checkLoaded, 300)
  }
}

const $ = createElement
export const LoadingScreen = {
  show() {
    if (!document.querySelector('.loading-screen')) {
      document.body.appendChild($('div', { className: 'loading-screen screen loading' }, [
        $('div', { className: 'loading-text' }),
        $('div', { }, [
          $('span', { className: 'loading-dot' }),
          $('span', { className: 'loading-dot' }),
          $('span', { className: 'loading-dot' }),
          $('span', { className: 'loading-dot' }),
          $('span', { className: 'loading-dot' }),
        ])
      ]))
    }

    loadingTimeout = loadingTimeout || setTimeout(checkLoaded, 300)
  },
  update(message: string) {
    document.querySelector('.loading-screen .loading-text').innerHTML = message
  },
  hide() {
    clearTimeout(loadingTimeout)
    loadingTimeout = 0

    document.querySelector('.loading-screen').classList.remove('loading')
  },
}

export const MenuManager = {
  activate(list: string, itemSelector?: string, listClass = 'menu-list', itemClass = 'menu-item') {
    for (const elem of document.querySelectorAll(`.${listClass}.active`)) {
      elem.classList.remove('active')
    }
    const elem = document.querySelector(list),
      listElem = elem && (elem.classList.contains(listClass) ? elem : elem.querySelector(`.${listClass}`))
    if (listElem) {
      listElem.classList.add('active')
      const lastActive = listElem.querySelector(`.${itemClass}.active`)
      if (lastActive) {
        lastActive.classList.remove('active')
      }
      const listItem = itemSelector ? listElem.querySelector(itemSelector) :
        (lastActive ? [lastActive] : [ ]).concat(Array.from(listElem.querySelectorAll(`.${itemClass}`)))
          .filter(elem => !elem.classList.contains('hidden'))[0]
      if (listItem) {
        listItem.classList.add('active')
      }
    }
  },
  activeList(listClass = 'menu-list') {
    return document.querySelector(`.${listClass}.active`)
  },
  activeItem(listClass = 'menu-list', itemClass = 'menu-item') {
    return document.querySelector(`.${listClass}.active .${itemClass}.active`)
  },
  selectNext(delta: number, listClass = 'menu-list', itemClass = 'menu-item') {
    const activeList = MenuManager.activeList(listClass)
    if (activeList) {
      const activeItem = MenuManager.activeItem(listClass, itemClass),
        allItems = Array.from(activeList.querySelectorAll(`.${itemClass}`))
          .filter(elem => !elem.classList.contains('hidden')),
        nextItem = allItems[(allItems.indexOf(activeItem) + delta + allItems.length) % allItems.length]
      activeItem && activeItem.classList.remove('active')
      nextItem && nextItem.classList.add('active')
    }
  },
}

export function loadWithXHR<T>(src: string, opts: any,
    onProgress?: (progress: number) => void) {
  return new Promise<T>((onload, onerror) => {
    const xhr = new XMLHttpRequest()
    xhr.addEventListener('error', onerror)
    xhr.addEventListener('load', _ => onload(xhr.response))
    xhr.addEventListener('progress', evt => onProgress && onProgress(evt.loaded / evt.total))
    Object.assign(xhr, opts)
    xhr.open('get', src)
    xhr.send()
  })
}

export function readAsDataURL(blob: Blob) {
  return new Promise<string>((onload, onerror) => {
    const fr = new FileReader()
    fr.onload = function() { onload(this.result) }
    fr.onerror = onerror
    fr.readAsDataURL(blob)
  })
}

export async function loadDataURLWithXHR(src: string, onProgress?: (progress: number) => void) {
  const blob = await loadWithXHR<Blob>(src, { responseType: 'blob' }, onProgress)
  return await readAsDataURL(blob)
}

const SPECIAL_KEYS: { [keyCode: number]: string } = {
  [13]: 'RETURN',
  [16]: 'SHIFT',
  [17]: 'CTRL',
  [27]: 'ESCAPE',
  [32]: 'SPACE',
  [37]: 'LEFT',
  [38]: 'UP',
  [39]: 'RIGHT',
  [40]: 'DOWN',
  [46]: 'DELETE',
}

export class KeyEmitter<KM> extends EventEmitter<{ [P in keyof KM]: boolean }> {
  private all = new EventEmitter<{ [key: string]: boolean }>()
  readonly state = { } as { [P in keyof KM]: boolean }
  readonly any = new EventEmitter<{
    change: { name: keyof KM, down: boolean }
    up:     keyof KM
    down:   keyof KM
  }>()

  constructor(keyMap: KM) {
    super()

    for (const name in keyMap) (keyMap[name] + '').split('|').forEach(combKey => {
      const keys = combKey.split('+').map(s => s.replace(/^\s+/, '').replace(/\s+$/, '')),
        keyDown = keys.map(_ => false)
      keys.forEach((key, index) => this.all.on(key, isDown => {
        keyDown[index] = isDown
        const down = keyDown.every(b => b)
        if (this.state[name] !== down) {
          this.emit(name, this.state[name] = down)
          this.any.emit(down ? 'down' : 'up', name)
          this.any.emit('change', { name, down })
        }
      }))
    })

    window.addEventListener('keydown', evt => {
      const key = SPECIAL_KEYS[evt.which] || String.fromCharCode(evt.which) || evt.which.toString()
      this.all.emit(key, true)
    })

    window.addEventListener('keyup', evt => {
      const key = SPECIAL_KEYS[evt.which] || String.fromCharCode(evt.which) || evt.which.toString()
      this.all.emit(key, false)
    })
  }

  down(key: keyof KM, cb: () => void) {
    return this.on(key, down => down && cb())
  }

  up(key: keyof KM, cb: () => void) {
    return this.on(key, down => !down && cb())
  }
}
