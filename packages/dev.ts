import fs from 'fs'
import chokidar from 'chokidar'
import path from 'path'
import {runTest, testAll} from './index'
import {exec, execSync} from "child_process";
import {FileLog} from "~/scripts/log";

const projects = {}
fs.readdirSync('packages').forEach((p) => (projects[p] = true))

chokidar.watch('packages').on('change', (target, ...a) => {
  const [pak, project, ctx, file] = target.split('/')
  if (projects[project]) {
    console.clear()
    switch (ctx) {
      case 'src':
        // console.log('reload', project.toUpperCase(), file)
        const testDir = path.resolve('packages', project, 'test')
        if (fs.existsSync(testDir)) {
          console.clear()
          fs.readdirSync(testDir).forEach((testfile) => {
            const f = path.resolve(testDir, testfile)
            const stat = fs.statSync(f)
            if(stat.isFile()){
              const logName = project+`:\\\\`+testfile
              console.log("::::", logName)
              const p = exec('node -r @swc-node/register -r tsconfig-paths/register ' + f)
              const l = FileLog(logName)
              p.stdout.on("data", v=>{
                l.info(v.slice(0,-1))
              })
              p.stderr.on("data", v=>{
                l.error(v)
              })
            }
          })
        }
        break
      case 'test':
        // console.clear()
        // console.log('update test', project.toUpperCase(), file)
        // console.log({target})
        runTest(path.resolve(target))
    }
  }
})



