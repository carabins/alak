import { randomBytes } from 'crypto'

export * from './isBrowser'
export * from './isDefined'

export function makeRune(length: number): string {
  // Use Node.js crypto for better randomness
  return Buffer.alloc(length, randomBytes(length)).toString('hex')
}
