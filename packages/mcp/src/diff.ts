// Schema diff — compares two IRs declaration-by-declaration and classifies
// every change as breaking / non_breaking / review. Pure function, no I/O.
//
// "Breaking" follows wire-compatibility intuition:
// - removing or renaming a public declaration is breaking
// - removing a required field is breaking
// - changing a field type is breaking
// - adding a required field with no default is breaking
// - tightening optional → required is breaking
// "Non-breaking": adding optional fields, new declarations, new enum values.
// "Review": directive changes — semantically loaded, can't classify mechanically.

import type { IR, IRField, IRRecord, IRAction, IREnum } from '../../graph/src/types'

export type ChangeKind = 'breaking' | 'non_breaking' | 'review'

export interface SchemaChange {
  kind: ChangeKind
  category: 'record' | 'action' | 'enum' | 'scalar' | 'opaque' | 'schema'
  name: string
  field?: string
  detail: string
}

export interface DiffReport {
  before: { schemas: string[] }
  after: { schemas: string[] }
  changes: SchemaChange[]
  summary: { breaking: number; non_breaking: number; review: number }
}

function fieldSig(f: IRField): string {
  const t = f.list ? `[${f.type}${f.listItemRequired ? '!' : ''}]` : f.type
  return `${t}${f.required ? '!' : ''}`
}

function diffFields(
  beforeFields: IRField[],
  afterFields: IRField[],
  category: SchemaChange['category'],
  ownerName: string,
  changes: SchemaChange[],
): void {
  const beforeMap = new Map(beforeFields.map(f => [f.name, f]))
  const afterMap = new Map(afterFields.map(f => [f.name, f]))

  for (const [name, before] of beforeMap) {
    const after = afterMap.get(name)
    if (!after) {
      changes.push({
        kind: before.required ? 'breaking' : 'non_breaking',
        category,
        name: ownerName,
        field: name,
        detail: `field removed (was ${fieldSig(before)})`,
      })
      continue
    }
    const beforeSig = fieldSig(before)
    const afterSig = fieldSig(after)
    if (beforeSig !== afterSig) {
      const typeChanged = before.type !== after.type || before.list !== after.list
      const tightened = !before.required && after.required
      const loosened = before.required && !after.required
      const itemTightened =
        before.list && after.list && !before.listItemRequired && !!after.listItemRequired
      const itemLoosened =
        before.list && after.list && !!before.listItemRequired && !after.listItemRequired
      let kind: ChangeKind
      let why = ''
      if (typeChanged) {
        kind = 'breaking'
      } else if (tightened || itemTightened) {
        kind = 'breaking'
        why = ' (writers must now supply value)'
      } else if (loosened || itemLoosened) {
        kind = 'review'
        why = ' (readers expecting non-null may break)'
      } else {
        kind = 'non_breaking'
      }
      changes.push({
        kind,
        category,
        name: ownerName,
        field: name,
        detail: `field type changed: ${beforeSig} → ${afterSig}${why}`,
      })
    }
  }

  for (const [name, after] of afterMap) {
    if (beforeMap.has(name)) continue
    changes.push({
      kind: after.required ? 'breaking' : 'non_breaking',
      category,
      name: ownerName,
      field: name,
      detail: `field added (${fieldSig(after)})`,
    })
  }
}

function diffRecord(name: string, before: IRRecord, after: IRRecord, changes: SchemaChange[]): void {
  if (before.scope !== after.scope) {
    changes.push({
      kind: 'breaking',
      category: 'record',
      name,
      detail: `scope changed: ${before.scope ?? 'null'} → ${after.scope ?? 'null'}`,
    })
  }
  diffFields(before.fields, after.fields, 'record', name, changes)
}

function diffAction(name: string, before: IRAction, after: IRAction, changes: SchemaChange[]): void {
  if (before.scope !== after.scope) {
    changes.push({
      kind: 'breaking',
      category: 'action',
      name,
      detail: `scope changed: ${before.scope ?? 'null'} → ${after.scope ?? 'null'}`,
    })
  }
  if (before.output !== after.output || before.outputRequired !== after.outputRequired) {
    changes.push({
      kind: 'breaking',
      category: 'action',
      name,
      detail: `output changed: ${before.output ?? 'void'}${before.outputRequired ? '!' : ''} → ${after.output ?? 'void'}${after.outputRequired ? '!' : ''}`,
    })
  }
  diffFields(before.input ?? [], after.input ?? [], 'action', name, changes)
}

function diffEnum(name: string, before: IREnum, after: IREnum, changes: SchemaChange[]): void {
  const beforeSet = new Set(before.values)
  const afterSet = new Set(after.values)
  for (const v of beforeSet) {
    if (!afterSet.has(v)) {
      changes.push({
        kind: 'breaking',
        category: 'enum',
        name,
        detail: `enum value removed: ${v}`,
      })
    }
  }
  for (const v of afterSet) {
    if (!beforeSet.has(v)) {
      changes.push({
        kind: 'non_breaking',
        category: 'enum',
        name,
        detail: `enum value added: ${v}`,
      })
    }
  }
}

export function diffIR(before: IR, after: IR): DiffReport {
  const changes: SchemaChange[] = []
  const beforeSchemas = Object.keys(before.schemas).sort()
  const afterSchemas = Object.keys(after.schemas).sort()

  for (const ns of beforeSchemas) {
    if (!after.schemas[ns]) {
      changes.push({
        kind: 'breaking',
        category: 'schema',
        name: ns,
        detail: `namespace removed`,
      })
    }
  }
  for (const ns of afterSchemas) {
    if (!before.schemas[ns]) {
      changes.push({
        kind: 'non_breaking',
        category: 'schema',
        name: ns,
        detail: `namespace added`,
      })
    }
  }

  for (const ns of afterSchemas) {
    const b = before.schemas[ns]
    const a = after.schemas[ns]
    if (!b) continue

    if (b.version !== a.version) {
      changes.push({
        kind: 'review',
        category: 'schema',
        name: ns,
        detail: `version: ${b.version} → ${a.version}`,
      })
    }

    for (const recName of Object.keys(b.records)) {
      const bRec = b.records[recName]
      const aRec = a.records[recName]
      if (!aRec) {
        changes.push({
          kind: 'breaking',
          category: 'record',
          name: recName,
          detail: `record removed`,
        })
        continue
      }
      diffRecord(recName, bRec, aRec, changes)
    }
    for (const recName of Object.keys(a.records)) {
      if (!b.records[recName]) {
        changes.push({
          kind: 'non_breaking',
          category: 'record',
          name: recName,
          detail: `record added`,
        })
      }
    }

    for (const actName of Object.keys(b.actions)) {
      const bAct = b.actions[actName]
      const aAct = a.actions[actName]
      if (!aAct) {
        changes.push({
          kind: 'breaking',
          category: 'action',
          name: actName,
          detail: `action removed`,
        })
        continue
      }
      diffAction(actName, bAct, aAct, changes)
    }
    for (const actName of Object.keys(a.actions)) {
      if (!b.actions[actName]) {
        changes.push({
          kind: 'non_breaking',
          category: 'action',
          name: actName,
          detail: `action added`,
        })
      }
    }

    for (const enName of Object.keys(b.enums)) {
      const bEn = b.enums[enName]
      const aEn = a.enums[enName]
      if (!aEn) {
        changes.push({
          kind: 'breaking',
          category: 'enum',
          name: enName,
          detail: `enum removed`,
        })
        continue
      }
      diffEnum(enName, bEn, aEn, changes)
    }
    for (const enName of Object.keys(a.enums)) {
      if (!b.enums[enName]) {
        changes.push({
          kind: 'non_breaking',
          category: 'enum',
          name: enName,
          detail: `enum added`,
        })
      }
    }
  }

  const summary = { breaking: 0, non_breaking: 0, review: 0 }
  for (const c of changes) {
    if (c.kind === 'breaking') summary.breaking++
    else if (c.kind === 'non_breaking') summary.non_breaking++
    else summary.review++
  }

  return {
    before: { schemas: beforeSchemas },
    after: { schemas: afterSchemas },
    changes,
    summary,
  }
}
