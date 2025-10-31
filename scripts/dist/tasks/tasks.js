import { compile } from './task.compile';
import { buildWithRolldown } from './task.rolldown';
import { test } from './task.test';
import { publish } from './task.publish';
import { browser } from './task.browser';
import { cover } from './task.cover';
/**
 * Доступные задачи сборки
 */
export const tasks = {
    compile: {
        name: 'compile',
        description: 'Compile with oxc-transform (current)',
        fn: compile,
    },
    rolldown: {
        name: 'rolldown',
        description: 'Build with Rolldown (new, experimental)',
        fn: buildWithRolldown,
    },
    test: {
        name: 'test',
        description: 'Run tests with bun:test',
        fn: test,
    },
    cover: {
        name: 'cover',
        description: 'Run tests with coverage',
        fn: cover,
    },
    publish: {
        name: 'publish',
        description: 'Publish to npm',
        fn: publish,
    },
    browser: {
        name: 'browser',
        description: 'Build browser bundle',
        fn: browser,
    },
};
/**
 * Алиасы для задач
 */
export const taskAliases = {
    build: 'compile', // default build
    rd: 'rolldown',
    t: 'test',
    p: 'publish',
    b: 'browser',
    c: 'cover',
};
/**
 * Получить задачу по имени или алиасу
 */
export function getTask(nameOrAlias) {
    const taskName = taskAliases[nameOrAlias] || nameOrAlias;
    return tasks[taskName];
}
/**
 * Получить список всех задач
 */
export function getTaskList() {
    return Object.values(tasks);
}
//# sourceMappingURL=tasks.js.map