import { Project } from '../common/project'
import { FileLog, Log } from '../log'
import { exec } from 'child_process'
import {versions} from "~/scripts/now";



export async function publish(project: Project) {
  const log = FileLog('publish:' + project.packageJson.name)
  project.savePackageJsonTo.source()

  const cmd = 'npm publish --access public'
  log('run ' + cmd)

  exec(
    cmd,
    {
      cwd: project.artPatch,
    },
    (error, stdout, std) => {
      if (error) {
        log.error(`\n${error.message}`)
        return
      }
      if (std) {
        log.warn(`${std}`)
      }
      log(`complete\n`, stdout)
    },
  )
}
