# M7 prototype validation

This report records the initial M7 acceptance. Subsequent user-reported command-overlap fixes and current test totals are recorded in [R020](../RESEARCH_LOG.md#r020-user-reported-initialization-and-command-overlap).

Date: 2026-10-30. Local MacBookAir10,1 / Apple M1 / 16 GiB RAM. Host Node 24.11.0. Initial acceptance browser: Playwright Chromium 156.0.8078.4.

## Verified capabilities

| Capability | Evidence | Boundary |
| --- | --- | --- |
| Actual Vite/React in browser | E01, built workspace and Pi Playwright flows | WebContainers, external runtime assets and package installation required |
| TS diagnostics, completion, hover, definition | E02 and real CodeMirror UI interactions | TypeScript 6 JS/VFS API and bundled declarations; no tsrs or LSP |
| Persistent files and conversations | Real SQLite/OPFS worker tests and UI reload | One editing tab; explicit drafts; SQLite is authoritative |
| Atomic edits, conflicts, rollback | Real SQL tests, shared workspace tests, human/Pi conflict UI | No collaborative editing or automatic replay |
| Worker failures | Actual worker exception rejects outstanding RPC; OPFS reopen after abrupt worker termination | No claim about power-loss durability or automatic worker restart |
| Pi agent and browser tools | Real Pi 1.4.0; fixture external inference through actual proxy | Browser tools list/read/edit/check/build; no shell |
| Live inference | `openrouter/free` changed heading, checked, built, and persisted | One live smoke pass, 36.9 seconds; underlying routed model not pinned |
| Cancel/error/reload recovery | Streaming cancel, provider disconnect, failed tool, interrupted-session UI | Saved edits remain; a running build can finish after result cancellation |
| Visible UI | Desktop and 375px screenshots inspected; no horizontal overflow | Prototype editor, not a full IDE/file manager |
| Proxy API | Real HTTP tests, Origin rejection, server-owned provider/key/model | Loopback-only local prototype; production authentication unimplemented |

## Validation commands

- `npm run check`: passed.
- `npm run test:coverage:worker-proof`: negative worker branch must fail at 50%, followed by full 100% per-file coverage. 62 tests passed across 30 application files/entries; all four metrics were 100% per file. Final totals are recorded in R019.
- `npm run build`: passed; expected compiler/bundle size warnings remain visible.
- `npm run test:integration:built`: all eight Chromium UI/API tests passed against the final application build in approximately 1.2 minutes.
- `npm run test:live`: real free OpenRouter test passed in 38.5 seconds total, separately from deterministic acceptance.
- `npm run test:workload`: all three measurements passed, including actual compiler-worker round trips.

Browser application units run in actual Chromium via Vitest Browser Mode. Proxy and launch configuration run under Vitest Node. Owned workers contribute real execution coverage through the tested snapshot bridge. Source inclusion also catches unimported application modules; no thresholds are relaxed. The proxy launch script itself is included. Build/test/config infrastructure and fixtures are outside application coverage.

## Reproducible source installation

Copied all Git-visible source files into a fresh temporary directory, excluding ignored files, `.env`, installed dependencies, and prior build output. This is an isolated source snapshot of uncommitted work, not a claim that a committed checkout exists.

`npm ci --ignore-scripts --no-audit --no-fund`, `npm run check`, and `npm run build` passed there. All 20 built files matched the working-tree build byte-for-byte. The API credential was absent from all built assets. Both host and embedded project lockfiles pin dependencies.

Main workspace JS: 621.38 kB minified / 200.82 kB gzip. TypeScript worker including declarations: 8,690.18 kB uncompressed. SQLite WASM: 879.08 kB / 411.62 kB gzip. These are bundle sizes, not complete runtime network costs. WebContainer assets/package installation and worker memory are not fully observable from the host page.

## Workload comparison

Same device and fixtures as E03, no concurrent test/build jobs. Fresh browser contexts; upstream/host caches remain uncontrolled. Raw [final samples](../../experiments/e03-workload/results/2026-10-30-m7-final.json) and [first M7 repeat](../../experiments/e03-workload/results/2026-10-30-m7.json) are retained alongside the original baseline.

| Larger fixture: 256 TS files | M2 baseline | Final M7 repeat |
| --- | --- | --- |
| Start to interactive | 12,722 ms | 14,036 ms |
| HMR observations | 134 / 123 / 120 ms | 117 / 125 / 115 ms |
| First build to preview | 4,440 ms | 4,609 ms |
| Repeated builds | 2,882 / 2,901 ms | 2,883 / 2,852 ms |
| In-process changed-file diagnostics | 80.9 / 53.2 / 52.7 ms | 84.9 / 54.1 / 50.9 ms |

Warm build/HMR behavior remains within the provisional 5-second/250-ms targets. Startup was 1.3 seconds slower in the final sample; with uncontrolled caches and few observations, this does not establish a regression or cause.

The additional test loads the actual application TypeScript worker through Vite, syncs the same 256-file graph, then measures snapshot cloning/RPC/update plus a changed-file diagnostic query. Initial worker load/sync/query took 660 ms; subsequent edit round trips were **27.3 / 21.8 / 15.6 ms**, all below the provisional 200-ms target. Each result must contain the newly introduced real TS2322 errors. This is a focused worker measurement, distinct from E03's all-file in-process diagnostic query and from complete editor interaction latency. Memory and total runtime download size remain unavailable.

## Browser support

| Browser | Original Vite probe | TS probe | Complete workspace/Pi |
| --- | --- | --- | --- |
| Chromium | Passed | Passed, including subsequent offline analysis | Passed; acceptance target |
| Playwright WebKit | Passed locally in M2 | Passed | Not certified |
| Firefox | Vite starts; embedded preview relay/service-worker failure | Passed | Unsupported in this configuration |

The original browser-specific failure is retained; security defaults were not disabled. Current full application coverage is not a cross-browser compatibility guarantee.

## Remaining work

- Cloudflare Worker compilation and browser-hosted workerd remain a separate feasibility investigation. The first-goal prototype does not establish either capability.
- Production authentication, deployment, runtime licensing/distribution, arbitrary dependency/type acquisition, multi-project management, collaboration, and offline startup remain outside this prototype.
- TypeScript's large static payload and runtime/package startup warrant deployment-specific work before a production product. Same-file-set edits now reuse the language service; no responsiveness guarantee is inferred from the isolated E03 service measurements.
- Hosted CI is authored but unexecuted. Nothing was deployed, committed, or pushed in this session.
