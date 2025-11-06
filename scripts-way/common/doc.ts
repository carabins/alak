import { Project } from '~/scripts/common/project'

const TypeDoc = require('typedoc')

export function doc(project: Project) {
  console.log()
  const app = new TypeDoc.Application()

  // If you want TypeDoc to load tsconfig.json / typedoc.json files
  app.options.addReader(new TypeDoc.TSConfigReader())
  app.options.addReader(new TypeDoc.TypeDocReader())

  app.bootstrap({
    entryPoints: [project.resolveInPackage('/src/index.ts')],
  })
  //
  const docProject = app.convert()
  //
  if (docProject) {
    const outputDir = 'docs'
    app.getEntryPoints()

    // await app.generateDocs(project, outputDir)
    // Alternatively generate JSON output
    // await app.generateJson(project, outputDir + '/documentation.json')
  }
}
