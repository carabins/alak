declare const Vue: any;
type Reactive<T> = typeof Vue.Reactive;
export declare function vueController<T>(c: {
    namespace?: string;
    name: string;
    model: T;
    sync?: boolean;
}): () => {
    state: Reactive<PureState<Instance<T>>>;
    core: IAtomCore<Instance<T>>;
};
export {};
