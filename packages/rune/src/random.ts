/**
 * Crypto-backed randomness primitives.
 *
 * Chooses a `randomBytes` implementation once at module load:
 *   1. `globalThis.crypto.getRandomValues` — modern Node (>=19) and all browsers.
 *   2. Node `require('crypto').randomBytes` — older Node fallback.
 *   3. Otherwise: throw on first call with a clear message.
 *
 * Everything else is built on top of `randomBytes`.
 */

type RandomBytesImpl = (n: number) => Uint8Array

const pickImpl = (): RandomBytesImpl => {
  // Prefer Web Crypto — available on modern Node and every browser.
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }
  if (g.crypto && typeof g.crypto.getRandomValues === 'function') {
    const getRandomValues = g.crypto.getRandomValues.bind(g.crypto)
    return (n: number) => {
      // getRandomValues has a 65536-byte per-call limit; chunk if needed.
      const out = new Uint8Array(n)
      const CHUNK = 65536
      for (let offset = 0; offset < n; offset += CHUNK) {
        const len = Math.min(CHUNK, n - offset)
        getRandomValues(out.subarray(offset, offset + len))
      }
      return out
    }
  }

  // Fallback: legacy Node — try `require('crypto')`.
  try {
    const req = (globalThis as { require?: (m: string) => unknown }).require
    if (typeof req === 'function') {
      const nodeCrypto = req('crypto') as { randomBytes?: (n: number) => Uint8Array }
      if (nodeCrypto && typeof nodeCrypto.randomBytes === 'function') {
        const nodeRandomBytes = nodeCrypto.randomBytes
        return (n: number) => {
          const buf = nodeRandomBytes(n) as Uint8Array & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }
          // Normalise Buffer → Uint8Array view over the same bytes.
          return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
        }
      }
    }
  } catch {
    // fall through
  }

  return () => {
    throw new Error(
      '@alaq/rune: no cryptographic random source available (need globalThis.crypto.getRandomValues or Node crypto.randomBytes)',
    )
  }
}

const impl: RandomBytesImpl = pickImpl()

/**
 * Fill and return `n` cryptographically random bytes.
 */
export const randomBytes = (n: number): Uint8Array => {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`randomBytes: n must be a non-negative integer, got ${n}`)
  }
  return impl(n)
}

/**
 * Read a uniformly-random Uint32 from the crypto source.
 */
const randomUint32 = (): number => {
  const b = randomBytes(4)
  // Big-endian assembly; endianness is irrelevant for uniformity.
  return ((b[0]! << 24) | (b[1]! << 16) | (b[2]! << 8) | b[3]!) >>> 0
}

/**
 * Uniform integer in `[min, max)`. Uses rejection sampling on a Uint32 to
 * avoid modulo-bias — values in the biased tail are discarded and resampled.
 *
 * @throws RangeError if `min >= max` or either bound is not a safe integer.
 */
export const randomInt = (min: number, max: number): number => {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new RangeError(`randomInt: bounds must be integers, got [${min}, ${max})`)
  }
  if (min >= max) {
    throw new RangeError(`randomInt: min must be < max, got [${min}, ${max})`)
  }
  const range = max - min
  if (range > 0x1_0000_0000) {
    throw new RangeError(`randomInt: range ${range} exceeds 2^32`)
  }
  // Largest multiple of `range` that fits in a Uint32. Anything above it
  // would bias the low buckets — reject and resample.
  const limit = Math.floor(0x1_0000_0000 / range) * range
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = randomUint32()
    if (r < limit) return min + (r % range)
  }
}

/**
 * Float in `[0, 1)`, crypto-backed. Same distribution shape as `Math.random`.
 * Takes a Uint32 of entropy and divides by 2^32.
 */
export const randomFloat = (): number => randomUint32() / 0x1_0000_0000
