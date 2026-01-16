import { Qv, type IQuark } from '@alaq/quark';
import type { Job, JobOptions, JobStatus } from './types';

export class JobImpl<T, R> implements Job<T, R> {
  public readonly id: string;
  public readonly data: T;
  public readonly options: JobOptions;

  public readonly status: IQuark<JobStatus>;
  public readonly progress: IQuark<number>;
  public readonly error: IQuark<Error | null>;

  public attempts = 0;
  
  private _resolve!: (value: R | PromiseLike<R>) => void;
  private _reject!: (reason?: any) => void;
  public readonly result: Promise<R>;
  
  private _abortController: AbortController | null = null;
  private _timeoutId: any = null;

  constructor(id: string, data: T, options: JobOptions = {}) {
    this.id = id;
    this.data = data;
    this.options = {
      priority: 0,
      retries: 0,
      ...options
    };

    this.status = Qv<JobStatus>('pending');
    this.progress = Qv(0);
    this.error = Qv<Error | null>(null);

    this.result = new Promise<R>((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  get signal(): AbortSignal | undefined {
    return this._abortController?.signal;
  }

  async _start(processor: (job: Job<T, R>) => Promise<R> | R): Promise<R> {
    if (this.status() === 'cancelled') {
        throw new Error('Job cancelled');
    }

    this.status('active');
    this.attempts++;
    this._abortController = new AbortController();

    // Timeout handling
    if (this.options.timeout) {
      this._timeoutId = setTimeout(() => {
        this._cancel('Timeout');
      }, this.options.timeout);
    }

    try {
      const result = await processor(this);
      
      if (this.status.value !== 'cancelled') { // Double check
        this.status('completed');
        this.progress(100);
        this._resolve(result);
        return result;
      }
      // If cancelled during processing, Promise is already rejected
      throw new Error('Job cancelled during processing');
      
    } catch (err: any) {
      if (this.status.value === 'cancelled') {
          throw err; // Already handled
      }
      // Don't reject yet, let Queue decide if retry is needed
      throw err;
    } finally {
      this._cleanup();
    }
  }

  _fail(err: any): void {
      this.error(err);
      this.status('failed');
      this._reject(err);
  }



  _cancel(reason: string = 'Cancelled'): void {
    if (this.status() === 'completed' || this.status() === 'failed') return;

    this.status('cancelled');
    this.error(new Error(reason));
    
    if (this._abortController) {
      this._abortController.abort();
    }
    
    this._reject(new Error(reason));
    this._cleanup();
  }

  private _cleanup() {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
    this._abortController = null;
  }
}