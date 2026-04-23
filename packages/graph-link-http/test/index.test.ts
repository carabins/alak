import { describe, it, expect } from 'bun:test'
import { generate } from '../src'

describe('HttpCodegen (TS)', () => {
  it('1. generates correct TS code from IR', () => {
    const ir: any = {
      schemas: {
        'test.ns': {
          namespace: 'test.ns',
          enums: { 'Status': { name: 'Status', values: ['Active', 'Idle'] } },
          records: {
            'User': {
              name: 'User',
              fields: [{ name: 'id', type: { kind: 'Scalar', name: 'String' }, required: true }]
            }
          },
          actions: {
            'GetUser': {
              name: 'GetUser',
              input: [{ name: 'id', type: { kind: 'Scalar', name: 'String' }, required: true }],
              output: { kind: 'Record', name: 'User' } as any
            }
          }
        }
      }
    }

    const { files } = generate(ir)
    const content = files[0].content

    expect(content).toContain("import { callAction, type HttpClientOptions } from '@alaq/link-http-client';")
    expect(content).toContain('export enum Status {')
    expect(content).toContain('Active = \'Active\'')
    expect(content).toContain('export interface IUser {')
    expect(content).toContain('export async function getUser(')
    expect(content).toContain("return callAction<IGetUserInput, IUser>(options, 'get_user', input);")
  })
})
