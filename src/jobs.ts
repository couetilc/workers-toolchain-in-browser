export type JobState = 'queued' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled';
export interface JobEvent<T> { id: number; key: string; task: T; state: JobState; error?: unknown }

/** Explicit commands serialize; identical requests join the same promise. */
export function serialJobs<T>(execute: (task: T, signal: AbortSignal) => Promise<unknown>, changed: (event: JobEvent<T>) => void) {
  type Job = JobEvent<T> & { controller: AbortController; result: ReturnType<typeof Promise.withResolvers<unknown>> };
  const jobs = new Map<string, Job>();
  const pending: Job[] = [];
  let running: Job | undefined;
  let next = 0;
  const publish = (job: Job, state: JobState, error?: unknown) => { job.state = state; changed({ id: job.id, key: job.key, task: job.task, state, error }); };
  async function pump() {
    const job = pending.shift()!;
    running = job; publish(job, 'running');
    try {
      const value = await execute(job.task, job.controller.signal);
      job.controller.signal.throwIfAborted();
      publish(job, 'succeeded'); job.result.resolve(value);
    } catch (error) {
      publish(job, job.controller.signal.aborted ? 'cancelled' : 'failed', error);
      job.result.reject(error);
    } finally {
      jobs.delete(job.key); running = undefined;
      if (pending.length) void pump();
    }
  }
  return {
    submit(key: string, task: T) {
      const existing = jobs.get(key);
      if (existing) return existing.result.promise;
      if (pending.length >= 8) {
        const error = new Error('Project task queue is full. Wait for current work to finish.');
        changed({ id: ++next, key, task, state: 'failed', error });
        return Promise.reject(error);
      }
      const job: Job = { id: ++next, key, task, state: 'queued', controller: new AbortController(), result: Promise.withResolvers<unknown>() };
      jobs.set(key, job); pending.push(job); publish(job, 'queued');
      if (!running) void pump();
      return job.result.promise;
    },
    cancel(matches: (task: T) => boolean) {
      for (const job of [...pending]) {
        if (!matches(job.task)) continue;
        pending.splice(pending.indexOf(job), 1); jobs.delete(job.key);
        job.controller.abort(); publish(job, 'cancelled'); job.result.reject(job.controller.signal.reason);
      }
      if (running && matches(running.task)) { running.controller.abort(); publish(running, 'cancelling'); }
    },
  };
}
