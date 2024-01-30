import { mixed, tag, saved } from '@alaq/atom/property'

export default class {
  tasks = ['a', 'b']
  multiplex = 10
  everCount = 12

  taggedVar = mixed(saved, tag, 12)
  someOtherVar = tag.some('+')

  addEverCount(v) {
    this.everCount += v
  }
  get taskCount() {
    return this.tasks ? this.tasks.length : 0
  }

  get multiCount() {
    return this.multiplex * this.taskCount
  }

  multiMethod() {
    return this.multiCount
  }
}
