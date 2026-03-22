import type { IQuark } from '@alaq/quark';

export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'cancelled';

export interface BackoffOptions {
  type: 'fixed' | 'exponential';
  delay: number;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  timeout?: number;
  retries?: number;
  backoff?: BackoffOptions;
  id?: string;
  dependsOn?: string | string[];
  meta?: Record<string, any>;
}

export interface Job<T = any, R = any> {
  id: string;
  data: T;
  options: JobOptions;
  
  status: IQuark<JobStatus>;
  progress: IQuark<number>;
  error: IQuark<Error | null>;
  
  result: Promise<R>;
  
  readonly attempts: number;
  
  // Internal control methods
  _start(processor: (job: Job<T, R>) => Promise<R> | R): Promise<R>;
  _cancel(reason?: string): void;
  _fail(error: any): void;
}



export interface QueueOptions<T, R> {
  processor: (job: Job<T, R>) => Promise<R> | R;
  concurrency?: number;
  autoStart?: boolean;
  id?: string;
  keepCompleted?: number; // GC limit
}

export interface QueueStats {
  total: number;
  pending: number;
  active: number;
  completed: number;
  failed: number;
}

export type QueueEvent = 
  | 'job:added' 
  | 'job:started' 
  | 'job:completed' 
  | 'job:failed' 
  | 'job:progress'
  | 'queue:drained'
  | 'queue:paused'
  | 'queue:resumed';
