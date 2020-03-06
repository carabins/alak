import { Core } from '../atom';
export declare type AtomSnap = [number, string, string, string[], any, number];
export declare function atomSnapshot(atom: Core): AtomSnap;
