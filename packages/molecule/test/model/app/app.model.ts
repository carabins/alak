export default class {
  startTime = Date.now()
  build = "1"

  get info() {
    return this.startTime + ":" + this.build
  }


  doSomething(){

  }

}
