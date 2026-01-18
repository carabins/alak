import { GqlSchema } from '../compiler/visitor'

export function generateTypescript(schema: GqlSchema): string {
  const chunks: string[] = []
  
  chunks.push(`import { SyncNode } from '@alaq/link-state';`)
  chunks.push(``)

  // 1. Interfaces
  for (const type of Object.values(schema.types)) {
    if (type.kind === 'object') {
      chunks.push(`export interface I${type.name} {`)
      type.fields.forEach(f => {
        const tsType = mapType(f.type)
        chunks.push(`  ${f.name}: ${tsType}${f.isList ? '[]' : ''};`)
      })
      chunks.push(`}`)
      chunks.push(``)
    }
  }

  // 2. Nodes
  for (const type of Object.values(schema.types)) {
    if (type.kind !== 'object') continue
    
    // Skip internal/root types from Node generation if needed, but Query needs a Node too (RootNode)
    
    chunks.push(`export class ${type.name}Node extends SyncNode<I${type.name}> {`)
    
    // Getters for fields
    type.fields.forEach(f => {
      // TODO: If field type is Object, return specific Node class
      chunks.push(`  get ${f.name}(): any { return this.get('${f.name}'); }`)
    })

    chunks.push(`}`)
    chunks.push(``)
  }

  return chunks.join('\n')
}

function mapType(gqlType: string): string {
  switch (gqlType) {
    case 'ID': return 'string'
    case 'String': return 'string'
    case 'Int': return 'number'
    case 'Float': return 'number'
    case 'Boolean': return 'boolean'
    default: return `I${gqlType}` // Link to interface
  }
}
