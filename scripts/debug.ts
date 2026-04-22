import path from 'path'
import fs from 'fs'
import {packageRegistry} from '~/scripts/common/scan.projects'
import {BuildPackage} from '~/scripts/BuildPackage'

const REQUIRED_FILES = ['package.json', 'lib/index.js', 'legacy/index.cjs'] as const

type StepResult = {ok: boolean; ms: number; error?: string}
type Artifact = {path: string; size: number; missing?: boolean}
type TreeShake = {
  sideEffects: unknown
  hasExportSyntax: boolean
  topLevelCalls: string[]
  topLevelAssignments: number
  score: 'good' | 'warn' | 'bad'
  notes: string[]
}

type Report = {
  package: string
  ok: boolean
  steps: Record<string, StepResult>
  artifacts: Artifact[]
  treeShake?: TreeShake
  optionalPeerDeps: string[]
  totalMs: number
}

async function runStep(name: string, steps: Report['steps'], fn: () => Promise<void> | void) {
  const t = Date.now()
  try {
    await fn()
    steps[name] = {ok: true, ms: Date.now() - t}
  } catch (e: any) {
    steps[name] = {ok: false, ms: Date.now() - t, error: e?.stack || String(e)}
    throw e
  }
}

function collectArtifacts(dir: string): Artifact[] {
  const out: Artifact[] = []
  for (const rel of REQUIRED_FILES) {
    const p = path.join(dir, rel)
    if (fs.existsSync(p)) out.push({path: rel, size: fs.statSync(p).size})
    else out.push({path: rel, size: 0, missing: true})
  }
  if (fs.existsSync(dir)) {
    const umd = fs.readdirSync(dir).find(f => f.endsWith('.min.js'))
    if (umd) out.push({path: umd, size: fs.statSync(path.join(dir, umd)).size})
  }
  return out
}

function checkTreeShaking(artDir: string): TreeShake | undefined {
  const pkgPath = path.join(artDir, 'package.json')
  const esmPath = path.join(artDir, 'lib/index.js')
  if (!fs.existsSync(pkgPath) || !fs.existsSync(esmPath)) return undefined

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
  const code = fs.readFileSync(esmPath, 'utf-8')
  const notes: string[] = []

  const hasExportSyntax = /^export\s/m.test(code) || /\nexport\s/.test(code)
  if (!hasExportSyntax) notes.push('no ESM export statements — bundlers cannot tree-shake')

  const lines = code.split('\n')
  const topLevelCalls: string[] = []
  let topLevelAssignments = 0
  let depth = 0
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      depth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length
      continue
    }
    if (depth === 0) {
      if (/^[a-zA-Z_$][\w$]*\s*\(/.test(line) && !/^(function|if|for|while|switch|return|throw|typeof|new)\b/.test(line)) {
        topLevelCalls.push(line.slice(0, 80))
      }
      if (/^(?:globalThis|window|self|global)\s*[.\[]/.test(line)) {
        topLevelAssignments++
      }
    }
    depth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length
  }

  if (topLevelCalls.length) notes.push(`top-level calls may block tree-shaking (${topLevelCalls.length})`)
  if (topLevelAssignments) notes.push(`top-level globals set (${topLevelAssignments})`)

  const sideEffects = pkg.sideEffects
  if (sideEffects === undefined) notes.push('package.json has no "sideEffects" field — bundlers assume true')
  else if (sideEffects !== false && !Array.isArray(sideEffects)) notes.push(`sideEffects=${JSON.stringify(sideEffects)} disables tree-shaking`)

  let score: TreeShake['score'] = 'good'
  if (!hasExportSyntax || sideEffects === true) score = 'bad'
  else if (topLevelCalls.length || topLevelAssignments || sideEffects === undefined) score = 'warn'
  else if (Array.isArray(sideEffects) && sideEffects.length) score = 'warn'

  return {
    sideEffects,
    hasExportSyntax,
    topLevelCalls: topLevelCalls.slice(0, 5),
    topLevelAssignments,
    score,
    notes,
  }
}

function readOptionalPeerDeps(project: BuildPackage): string[] {
  const meta = (project.packageJson as any).peerDependenciesMeta
  if (!meta) return []
  return Object.keys(meta).filter(k => meta[k]?.optional)
}

function printReport(r: Report) {
  const line = (s: string) => process.stdout.write(s + '\n')
  line('')
  line(`=== BUILD DEBUG REPORT: ${r.package} ===`)
  line(`status: ${r.ok ? 'OK' : 'FAIL'}  total: ${r.totalMs}ms`)
  if (r.optionalPeerDeps.length) line(`optional peers: ${r.optionalPeerDeps.join(', ')}`)
  line('')
  line('steps:')
  for (const [name, s] of Object.entries(r.steps)) {
    const mark = s.ok ? 'ok  ' : 'FAIL'
    line(`  ${mark} ${name.padEnd(12)} ${s.ms}ms`)
    if (s.error) {
      const firstLines = s.error.split('\n').slice(0, 6).join('\n    ')
      line(`    ${firstLines}`)
    }
  }
  line('')
  line('artifacts:')
  for (const a of r.artifacts) {
    const mark = a.missing ? 'MISS' : 'ok  '
    const size = a.missing ? '-' : `${a.size}B`
    line(`  ${mark} ${a.path.padEnd(24)} ${size}`)
  }
  if (r.treeShake) {
    line('')
    line(`tree-shaking: ${r.treeShake.score.toUpperCase()}`)
    line(`  sideEffects: ${JSON.stringify(r.treeShake.sideEffects)}`)
    line(`  ESM exports: ${r.treeShake.hasExportSyntax ? 'yes' : 'NO'}`)
    if (r.treeShake.topLevelCalls.length) {
      line(`  top-level calls:`)
      for (const c of r.treeShake.topLevelCalls) line(`    ${c}`)
    }
    for (const n of r.treeShake.notes) line(`  ! ${n}`)
  }
  line('')
  line(r.ok ? 'RESULT: success' : 'RESULT: failure')
}

async function buildOne(pkgId: string, keep: boolean): Promise<Report> {
  const project: BuildPackage | undefined = packageRegistry.all[pkgId]
  if (!project) throw new Error(`package "${pkgId}" not found`)

  const report: Report = {
    package: pkgId,
    ok: false,
    steps: {},
    artifacts: [],
    optionalPeerDeps: readOptionalPeerDeps(project),
    totalMs: 0,
  }
  const start = Date.now()

  try {
    if (!keep) {
      await runStep('clean', report.steps, () => {
        if (fs.existsSync(project.artPatch)) fs.rmSync(project.artPatch, {recursive: true, force: true})
      })
    }
    await runStep('tsc', report.steps, async () => {
      const tsc = (await import('~/scripts/tasks/build/aggregate.tsc')).default
      await tsc([project])
    })
    await runStep('package', report.steps, async () => {
      const pkg = (await import('~/scripts/tasks/build/task.package')).default
      await pkg(project)
    })
    await runStep('build', report.steps, async () => {
      const build = (await import('~/scripts/tasks/build/task.build')).default
      await build(project)
    })
    report.artifacts = collectArtifacts(project.artPatch)
    report.treeShake = checkTreeShaking(project.artPatch)
    report.ok = report.artifacts.every(a => !a.missing) &&
      Object.values(report.steps).every(s => s.ok)
  } catch {
    report.artifacts = fs.existsSync(project.artPatch) ? collectArtifacts(project.artPatch) : []
    report.treeShake = checkTreeShaking(project.artPatch)
    report.ok = false
  }
  report.totalMs = Date.now() - start
  return report
}

async function main() {
  const args = process.argv.slice(2)
  const keep = args.includes('--keep')
  const asJson = args.includes('--json')
  const all = args.includes('--all')
  const positional = args.filter(a => !a.startsWith('--'))

  if (!positional.length && !all) {
    console.error('usage: bun scripts/debug.ts <package> [--keep] [--json]')
    console.error('       bun scripts/debug.ts --all [--json]')
    console.error('packages:', Object.keys(packageRegistry.all).join(', '))
    process.exit(2)
  }

  const targets = all ? Object.keys(packageRegistry.all) : positional

  if (all) {
    const summary: Report[] = []
    for (const id of targets) {
      try {
        const r = await buildOne(id, keep)
        summary.push(r)
      } catch (e: any) {
        summary.push({
          package: id, ok: false, steps: {}, artifacts: [],
          optionalPeerDeps: [], totalMs: 0,
        })
      }
    }
    if (asJson) {
      console.log(JSON.stringify(summary, null, 2))
    } else {
      console.log('')
      console.log('=== ALL PACKAGES SUMMARY ===')
      for (const r of summary) {
        const status = r.ok ? 'OK  ' : 'FAIL'
        const ts = r.treeShake ? r.treeShake.score.padEnd(4) : '-   '
        const failStep = Object.entries(r.steps).find(([, s]) => !s.ok)?.[0] || ''
        console.log(`  ${status}  ts:${ts}  ${r.package.padEnd(20)} ${r.totalMs}ms  ${failStep}`)
      }
      const ok = summary.filter(r => r.ok).length
      console.log(`\n${ok}/${summary.length} packages built successfully`)
    }
    process.exit(summary.every(r => r.ok) ? 0 : 1)
  }

  const report = await buildOne(positional[0], keep)
  if (asJson) console.log(JSON.stringify(report, null, 2))
  else printReport(report)
  process.exit(report.ok ? 0 : 1)
}

main()
