import { describe, it, expect } from 'bun:test'
import { generate } from '../src'

describe('HttpCodegen (TS)', () => {
  it('1. generates correct TS code from IR', () => {
    // Mock IR structure
    const ir: any = {
      namespaces: [{
        name: 'test.ns',
        enums: [{ name: 'Status', variants: ['Active', 'Idle'] }],
        records: [{
          name: 'User',
          fields: [{ name: 'id', type: { kind: 'Scalar', name: 'String' }, required: true }]
        }],
        actions: [{
          name: 'GetUser',
          input: [{ name: 'id', type: { kind: 'Scalar', name: 'String' }, required: true }],
          output: { kind: 'Record', name: 'User' }
        }]
      }]
    }

    const { files } = generate(ir)
    const content = files[0].content

    expect(content).toContain("import { callAction, type HttpClientOptions } from '@alaq/link-http-client';")
    expect(content).toContain('export enum Status {')
    expect(content).toContain('Active = \'Active\'')
    expect(content).toContain('export interface IUser {')
    expect(content).toContain('export async function getUser(')
    expect(content).toContain("return callAction<IGetUserInput, IUser>(options, 'get_user', input);")
    expect(content).toContain('export function createHttpApi(options: HttpClientOptions)')
  })
})
