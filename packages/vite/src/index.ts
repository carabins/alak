import { createBitmaskWriter } from './updateBitmask'
import * as fs from 'fs'
import * as path from 'path'
import { createAtomWriter } from './updateAtom'
import { createIndexUpdater } from './updateIndex'
//@ts-ignore
import fg from 'fast-glob'
//@ts-ignore
import { ViteDevServer } from 'vite'
//@ts-ignore
import picomatch from 'picomatch'

const defaultOptions = {
  models: 'src/models',
  bitmasks: [],
  output: 'src/-',
} as AVDefaultOptions

type AVDefaultOptions = {
  models?: string
  bitmasks?: string[]
  output?: string
}

export const Alak = async (opts?: AVDefaultOptions) => {
  const options = opts ? Object.assign(defaultOptions, opts) : defaultOptions
  const atomsFolder = path.resolve(options.models) + '/*'
  const outDir = path.resolve(options.output)
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir)
  }
  const updateBitmask = createBitmaskWriter(outDir)
  const updateAtoms = createAtomWriter(outDir, atomsFolder)
  const updateIndex = createIndexUpdater(outDir)
  return {
    name: 'alak-vite-plugin',
    async configureServer({ watcher, ws, config: { logger } }: ViteDevServer) {
      let bitmaskFiles = await fg(options.bitmasks)
      let atomsFiles = await fg(atomsFolder)
      const shouldBitReload = picomatch(bitmaskFiles)
      const shouldAtomReload = picomatch(atomsFiles)
      const checkReload = (path: string) => {
        if (shouldAtomReload(path)) {
          updateAtoms([path]).then(async () => {
            updateIndex()
            ws.send({ type: 'full-reload', path })
          })
        }
        if (shouldBitReload(path)) {
          updateBitmask(path).then(() => {
            updateIndex()
            ws.send({ type: 'full-reload', path })
          })
        }
      }
      await updateAtoms(atomsFiles)
      await Promise.all(bitmaskFiles.map(updateBitmask))
      await updateIndex()

      watcher.add(bitmaskFiles)
      watcher.add(atomsFiles)
      watcher.on('add', checkReload)
      watcher.on('change', checkReload)
    },
  }
}
