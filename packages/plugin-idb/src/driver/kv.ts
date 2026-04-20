/**
 * KV driver — single-value mode.
 *
 * All single-value nucls share one object store `__kv__` per realm.
 * The nucl's `id` is the IDB key.
 */

import type { IDBDatabaseLike } from '../types'

export const KV_STORE_NAME = '__kv__'

export function kvGet(db: IDBDatabaseLike, key: string): Promise<{ hit: boolean; value: any }> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE_NAME, 'readonly')
    const store = tx.objectStore(KV_STORE_NAME)
    const req = store.get(key)
    req.onsuccess = () => {
      const v = req.result
      resolve({ hit: v !== undefined, value: v })
    }
    req.onerror = () => reject(req.error ?? new Error('kv get error'))
  })
}

export function kvPut(db: IDBDatabaseLike, key: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE_NAME, 'readwrite')
    const store = tx.objectStore(KV_STORE_NAME)
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('kv put error'))
  })
}

export function kvDelete(db: IDBDatabaseLike, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE_NAME, 'readwrite')
    const store = tx.objectStore(KV_STORE_NAME)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('kv delete error'))
  })
}
