/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import accountModel, { accountState } from './model/account'

let i = 0
let z = setInterval(() => {
  i++
  accountModel.core.test({
    i,
  } as any)
  if (i > 240) {
    clearInterval(z)
  }
}, 10)
