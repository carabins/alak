import molecule from '@alaq/molecule/index'
import account from './account'

const topModel = molecule({
  atoms: {
    account,
  },
  multi: {},
})

export default topModel
