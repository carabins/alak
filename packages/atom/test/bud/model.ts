export default class {
  tasks = ['a', 'b']
  multiplex = 10
  everCount = 12

  addEverCount(v) {
    this.everCount += v
  }
  get taskCount() {
    return this.tasks ? this.tasks.length : 0
  }

  get multiCount() {
    console.log('multiCount', this.multiplex, this.taskCount)
    return this.multiplex * this.taskCount
  }

  get globalCount() {
    return this.everCount
  }

  global() {
    return this.globalCount
  }
}
