# @alaq/rune

Randomness and identifiers for the v6 ecosystem.

## Status

`6.0.0-alpha.0` — **unstable**. The surface is small and stable by shape, but signatures may still shift before 6.0.0 GA. Pin exact versions.

## What it is

`@alaq/rune` is the randomness primitive for the alaq stack. Crypto-backed random bytes, unbiased integers, a crypto-backed float, a non-mutating Fisher-Yates, and three flavours of identifier (UUID v7, ULID, nanoid) — plus one deterministic PRNG for tests and reproducible simulations. Zero runtime dependencies. Works in Node (>=20) and all modern browsers — one entry point, one build.

## Install

```sh
bun add @alaq/rune
```

```sh
npm install @alaq/rune
```

## API

### Randomness

```ts
import { randomBytes, randomInt, randomFloat } from '@alaq/rune'

randomBytes(32)        // Uint8Array(32) of crypto-random bytes
randomInt(0, 100)      // integer in [0, 100), no modulo-bias (rejection sampling)
randomFloat()          // float in [0, 1), backed by 4 crypto bytes
```

### Collections

```ts
import { pick, shuffle } from '@alaq/rune'

pick(['a', 'b', 'c'])        // one random element; throws on empty input
shuffle([1, 2, 3, 4, 5])     // new array, input untouched (non-mutating Fisher-Yates)
```

### Identifiers

```ts
import { uuidV7, ulid, nanoid } from '@alaq/rune'

uuidV7()                     // e.g. "018f3a7c-...-7xxx-8xxx-............"  (RFC 9562)
ulid()                       // e.g. "01HK8Z6S3N7...ABCDE"  (monotonic within the same ms)
nanoid()                     // 21 chars, URL-safe default alphabet
nanoid(10, 'ABC')            // length 10, custom alphabet, rejection-sampled (no bias)
```

### Seeded PRNG

```ts
import { createPRNG, type PRNG } from '@alaq/rune'

const rng: PRNG = createPRNG('seed')  // xoroshiro128+, deterministic
rng()                                  // float in [0, 1); same seed → same sequence
```

String seeds are hashed (FNV-1a → SplitMix64) to derive the two 64-bit state words. Numeric seeds go through the same mixer so neighbouring integers produce independent streams.

## Why these and not others

- **UUID v7 (not v4).** v7 is time-ordered by construction — the first 48 bits are the millisecond timestamp — so inserts don't thrash database B-trees the way random v4 does. Same uniqueness guarantees, better index locality.
- **ULID alongside v7.** Same idea (time prefix + randomness) but Crockford base-32 instead of hex, so a ULID is 26 chars instead of 36 and safer to read aloud. Also monotonic within a millisecond — consecutive calls in the same ms are strictly ordered, which UUID v7 doesn't guarantee by default.
- **nanoid.** Shorter than a UUID when you don't need a time prefix, URL-safe by default, and supports custom alphabets. The implementation uses rejection sampling on a bitmask so custom alphabets stay uniform — the common `% length` shortcut biases the distribution and this package doesn't ship that.
- **Not KSUID / Snowflake.** Overkill. KSUID needs a second-resolution epoch you'd rather not coordinate; Snowflake wants a worker-ID registry. If you've reached for either you're past what this package is for.
- **Not `isBrowser` / `isDefined`.** Environment sniffing and null checks aren't this package's job. Environment is picked once at module load inside `random.ts`; callers don't need to ask.

## Environment

The package chooses its random source once at import time:

1. `globalThis.crypto.getRandomValues` — modern Node (>=19) and every browser.
2. Node `require('crypto').randomBytes` — legacy Node fallback.
3. Otherwise: throws on the first `randomBytes` call with a clear message.

## Test

```sh
cd packages/rune && bun test
```

## License

Apache-2.0.
