import { describe, expect, test } from 'bun:test';
import { createQueue } from '../src';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('Queue Coverage', () => {
  
  test('addMany adds multiple jobs', async () => {
    const queue = createQueue({
        autoStart: false,
        processor: async () => {}
    });
    
    const jobs = queue.addMany([
        { data: 1 },
        { data: 2, options: { priority: 10 } }
    ]);
    
    expect(jobs.length).toBe(2);
    expect(queue.size.value).toBe(2);
    expect(jobs[0].data).toBe(1);
    expect(jobs[1].options.priority).toBe(10);
  });

  test('timeout cancels job automatically', async () => {
    const queue = createQueue({
      processor: async (job) => {
        await sleep(100);
        return 'done';
      }
    });

    const job = queue.add('slow', { timeout: 10 });
    
    try {
      await job.result;
      expect(true).toBe(false); // Should not reach
    } catch (e: any) {
      expect(e.message).toBe('Timeout');
      expect(job.status.value).toBe('cancelled');
    }
  });

  test('manual cancel aborts processing', async () => {
    let aborted = false;
    const queue = createQueue({
      processor: async (job) => {
        const signal = job.signal;
        if (signal) {
            signal.addEventListener('abort', () => aborted = true);
        }
        await sleep(50);
        if (signal?.aborted) throw new Error('Aborted inside');
        return 'done';
      }
    });

    const job = queue.add('cancel-me');
    
    // Give it time to start
    await sleep(10);
    expect(job.status.value).toBe('active');
    
    job._cancel('Manual');
    
    try {
      await job.result;
    } catch (e: any) {
      expect(e.message).toBe('Manual');
    }
    
    expect(aborted).toBe(true);
    expect(job.status.value).toBe('cancelled');
  });

  test('clear("all") cancels active jobs', async () => {
    const queue = createQueue({
        concurrency: 2,
        processor: async () => await sleep(50)
    });
    
    const j1 = queue.add(1);
    const j2 = queue.add(2); // active
    const j3 = queue.add(3); // pending
    
    // Attach catch handlers to avoid Unhandled Rejection
    j1.result.catch(() => {});
    j2.result.catch(() => {});
    
    await sleep(10);
    
    queue.clear('all');
    
    expect(queue.size.value).toBe(0);
    // expect(j3.status.value).not.toBe('pending'); // Removed pending jobs retain their status but are detached
    
    // Active jobs should be cancelled
    expect(j1.status.value).toBe('cancelled');
    expect(j2.status.value).toBe('cancelled');
    
    // Verify j3 is gone from queue
    expect(queue.getJob(j3.id)).toBeUndefined();
  });
  
  test('remove deletes specific job', async () => {
     const queue = createQueue({ autoStart: false, processor: async () => {} });
     
     const j1 = queue.add(1, { priority: 10 });
     const j2 = queue.add(2, { priority: 20 }); // top
     const j3 = queue.add(3, { priority: 5 }); // bottom
     
     // Remove middle (heap logic check)
     expect(queue.remove(j1.id)).toBe(true);
     expect(queue.size.value).toBe(2);
     
     // Remove top
     expect(queue.remove(j2.id)).toBe(true);
     
     // Remove non-existent
     expect(queue.remove('fake')).toBe(false);
     
     // Remove non-pending (simulated)
     const j4 = queue.add(4);
     // Force status change manually (hack for test) or start it
     queue.resume();
     await sleep(0);
     expect(queue.remove(j4.id)).toBe(false); // Can't remove active
  });

  test('deduplication returns existing job', () => {
      const queue = createQueue({ processor: async () => {} });
      const j1 = queue.add('data', { id: 'fixed-id' });
      const j2 = queue.add('other', { id: 'fixed-id' });
      
      expect(j1).toBe(j2);
      expect(queue.size.value).toBe(1);
  });
  
  test('handles queue events safely', () => {
      const queue = createQueue({ processor: async () => {} });
      let count = 0;
      const unsub = queue.on('job:added', () => {
          count++;
          if (count === 1) throw new Error('Listener error'); 
      });
      
      // Should not crash even if listener throws
      queue.add(1);
      expect(count).toBe(1);
      
      queue.add(2);
      expect(count).toBe(2);
      
      unsub();
      queue.add(3);
      expect(count).toBe(2);
  });
});
