export declare const QState: {
    AWAIT: string;
    CLEAR: string;
};
export declare const ClearState: {
    VALUE: string;
    DECAY: string;
};
export declare function dispatchEvent(quark: any, state: string, ...value: any[]): void;
export declare function addEventListener(quark: any, state: any, fun: any): void;
export declare function removeEventListener(quark: any, state: string, fun: any): void;
export declare function removeListener(quark: any, fun: any): void;
