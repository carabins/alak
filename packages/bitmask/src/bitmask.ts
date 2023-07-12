const bitToNum = (bitmask: AlakBitMask<any> | number): number => {
  if (typeof bitmask === 'number') {
    return bitmask
  } else {
    return bitmask.flags
  }
}

export class AlakBitMask<T extends Record<string, number>> {
  constructor(public flags: number, public masks: T) {}

  is(n): boolean {
    return (this.flags & n) === n
  }

  isNot(n): boolean {
    return (this.flags & n) !== n
  }
  removeFlag(flagName: keyof T) {
    return this.remove(this.bitsFromFlagName(flagName))
  }
  remove(bits: number) {
    if (this.is(bits)) {
      this.flags = this.flags ^ bits
      return true
    }
    return false
  }

  private bitsFromFlagName(flagName) {
    const flagValue = this.masks[flagName]
    if (flagValue) {
      return flagValue
    } else {
      console.error('FLAG', flagName, 'not found in', this.masks)
      throw 'UNKNOWN FLAG'
    }
  }

  toggle(bits: number) {
    return (this.flags = this.flags ^ bits)
  }
  toggleFlag(flagName: string) {
    return this.toggle(this.bitsFromFlagName(flagName))
  }
  addFlag(flagName: string) {
    return this.add(this.bitsFromFlagName(flagName))
  }

  add(bits: number) {
    if (this.isNot(bits)) {
      this.flags = this.flags | bits
      return true
    }
    return false
  }

  public binary(bits: 8 | 16 | 24 | 32 = 8): string {
    return '0b' + (this.flags >>> 0).toString(2).padStart(bits, '0')
  }
}
