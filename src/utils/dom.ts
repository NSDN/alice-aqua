import {
  h,
  Component,
  render as renderWithReact,
} from 'preact'

import {
  EventEmitter,
  queryStringGet,
  queryStringSet,
  promiseObject,
} from './'

export async function checkFontsLoaded() {
  const fonts = (document as any).fonts
  if (fonts && fonts.ready) {
    await fonts.ready
  }
}

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

export async function appendScript(src: string) {
  let script: HTMLScriptElement
  await new Promise((onload, onerror) => script = appendElement('script', { src, onload, onerror }) as HTMLScriptElement)
  return script
}

export function renderReactComponent<P, S>(render: (state: S, props?: P) => JSX.Element, container: Element) {
  class Renderer extends Component<P, S> {
    setStatePartial(state: Partial<S>) {
      super.setState(state as S)
    }
    componentDidMount() {
      wait.resolve(this as Renderer)
    }
    render() {
      return render(this.state)
    }
  }
  const wait = promiseObject<Renderer>()
  renderWithReact(h(Renderer, { }), container)
  return wait.promise
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

export function promptDownloadText(filename: string, content: string) {
  const a = appendElement('a', {
    href: 'data:text/json;charset=utf-8,' + encodeURIComponent(content),
    target: '_blank',
    download: filename,
  }) as HTMLLinkElement
  a.click()
  a.parentNode.removeChild(a)
}

export function requestUploadingText() {
  return new Promise<string>((resolve, reject) => {
    const f = appendElement('input', { type: 'file', className: 'hidden' }) as HTMLInputElement
    f.addEventListener('change', _ => {
      const r = new FileReader()
      r.onload = _ => resolve(r.result)
      r.onerror = reject
      r.readAsText(f.files[0])
    })
    f.click()
    f.parentNode.removeChild(f)
  })
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
    return queryStringGet(location.search.replace(/^\?/, ''), key)
  },
  set(dict: any) {
    location.search = queryStringSet(location.search.replace(/^\?/, ''), dict)
  },
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
  error(message: string) {
    document.querySelector('.loading-screen .loading-text').innerHTML = message
    document.querySelector('.loading-screen').classList.add('error')
  },
  update(message: string) {
    document.querySelector('.loading-screen .loading-text').innerHTML = message
    document.querySelector('.loading-screen').classList.remove('error')
  },
  hide() {
    clearTimeout(loadingTimeout)
    loadingTimeout = 0

    document.querySelector('.loading-screen').classList.remove('loading')
  },
}

export const MenuManager = {
  activate(list: string | Element, itemSelector?: string, listClass = 'menu-list', itemClass = 'menu-item') {
    for (const elem of document.querySelectorAll(`.${listClass}.active`)) {
      elem.classList.remove('active')
    }
    const elem = typeof list === 'string' ? document.querySelector(list) : list,
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

export function loadWithXHR<T>(src: string, opts?: any, onProgress?: (progress: number) => void) {
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
  readonly down = new EventEmitter<{ [P in keyof KM]: void }>()
  readonly up = new EventEmitter<{ [P in keyof KM]: void }>()
  readonly state = { } as { [P in keyof KM]: boolean }
  readonly any = new EventEmitter<{
    change: { name: keyof KM, down: boolean }
    up:     keyof KM
    down:   keyof KM
  }>()

  protected keyEvents = new EventEmitter<{ [key: string]: boolean }>()
  constructor(keyMap: KM) {
    super()

    for (const name in keyMap) {
      const comboKeys = (keyMap[name] + '').split('|'),
        comboKeyDown = comboKeys.map(_ => false)
      comboKeys.forEach((combKey, order) => {
        const keys = combKey.split('+').map(s => s.replace(/^\s+/, '').replace(/\s+$/, '')),
          keyDown = keys.map(_ => false)
        keys.forEach((key, index) => this.keyEvents.on(key, isDown => {
          keyDown[index] = isDown
          comboKeyDown[order] = keyDown.every(Boolean)
          const down = comboKeyDown.some(Boolean)
          if (this.state[name] !== down) {
            this.emit(name, this.state[name] = down)
            this[down ? 'down' : 'up'].emit(name, null)
            this.any.emit(down ? 'down' : 'up', name)
            this.any.emit('change', { name, down })
          }
        }))
      })
    }

    window.addEventListener('keydown', evt => {
      const key = SPECIAL_KEYS[evt.which] || String.fromCharCode(evt.which) || evt.which.toString()
      this.keyEvents.emit(key, true)
    })

    window.addEventListener('keyup', evt => {
      const key = SPECIAL_KEYS[evt.which] || String.fromCharCode(evt.which) || evt.which.toString()
      this.keyEvents.emit(key, false)
    })
  }
}
