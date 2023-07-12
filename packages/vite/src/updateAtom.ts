import * as fs from 'fs'
import * as path from 'path'
//@ts-ignore
import fg from 'fast-glob'
import { getFileNames, updateIfNew } from './tools'
import { headStamp } from './headstamp'

export function createAtomWriter(outDir, atomsFolder) {
  return async (newfiles: string[]) => {
    const allFiles = await fg(atomsFolder)
    const vm = []
    allFiles.forEach((f) => {
      if (fs.readFileSync(f).includes('//@vue-model')) {
        vm.push(f)
      }
    })

    const names = getFileNames(vm)
    const atomic = names.map((n) => ({
      name: n + 'Model',
      file: n,
      id: n.toLowerCase(),
    }))
    const template = `${headStamp}
import {alakCluster} from "alak/cluster";
import {watchVueAtom} from "@alaq/vue";
import {injectCluster,  Nucleus} from "alak";
${atomic
  .map(
    (a) =>
      'import ' +
      a.name +
      ' from "' +
      path.relative(outDir, atomsFolder).replace('*', a.file) +
      '";',
  )
  .join('\n')}

export const onInit = {
    ${atomic.map((a) => a.id + ' : Nucleus<AlakAtom<' + a.name + '>>()').join(',\n\t')}
}
injectCluster().bus.addEventListener("ATOM_INIT", (a) => {
    onInit[a.name](a.atom)
})

export const {atoms, states, cores, bus} = alakCluster({
    ${atomic.map((a) => a.id + ':' + a.name).join(',\n\t')}
})

export default function atomsVueSetup(app){
    app.config.globalProperties.$atoms = new Proxy({}, {
        get(proxyAtoms, name) {
          const pa = proxyAtoms[name]
          if (pa) {
            return pa
          } else {
            return proxyAtoms[name] = watchVueAtom(atoms[name])
          }
        }
    })
}
declare module '@vue/runtime-core' {
    interface ComponentCustomProperties {
        $atoms:{
            ${atomic.map((a) => a.id + ':' + a.name).join('\n\t\t\t')}
        }
    }
}
export{}
`
    return {
      atoms: updateIfNew(path.resolve(outDir, 'atoms.ts'), template),
    }
  }
}
