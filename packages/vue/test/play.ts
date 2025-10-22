import {vueController} from "../src";
import {UnionModel} from "alak/index";
import {watch} from "vue";

class model extends UnionModel<any> {
  one = 1
  two: number

  doIt() {
    this.two = 2
  }

  _one_up(v) {
    this.two = this.two * v
  }

  setA20() {
    this._.cores.a.one(10)
  }
}


const bc = vueController({
  name: "b", model,
  namespace: 'vue_test',
  sync: true
})
const ac = vueController({
  name: "a", model,
  namespace: 'vue_test',
  sync: true
})
const b = bc()
watch(() => b.state.one, v => {
  console.log("watch", v)
})

b.core.one(10)
// const b2 = bc()
b.state.one = 100
b.state.two = 2
console.log("::::", b.core.two.value)
b.core.two.up(v=>{
  console.log(":::", v)
})




