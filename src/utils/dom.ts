export function appendElement(tag: string, attrs = { } as any, parent = document.body as Element) {
  const elem = Object.assign(document.createElement(tag), attrs)
  Object.assign(elem.style, attrs.style)
  if (attrs.attributesToSet) for (const key in attrs.attributesToSet) {
    elem.setAttribute(key, attrs.attributesToSet[key])
  }
  parent && parent.appendChild(elem)
  return elem
}

export function createDataURLFromIconFont(className: string, size: number = 24, color = '#333') {
  const attrs = { className, width: size, height: size, style: { fontSize: size + 'px' } },
    canvas = appendElement('canvas', attrs) as HTMLCanvasElement,
    dc = canvas.getContext('2d'),
    style = getComputedStyle(canvas, ':before'),
    text = (style.content || '').replace(/"/g, '')
  dc.fillStyle = color
  dc.font = style.font
  dc.textAlign = 'center'
  dc.textBaseline = 'middle'
  dc.fillText(text, size / 2, size / 2)
  return canvas.toDataURL()
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

