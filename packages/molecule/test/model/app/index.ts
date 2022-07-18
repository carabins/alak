import {atomicNode, atomicNodes} from "@alaq/molecule/atomicNode";
import model from "./app.model";
import counter from "./counter";
import {events} from "../events";





const appModel = atomicNode({
  model,
  eternal: model,
  nodes: {
    counter
  },
  edges: [
    {
      from: "startTime",
      to: "doSomething"
    }
  ],
  listen: {
    zz: "build"
  },
  activate() {
    console.log("activate time", this.startTime)
  }
})

export default appModel
