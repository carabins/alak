import type {INucleonCore} from "@alaq/nucl/INucleon";
import type {INuOptions} from "@alaq/nucl/index";
import {createState} from "@alaq/deep-state";
import {IPluginsRegistry} from "@alaq/nucl/INucleonPlugin";

export function setupDeepState(n: INucleonCore, o: INuOptions, reg: IPluginsRegistry) {
  n._watcher = createState((value, from) => {
      console.log("state", value)
      reg.handleWatch(n, from)
    }
  )
  n._isDeep = true
}

export function firstWatch(n: INucleonCore, value: any) {
  n._isDeepAwake = true
  n._state = n._watcher.deepWatch(value)
}
