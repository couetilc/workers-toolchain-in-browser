const cancelled = () => new DOMException('Job cancelled or superseded', 'AbortError');

/** One running job and one replaceable pending job; stale results never publish. */
export function latestQueue<Input, Output>(execute: (input: Input, signal: AbortSignal) => Promise<Output>) {
  type Job = { id: number; input: Input; resolve: (value: Output) => void; reject: (reason: unknown) => void };
  let generation = 0;
  let pending: Job | undefined;
  let running: { job: Job; controller: AbortController } | undefined;
  async function pump() {
    const job = pending!;
    pending = undefined;
    const controller = new AbortController();
    running = { job, controller };
    try {
      const result = await execute(job.input, controller.signal);
      if (job.id === generation) job.resolve(result);
      else job.reject(cancelled());
    } catch (error) { job.reject(error); }
    finally {
      running = undefined;
      if (pending) void pump();
    }
  }
  return {
    submit(input: Input) {
      pending?.reject(cancelled());
      const promise = new Promise<Output>((resolve, reject) => {
        pending = { id: ++generation, input, resolve, reject };
      });
      if (!running) void pump();
      return promise;
    },
    cancel() {
      generation++;
      pending?.reject(cancelled());
      pending = undefined;
      running?.job.reject(cancelled());
      running?.controller.abort();
    },
  };
}
