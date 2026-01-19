export const nextTick = (callback) => {
  if (typeof callback !== 'function') return
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback)
    return
  }
  Promise.resolve().then(callback)
}

export default {
  nextTick,
}
