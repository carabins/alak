import { test, expect } from 'bun:test'
import { readSchema } from '../src/index'
import { Kind } from 'graphql'

test('should parse and concat hat schema', async () => {
  // Читаем из реальной папки __new_hat
  const doc = await readSchema('__new_hat/schema/*.graphql')
  
  expect(doc).toBeDefined()
  expect(doc.kind).toBe(Kind.DOCUMENT)
  
  // Проверяем наличие типов
  const typeNames = doc.definitions
    .filter((d: any) => d.kind === Kind.OBJECT_TYPE_DEFINITION)
    .map((d: any) => d.name.value)
    
  expect(typeNames).toContain('Player')
  expect(typeNames).toContain('GameRoom')
  expect(typeNames).toContain('SystemInfo')
  
  // Проверяем наличие расширений Mutation
  const extensions = doc.definitions
    .filter((d: any) => d.kind === Kind.OBJECT_TYPE_EXTENSION)
    .map((d: any) => d.name.value)
    
  expect(extensions).toContain('Mutation')
})
