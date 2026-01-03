import {INucleonPlugin} from "@alaq/nucl/INucleonPlugin";
import {INucleonCore} from "@alaq/nucl/INucleon";
import INucleusCore from "@alaq/nucl/core";


const vueNuclPlugin: INucleonPlugin = {
  name: 'vue-nucl-plugin',
  deepWatch(n: INucleusCore<any>, f) {

    console.log(f.type, f.path, f.target, f.value,)

  }
}
