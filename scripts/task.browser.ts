import { Project } from '~/scripts/common/project'
import { rollup } from 'rollup'
import path from 'path'
import { existsSync } from 'fs'
import typescript from '@rollup/plugin-typescript'
// import nodeResolve from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import { capitalize } from 'vue'

export async function browser(project: Project) {
  const indexPatch = path.join(project.packagePath, 'src', 'index.ts')
  // const dir = path.join(project.artPatch, 'dist')
  const outFile = path.resolve('/Volumes/A', project.dir + '.dist.')

  if (project.dir !== 'nucleus') {
    return
  }
  // console.log()
  existsSync(indexPatch) &&
    rollup({
      input: indexPatch,
      plugins: [typescript(), terser()],
      // output: {
      //   format: 'umd',
      //   file: outFile
      // },
    }).then((v) => {
      // console.log(outFile)
      // console.log(v.cache.modules)
      v.write({
        format: 'umd',
        name: capitalize(project.dir),
        file: outFile + 'umd.js',
      })
      v.write({
        format: 'module',
        name: capitalize(project.dir),
        file: outFile + 'module.js',
      })
      v.write({
        format: 'cjs',
        name: capitalize(project.dir),
        file: outFile + 'cjs.js',
      })
      v.write({
        format: 'commonjs',
        name: capitalize(project.dir),
        file: outFile + 'commonjs.js',
      })
      v.write({
        format: 'iife',
        name: capitalize(project.dir),
        file: outFile + 'iife.js',
      })
    })

  // swc.parseFile(indexPatch).then((r) => {
  //   console.log(r)
  // })
}
