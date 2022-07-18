import {atomicNode} from "@alaq/molecule/atomicNode";
import model from "./counter.model";
import eternal from "./counter.eternal";

export default atomicNode({
  model,
  eternal,
  activate({counterZ}){

  }
})
