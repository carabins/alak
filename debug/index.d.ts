export declare const installAtomDebuggerTool: {
    default(options?: {
        port: number;
    }): void;
    host(): void;
    instance(): {
        startCollect(): void;
        stopCollect(): import("./instance").AtomLog[];
        onRecord(recordListener: (log: import("./instance").AtomLog) => void): void;
    };
};
