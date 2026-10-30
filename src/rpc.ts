export type Reply = { id: number; value?: unknown; error?: string };
export interface Port {
  onmessage: ((event: MessageEvent<Reply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

/** Bounded callers use the queue; a worker crash rejects every outstanding call. */
export function rpc(port: Port) {
  let next = 0;
  let closed = false;
  const requests = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  function close(message: string) {
    closed = true;
    for (const request of requests.values()) request.reject(new Error(message));
    requests.clear();
    port.terminate();
  }
  port.onmessage = ({ data }) => {
    const request = requests.get(data.id);
    if (!request) return;
    requests.delete(data.id);
    if (data.error !== undefined) request.reject(new Error(data.error));
    else request.resolve(data.value);
  };
  port.onerror = event => close(event.message);
  return {
    call<T>(method: string, payload: unknown): Promise<T> {
      if (closed) return Promise.reject(new Error('Worker closed'));
      return new Promise((resolve, reject) => {
        const id = ++next;
        requests.set(id, { resolve, reject });
        try { port.postMessage({ id, method, payload }); }
        catch (error) { requests.delete(id); reject(error); }
      });
    },
    close: () => close('Worker closed'),
  };
}

export function serve(handle: (method: string, payload: any) => unknown | Promise<unknown>, scope: Pick<Worker, 'onmessage' | 'postMessage'>) {
  let tail = Promise.resolve();
  scope.onmessage = ({ data }) => {
    tail = tail.then(async () => {
      try { scope.postMessage({ id: data.id, value: await handle(data.method, data.payload) }); }
      catch (error) { scope.postMessage({ id: data.id, error: String(error) }); }
    });
  };
}
