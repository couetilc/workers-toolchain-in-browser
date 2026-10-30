import { afterAll, beforeAll, expect, it } from 'vitest';
import { createCoverageMap, type CoverageMapData } from '@vitest/istanbul-lib-coverage';

let worker: Worker;
let latestCoverage: CoverageMapData | undefined;
beforeAll(() => {
  worker = new Worker(new URL('../fixtures/coverage-worker.ts', import.meta.url), { type: 'module' });
});
afterAll(() => {
  worker.terminate();
  const host = globalThis as typeof globalThis & { __VITEST_COVERAGE__?: CoverageMapData };
  const coverage = createCoverageMap(host.__VITEST_COVERAGE__ ?? {});
  if (latestCoverage) coverage.merge(latestCoverage);
  host.__VITEST_COVERAGE__ = coverage.toJSON();
});

function classify(value: number) {
  return new Promise<string>((resolve, reject) => {
    worker.onmessage = event => {
      latestCoverage = event.data.coverage;
      resolve(event.data.message);
    };
    worker.onerror = reject;
    worker.postMessage(value);
  });
}

it('executes the positive branch in a real browser Worker', async () => {
  expect(await classify(1)).toBe('positive');
});

it.skipIf(import.meta.env.VITE_COVERAGE_NEGATIVE === '1')('executes the other branch in the same real Worker', async () => {
  expect(await classify(0)).toBe('nonpositive');
});
