import { test } from 'tap'
import { session } from './model/session'

test('idea', async (t) => {
  // console.log(session)
  // console.log(session)
  // session.actions.sessionHandler()

  session.actions.newSessionHandler()
  session.core.newTime
  session.core.sessionHandler()
  session.state.time
  session.state
})
