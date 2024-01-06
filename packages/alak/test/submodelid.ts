import {UnionAtom, UnionModel} from "alak/index";

class ParentModel extends UnionModel<"defaultUnion"> {
  get parentCallChild() {
    return this['birds'] as number
  }
  get parentName() {
    return this._
  }

}

class BaseModel extends ParentModel {
  birds = 10
  add() {
    this.birds++
  }

  get parentValue() {
    return this.parentCallChild
  }
  // oneReturnMethod() {
  //   // return this.parentOne
  // }
  // constructor(...a) {
  //   super()
  //   // console.log('constructor', a)
  // }

  onEventHelloWorld(data) {
    // console.log(this._.name, 'hi event', data)
  }
}
const a = UnionAtom({
  name:"a",
  model:BaseModel
})

// console.log("::", a.core.birds)
// console.log("::parentCallChild", a.state.parentCallChild)
// console.log("::", a.state.parentname)



