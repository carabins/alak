import Eternal from './eternal'

export default class extends Eternal {
  tasks = ['a', 'b']
  multiplex = 10

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
