import { publish } from '~/scripts/tasks/task.publish';
import { syncDeps } from '~/scripts/tasks/task.syncDeps';
import { coverageTest, testProjects } from '~/scripts/tasks/task.test';
import { compile } from '~/scripts/tasks/task.compile';
import { upver } from '~/scripts/tasks/task.upver';
import { dev } from '~/scripts/tasks/task.dev';
import { projects } from '~/scripts/now';
import { commitAndPush } from '~/scripts/tasks/task.commitAndPush';
import { Log } from '~/scripts/log';
import { bench } from '~/scripts/common/bench';
import { browser } from '~/scripts/tasks/task.browser';
import { buildWithRolldown } from '~/scripts/tasks/task.rolldown';
export const buildTask = {
    // prepare: testProjects,
    pipeline: [upver, syncDeps, browser, compile],
    // pipeline: [ compile ],
};
export const xTask = {
    pipeline: [syncDeps, buildWithRolldown, publish, upver],
};
export const rolldownTask = {
    // prepare: testProjects,
    pipeline: [buildWithRolldown],
};
export function getTaskChoices(affectedStr) {
    const publishPipeline = [upver, syncDeps, compile, publish];
    return [
        // {
        //   name: "build & publish changes (" + affectedStr + ")",
        //   description: "build & push to npm ",
        //   value: {
        //     affected: true,
        //     prepare: testProjects,
        //     pipeline:  [ upver, syncDeps, compile, browser, publish],
        //     // finalize: commitAndPush
        //   }
        // },
        {
            name: 'publish changes (' + affectedStr + ')',
            description: 'push to npm and git new version',
            value: {
                affected: true,
                prepare: testProjects,
                pipeline: publishPipeline,
                // finalize: commitAndPush
            },
        },
        {
            name: 'select for publish',
            description: 'select packages and push to npm and git new version',
            value: {
                selectProjectsDialog: true,
                prepare: testProjects,
                pipeline: publishPipeline,
                // finalize: commitAndPush
            },
        },
        {
            name: 'commit and push to git',
            description: 'just push to git',
            value: {
                prepare: testProjects,
                finalize: commitAndPush,
            },
        },
        // {
        //   name: 'build',
        //   description: 'local compile bundles',
        //   value: {
        //     prepare: testProjects,
        //     pipeline: [upver, syncDeps, compile, browser],
        //   },
        // },
        {
            name: 'rolldown',
            description: 'build with Rolldown (new bundler)',
            value: {
                selectProjectsDialog: true,
                pipeline: [buildWithRolldown],
            },
        },
        {
            name: 'dev',
            description: 'run test on changes',
            value: {
                finalize: dev,
            },
        },
        {
            name: 'test',
            description: 'fast test',
            value: {
                finalize: testProjects,
            },
        },
        {
            name: 'test + report',
            description: 'coverage test',
            value: {
                finalize: coverageTest,
            },
        },
    ].map((o) => {
        o.value['name'] = o.name;
        return o;
    });
}
export const getProjectChoices = (affectedObj, affectedStr) => {
    return [
        {
            name: 'affected (' + affectedStr + ')',
            description: 'Filesystem changes with GIT',
            value: affectedObj,
        },
        {
            name: 'custom',
            description: 'manual select',
            value: false,
        },
        {
            name: 'all',
            description: 'all',
            value: projects,
        },
    ];
};
export async function startTask(superTask, targetProjects) {
    // console.clear()
    if (!targetProjects?.length) {
        Log.error('Проекты не выбраны');
        return;
    }
    Log.info('start pipeline for supertask : ' + superTask.name);
    const b = bench();
    superTask.prepare && (await superTask.prepare(targetProjects));
    targetProjects.forEach((p) => { });
    if (superTask.pipeline?.length) {
        for (const task of superTask.pipeline) {
            Log.info('start task : ' + task.name);
            await Promise.all(targetProjects.map(task)).catch((e) => {
                Log.error({ e });
            });
        }
    }
    superTask.finalize && (await superTask.finalize(targetProjects));
    Log.info('finish at', b());
}
//# sourceMappingURL=index.js.map