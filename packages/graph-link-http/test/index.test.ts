// Wave 0 regression suite — real-IR fixture exercising every bug family
// cli-ui + srv found during the first live migration:
//   · built-in scalars vs user types (String/Int/Boolean/Timestamp/UUID/ID/Float)
//   · enum emission (string-literal union, bare name, snake-case wire)
//   · list at action output (`outputList` + `outputListItemRequired`)
//   · list at record field (`list` + `listItemRequired`)
//   · optional list of optional items
//   · Map<K,V> field
//   · reserved-word action name (`Delete` → function mangling, factory key intact)
//   · empty-input action
//   · action with no output (void)
//
// The fixture lives at test/regression.aql. We parse it with @alaq/graph and
// generate through @alaq/graph-link-http; then assert on the output content
// and run `tsc --noEmit` against a harness that imports the generated file.

import { describe, expect, test, beforeAll } from 'bun:test'
import { readFileSync, mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseSource } from '../../graph/src/index'
import { generate } from '../src/index'

const FIXTURE = readFileSync(join(import.meta.dir, 'regression.aql'), 'utf8')

let generated: string

beforeAll(() => {
  const parsed = parseSource(FIXTURE, 'regression.aql')
  expect(parsed.diagnostics.filter(d => d.severity === 'error')).toEqual([])
  expect(parsed.ir).not.toBeNull()
  const { files } = generate(parsed.ir!, { namespace: 'regression.ns' })
  expect(files.length).toBe(1)
  generated = files[0]!.content
})

describe('@alaq/graph-link-http — scalar mapping', () => {
  test('built-in scalars map to TS primitives (not `IString`, `IInt`, etc.)', () => {
    // Record `Item` has String/Int/Float/Boolean/Timestamp/UUID/ID fields.
    expect(generated).not.toContain('IString')
    expect(generated).not.toContain('IInt')
    expect(generated).not.toContain('IBoolean')
    expect(generated).not.toContain('IFloat')
    expect(generated).not.toContain('ITimestamp')
    expect(generated).not.toContain('IUUID')
    expect(generated).not.toContain('IID')
    expect(generated).toMatch(/readonly id: string;/)
    expect(generated).toMatch(/readonly title: string;/)
    expect(generated).toMatch(/readonly count: number;/)
    expect(generated).toMatch(/readonly ratio: number;/)
    expect(generated).toMatch(/readonly active: boolean;/)
    expect(generated).toMatch(/readonly updated_at: number;/)
  })
})

describe('@alaq/graph-link-http — enum mapping', () => {
  test('enums emit as string-literal union, NOT as `IChannel`/`IPlatform`', () => {
    expect(generated).not.toContain('IChannel')
    expect(generated).not.toContain('IPlatform')
    expect(generated).not.toContain('enum Channel {')
    expect(generated).toContain("export type Channel = 'master' | 'test' | 'dev';")
    expect(generated).toContain("export type Platform = 'windows_msi' | 'linux_deb' | 'android_apk';")
  })

  test('enum used as field type is the bare name', () => {
    expect(generated).toMatch(/readonly channel: Channel;/)
  })
})

describe('@alaq/graph-link-http — list handling', () => {
  test('record field `[Tag!]!` emits `ITag[]` (not `ITag`)', () => {
    expect(generated).toMatch(/readonly tags: ITag\[\];/)
  })

  test('record field `Tag` (nullable) emits `ITag | null` with `?` marker', () => {
    expect(generated).toMatch(/readonly optional_tag\?: ITag \| null;/)
  })

  test('record field `[Tag]` (nullable list of nullable) emits `(ITag | null)[] | null`', () => {
    expect(generated).toMatch(/readonly optional_tags\?: \(ITag \| null\)\[\] \| null;/)
  })

  test('record field `Map<String, String>!` emits `Record<string, string>`', () => {
    expect(generated).toMatch(/readonly metadata: Record<string, string>;/)
  })

  test('action output `[Item!]!` emits `Promise<IItem[]>` (not `Promise<IItem>`)', () => {
    // Action `List` — camelCase `list` is NOT a JS reserved word, so no mangling.
    expect(generated).toMatch(/export async function list\([\s\S]*?\): Promise<IItem\[\]>/)
  })

  test('action output `Boolean!` (required scalar) emits `Promise<boolean>`', () => {
    expect(generated).toMatch(/export async function delete_\([\s\S]*?\): Promise<boolean>/)
    expect(generated).toMatch(/export async function ping\([\s\S]*?\): Promise<boolean>/)
  })

  test('action with no output emits `Promise<void>`', () => {
    expect(generated).toMatch(/export async function fireAndForget\([\s\S]*?\): Promise<void>/)
  })
})

describe('@alaq/graph-link-http — reserved-word handling', () => {
  test('action `Delete` emits function `delete_` (suffix _), NOT `delete`', () => {
    expect(generated).not.toMatch(/export async function delete\(/)
    expect(generated).toContain('export async function delete_(')
  })

  test('non-reserved action names stay unmangled (`list`, `ping`, `fireAndForget`)', () => {
    // Guard that we don't mangle identifiers that happen to look like
    // reserved words but aren't (e.g. `list` is a common non-reserved name).
    expect(generated).toContain('export async function list(')
    expect(generated).toContain('export async function ping(')
    expect(generated).toContain('export async function fireAndForget(')
  })

  test('factory object key stays `delete` (unmangled) — JS allows `api.delete` as property access', () => {
    expect(generated).toContain('delete: (input: IDeleteInput) => delete_(options, input)')
  })
})

describe('@alaq/graph-link-http — action wire names', () => {
  test('action names go over the wire snake_cased', () => {
    expect(generated).toContain("callAction<IDeleteInput, boolean>(options, 'delete', input)")
    expect(generated).toMatch(/callAction<IListInput, IItem\[\]>\(options, 'list', input\)/)
    expect(generated).toContain("callAction<IPingInput, boolean>(options, 'ping', input)")
    expect(generated).toContain("callAction<IFireAndForgetInput, void>(options, 'fire_and_forget', input)")
  })
})

describe('@alaq/graph-link-http — tsc --noEmit', () => {
  test('generated file is valid TypeScript', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'alak-tls-http-ts-'))
    try {
      writeFileSync(join(tmp, 'regression.ns.http.generated.ts'), generated)

      // Stub out @alaq/link-http-client so tsc doesn't need the real package.
      writeFileSync(
        join(tmp, 'link-http-client.ts'),
        `export interface HttpClientOptions { baseUrl: string }
export async function callAction<I, O>(
  _o: HttpClientOptions, _n: string, _i: I,
): Promise<O> { return undefined as unknown as O }
`,
      )
      // Rewrite the import to use the local stub.
      const generatedLocal = generated.replace(
        "from '@alaq/link-http-client'",
        "from './link-http-client'",
      )
      writeFileSync(join(tmp, 'regression.ns.http.generated.ts'), generatedLocal)

      // Include a consumer to exercise the exported surface.
      writeFileSync(
        join(tmp, 'consumer.ts'),
        `import { createHttpApi, type IItem, type Channel } from './regression.ns.http.generated'

const api = createHttpApi({ baseUrl: 'http://localhost' })

async function main() {
  const items: IItem[] = await api.list({ channel: 'master' })
  for (const it of items) {
    const _id: string = it.id
    const _count: number = it.count
    const _active: boolean = it.active
    const _ch: Channel = it.channel
    const _tagNames: string[] = it.tags.map(t => t.name)
  }

  const ok: boolean = await api.delete({ id: 'x' })
  await api.fireAndForget({ payload: 'p' })
  void ok
}

void main
`,
      )

      writeFileSync(
        join(tmp, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'es2022',
            module: 'esnext',
            moduleResolution: 'bundler',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            types: [],
          },
          include: ['*.ts'],
        }),
      )

      const r = spawnSync('bun', ['x', 'tsc', '--noEmit', '-p', tmp], {
        cwd: tmp,
        encoding: 'utf8',
        stdio: 'pipe',
      })
      if (r.status !== 0) {
        console.error('tsc stdout:\n' + r.stdout)
        console.error('tsc stderr:\n' + r.stderr)
      }
      expect(r.status).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }, 60_000)
})
