export default class CountModel {
  count = 1

  get mixedCount() {
    return this.count * 100
  }

  increment() {
    console.warn('++')
    this.count = this.count + 1
  }
}
