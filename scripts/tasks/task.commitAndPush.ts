import { Project } from '~/scripts/common/project'
import { getLine } from '~/scripts/common/oneLine'
import path from 'path'
import fs from 'fs'

export async function commitAndPush() {
  const m = []
  // const commitSonnet = userMessage ? userMessage : getLine()
  // const head = '\n### '
  // const d = new Date()
  // let changeLog =
  //   '\n' + commitSonnet + '    // ' + d.toDateString() + ' ' + d.toLocaleTimeString()
  // const added = {}
  // affected.forEach((k) => {
  //   const p = projects[k]
  //   const version = p.packageJson.version
  //   m.push(`${k}@${version} / ${changes[k]}`)

  //     const changedFiles = p.changes
  //       .filter((f) => !f.path.includes('package.json') && !f.path.includes(changelogFileName))
  //       .map((f) => {
  //         let n = f.path.replace('packages/' + k + '/', '')
  //         if (f.index == 'D') {
  //           n += ' DELETED'
  //         }
  //         added[f.path] = true
  //         return n
  //       })
  //     if (changedFiles.length) {
  //       changeLog += '\n\t' + k + '@' + version
  //       changedFiles.forEach((f) => {
  //         changeLog += '\n\t\t - ' + f
  //       })
  //     }
  //
  //     let isNew = false
  //     let prev = {
  //       sonnets: [],
  //       changes: [],
  //       parts: [],
  //     } as any
  //     const addPrev = (v: string) => {
  //       if (v.length < 3) {
  //         return
  //       }
  //       if (v.startsWith(' - ')) {
  //         prev.changes.push(v.replace(' - ', ''))
  //       } else {
  //         prev.sonnets.push(v)
  //       }
  //     }
  //     const changelogFilePath = path.resolve(p.packagePath, changelogFileName)
  //     if (!fs.existsSync(changelogFilePath)) {
  //       isNew = true
  //     } else {
  //       const prevLog = fs.readFileSync(changelogFilePath).toString().split(head)
  //       isNew = prevLog.length === 1
  //       prev.parts = !isNew ? prevLog.slice(1) : []
  //
  //       const parts = prev.parts[0].split('\n')
  //       prev.version = parts.shift().replace('###', '').trim().split(' - ')
  //
  //       while (parts.length) addPrev(parts.shift())
  //     }
  //     // console.log(prev.version)
  //     // console.log(version)
  //     // console.log(version != prev.version)
  //     // console.log('--')
  //     if (isNew || version != prev.version[0]) {
  //       const sameChanges = prev.changes.join(':') == changedFiles.join(':')
  //       let newVersion = version
  //       let sonnets = commitSonnet
  //       if (sameChanges && !isNew) {
  //         const prevVersion = prev.version.length > 1 ? prev.version[1] : prev.version[0]
  //         newVersion = [version, prevVersion].join(' - ')
  //         sonnets = [commitSonnet, ...prev.sonnets].join('\n')
  //       }
  //       const localChangeLog =
  //         '# ' +
  //         p.packageJson.name +
  //         ' changelog' +
  //         head +
  //         newVersion +
  //         ` \n${sonnets}
  // ${changedFiles.length > 0 ? ' - ' + changedFiles.join('\n - ') : ''}
  // `
  //       let eof = ''
  //       if (!isNew) {
  //         const eoff = prev.parts.slice(sameChanges ? 1 : 0).join(head)
  //         if (eoff.length > 1) {
  //           eof = head + eoff
  //         }
  //       }
  //       const finalLog = localChangeLog + eof
  //       // fs.writeFileSync(changelogFilePath, finalLog)
  //       // console.log({ finalLog })
  //     }
  //   })
  //   const message = commitSonnet + '\n' + m.join('\n')
  //   list.forEach((s) => {
  //     if (!added[s.path] && s.path.includes('scripts/')) {
  //       changeLog += '\n\t' + s.path
  //     }
  //   })
  //   trace(message)
  //   const prevLog = fs.readFileSync(changelogFileName.replace('.md', ''))
  //   fs.writeFileSync(changelogFileName.replace('.md', ''), [changeLog, prevLog].join('\n\n'))
  //   await git.add('-A')
  //   await git.commit(message)
  //   trace('done')
}

//
// export async function prePush(projects: Record<string, Project>) {
//   const git = await initGit(projects)
//   const changes = git.affected.join(',')
//   //if (!changes) {
//   // Log.info('no one changes')
//   // }
//   // const target = (function () {
//   //   switch (task) {
//   //     case 'commit':
//   //       return process.argv[3]
//   //     case 'test':
//   //       return Object.keys(projects).join(',')
//   //     default:
//   //       return process.argv[3] ? process.argv[3] : changes
//   //   }
//   // })()
// // }
// }
