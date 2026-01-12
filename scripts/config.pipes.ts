import {buildTask} from "../___/tasks";

export interface TaskPipeline {
  name: string
  desc?: string
  pipeline?: BuildBaseTaskNames[]
  aggregate?: BuildAggregateTaskNames[]

}

export const taskPipelines: Record<string, TaskPipeline> = {
  fast: {
    name: 'Run fast tests',
    desc: 'Run tests with hidden console output',
    pipeline: ["test"],
  },

  art: {
    name: 'Build project',
    desc: 'Build project artifacts',
    aggregate: ["tsc"],
    pipeline: ["test", "package", "build"],
  },

  // 'coverage-generate': {
  //   name: 'Generate coverage reports',
  //   desc: 'Run tests with coverage for individual projects',
  //   pipeline: [P.coverageTestProject], // This runs per project
  // },
  //
  // 'coverage-text': {
  //   name: 'Generate text coverage reports',
  //   desc: 'Run tests with coverage and save text reports for individual projects',
  //   pipeline: [P.coverageTextReport], // This runs per project and saves text reports
  // },
  //
  // 'coverage-aggregate': {
  //   name: 'Aggregate coverage reports',
  //   desc: 'Aggregate coverage reports and generate HTML',
  //   aggregate: [A.aggregateLcovCoverage, A.generateLcovHtml], // This runs once with all projects
  // },
  //
  // coverage: {
  //   name: 'Run full coverage workflow',
  //   desc: 'Generate coverage for all projects then aggregate',
  //   pipeline: [P.coverageTestProject], // First, run coverage for each project
  //   aggregate: [A.aggregateLcovCoverage, A.generateLcovHtml], // Then aggregate and generate HTML
  // },

  // 'coverage-aggregate-only': {
  //   name: 'Run aggregate coverage only',
  //   desc: 'Aggregate existing coverage reports and generate HTML',
  //   aggregate: [A.aggregateLcovCoverage, A.generateLcovHtml],
  // },

  // tsc: {
  //   name: 'TSC',
  //   desc: 'Build type definitions',
  //   aggregate: [A.runTscTask]
  // },
  //
  // build: {
  //   name: 'Build project',
  //   desc: 'Build project artifacts',
  //   pipeline: [P.buildDtsForProject], // Now includes DTS building as part of the main build
  // },
  //
  // 'build-dts': {
  //   name: 'Build type definitions',
  //   desc: 'Build type definitions using rolldown-plugin-dts',
  //   pipeline: [P.buildDtsForProject],
  // },
  //
  // 'generate-package': {
  //   name: 'Generate package.json',
  //   desc: 'Generate package.json file for the project',
  //   pipeline: [P.generatePackageJsonForProject],
  // },
  //
  // 'update-npm-version': {
  //   name: 'Update NPM version',
  //   desc: 'Update the NPM version for the project',
  //   pipeline: [P.updateProjectNpmVersion],
  // },
  //
  // 'check-versions': {
  //   name: 'Check published versions',
  //   desc: 'Check published versions of a package in npm registry',
  //   pipeline: [P.checkVersionsWorkflow],
  // },

}
