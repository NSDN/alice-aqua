export function randomRange(begin: number, end: number) {
  return Math.random() * (end - begin) + begin
}

export function randomBytes(size = 4) {
  return Array(size * 2).fill(0).map(_ => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function softClamp(x: number, min: number, max: number, epsi = 1e-3, fac = 0.1) {
  if (x < min - epsi * min) {
    return x * (1 - fac) + min * fac
  }
  if (x > max + epsi * min) {
    return x * (1 - fac) + max * fac
  }
  return x
}

interface Task {
  start: () => Promise<any>
  resolve: Function
  reject: Function
}
export function queue() {
  let running = null as Task
  const waiting = [ ] as Task[]
  const exec = () => {
    running = waiting.shift()
    running && running.start()
        .then(r => (running.resolve(r), exec()))
        .catch(e => (running.reject(e), exec()))
  }
  return <T>(start: () => Promise<T>) => new Promise((resolve, reject) => {
    waiting.push({ start, resolve, reject })
    !running && exec()
  })
}

export function holdon(fn: (p: Promise<any>) => Promise<any>) {
  let resolve = null as Function,
    next = new Promise(res => resolve = res),
    done = fn(next)
  return () => {
    resolve()
    return done
  }
}

export function fpsCounter(n = 30) {
  let a = Array(n).fill(0), c = 0
  return () => {
    const i = c,
      j = (c + 1) % a.length,
      t = (a[i] - a[j]) / (a.length - 1)
    a[c = j] = Date.now()
    return 1000 / t
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
  const cache = { } as any, join = [ ].join
  return function() {
    const key = join.call(arguments, '/')
    return cache[key] || (cache[key] = fn.apply(this, arguments))
  } as any as F
}

function equal<T>(a: T, b: T) {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.every((_, i) => a[i] === b[i])
  }
  else {
    return a === b
  }
}

export function watch<T>(test: (...args: any[]) => T,
    update: (newVal?: T, oldVal?: T) => void, oldVal?: T) {
  return (...args: any[]) => {
    const newVal = test.apply(null, args)
    if (!equal(newVal, oldVal)) {
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
export function getBlocksFromHeightMap(heights: N[], n: N, h: N) {
  const blocks = [ ] as N[][],
    a = heights.map(h => h),
    b = heights.map(_ => h)

  let f = find2(a, b, n, 0, n, 0, n, (a, b) => a > b)
  while (f) {
    const i0 = f.i, j0 = f.j, h0 = b[i0 * n + j0]

    let i1 = i0 + 1, j1 = j0 + 1, isNotFlat = (a: N, b: N) => a <= h0 || b !== h0
    while (i1 < n && !find2(a, b, n, i1, i1 + 1, j0, j0 + 1, isNotFlat)) i1 ++
    while (j1 < n && !find2(a, b, n, i0, i1,     j1, j1 + 1, isNotFlat)) j1 ++

    let h1 = 1 / 0
    each2(a, b, n, i0, i1, j0, j1, (a, _b) => h1 = Math.min(h1, a))
    each2(a, b, n, i0, i1, j0, j1, (_, _b, c) => b[c] = h1)

    blocks.push([i0, i1, j0, j1, h0, h1])
    f = find2(a, b, n, 0, n, 0, n, (a, b) => a > b)
  }

  return blocks
}

export class EventEmitter<EventNames> {
  private callbacks = { } as { [E in keyof EventNames]: Function[] }

  on<E extends keyof EventNames>(evt: E, callback: (data: EventNames[E]) => void) {
    const cbs = this.callbacks[evt] || (this.callbacks[evt] = [ ])
    if (cbs.indexOf(callback) === -1) {
      cbs.push(callback)
    }
    return callback
  }

  off<E extends keyof EventNames>(evt: E, callback: (data: EventNames[E]) => void) {
    const cbs = this.callbacks[evt]
    if (cbs) {
      cbs.splice(cbs.indexOf(callback), 1)
    }
    return callback
  }

  emit<E extends keyof EventNames>(evt: E, data: EventNames[E]) {
    (this.callbacks[evt] || [ ]).forEach(cb => cb(data))
  }
}
