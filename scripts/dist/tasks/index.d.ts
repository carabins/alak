import { Project } from '~/scripts/common/project';
import { upver } from '~/scripts/tasks/task.upver';
import { buildWithRolldown } from '~/scripts/tasks/task.rolldown';
type ITaskProcess = (p: Project) => Promise<any>;
interface ISuperTasks {
    name?: string;
    pipeline: ITaskProcess[];
    prepare?(projects: Project[]): Promise<any>;
    finalize?(projects: Project[]): Promise<any>;
}
export declare const buildTask: {
    pipeline: (typeof upver)[];
};
export declare const xTask: {
    pipeline: (typeof upver)[];
};
export declare const rolldownTask: {
    pipeline: (typeof buildWithRolldown)[];
};
export declare function getTaskChoices(affectedStr: any): any;
export declare const getProjectChoices: (affectedObj: any, affectedStr: any) => any;
export declare function startTask(superTask: ISuperTasks, targetProjects: Project[]): Promise<void>;
export {};
//# sourceMappingURL=index.d.ts.map