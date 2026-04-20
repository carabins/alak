/**
 * Seeded PRNG — xoroshiro128+.
 *
 * Deterministic: `createPRNG("foo")` produces the same sequence every run.
 * A string seed is hashed with FNV-1a (64-bit variant, split into two 32-bit
 * halves) to derive the two 64-bit state words. A numeric seed is splat
 * through the same mixer so neighbouring integers don't produce correlated
 * streams.
 */

export type PRNG = () => number

// --- 64-bit arithmetic via BigInt -------------------------------------------
// Using BigInt keeps the code short and unambiguous. Perf is fine for our
// purposes (xoroshiro calls are cheap).

const MASK64 = (1n << 64n) - 1n

const rotl = (x: bigint, k: bigint): bigint =>
  (((x << k) & MASK64) | (x >> (64n - k))) & MASK64

// --- FNV-1a 64-bit ----------------------------------------------------------

const FNV_OFFSET = 0xcbf29ce484222325n
const FNV_PRIME = 0x00000100000001b3n

const fnv1a64 = (s: string): bigint => {
  let h = FNV_OFFSET
  for (let i = 0; i < s.length; i++) {
    // XOR with code unit (16-bit); good enough — we just need spread.
    h = (h ^ BigInt(s.charCodeAt(i))) & MASK64
    h = (h * FNV_PRIME) & MASK64
  }
  return h
}

// SplitMix64 — the canonical way to derive multiple independent 64-bit state
// words from a single seed value. Reference: Vigna, "Further scramblings".
const splitmix64 = (s: bigint): [bigint, bigint] => {
  let x = s & MASK64
  const next = (): bigint => {
    x = (x + 0x9e3779b97f4a7c15n) & MASK64
    let z = x
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64
    return (z ^ (z >> 31n)) & MASK64
  }
  return [next(), next()]
}

const seedToState = (seed: number | string): [bigint, bigint] => {
  const base = typeof seed === 'string' ? fnv1a64(seed) : BigInt(Math.trunc(seed))
  let [a, b] = splitmix64(base)
  // xoroshiro128+ requires non-zero state.
  if (a === 0n && b === 0n) a = 1n
  return [a, b]
}

/**
 * Create a deterministic PRNG from `seed`. Each call returns a float in
 * `[0, 1)`. Algorithm: xoroshiro128+ (Blackman & Vigna). State is derived
 * from the seed via SplitMix64 (numeric seed) or FNV-1a → SplitMix64 (string
 * seed).
 */
export const createPRNG = (seed: number | string): PRNG => {
  let [s0, s1] = seedToState(seed)

  return () => {
    const result = (s0 + s1) & MASK64
    const s1x = s1 ^ s0
    s0 = rotl(s0, 24n) ^ s1x ^ ((s1x << 16n) & MASK64)
    s1 = rotl(s1x, 37n)
    // Take the top 53 bits (safe-integer span) and divide by 2^53.
    // `Number(result >> 11n)` fits in a JS safe integer.
    return Number(result >> 11n) / 2 ** 53
  }
}
