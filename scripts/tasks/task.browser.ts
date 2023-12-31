import {Project} from '~/scripts/common/project'
import {rollup} from 'rollup'
import path from 'path'
import {existsSync} from 'fs'
import typescript from '@rollup/plugin-typescript'

import terser from '@rollup/plugin-terser';
import * as fs from "fs-extra";
import {FileLog} from "~/scripts/log";
import * as module from "module";



export async function browser(project: Project) {
  if (!project.packageJson.browser) {
    return
  }
  const log = FileLog(project.packageJson.name + ' browser')
  const indexPatch = path.join(project.packagePath, 'src', 'index.ts')
  const dir = path.join(project.artPatch, "dist")
  // fs.existsSync(dir) && fs.removeSync(dir)
  // fs.mkdirpSync(dir)

  // const artFilePrePath = moduleType => path.resolve(dir, [project.id, moduleType, project.packageJson.version, "min.js"].join("."))
  const artFilePrePath = moduleType => path.resolve(dir,  [moduleType, "min.js"].join("."))
  log.info(artFilePrePath)

  // console.log()
  existsSync(indexPatch) &&
  rollup({
    input: indexPatch,
    plugins: [typescript({
      noEmitOnError: true,
      skipLibCheck: true,
      skipDefaultLibCheck: true,
      sourceMap: false,
      declaration: false
    }), terser()]
  }).then((v) => {
    ['umd', 'amd', 'esm', 'cjs'].forEach((format: any) =>
      v.write({
        exports: "named",
        name: project.dir,
        file: artFilePrePath(format),
      })
    )
  })
}
