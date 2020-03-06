import { FlowHandlers } from './index';
export declare const coreProps: {
    isEmpty: {
        get(): boolean;
    };
};
export declare const proxyProps: {
    value(): any;
    isEmpty(): boolean;
    uid(): any;
    id(): any;
    name(): any;
    isAsync(): any;
    isAwaiting(): boolean;
};
export declare const handlers: FlowHandlers;
