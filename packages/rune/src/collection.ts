import { randomInt } from './random'

/**
 * Return one random element from `array`.
 * @throws Error on empty input — there is nothing to pick.
 */
export const pick = <T>(array: readonly T[]): T => {
  if (array.length === 0) {
    throw new Error('pick: cannot pick from an empty array')
  }
  return array[randomInt(0, array.length)]!
}

/**
 * Return a new array with the elements of `array` in random order.
 * Non-mutating: the input is left untouched. Uses Fisher-Yates with
 * `randomInt` so the shuffle is crypto-backed.
 */
export const shuffle = <T>(array: readonly T[]): T[] => {
  const out = array.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1)
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}
