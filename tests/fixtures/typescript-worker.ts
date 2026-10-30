import '../../src/typescript.worker';
import type { CoverageMapData } from '@vitest/istanbul-lib-coverage';
const send = self.postMessage.bind(self);
self.postMessage = message => send({ message, coverage: (globalThis as typeof globalThis & { __VITEST_COVERAGE__?: CoverageMapData }).__VITEST_COVERAGE__ });
