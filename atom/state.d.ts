export declare const FState: {
    AWAIT: string;
    EMPTY: string;
};
export declare function notifyStateListeners(atom: any, state: string, ...value: any[]): void;
export declare function addStateEventListener(atom: any, state: any, fun: any): void;
export declare function removeStateEventListener(atom: any, state: string, fun: any): void;
