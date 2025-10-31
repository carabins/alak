// Main entry point for build scripts - integrates new build-system
import select from '@inquirer/select';
import checkbox from '@inquirer/checkbox';
import { Builder } from './core/Builder.js';
import { createContext } from './core/Context.js';
import { ConsoleReporter } from './reporters/ConsoleReporter.js';
import { projects } from './now.js';
import { getAffected } from './common/git.js';
import { coverageTest, testProjects } from './tasks/task.test.js';
import { bench } from './common/bench.js';
import { Log } from './log/index.js';
async function start() {
    console.clear();
    const fullBench = bench();
    const allProjects = Object.values(projects);
    const affectedList = await getAffected();
    const affectedObj = affectedList.map((id) => projects[id]);
    const affectedStr = affectedList.join(', ');
    console.log(`
      o
       o
     ___
     | |
     | |
     |o|
    .' '.
   /  o  \\
  :____o__:
  '._____.'`);
    // Quick commands
    switch (process.argv[2]) {
        case 'test':
            return testProjects(allProjects);
        case 'cover':
            return coverageTest();
    }
    // Select task
    const selectedTask = await select({
        message: 'Select a task',
        choices: [
            {
                name: 'build (new system)',
                description: 'Build packages with new build-system (HIGH STRICTNESS)',
                value: 'build-new'
            },
            {
                name: 'test',
                description: 'Run tests for all packages',
                value: 'test'
            },
            {
                name: 'test + coverage',
                description: 'Run tests with coverage report',
                value: 'coverage'
            },
        ]
    });
    // Execute selected task
    switch (selectedTask) {
        case 'build-new':
            await buildWithNewSystem();
            break;
        case 'test':
            await testProjects(allProjects);
            break;
        case 'coverage':
            await coverageTest();
            break;
    }
    Log.info('total time', fullBench());
}
/**
 * Build packages using new build-system
 */
async function buildWithNewSystem() {
    console.log('\n');
    // Select packages to build
    const selectedMode = await select({
        message: 'Select packages',
        choices: [
            { name: 'All packages', value: 'all' },
            { name: 'Select manually', value: 'manual' },
        ]
    });
    let selectedPackages = [];
    if (selectedMode === 'all') {
        selectedPackages = Object.keys(projects);
    }
    else {
        const choices = Object.values(projects).map((p) => ({
            name: p.packageJson.name || p.id,
            description: p.packageJson.description,
            value: p.id,
            checked: false
        }));
        selectedPackages = await checkbox({
            message: 'Select packages to build',
            choices,
            pageSize: 15
        });
    }
    if (selectedPackages.length === 0) {
        Log.error('No packages selected');
        return;
    }
    console.log(`\nBuilding ${selectedPackages.length} packages...\n`);
    // Build each package
    for (const pkgId of selectedPackages) {
        const project = projects[pkgId];
        const packagePath = project.packagePath;
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Building: ${project.packageJson.name || pkgId}`);
        console.log('='.repeat(60));
        try {
            // Create build context
            const context = await createContext(packagePath);
            // Create builder
            const builder = new Builder(context);
            // Setup console reporter
            const reporter = new ConsoleReporter();
            reporter.listen(builder);
            // Run build
            const result = await builder.build();
            // Print result
            reporter.printResult(result);
            if (!result.success) {
                Log.error(`Build failed for ${project.packageJson.name}`);
                // Ask if continue
                const shouldContinue = await select({
                    message: 'Build failed. Continue with other packages?',
                    choices: [
                        { name: 'Yes, continue', value: true },
                        { name: 'No, stop', value: false }
                    ]
                });
                if (!shouldContinue) {
                    process.exit(1);
                }
            }
        }
        catch (error) {
            Log.error(`Build error for ${pkgId}:`, error.message);
            console.error(error);
            // Ask if continue
            const shouldContinue = await select({
                message: 'Build error. Continue with other packages?',
                choices: [
                    { name: 'Yes, continue', value: true },
                    { name: 'No, stop', value: false }
                ]
            });
            if (!shouldContinue) {
                process.exit(1);
            }
        }
    }
    console.log(`\n${'='.repeat(60)}`);
    console.log('All builds completed!');
    console.log('='.repeat(60));
}
start().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map