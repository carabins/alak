import { installAtomExtension } from '../atom';
declare const A: import("../atom").AtomCoreConstructor & {
    installExtension: typeof installAtomExtension;
};
export default A;
