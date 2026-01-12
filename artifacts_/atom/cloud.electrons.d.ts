export default class CloudElectrons {
    getNucleon: AnyFunction;
    getters: {};
    actions: {};
    instaValues: {};
    savedKeys: any[];
    core: any;
    state: any;
    constructor(getNucleon: AnyFunction, cloud: any);
    addEternals(keys: String[]): void;
}
