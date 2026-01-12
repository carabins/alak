export declare const isString: (p: any) => p is string;
export declare const cloudProxy: {
    nuclear: (valence: Record<string, any>, core: IDeepAtomCore<any>) => {
        valence: Record<string, any>;
        core: IDeepAtomCore<any>;
    };
    warpNucleonGetter: (getter: any, core: any) => {
        getter: any;
        core: any;
    };
    warp: (shell: any, core: any) => any;
    state: (atom: any) => any;
};
