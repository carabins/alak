// Unit-level smoke test for the snake_case helper — the single decision
// that binds the Tauri generator to the Rust side. Keep it cheap and
// exhaustive enough that tricky acronym cases are nailed down.

import { test, expect, describe } from 'bun:test'
import { snakeCase, camelCase, pascalCase } from '../src/utils'

describe('snakeCase', () => {
  test('simple Pascal → snake', () => {
    expect(snakeCase('RenderMarkdown')).toBe('render_markdown')
    expect(snakeCase('Upload')).toBe('upload')
    expect(snakeCase('Delete')).toBe('delete')
  })

  test('multi-word', () => {
    expect(snakeCase('GetViewHistory')).toBe('get_view_history')
    expect(snakeCase('OpenInExplorer')).toBe('open_in_explorer')
    expect(snakeCase('OpenBundle')).toBe('open_bundle')
  })

  test('acronym runs', () => {
    expect(snakeCase('HTTPSConnect')).toBe('https_connect')
    expect(snakeCase('ParseURL')).toBe('parse_url')
  })

  test('already snake', () => {
    expect(snakeCase('already_snake')).toBe('already_snake')
    expect(snakeCase('_leading')).toBe('leading')
  })

  test('digits', () => {
    expect(snakeCase('V2Action')).toBe('v2_action')
    expect(snakeCase('Action2')).toBe('action2')
  })
})

describe('camelCase / pascalCase', () => {
  test('camelCase lowercases first char only', () => {
    expect(camelCase('RenderMarkdown')).toBe('renderMarkdown')
    expect(camelCase('Upload')).toBe('upload')
  })
  test('pascalCase uppercases first char only', () => {
    expect(pascalCase('renderMarkdown')).toBe('RenderMarkdown')
  })
})
