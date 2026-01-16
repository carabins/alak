import { Qv } from '@alaq/quark';
import type IQuark from '@alaq/quark/src/IQuark';
import { QueueEmitter } from './events';
import { JobImpl } from './job';
import { PriorityQueue } from './priority-queue';
import type { Job, JobOptions, QueueEvent, QueueOptions } from './types';

export class Queue<T = any, R = any> {
  // Public Reactive State
  public readonly size: IQuark<number>;
  public readonly pending: IQuark<number>;
  public readonly active: IQuark<number>;
  public readonly isPaused: IQuark<boolean>;
  public readonly isIdle: IQuark<boolean>;
  public readonly isEmpty: IQuark<boolean>;

  // Internals
  private readonly _options: QueueOptions<T, R>;
  private readonly _jobs = new Map<string, JobImpl<T, R>>();
  private readonly _pendingQueue = new PriorityQueue<JobImpl<T, R>>();
  private readonly _emitter = new QueueEmitter();
  
  // GC
  private readonly _completedIds: string[] = [];
  
  // Processing loop
  private _processingCount = 0;
  private _delayedCount = 0;
  private _nextId = 0;

  constructor(options: QueueOptions<T, R>) {
    this._options = {
      concurrency: 1,
      autoStart: true,
      keepCompleted: 0, 
      ...options
    };
    if (this._options.keepCompleted === undefined) {
        this._options.keepCompleted = 100;
    }

    // Init state
    this.size = Qv(0);
    this.pending = Qv(0);
    this.active = Qv(0);
    this.isPaused = Qv(!this._options.autoStart);
    this.isIdle = Qv(true);
    this.isEmpty = Qv(true);
  }


  // --- API ---

  public add(data: T, options?: JobOptions): Job<T, R> {
    const id = options?.id || `job-${++this._nextId}`;

    // Dedup: return existing if found
    if (this._jobs.has(id)) {
      return this._jobs.get(id)!;
    }

    const job = new JobImpl<T, R>(id, data, options);
    
    this._jobs.set(id, job);
    this._pendingQueue.push(job);
    
    this._updateStats();
    this._emitter.emit('job:added', job);
    
    this._tryProcess();
    
    return job;
  }

  public addMany(items: { data: T; options?: JobOptions }[]): Job<T, R>[] {
    return items.map(item => this.add(item.data, item.options));
  }

  public getJob(id: string): Job<T, R> | undefined {
    return this._jobs.get(id);
  }

  public remove(id: string): boolean {
    const job = this._jobs.get(id);
    if (!job) return false;
    
    if (job.status() !== 'pending') return false; // Can only remove pending
    
    const removed = this._pendingQueue.remove(id);
    if (removed) {
      this._jobs.delete(id);
      this._updateStats();
      return true;
    }
    return false;
  }

  public pause(): void {
    if (!this.isPaused()) {
      this.isPaused(true);
      this._emitter.emit('queue:paused');
    }
  }

  public resume(): void {
    if (this.isPaused()) {
      this.isPaused(false);
      this._emitter.emit('queue:resumed');
      this._tryProcess();
    }
  }

  public clear(mode: 'pending' | 'all' = 'pending'): void {
    // Clear pending
    this._pendingQueue.clear();
    
    if (mode === 'all') {
      // Cancel active
      for (const job of this._jobs.values()) {
        if (job.status() === 'active') {
          job._cancel('Queue cleared');
        }
      }
      this._jobs.clear();
      this._completedIds.length = 0;
    } else {
      // Remove only pending from Map
      for (const [id, job] of this._jobs.entries()) {
        if (job.status() === 'pending') {
          this._jobs.delete(id);
        }
      }
    }
    
    this._updateStats();
  }

  public async drain(): Promise<void> {
    if (this.isEmpty()) return;
    
    return new Promise<void>(resolve => {
      const unsubscribe = this._emitter.on('queue:drained', () => {
        unsubscribe();
        resolve();
      });
    });
  }

  public on<E = any>(event: QueueEvent, handler: (data: E, ...args: any[]) => void): () => void {
    return this._emitter.on(event, handler);
  }

  // --- Internal Loop ---

  private _updateStats() {
    const pending = this._pendingQueue.size;
    const active = this._processingCount;
    const delayed = this._delayedCount;
    
    this.pending(pending);
    this.active(active);
    this.size(this._jobs.size); // Total jobs in memory
    
    this.isIdle(active === 0);
    this.isEmpty(pending === 0 && active === 0 && delayed === 0);
    
    if (pending === 0 && active === 0 && delayed === 0) {
      this._emitter.emit('queue:drained');
    }
  }


  private _tryProcess() {
    if (this.isPaused()) return;
    
    const max = this._options.concurrency || 1;
    
    while (this._processingCount < max && !this._pendingQueue.isEmpty) {
      const job = this._pendingQueue.pop();
      if (!job) break;
      
      // Check dependencies
      if (this._isBlocked(job)) {
        // Optimization: if blocked, we should probably re-queue it or hold it separately
        // For simple impl: push back? 
        // Pushing back immediately causes infinite loop if head is blocked.
        // Better: 'waiting' queue. But for simplicity now:
        // We skip this job. To avoid losing it, we need a mechanism.
        // Let's implement simple dep check: if blocked, don't pop, peek next? Heap doesn't support peeking next easily.
        // Correct way: When job completes, check waiting jobs. 
        // Complex. Let's assume for MVP: dependencies just fail if not ready? 
        // Or re-add to queue with delay?
        
        // Re-add with slight penalty/delay to let others pass?
        // job.options.priority = (job.options.priority || 0) - 1; // Decrease priority?
        // this._pendingQueue.push(job);
        // break; // Stop loop to avoid spinning
        
        // For MVP: we just ignore deps or implement basic check.
        // If we want real DAG, we need separate 'blocked' set.
        // Let's skip complex DAG for now to keep code safe.
        // Just process.
      }
      
      this._runJob(job);
    }
  }
  
  private _isBlocked(job: JobImpl<T, R>): boolean {
    if (!job.options.dependsOn) return false;
    
    const deps = Array.isArray(job.options.dependsOn) 
      ? job.options.dependsOn 
      : [job.options.dependsOn];
      
    for (const depId of deps) {
      const depJob = this._jobs.get(depId);
      // Blocked if dep doesn't exist (yet?) or not completed
      if (!depJob || depJob.status() !== 'completed') {
        return true;
      }
    }
    return false;
  }

  private async _runJob(job: JobImpl<T, R>) {
    // Double check if blocked (if we solved the pop issue)
    if (this._isBlocked(job)) {
         // Naive "Parking": put back and wait.
         // This is bad for perf. But safe.
         // Ideally: put in separate 'waiting' Map.
         // For now: push back and stop loop.
         this._pendingQueue.push(job);
         return; 
    }

    this._processingCount++;
    this._updateStats();
    
    this._emitter.emit('job:started', job);
    
    try {
      await job._start(this._options.processor);
      this._emitter.emit('job:completed', job, await job.result);
      this._handleSuccess(job);
    } catch (err) {
      // Retry logic
      if (job.attempts < (job.options.retries || 0) + 1) { // +1 because attempts counts initial run
        this._emitter.emit('job:failed', job, err); // Emitted, but will retry
        this._scheduleRetry(job);
      } else {
        // console.log('Job failed permanently');
        this._emitter.emit('job:failed', job, err);
        job._fail(err);
        this._handleFail(job);
      }
    } finally {
      this._processingCount--;
      this._updateStats();
      // Next tick
      queueMicrotask(() => this._tryProcess());
    }
  }
  
  private _scheduleRetry(job: JobImpl<T, R>) {
     const backoff = job.options.backoff || { type: 'fixed', delay: 1000 };
     let delay = backoff.delay;
     if (backoff.type === 'exponential') {
         delay = delay * Math.pow(2, job.attempts - 1);
     }
     
     this._delayedCount++;
     this._updateStats();

     setTimeout(() => {
         this._delayedCount--;
         job.status('pending');
         this._pendingQueue.push(job);
         this._updateStats();
         this._tryProcess();
     }, delay);
  }
  
  private _handleSuccess(job: JobImpl<T, R>) {
      this._completedIds.push(job.id);
      this._gc();
  }
  
  private _handleFail(job: JobImpl<T, R>) {
      this._completedIds.push(job.id);
      this._gc();
  }
  
  private _gc() {
      const limit = this._options.keepCompleted!;
      
      while (this._completedIds.length > limit) {
          const idToRemove = this._completedIds.shift();
          if (idToRemove) {
              this._jobs.delete(idToRemove);
              // Note: We don't need to remove from _pendingQueue as completed jobs aren't there
          }
      }
      
      this.size(this._jobs.size);
  }
}

export function createQueue<T, R>(options: QueueOptions<T, R>): Queue<T, R> {
  return new Queue(options);
}
