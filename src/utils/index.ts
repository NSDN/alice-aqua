export function queryStringSet(query: string, dict: any) {
  return query.replace(/^\?/, '').split('&')
    .filter(pair => !(pair.split('=').shift() in dict))
    .concat(Object.keys(dict).map(key => key + '=' + encodeURIComponent(dict[key])))
    .filter(pair => pair)
    .join('&')
}

export function queryStringGet(query: string, key: string) {
  return query.split('&')
    .concat(key + '=')
    .find(pair => pair.startsWith(key + '=')).split('=').map(decodeURIComponent)
    .pop()
}

export function randomBytes(size = 4) {
  return Array(size * 2).fill(0).map(_ => Math.floor(Math.random() * 16).toString(16)).join('')
}

export function camelCaseToHyphen(str: string) {
  return str.replace(/[a-z][A-Z]{1}/g, m => m[0] + '-' + m[1].toLowerCase())
}

export function arrayRange(begin: number, end: number) {
  return Array(end - begin).fill(begin).map((b, i) => b + i)
}

export function randomRange(begin: number, end: number) {
  return Math.random() * (end - begin) + begin
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

export function compressWithRLE(array: number[]) {
  const packed = [ ] as number[]
  for (let i = 0, a = NaN; i < array.length; i ++) {
    array[i] === a ?
      packed[packed.length - 1] ++ :
      packed.push(a = array[i], 1)
  }
  return packed
}

export function extractWithRLE(packed: number[]) {
  const array = [ ] as number[]
  for (let i = 0; i < packed.length; i += 2) {
    const a = packed[i], n = packed[i + 1]
    array.push.apply(array, Array(n).fill(a))
  }
  return array
}

export function queue() {
  let running = null as {
    start: () => Promise<any>
    resolve: Function
    reject: Function
  }
  const waiting = [ ] as (typeof running)[]
  const exec = () => {
    running = waiting.shift()
    running && running.start()
        .then(r => (running.resolve(r), exec()))
        .catch(e => (running.reject(e), exec()))
  }
  return <T>(start: () => Promise<T>) => new Promise((resolve, reject) => {
    waiting.push({ start, resolve, reject })
    running || exec()
  })
}

export function promiseObject<T>() {
  let resolve = null as Function,
    reject = null as Function,
    promise = new Promise<T>((res, rej) => [resolve, reject] = [res, rej])
  return { resolve, reject, promise }
}

export function step(fn: (p: () => Promise<any>) => Promise<any>) {
  const start = promiseObject(), stop = promiseObject()
  const done = fn(async () => {
    start.resolve()
    await stop.promise
  })
  return async () => {
    await start.promise
    stop.resolve()
    return done
  }
}

export async function sleep(delay: number) {
  await new Promise(resolve => setTimeout(resolve, delay))
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

export function deepClone<T>(obj: T) {
  return JSON.parse(JSON.stringify(obj)) as T
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
    return () => cbs.splice(cbs.indexOf(callback), 1)
  }

  off<E extends keyof EventNames>(evt: E, callback: (data: EventNames[E]) => void) {
    const cbs = this.callbacks[evt]
    if (cbs) {
      cbs.splice(cbs.indexOf(callback), 1)
    }
  }

  emit<E extends keyof EventNames>(evt: E, data: EventNames[E]) {
    (this.callbacks[evt] || [ ]).slice().forEach(cb => cb(data))
  }
}
