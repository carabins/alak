export * from './isBrowser'
export * from './isDefined'

export function makeRune(length: number): string {
  let charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
    i,
    result = ''

  // Use crypto.getRandomValues if available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    let values = new Uint32Array(length)
    window.crypto.getRandomValues(values)
    for (i = 0; i < length; i++) {
      result += charset[values[i] % charset.length]
    }
    return result
  }

  // Fallback to Math.random
  result += charset[Math.floor(Math.random() * (charset.length - 10))]
  length--
  for (i = 0; i < length; i++) {
    result += charset[Math.floor(Math.random() * charset.length)]
  }
  return result
}
