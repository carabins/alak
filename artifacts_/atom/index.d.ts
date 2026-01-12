/// <reference path="types.d.ts" />
import cloudCreate from './cloud.create';
export * from './property';
export * from './storage';
export declare const savedAtom: <T>(name: string, model: T) => IAtom<T>;
export declare const coreAtom: <T>(model: T) => IAtomCore<ClassToKV<T>>;
export declare const Atom: typeof cloudCreate;
export declare const A: typeof cloudCreate;
export declare class MultiAtomic {
    id: string | any;
}
