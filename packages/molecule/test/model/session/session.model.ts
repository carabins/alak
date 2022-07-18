export default class {
  time = Date.now()
  sessionHandlerDone: boolean

  sessionHandler() {
    this.sessionHandlerDone = true
  }
}
