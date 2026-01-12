/** @internal */
export declare function from(...fromNucleons: INucleus<any>[]): {
    some: (mixFn: any) => INucleus<any>;
    weak: (f: any) => INucleus<any>;
    strong: (f: any) => INucleus<any>;
};
