export default class Point {
  constructor(
    public x = 0,
    public y = 0, // public w = 0,
  ) {
    // public h = 0,
  }

  traceTo(radius, angle) {
    const x = radius * Math.sin((Math.PI * 2 * angle) / 360)
    const y = radius * Math.cos((Math.PI * 2 * angle) / 360)
    return new Point(this.x + Math.round(x * 100) / 100, this.y + Math.round(y * 100) / 100)
  }

  // get center() {
  //   return new Point(this.h / 2, this.w / 2)
  // }
}

export class Rect {
  constructor(
    public x = 0,
    public y = 0,
    public w = 0,
    public h = 0,
  ) {}

  center() {
    return new Point(this.w / 2, this.h / 2)
  }
}
