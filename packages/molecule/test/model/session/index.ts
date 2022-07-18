import { events } from '../events'
import model from './session.model'
import eternal from './session.eternal'
import auth from './auth'
import view from './view'
import profile from './profile'
import { atomicNode } from '@alaq/molecule/atomicNode'

const sessionModel = atomicNode({
  model,
  eternal,
  // events,
  nodes: {
    auth,
    view,
    profile,
  },
  // startup: 'IMMEDIATELY',
  edges: [
    {
      from: 'auth.granted',
      to: 'auth.checkCodeHandler',
    },
  ],
  listen: {
    PROFILE_UPDATE: 'sessionHandler',
  },
  activate({ time }, q) {
    // console.log("session activate", )
  },
})

export default sessionModel
