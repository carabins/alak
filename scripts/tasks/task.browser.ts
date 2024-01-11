import {Project} from '~/scripts/common/project'
import {rollup} from 'rollup'
import path from 'path'
import {existsSync} from 'fs'
import typescript from '@rollup/plugin-typescript'

import terser from '@rollup/plugin-terser';
import * as fs from "fs-extra";
import {FileLog} from "~/scripts/log";
import * as module from "module";
import {minify} from "@swc/core";

const modules = new Set(['umd', 'es'])

export async function browser(project: Project) {
  const log = FileLog(project.packageJson.name + ' browser')
  project.packageJson.typings = "index.d.ts"
  project.packageJson.main = "index.js"
  const buildModule = !!project.packageJson.module
  const buildCdn = !!project.packageJson.browser
  if (!buildCdn && buildModule) {
    log.info("skip")
  }


  const input = path.join(project.packagePath, 'src', 'index.ts')
  const distName = "lib"
  const outDir = path.join(project.artPatch, distName)
  const esDir = path.join(outDir, "es")
  fs.existsSync(outDir) && fs.removeSync(outDir)
  fs.mkdirpSync(outDir)

  const artFilePrePath = moduleType => path.resolve(outDir, [moduleType, "js"].join("."))
  if (buildCdn) {
    project.packageJson['unpkg'] = distName + "/es.js"
    project.packageJson.browser = distName + "/umd.js"
  }
  if (buildModule) {
    project.packageJson.module = distName + "/es.js"
  }
  return new Promise(done => {
    rollup({
      input,
      // preserveEntrySignatures: "strict",
      plugins: [typescript({
        noEmitOnError: true,
        skipLibCheck: true,
        skipDefaultLibCheck: true,
        declaration: false,
        exclude: [path.resolve(project.dir, "test")],
        outDir: esDir
      }), terser()],
      external: ['vue'],
    }).then((v) => {
      Promise.all(Array.from(modules)
        .map((format: any) =>
        v.write({
          format,
          globals: {vue: 'Vue'},
          exports: "named",
          name: project.dir,
          file: artFilePrePath(format),
        })
      ))
    }).then(done)
  })
}
