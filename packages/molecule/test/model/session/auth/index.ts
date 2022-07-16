import model from './auth.model'
import eternal from './auth.eternal'
import { events } from './../../events'
import atomicNode from '@alaq/molecule/atomicNode'

export default atomicNode({
  model,
  eternal,
  edges: [
    {
      from: 'granted',
      to: 'checkToken',
    },
  ],
  events,
  listen: {
    AUTH_NEW_CODE: 'checkCodeHandler',
  },
})
