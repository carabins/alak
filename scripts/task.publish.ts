import { Project } from './common/project'
import { FileLog, Log } from './log'
import { exec } from 'child_process'
import { versions } from '~/scripts/index'

export function upver(project: Project) {
  const trace = FileLog(project.packageJson.name + ' version')
  const v = project.packageJson.version
  const parts = v.split('.')
  let build = parseInt(parts.pop())
  // @ts-ignore
  build++
  if (isNaN(build as any)) {
    Log.error(build + 'build is Not A Number')
    Log.error('wrong version number', parts)
    throw 'wrong version number'
  }
  parts.push(build.toString())
  const nv = parts.join('.')
  trace('set version', nv)
  project.packageJson.version = nv
  versions[project.packageJson.name] = nv
  // project.savePackageJsonTo.art()
}

export function publish(project: Project) {
  const trace = FileLog('publish:' + project.packageJson.name)
  project.savePackageJsonTo.source()

  const cmd = 'npm publish --access public'
  trace('run ' + cmd)

  exec(
    cmd,
    {
      cwd: project.artPatch,
    },
    (error, stdout, std) => {
      if (error) {
        trace.error(`\n${error.message}`)
        return
      }
      if (std) {
        trace.warn(`${std}`)
      }
      trace(`complete\n`, stdout)
    },
  )
}
