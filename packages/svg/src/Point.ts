export default class Point {
  constructor(public x: number, public y: number) {}

  traceTo(radius, angle) {
    const x = radius * Math.sin((Math.PI * 2 * angle) / 360)
    const y = radius * Math.cos((Math.PI * 2 * angle) / 360)
    return new Point(this.x + Math.round(x * 100) / 100, this.y + Math.round(y * 100) / 100)
  }
}
