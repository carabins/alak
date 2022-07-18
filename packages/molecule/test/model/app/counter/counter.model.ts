import eternal from './counter.eternal'

export default class extends eternal {
  countA: number = 0
  countB = 0



  get totalCount(){
    return this.countA + this.countB
  }

  addACount() {
    this.countA += 1
  }
}
