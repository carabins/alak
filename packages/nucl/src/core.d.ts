import {InternalQuark} from "@alaq/quark/types/IQuarkSystem";
import {PluginsRegistry} from "../types";

export default interface INucleusQuark<T> extends InternalQuark<T> {
  _value: T
  _proxy: T
  _reg: PluginsRegistry
}
