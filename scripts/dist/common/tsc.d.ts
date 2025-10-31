import { scanAllSrc } from '~/scripts/common/scan';
declare const state: {
    sources: UnpackedFnArgs<typeof scanAllSrc>;
    ready: boolean;
    declarations: Record<string, any>;
};
export declare function runTsc(): Promise<typeof state>;
export {};
//# sourceMappingURL=tsc.d.ts.map