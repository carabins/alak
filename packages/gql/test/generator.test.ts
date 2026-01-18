import { test, expect } from 'bun:test'
import { readSchema } from '../src/index'
import { compileSchema } from '../src/compiler/visitor'
import { generateTypescript } from '../src/generators/typescript'

test('should generate TS code from hat schema', async () => {
  const doc = await readSchema('__new_hat/schema/*.graphql')
  const schema = compileSchema(doc)
  const code = generateTypescript(schema)
  
  // Check for Interfaces
  expect(code).toContain('export interface IGameRoom {')
  expect(code).toContain('id: string;')
  expect(code).toContain('status: IRoomStatus;')
  
  // Check for Nodes
  expect(code).toContain('export class GameRoomNode extends SyncNode<IGameRoom> {')
  expect(code).toContain("get players(): any { return this.get('players'); }")
})
