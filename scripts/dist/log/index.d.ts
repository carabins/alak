type Levels = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
type LogCall = {
    (...info: any[]): void;
};
type LevelCalls = {
    [K in Levels]: LogCall;
};
type ProxyLoger = LevelCalls & LogCall;
export declare const Log: ProxyLoger;
export declare function FileLog(filename: any): ProxyLoger;
export {};
//# sourceMappingURL=index.d.ts.map