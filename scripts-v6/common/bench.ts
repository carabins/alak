export function bench() {
  const t = Date.now()
  return () => {
    const ms = Date.now() - t
    const sec = Math.floor(ms / 1000)
    return sec + '.' + ms + 's'
  }
}
