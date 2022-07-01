import { Project } from './common/project'
import { FileLog } from './log'
import { writeFile, writeJSONSync } from 'fs-extra'
import { writeFileSync } from 'fs'
import * as path from 'path'
import { Const } from './common/constants'
import * as fs from 'fs'
import { exec } from 'child_process'

export function upver(project: Project) {
  const trace = FileLog(project.packageJson.name + ' version')
  const v = project.packageJson.version
  const parts = v.split('.')
  let build = parts.pop()
  // @ts-ignore
  build++
  if (isNaN(build as any)) {
    throw 'wrong version number'
  }
  parts.push(build)
  const nv = parts.join('.')
  trace('next version', nv)
  project.packageJson.version = nv
  project.savePackageJsonTo.art()
}

export function publish(project: Project) {
  const trace = FileLog('publish:' + project.packageJson.name)
  project.savePackageJsonTo.source()

  trace('run npm publish --access public')

  exec(
    'npm publish',
    {
      cwd: project.artPatch,
    },
    (error, stdout, stderr) => {
      if (error) {
        trace.error(`error: ${error.message}`)
        return
      }
      if (stderr) {
        trace.error(`stderr: ${stderr}`)
        return
      }
      trace(`result\n`, stdout)
      trace('done')
    },
  )
}
