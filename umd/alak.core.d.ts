import { installAtomExtension } from '../atom';
declare const A: import("../atom").IAtomCoreConstructor & {
    installExtension: typeof installAtomExtension;
};
export default A;
