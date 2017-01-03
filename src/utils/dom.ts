export function appendElement(tag: string, attrs = { } as any, parent = document.body as any) {
  const elem = Object.assign(document.createElement(tag), attrs)
  Object.assign(elem.style, attrs.style)
  if (attrs.attributesToSet) for (const key in attrs.attributesToSet) {
    elem.setAttribute(key, attrs.attributesToSet[key])
  }
  if (parent) {
    if (typeof parent === 'string') {
      document.querySelector(parent).appendChild(elem)
    }
    else {
      (parent as Element).appendChild(elem)
    }
  }
  return elem
}

export function drawIconFont(dc: CanvasRenderingContext2D, className: string, x: number, y: number, size: number) {
  const attrs = { className, width: size, height: size, style: { fontSize: size + 'px' } },
    span = appendElement('i', attrs) as HTMLCanvasElement,
    style = getComputedStyle(span, ':before'),
    text = (style.content || '').replace(/"/g, '')
  dc.save()
  dc.font = style.font
  dc.fillText(text, x, y)
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

