import * as path from 'path'
import * as fs from 'fs'

export const getFileNames = (files) => files.map((f) => path.basename(f).split('.')[0]) as string[]

export function updateIfNew(filePath, template) {
  if (fs.existsSync(filePath)) {
    if (fs.readFileSync(filePath).toString() === template) {
      return false
    }
  }
  fs.writeFileSync(path.resolve(filePath), template)
  return true
}
