/**
 * Расширение атома для vue
 * @remarks
 * @packageDocumentation
 */
import { UnwrapNestedRefs } from '@vue/reactivity';
export declare function vueNucleon<T = any>(n: INucleus<T>): any;
export declare function watchVueNucleon<T = any>(n: INucleus<T>): any;
export default function vueAtom<M>(atom: IAtom<M> | IUnionAtom<M, any>): UnwrapNestedRefs<ClassToKV<M>>;
export declare function watchVueAtom<M>(atom: IAtom<M> | IUnionAtom<M, any>): UnwrapNestedRefs<ClassToKV<M>>;
