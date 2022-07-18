import model from './profile.model'
import { events } from '../../events'
import {atomicNode} from '@alaq/molecule/atomicNode'

export default atomicNode({
  model,
  eternal: '*',
  events,
  listen: {
    PROFILE_UPDATE: 'onProfileUpdateHandler',
  },
})
