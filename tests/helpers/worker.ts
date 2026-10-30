import { createCoverageMap, type CoverageMapData } from '@vitest/istanbul-lib-coverage';
import { rpc, type Port } from '../../src/rpc';

export function testWorker(url: URL) {
  const worker = new Worker(url, { type: 'module' });
  let latest: CoverageMapData | undefined;
  const port: Port = {
    onmessage: null, onerror: null,
    postMessage: message => worker.postMessage(message),
    terminate() {
      worker.terminate();
      const host = globalThis as typeof globalThis & { __VITEST_COVERAGE__?: CoverageMapData };
      const map = createCoverageMap(host.__VITEST_COVERAGE__ ?? {});
      if (latest) map.merge(latest);
      host.__VITEST_COVERAGE__ = map.toJSON();
    },
  };
  worker.onmessage = event => {
    latest = event.data.coverage;
    port.onmessage?.(new MessageEvent('message', { data: event.data.message }));
  };
  worker.onerror = event => port.onerror?.(event);
  return rpc(port);
}
