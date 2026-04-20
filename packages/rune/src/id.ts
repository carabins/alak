import { randomBytes } from './random'

// --- uuidV7 -----------------------------------------------------------------

const HEX = '0123456789abcdef'

const toHex = (bytes: Uint8Array, start: number, end: number): string => {
  let s = ''
  for (let i = start; i < end; i++) {
    const b = bytes[i]!
    s += HEX[b >>> 4]! + HEX[b & 0x0f]!
  }
  return s
}

/**
 * Time-ordered UUID v7 per RFC 9562.
 *
 * Layout: 48-bit unix_ts_ms | 4-bit version (7) | 12-bit rand_a |
 *         2-bit variant (10) | 62-bit rand_b. Output is the canonical
 * 36-character hyphenated hex string.
 */
export const uuidV7 = (): string => {
  const ts = Date.now()
  const rnd = randomBytes(10)
  const b = new Uint8Array(16)

  // 48-bit big-endian timestamp.
  b[0] = (ts / 2 ** 40) & 0xff
  b[1] = (ts / 2 ** 32) & 0xff
  b[2] = (ts >>> 24) & 0xff
  b[3] = (ts >>> 16) & 0xff
  b[4] = (ts >>> 8) & 0xff
  b[5] = ts & 0xff

  // 4-bit version (0111) + top 4 bits of rand_a.
  b[6] = 0x70 | (rnd[0]! & 0x0f)
  b[7] = rnd[1]!

  // 2-bit variant (10) + top 6 bits of rand_b.
  b[8] = 0x80 | (rnd[2]! & 0x3f)
  b[9] = rnd[3]!
  b[10] = rnd[4]!
  b[11] = rnd[5]!
  b[12] = rnd[6]!
  b[13] = rnd[7]!
  b[14] = rnd[8]!
  b[15] = rnd[9]!

  return (
    toHex(b, 0, 4) +
    '-' +
    toHex(b, 4, 6) +
    '-' +
    toHex(b, 6, 8) +
    '-' +
    toHex(b, 8, 10) +
    '-' +
    toHex(b, 10, 16)
  )
}

// --- ULID -------------------------------------------------------------------

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

// Monotonicity state: if called again within the same millisecond, the
// randomness is incremented so the resulting ULID is lexicographically greater.
let lastUlidTs = -1
let lastUlidRand: Uint8Array | null = null

const incrementBytes = (b: Uint8Array): void => {
  // Big-endian increment with carry. If the whole buffer overflows (all 0xff)
  // we wrap around — extremely unlikely with 80 bits inside a single ms.
  for (let i = b.length - 1; i >= 0; i--) {
    if (b[i]! === 0xff) {
      b[i] = 0
    } else {
      b[i] = b[i]! + 1
      return
    }
  }
}

/**
 * Encode `n` bytes as a Crockford base-32 string of exactly `charLen` chars.
 * Requires `charLen * 5 >= n * 8`. Top bits of the first byte are treated as
 * zero-padded if the bit-count doesn't divide evenly — which is how the ULID
 * 48-bit timestamp (→ 10 chars, 50 bits) and 80-bit randomness (→ 16 chars)
 * are laid out.
 */
const encodeCrockford = (bytes: Uint8Array, charLen: number): string => {
  // Treat `bytes` as a big-endian bit-string left-padded with zeros out to
  // charLen * 5 bits. Walk it 5 bits at a time.
  const totalBits = charLen * 5
  const bitOffset = totalBits - bytes.length * 8 // zero-pad on the left
  let out = ''
  for (let i = 0; i < charLen; i++) {
    const bitPos = i * 5 - bitOffset
    let v = 0
    for (let k = 0; k < 5; k++) {
      const p = bitPos + k
      if (p < 0 || p >= bytes.length * 8) continue
      const bit = (bytes[p >>> 3]! >>> (7 - (p & 7))) & 1
      v = (v << 1) | bit
    }
    out += CROCKFORD[v]!
  }
  return out
}

/**
 * Crockford base-32 ULID: 48-bit timestamp + 80-bit randomness, 26 chars.
 * Monotonic within the same millisecond — a second call in the same ms
 * increments the randomness so the resulting string sorts strictly after.
 */
export const ulid = (): string => {
  const ts = Date.now()

  let rand: Uint8Array
  if (ts === lastUlidTs && lastUlidRand) {
    // Same ms: bump the previous randomness.
    rand = new Uint8Array(lastUlidRand)
    incrementBytes(rand)
  } else {
    rand = randomBytes(10)
  }
  lastUlidTs = ts
  lastUlidRand = rand

  // 48-bit timestamp → 6 bytes big-endian.
  const tsBytes = new Uint8Array(6)
  tsBytes[0] = (ts / 2 ** 40) & 0xff
  tsBytes[1] = (ts / 2 ** 32) & 0xff
  tsBytes[2] = (ts >>> 24) & 0xff
  tsBytes[3] = (ts >>> 16) & 0xff
  tsBytes[4] = (ts >>> 8) & 0xff
  tsBytes[5] = ts & 0xff

  return encodeCrockford(tsBytes, 10) + encodeCrockford(rand, 16)
}

// --- nanoid -----------------------------------------------------------------

const DEFAULT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
const DEFAULT_LENGTH = 21

/**
 * Compute the smallest bitmask `2^k - 1 >= alphabetLength - 1`. We read `k`
 * bits per sample and reject any value `>= alphabetLength` — this keeps the
 * distribution uniform for any alphabet size (no modulo-bias).
 */
const bitmaskFor = (alphabetLength: number): number => {
  // k = ceil(log2(alphabetLength))
  let mask = 1
  while (mask < alphabetLength) mask = (mask << 1) | 1
  return mask
}

/**
 * URL-safe random identifier. Defaults: 21 chars over the 64-char alphabet
 * `A-Za-z0-9_-`. A custom alphabet is scaled correctly via rejection sampling
 * — no `% length` bias.
 */
export const nanoid = (length: number = DEFAULT_LENGTH, alphabet: string = DEFAULT_ALPHABET): string => {
  if (!Number.isInteger(length) || length < 0) {
    throw new RangeError(`nanoid: length must be a non-negative integer, got ${length}`)
  }
  if (alphabet.length < 2 || alphabet.length > 256) {
    throw new RangeError(`nanoid: alphabet must have between 2 and 256 chars, got ${alphabet.length}`)
  }
  if (length === 0) return ''

  const mask = bitmaskFor(alphabet.length)
  // A step of ~1.6 * length / efficiency bytes keeps the loop count low
  // without making small requests wasteful. Efficiency = alphabet.length / (mask + 1).
  const step = Math.ceil((1.6 * (mask + 1) * length) / alphabet.length)

  let out = ''
  while (true) {
    const bytes = randomBytes(step)
    for (let i = 0; i < step; i++) {
      const v = bytes[i]! & mask
      if (v < alphabet.length) {
        out += alphabet[v]
        if (out.length === length) return out
      }
    }
  }
}
