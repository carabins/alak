import type { Project } from '../common/project';
export type TaskFunction = (project: Project) => Promise<void>;
export interface TaskDefinition {
    name: string;
    description: string;
    fn: TaskFunction;
}
/**
 * Доступные задачи сборки
 */
export declare const tasks: Record<string, TaskDefinition>;
/**
 * Алиасы для задач
 */
export declare const taskAliases: Record<string, string>;
/**
 * Получить задачу по имени или алиасу
 */
export declare function getTask(nameOrAlias: string): TaskDefinition | undefined;
/**
 * Получить список всех задач
 */
export declare function getTaskList(): TaskDefinition[];
//# sourceMappingURL=tasks.d.ts.map