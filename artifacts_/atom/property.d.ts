export declare const savedSym: unique symbol;
export declare const finiteSym: unique symbol;
export declare const tagSym: unique symbol;
export declare const statelessSym: unique symbol;
export declare const mixedSym: unique symbol;
export declare const wrapSym: unique symbol;
export declare const tag: {
    <T>(startValue?: T): T;
    [s: string]: <T>(startValue?: T) => T;
};
export declare function saved<T>(startValue?: T): T;
export declare function mixed<T>(...a: any[]): T;
export declare function stateless<T>(startValue?: T): T;
export declare function finite<T>(startValue?: T): T;
export declare function wrap<T, B>(wrapper: (v: T) => B, startValue?: T): B;
