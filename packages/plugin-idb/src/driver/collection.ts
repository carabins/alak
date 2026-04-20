/**
 * Collection driver — one object store per nucl id.
 *
 * Operations are grouped per-transaction by the write queue.
 * For simplicity and good-enough semantics: each insert/update/remove
 * becomes its own `put`/`delete` inside a single readwrite transaction.
 */

import type { IDBDatabaseLike } from '../types'

export type CollectionOp =
  | { t: 'put'; value: any }
  | { t: 'delete'; key: any }
  | { t: 'clear' }

export function collGetAll(db: IDBDatabaseLike, storeName: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : [])
    req.onerror = () => reject(req.error ?? new Error('coll getAll error'))
  })
}

export function collFlush(
  db: IDBDatabaseLike,
  storeName: string,
  ops: CollectionOp[],
): Promise<void> {
  if (ops.length === 0) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    let pending = ops.length
    let rejected = false
    const fail = (e: any) => {
      if (rejected) return
      rejected = true
      reject(e instanceof Error ? e : new Error(String(e)))
    }
    const step = () => {
      if (rejected) return
      pending -= 1
      if (pending === 0) resolve()
    }
    for (const op of ops) {
      try {
        if (op.t === 'put') {
          const r = store.put(op.value)
          r.onsuccess = step
          r.onerror = () => fail(r.error ?? new Error('coll put error'))
        } else if (op.t === 'delete') {
          const r = store.delete(op.key)
          r.onsuccess = step
          r.onerror = () => fail(r.error ?? new Error('coll delete error'))
        } else {
          const r = store.clear()
          r.onsuccess = step
          r.onerror = () => fail(r.error ?? new Error('coll clear error'))
        }
      } catch (e) {
        fail(e)
      }
    }
  })
}
