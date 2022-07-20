/*
 * Copyright (c) 2022. Only the truth - liberates.
 */

import model from './account.model'
import eternal from './account.eternal'
import { atomicNode } from '@alaq/molecule/atomicNode'

export const accountModel = atomicNode({
  model,
  edges: [{ from: 'balance', to: 'balanceListener' }],
  listen: {
    asd: 'balanceListener',
  },
  activate({ afterListen }) {},
})

export default accountModel
export const accountCore = accountModel.core
export const accountState = accountModel.state
