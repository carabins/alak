/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import aEternal from './account.eternal'
import { eternal } from '@alaq/atom/property'

export default class extends aEternal {
  balance = eternal<string>()

  test = eternal<string>()

  afterListen: string

  balanceListener(v) {
    this.afterListen = v
  }
}
