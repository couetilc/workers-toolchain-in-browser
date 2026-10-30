# E04 Real Worker coverage

Status: positive and negative controls passed locally on 2026-10-30.

## Why this experiment exists

Running Vitest in a browser does not by itself prove that coverage includes code executing in a Worker. The probe has two branches and communicates through a real browser Worker. No Worker mock or direct main-thread import stands in for execution.

## Observed behavior

1. With `@vitest/coverage-v8@5.0.5`, both worker assertions passed, but the worker was reported at **0%** across all metrics. Explicit source inclusion caught the gap instead of omitting the file.
2. Switched to `@vitest/coverage-istanbul@5.0.5`. Vitest instruments the worker module served through Vite. A test-only worker entry wraps outgoing messages to attach the worker's coverage snapshot.
3. The test retains the final cumulative snapshot and merges it into the page's coverage with `@vitest/istanbul-lib-coverage@1.0.2`. The application worker has no coverage transport or test hooks.
4. With the second branch deliberately skipped, the worker reports **50% branch coverage**, and the unchanged 100% gate exits 1.
5. With both branches exercised, the entire application report passes at **100% statements, branches, functions, and lines per file**. At this checkpoint: 19 tests, 11 source modules.

Run `npm run test:coverage:worker-proof` to reproduce both controls. Its script checks the exit status and actual worker branch counters; an unrelated failing test or missing worker report cannot satisfy the proof. Normal `npm run test:coverage` runs the positive suite.

## Boundaries and maintenance

- The test bridge uses the pinned Vitest provider's internal `__VITEST_COVERAGE__` store. Preserve this proof when upgrading Vitest; it is an explicit compatibility dependency, not a public browser API.
- The final worker snapshot must be collected before termination. Future worker adapters need their own test wrapper and coverage merge; this probe does not automatically capture every library-created worker.
- Dependencies, fixtures, test/build infrastructure, and generated code are outside application coverage. All owned application source under `src/` and each experiment's `src/`, including workers and unimported TS/TSX/JS/JSX files, remains explicitly included. No application exclusion or coverage-ignore directive was added.
- Chromium runs the coverage gate. Other browsers have separate integration evidence; browser-mode testing is not a claim of identical behavior across engines.
- The Istanbul dependency graph requires newer Node than the original host 24.10.0. Host tooling is now pinned to 24.11.0 in `.node-version`. This is independent of WebContainer's reported Node 22.22.3.

Sources: [Vitest coverage documentation](https://vitest.dev/guide/coverage.html), installed provider source at `node_modules/@vitest/coverage-istanbul/dist/`, and executable tests in `tests/unit/worker-coverage.test.ts`. Initial V8 and negative-control JSON reports are retained as ignored local artifacts under `experiments/e04-worker-coverage/artifacts/`.
