import { Core } from './index';
declare type AnyFunction = {
    (...v: any[]): any;
};
export declare const debug: {
    enabled: boolean;
    updateAsyncStart(atom: Core, context?: string): any;
    updateAsyncFinish(atom: Core): any;
    updateValue(atom: Core, context: string): any;
};
export declare function setAtomValue(atom: Core, value: any, context?: any): any;
export declare function notifyChildes(atom: Core): void;
export declare function grandUpFn(atom: Core, keyFun: AnyFunction, grandFun: AnyFunction): any;
export declare const createCore: (...a: any[]) => any;
export {};
