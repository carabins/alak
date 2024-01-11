import {mixed, rune, saved} from '@alaq/atom/property'

export default class {
  tasks = ['a', 'b']
  multiplex = 10
  everCount =  12

  runedVar = mixed(saved(12), rune())
  someOtherVar = rune.some('+')

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
