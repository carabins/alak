import molecule from "@alaq/molecule/index";
import app from "./app/index";
import session from "./session/index";
import {atomicNodes} from "@alaq/molecule/atomicNode";


class MultiModel {
  one = 1
  id: string | number
  target: object

  add() {
    // console.log("+?")
    this.one += 1
    // console.log("this.id:::",this.id)
    // console.log("add:::", this.one)
  }
}

const mmm = atomicNodes({model: MultiModel})


const topModel = molecule({
  atoms: {
    app,
    session
  },
  multi: {mmm}
})


export default topModel

