import { parse, Source, DocumentNode, concatAST } from 'graphql'
import { Glob } from 'bun'

export async function readSchema(pattern: string): Promise<DocumentNode> {
  const glob = new Glob(pattern)
  const sources: DocumentNode[] = []

  for await (const file of glob.scan('.')) {
    const content = await Bun.file(file).text()
    try {
      const doc = parse(new Source(content, file))
      sources.push(doc)
    } catch (e) {
      console.error(`Error parsing ${file}:`, e)
      throw e
    }
  }

  return concatAST(sources)
}
