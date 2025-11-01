import {Atom} from "@alaq/atom";

class ArrayModel {
  items: number[] = [1, 2, 3]

  get count() {
    return this.items.length
  }

  get total() {
    // console.log("count", this.count)
    return this.items.reduce((sum, item) => sum + item, 0)
  }

  get average() {
    // console.log(this.count, this.total, this.total / this.count)
    // console.log('+', this.total, this.count)
    return this.count > 0 ? this.total / this.count : 0
  }

  addItem(n: number) {
    this.items.push(n)
  }
}

const model = Atom(ArrayModel)


console.log(model.core.items.id, model.core.count.uid)

console.log(model.core.count)
expect(model.state.count).toBe(3)
expect(model.state.total).toBe(6) // 1 + 2 + 3
console.log(model.core.state.uid)
expect(model.state.average).toBe(2) // 6 / 3
//
// // To make the array reactive, we need to update the whole array reference
// // rather than mutating the existing array
model.state.items = [1, 2, 3, 4]
expect(model.state.count).toBe(4)
console.log(model.core.items.id, model.core.count.uid)
expect(model.state.total).toBe(10) // 1 + 2 + 3 + 4
// console.log(model.state.average)
console.log(model.core.items.id, model.core.count.uid)
expect(model.state.average).toBe(2.5) // 10 / 4

console.log(model.core.items.id, model.core.count.uid)
