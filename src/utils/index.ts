export class ArrayHash<K, V> {
  data = [ ] as [K, V][]
  get(key: K) {
    const find = this.data.filter(([k, v]) => k === key).pop()
    return find && find[1]
  }
  del(key: K) {
    this.data = this.data.filter(([k, v]) => k !== key)
  }
  set(key: K, val: V) {
    const find = this.data.filter(([k, v]) => k === key).pop()
    if (find) {
      find[1] = val
    }
    else {
      this.data.push([key, val])
    }
    return val
  }
}

export function debounce<F extends Function>(fn: F, delay: number) {
  let timeout = 0
  return function () {
    const that = this, args = arguments
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => {
      fn.apply(that, args)
      timeout = 0
    }, delay)
  } as any as F
}

export function throttle<F extends Function>(fn: F, delay: number) {
  let timeout = 0
  return function () {
    const that = this, args = arguments
    if (timeout) {
      return
    }
    timeout = setTimeout(() => {
      fn.apply(that, args)
      timeout = 0
    }, delay)
  } as any as F
}

export function memo<F extends Function>(fn: F) {
  const cache = { }, join = [ ].join
  return function() {
    const key = join.call(arguments)
    return cache[key] || (cache[key] = fn.apply(this, arguments))
  } as any as F
}

export function watch<T>(test: (...args: any[]) => T,
    update: (newVal?: T, oldVal?: T) => void, oldVal?: T) {
  return (...args: any[]) => {
    const newVal = test.apply(null, args)
    if (newVal !== oldVal) {
      update(newVal, oldVal)
      oldVal = newVal
    }
  }
}

type N = number
function find2(a: N[], b: N[], n: N,
    i0: N, i1: N, j0: N, j1: N, fn: (...key: N[]) => boolean) {
  for (let i = i0; i < i1; i ++) {
    for (let j = j0; j < j1; j ++) {
      const c = i * n + j
      if (fn(a[c], b[c], c, i, j)) {
        return { i, j }
      }
    }
  }
}
function each2(a: N[], b: N[], n: N,
  i0: N, i1: N, j0: N, j1: N, fn: (...key: N[]) => void) {
  for (let i = i0; i < i1; i ++) {
    for (let j = j0; j < j1; j ++) {
      const c = i * n + j
      fn(a[c], b[c], c, i, j)
    }
  }
}
export function getBlocksFromHeightMap(heights: number[], n: number) {
  const blocks = [ ] as number[][],
    h = Math.min.apply(Math, heights) - 2,
    a = heights,
    b = heights.map(() => h)

  let f = find2(a, b, n, 0, n, 0, n, (a, b) => a > b)
  while (f) {
    const i0 = f.i, j0 = f.j, h0 = b[i0 * n + j0]

    let i1 = i0 + 1, j1 = j0 + 1, isNotFlat = (a, b) => a <= h0 || b !== h0
    while (i1 < n && !find2(a, b, n, i1, i1 + 1, j0, j0 + 1, isNotFlat)) i1 ++
    while (j1 < n && !find2(a, b, n, i0, i1,     j1, j1 + 1, isNotFlat)) j1 ++

    let h1 = 1/0
    each2(a, b, n, i0, i1, j0, j1, (a, _, c) => h1 = Math.min(h1, a))
    each2(a, b, n, i0, i1, j0, j1, (a, _, c) => b[c] = h1)
    
    blocks.push([i0, i1, j0, j1, h0, h1])
    f = find2(a, b, n, 0, n, 0, n, (a, b) => a > b)
  }

  return blocks
}

export class EventEmitter<EventNames extends any> {
  private callbacks = { } as { [P in EventNames]: Function[] }

  addEventListener(evt: EventNames, callback: Function) {
    const cbs = this.callbacks[evt] || (this.callbacks[evt] = [ ])
    if (cbs.indexOf(callback) === -1) {
      cbs.push(callback)
    }
  }

  removeEventListener(evt: EventNames, callback: Function) {
    const cbs = this.callbacks[evt]
    if (cbs) {
      cbs.splice(cbs.indexOf(callback), 1)
    }
  }

  emit(evt: EventNames, ...args: any[]) {
    (this.callbacks[evt] || [ ]).forEach(cb => cb.apply(this, args))
  }
}
