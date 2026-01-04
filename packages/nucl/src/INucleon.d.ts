import IQuarkCore from "@alaq/quark/IQuarkCore";
import {IPluginsRegistry} from "@alaq/nucl/INucleonPlugin";

import {IDeepWatcher} from "@alaq/deep-state/tracker";
import {IDeepState} from "@alaq/deep-state/types";

export interface INucleonCore extends IQuarkCore {
  _isDeep?: boolean
  _isDeepAwake?: boolean
  _watcher?: IDeepWatcher
  _state?: IDeepState
  _reg: IPluginsRegistry
  _value: any
}
