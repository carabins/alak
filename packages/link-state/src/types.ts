import { IQ } from '@alaq/quark'

export type SyncStatus = 'pending' | 'ready' | 'error'

export interface ISyncNode<T = any> extends IQ<T> {
  // Callable signature: node() to get, node(val) to set
  (value?: T): T | undefined

  readonly $status: IQ<SyncStatus>
  readonly $error: IQ<any>
  readonly $meta: {
    readonly isGhost: boolean
    readonly path: string
  }
  
  // Internal API for generated code
  _get(key: string): any
  _node(key: string): ISyncNode<any>
  _act(name: string, args?: any): Promise<any>
  
  // Lifecycle
  $release(): void
}

export interface SyncStoreOptions {
  onFetch?: (path: string) => Promise<any>
  onSubscribe?: (path: string) => void
  onUnsubscribe?: (path: string) => void
  onAction?: (action: string, path: string, args: any) => Promise<any>
}
