import { external } from '@alaq/atom/property'

export default class {
  tasks = ['a', 'b']
  multiplex = 10
  everCount = 12

  someOtherVar = external.some('+')

  addEverCount(v) {
    this.everCount += v
  }
  get taskCount() {
    return this.tasks ? this.tasks.length : 0
  }

  get multiCount() {
    // console.log('multiCount', this.multiplex, this.taskCount)
    return this.multiplex * this.taskCount
  }

  multiMethod() {
    return this.multiCount
  }
}
