export default class {
  token: string
  sid: string
  get payload() {
    return {
      sid: this.sid,
      token: this.token,
    }
  }
}
