export declare const alive: (v: any) => boolean;
export declare const isTruth: (v: any) => boolean;
export declare const noneFilter: (f: any) => (v: any) => any;
export declare const someFilter: (f: any) => (v: any) => any;
export declare const trueFilter: (f: any) => (v: any) => any;
export declare const someFalseFilter: (f: any) => (v: any) => any;
export declare const falseFilter: (f: any) => (v: any) => any;
export declare const DECAY_ATOM_ERROR = "Attempt to pass into the decayed atom";
export declare const PROPERTY_ATOM_ERROR = "undefined atom property";
export declare const AtomContext: {
    direct: string;
    getter: string;
    fmap: string;
};
export declare const deleteParams: (o: any) => void;
export declare function isPromise(obj: any): boolean;
