import { 
  DocumentNode, 
  visit, 
  Kind, 
  ObjectTypeDefinitionNode, 
  FieldDefinitionNode, 
  TypeNode, 
  StringValueNode,
  IntValueNode,
  BooleanValueNode,
  EnumValueNode
} from 'graphql'

export interface GqlType {
  name: string
  kind: 'object' | 'enum' | 'input' | 'scalar'
  fields: GqlField[]
  methods: GqlField[] // Context-bound mutations
  values?: string[] // For enums
  directives: Record<string, any>
}

// ... existing code ...

export function compileSchema(doc: DocumentNode): GqlSchema {
  // ... existing init ...

  // Pass 1 & 2 (definitions & fields) ...
  // ... (keep existing visit calls) ...

  // NEW Pass 3: Link Mutations to Types (Context Binding)
  // We do this after collecting all types and mutations
  
  // Need to run existing logic first, then link
  // Since 'visit' runs synchronously, we can just do post-processing here?
  // Wait, visit returns void but modifies schema closure.
  
  // Let's refactor slightly to allow post-processing before return
  
  visit(doc, {
     // ... (Pass 1 code) ...
  })
  
  visit(doc, {
     // ... (Pass 2 code) ...
  })

  // Post-process: Link @this mutations
  schema.mutations.forEach(mutation => {
    const firstArg = mutation.args?.[0]
    if (firstArg?.directives?.this) {
      // Find the type this argument refers to.
      // Usually the argument name hints at the type (e.g. roomId -> Room, playerId -> Player)
      // OR we look for a type that has this ID field? No, simpler convention.
      
      // Strategy: 
      // 1. Look for @bind(to: "Type") on mutation (explicit) - NOT IMPLEMENTED YET
      // 2. Infer from argument name (roomId -> GameRoom? No, weak)
      // 3. Infer from File Structure? (We lost file info in concatAST)
      
      // WAIT. We discussed using 'extend type Mutation' inside 'player.graphql'.
      // But concatAST merges everything. The visitor doesn't know which file it came from.
      
      // Better Strategy: Explicitly assume the Type name is derived or passed?
      // Actually, if we use @this, we just need to match the Argument Type (ID!) to the Object ID.
      // But multiple types have ID.
      
      // Let's assume we rely on naming convention for now OR fix the parser to read @bind.
      // Or simply: The generator will generate methods on ALL types? No.
      
      // Let's use a heuristic:
      // If mutation is `joinRoom(roomId: ID! @this)`, we look for type `Room` or `GameRoom`?
      // This is ambiguous.
      
      // Correct approach: We need to update the Schema/Parser to preserve context OR use explicit binding.
      // Let's add explicit `binding` field to Mutation IR, and let the Generator decide.
      // But for now, let's just populate a flat list and let Generator filter?
      
      // Actually, let's keep it simple: 
      // We will add logic to `typescript.ts` generator to find these, rather than complicating the visitor yet.
      // The visitor just produces the raw graph.
    }
  })

  return schema
}

export interface GqlSchema {
  types: Record<string, GqlType>
  queries: GqlField[]
  mutations: GqlField[]
  subscriptions: GqlField[]
}

function parseValue(node: any): any {
  switch (node.kind) {
    case Kind.STRING: return node.value
    case Kind.INT: return parseInt(node.value, 10)
    case Kind.BOOLEAN: return node.value
    case Kind.ENUM: return node.value
    default: return null
  }
}

function parseDirectives(nodes: ReadonlyArray<any> | undefined): Record<string, any> {
  const result: Record<string, any> = {}
  if (!nodes) return result
  
  for (const node of nodes) {
    const args: Record<string, any> = {}
    if (node.arguments) {
      for (const arg of node.arguments) {
        args[arg.name.value] = parseValue(arg.value)
      }
    }
    result[node.name.value] = args
  }
  return result
}

function resolveType(node: TypeNode): { name: string, isList: boolean, isRequired: boolean } {
  let isRequired = false
  let isList = false
  let current = node

  if (current.kind === Kind.NON_NULL_TYPE) {
    isRequired = true
    current = current.type
  }

  if (current.kind === Kind.LIST_TYPE) {
    isList = true
    current = current.type
    if (current.kind === Kind.NON_NULL_TYPE) {
      current = current.type
    }
  }
  
  if (current.kind === Kind.NAMED_TYPE) {
    return { name: current.name.value, isList, isRequired }
  }
  
  return { name: 'Unknown', isList, isRequired }
}

export function compileSchema(doc: DocumentNode): GqlSchema {
  const schema: GqlSchema = {
    types: {},
    queries: [],
    mutations: [],
    subscriptions: []
  }

  // Pass 1: Collect definitions
  visit(doc, {
    ObjectTypeDefinition(node) {
      if (node.name.value === 'Query') return
      if (node.name.value === 'Mutation') return
      if (node.name.value === 'Subscription') return

      schema.types[node.name.value] = {
        name: node.name.value,
        kind: 'object',
        fields: [],
        methods: [],
        directives: parseDirectives(node.directives)
      }
    },
    InputObjectTypeDefinition(node) {
      schema.types[node.name.value] = {
        name: node.name.value,
        kind: 'input',
        fields: [],
        directives: parseDirectives(node.directives)
      }
    },
    EnumTypeDefinition(node) {
      schema.types[node.name.value] = {
        name: node.name.value,
        kind: 'enum',
        fields: [],
        values: node.values?.map(v => v.name.value) || [],
        directives: parseDirectives(node.directives)
      }
    }
  })

  // Pass 2: Collect fields and extensions
  visit(doc, {
    ObjectTypeDefinition(node) {
      // Handle Root Types (Query, Mutation, Subscription)
      if (['Query', 'Mutation', 'Subscription'].includes(node.name.value)) {
        const target = node.name.value === 'Query' ? schema.queries :
                       node.name.value === 'Mutation' ? schema.mutations :
                       schema.subscriptions
        
        node.fields?.forEach(f => {
          const typeInfo = resolveType(f.type)
          target.push({
            name: f.name.value,
            type: typeInfo.name,
            isList: typeInfo.isList,
            isRequired: typeInfo.isRequired,
            directives: parseDirectives(f.directives),
            args: f.arguments?.map(a => {
              const argType = resolveType(a.type)
              return {
                name: a.name.value,
                type: argType.name,
                isList: argType.isList,
                isRequired: argType.isRequired,
                directives: parseDirectives(a.directives)
              }
            })
          })
        })
        return
      }

      // Handle Regular Types
      const type = schema.types[node.name.value]
      if (type && node.fields) {
        // Collect type-level directives to merge down
        const typeDirectives = parseDirectives(node.directives)
        
        node.fields.forEach(f => {
          const typeInfo = resolveType(f.type)
          const fieldDirectives = parseDirectives(f.directives)
          
          // Merge Logic: Field overrides Type
          const mergedDirectives = { ...typeDirectives, ...fieldDirectives }
          
          if (typeDirectives.sync && fieldDirectives.sync) {
             mergedDirectives.sync = { ...typeDirectives.sync, ...fieldDirectives.sync }
          }
          if (typeDirectives.auth && fieldDirectives.auth) {
             mergedDirectives.auth = { ...typeDirectives.auth, ...fieldDirectives.auth }
          }

          type.fields.push({
            name: f.name.value,
            type: typeInfo.name,
            isList: typeInfo.isList,
            isRequired: typeInfo.isRequired,
            directives: mergedDirectives
          })
        })
      }
    },
    // Handle "extend type"
    ObjectTypeExtension(node) {
      if (node.name.value === 'Mutation') {
        node.fields?.forEach(f => {
          const typeInfo = resolveType(f.type)
          schema.mutations.push({
            name: f.name.value,
            type: typeInfo.name,
            isList: typeInfo.isList,
            isRequired: typeInfo.isRequired,
            directives: parseDirectives(f.directives),
            args: f.arguments?.map(a => {
              const argType = resolveType(a.type)
              return {
                name: a.name.value,
                type: argType.name,
                isList: argType.isList,
                isRequired: argType.isRequired,
                directives: parseDirectives(a.directives)
              }
            })
          })
        })
        return
      }

      const type = schema.types[node.name.value]
      if (type && node.fields) {
        node.fields.forEach(f => {
          const typeInfo = resolveType(f.type)
          // Note: Directives inheritance for extensions might need parent lookup
          // For now, simpler implementation
          type.fields.push({
            name: f.name.value,
            type: typeInfo.name,
            isList: typeInfo.isList,
            isRequired: typeInfo.isRequired,
            directives: parseDirectives(f.directives)
          })
        })
      }
    }
  })

  return schema
}