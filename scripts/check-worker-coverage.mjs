import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

function run(negative) {
  const result = spawnSync('npm', ['run', 'test:coverage'], {
    env: { ...process.env, VITE_COVERAGE_NEGATIVE: negative ? '1' : '0' },
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  assert.equal(result.error, undefined);
  assert.equal(result.status, negative ? 1 : 0);
  if (negative) assert.match(result.stderr, /Coverage for branches \(50%\).*threshold \(100%\).*probe\.worker\.ts/);
  const coverage = JSON.parse(readFileSync('coverage/coverage-final.json', 'utf8'));
  const worker = Object.entries(coverage).find(([path]) => path.endsWith('/e04-worker-coverage/src/probe.worker.ts'))?.[1];
  assert.ok(worker, 'Worker must appear in the report');
  const branches = Object.values(worker.b).flat();
  assert.equal(branches.length, 2);
  assert.ok(branches[0] > 0, 'Positive branch must execute in the worker');
  assert.equal(branches[1] > 0, !negative, 'Negative control must leave exactly the other branch uncovered');
}

run(true);
console.log('Verified: executing only one worker branch fails the coverage gate.');
run(false);
console.log('Verified: executing both worker branches passes the full 100% gate.');
