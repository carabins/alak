import { PackageJson } from 'type-fest';
import { FileStatusResult } from 'simple-git/dist/typings/response';
export type Project = {
    packageJson: PackageJson;
    packagePath: string;
    artPatch: string;
    dir: string;
    id: string;
    changes: FileStatusResult[];
    copyToArt(filename: string): any;
    resolveInPackage(name: string): string;
    savePackageJsonTo: {
        artifacts(): void;
        source(): void;
    };
};
export declare function initProject(dir: any): false | Project;
//# sourceMappingURL=project.d.ts.map