import { describe, it, expect } from 'bun:test'
import { generate } from '../src'

describe('HttpCodegen (Rust)', () => {
  it('1. generates correct Rust code from IR', () => {
    const ir: any = {
      schemas: {
        'test.ns': {
          namespace: 'test.ns',
          enums: { 'Status': { name: 'Status', values: ['Active', 'Idle'] } },
          records: {
            'User': {
              name: 'User',
              fields: [
                { name: 'id', type: { kind: 'Scalar', name: 'String' }, required: true },
                { name: 'meta', type: { kind: 'Scalar', name: 'String' }, required: false }
              ]
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

    expect(content).toContain('use serde::{Deserialize, Serialize};')
    expect(content).toContain('use alaq_link_http_client::{HttpClient, AlaqHttpError};')
    expect(content).toContain('pub enum Status {')
    expect(content).toContain('pub struct User {')
    expect(content).toContain('pub id: String,')
    expect(content).toContain('pub meta: Option<String>,')
    expect(content).toContain('pub struct NsClient {')
    expect(content).toContain('pub async fn get_user(&self, input: GetUserInput) -> Result<User, AlaqHttpError>')
    expect(content).toContain('self.inner.call_action("get_user", input).await')
  })
})
