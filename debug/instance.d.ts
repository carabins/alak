export declare type AtomLog = [number, string, number, any, string, string, string[], number, string?];
export declare function debugInstance(): {
    controller: {
        startCollect(): void;
        stopCollect(): AtomLog[];
        onRecord(recordListener: (log: AtomLog) => void): void;
    };
    receiver(event: string, atom: any, ...context: any[]): void;
};
