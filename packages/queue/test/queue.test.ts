import { describe, expect, test, mock } from 'bun:test';
import { createQueue } from '../src';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('Queue', () => {
  test('processes jobs in FIFO order by default', async () => {
    const results: number[] = [];
    const queue = createQueue<number, void>({
      processor: async (job) => {
        results.push(job.data);
      }
    });

    queue.add(1);
    queue.add(2);
    queue.add(3);

    await queue.drain();
    expect(results).toEqual([1, 2, 3]);
  });

  test('respects concurrency', async () => {
    let running = 0;
    let maxRunning = 0;
    
    const queue = createQueue({
      concurrency: 2,
      processor: async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await sleep(10);
        running--;
      }
    });

    for(let i=0; i<5; i++) queue.add(i);
    
    await queue.drain();
    expect(maxRunning).toBe(2);
  });

  test('handles priority correctly', async () => {
    const results: string[] = [];
    const queue = createQueue<string, void>({
      autoStart: false,
      processor: async (job) => {
        results.push(job.data);
      }
    });

    queue.add('low', { priority: 0 });
    queue.add('high', { priority: 100 });
    queue.add('normal', { priority: 10 });
    queue.add('critical', { priority: 1000 });

    expect(queue.isPaused.value).toBe(true);
    expect(results.length).toBe(0);

    queue.resume();
    await queue.drain();

    expect(results).toEqual(['critical', 'high', 'normal', 'low']);
  });

  test('removes old completed jobs (GC)', async () => {
    const queue = createQueue({
      keepCompleted: 2,
      processor: async () => {}
    });

    queue.add(1); // will be removed
    queue.add(2); // will be kept
    queue.add(3); // will be kept
    
    await queue.drain();
    
    expect(queue.getJob('job-1')).toBeUndefined();
    expect(queue.getJob('job-2')).toBeDefined();
    expect(queue.getJob('job-3')).toBeDefined();
  });

  test('retries failed jobs', async () => {
    let attempts = 0;
    const queue = createQueue({
      processor: async () => {
        attempts++;
        if (attempts <= 2) throw new Error('Fail');
        return 'Success';
      }
    });

    const job = queue.add('test', { 
        retries: 3, 
        backoff: { type: 'fixed', delay: 10 } 
    });
    
    await queue.drain();
    
    expect(job.status.value).toBe('completed');
    expect(attempts).toBe(3); // 1 initial + 2 retries
  });
  
  test('pauses and resumes', async () => {
      const results: number[] = [];
      const queue = createQueue<number, void>({
          processor: async (job) => results.push(job.data)
      });
      
      queue.pause();
      queue.add(1);
      
      await sleep(20);
      expect(results.length).toBe(0); // Should not process
      
      queue.resume();
      await queue.drain();
      expect(results.length).toBe(1);
  });
});

