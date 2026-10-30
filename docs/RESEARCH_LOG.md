# Browser toolchain research log

Chronological evidence for the [prototype plan](PLAN.md). Keep source findings distinct from experiments. Append corrections with references to earlier entries. A package description or source inspection does not establish that a configuration runs in our browser harness.

## R001 Vite execution boundary

- Date: 2026-10-29.
- Question: does actual Vite have a supported path to browser execution?
- Evidence: upstream documentation and source inspection; no local browser execution.
- Source revision: `vitejs/vite` at `cce559ab158cc6b177d0911a0bea73436b48faff`, obtained with `git ls-remote https://github.com/vitejs/vite.git HEAD`.
- Findings: the package's primary export is under `dist/node`; its server imports Node filesystem, HTTP, and child-process modules. A browser import of the client runtime is not equivalent to running the build/dev server. Vite's guide explicitly identifies StackBlitz as a browser-hosted Vite setup.
- Implication: investigate a browser Node-compatible runtime before considering a reimplementation.
- Sources: [package entry points](https://github.com/vitejs/vite/blob/cce559ab158cc6b177d0911a0bea73436b48faff/packages/vite/package.json), [server imports](https://github.com/vitejs/vite/blob/cce559ab158cc6b177d0911a0bea73436b48faff/packages/vite/src/node/server/index.ts), [Vite online](https://vite.dev/guide/#trying-vite-online).
- Next: pin the runtime and transitive binding versions for E01; verify browser execution rather than host compilation.

## R002 WebContainers candidate and constraints

- Date: 2026-10-29.
- Question: what is required to run Vite through WebContainers?
- Evidence: upstream documentation, not a local experiment.
- Findings: WebContainers describes browser-local Node application execution and names Vite. Its support guide requires SharedArrayBuffer/cross-origin isolation and documents browser-dependent preview limitations. The guide is internally inconsistent about Firefox's alpha/beta label; neither label establishes our compatibility. Its troubleshooting guide says native addons need JavaScript or WASM alternatives. The commercial-use page states prototypes/POCs do not require a commercial license and commercial production use does; this records the vendor's statement, not a production licensing decision.
- Implication: E01 must test exact dependency bindings, required headers, preview networking, and browser support. The existence of a native package is insufficient. Runtime processes can be controlled without adding terminal UI.
- Sources: [runtime introduction](https://webcontainers.io/guides/introduction), [browser support](https://webcontainers.io/guides/browser-support), [native addon limitations](https://webcontainers.io/guides/troubleshooting#cannot-load-native-addon-error), [commercial usage](https://webcontainers.io/enterprise).
- Next: record runtime asset/network dependencies and reproducibility of dependency acquisition in E01.

## R003 tsrs WASM and language server boundary

- Date: 2026-10-29.
- Question: is the missing browser language server a transport adapter or more substantial work?
- Evidence: documentation and pinned source inspection; no compilation or port attempted.
- Source revision: `oxc-project/tsrs` at `ce0b047a3f6b0fb8d5a7713bb744273cb50b41fa`, obtained with `git ls-remote https://github.com/oxc-project/tsrs.git HEAD`.
- Findings: the WASM README excludes LSP, watch, and the API server; it describes fresh compiler instances per call. The WASM crate is a library and does not list the LSP crate as a dependency. The native server uses blocking I/O abstractions, synchronization, and thread creation.
- Inference: adding CodeMirror message transport would not enable this shipped WASM package's LSP. A port would need runtime/lifecycle investigation beyond protocol wiring; effort has not been estimated.
- Decision: keep tsrs out of prototype dependencies under D002. Its compiler capability remains a research finding, not permission to substitute it for the required service.
- Sources: [WASM limits](https://github.com/oxc-project/tsrs/blob/ce0b047a3f6b0fb8d5a7713bb744273cb50b41fa/npm/tsrs-wasm/README.md), [WASM manifest](https://github.com/oxc-project/tsrs/blob/ce0b047a3f6b0fb8d5a7713bb744273cb50b41fa/crates/tsrs_wasm/Cargo.toml), [native server](https://github.com/oxc-project/tsrs/blob/ce0b047a3f6b0fb8d5a7713bb744273cb50b41fa/crates/tsrs_lsp/src/server.rs).
- Research correction: an attempted `crates/tsrs_wasm/src/main.rs` read returned 404; the manifest identifies a library crate and `src/lib.rs` exists. No negative capability claim is based on that failed lookup.
- Next: identify a shipped browser TypeScript semantic service without choosing an editor first.

## R004 Rolldown browser package and Vite compatibility

- Date: 2026-10-29.
- Question: does a browser build of Vite's bundler resolve Vite's runtime requirements?
- Evidence: pinned source and upstream project instructions; tests described upstream were not run here.
- Source revision: `rolldown/rolldown` at `f99560b2c227a171106cad013b52c75900250942`, obtained with `git ls-remote https://github.com/rolldown/rolldown.git HEAD`.
- Findings: `@rolldown/browser` has browser-specific exports and WASM runtime dependencies. Upstream describes separate real-browser and WebContainer suites. The inspected Vite manifest depends on Rolldown and Lightning CSS; their exact binding paths must be verified together.
- Implication: a browser bundler is a candidate component, not proof of Vite server/plugin/HMR compatibility. Upstream test descriptions are useful starting points for our experiment.
- Sources: [browser manifest](https://github.com/rolldown/rolldown/blob/f99560b2c227a171106cad013b52c75900250942/packages/browser/package.json), [upstream browser test workflow](https://github.com/rolldown/rolldown/blob/f99560b2c227a171106cad013b52c75900250942/AGENTS.md#browser-ci), [Vite dependencies](https://github.com/vitejs/vite/blob/cce559ab158cc6b177d0911a0bea73436b48faff/packages/vite/package.json).
- Next: inspect published artifacts and the upstream WebContainer harness before pinning E01.

## R005 Planning checkpoint

- Date: 2026-10-29.
- Local repository baseline: `6a1c23a`; README only before this documentation change.
- Local tooling observed: Node `v24.10.0`, npm `11.6.1`. These are host research tools, not evidence of the browser runtime's Node version.
- Work completed: milestone plan, research log, decisions, continuation instructions, and initial source investigation.
- Work not performed: dependency installation, browser toolchain experiment, unit tests, coverage collection, UI implementation, deployment.
- Next action: complete M1's published dependency audit, then implement E01 with an actual Vite-in-browser fixture and Playwright observations.

## R006 Published package audit

- Date: 2026-10-29.
- Question: which published versions should the runtime experiment evaluate, and are source defaults sufficient?
- Evidence: direct npm registry metadata, saved in [the package snapshot](research/2026-10-29-package-metadata.json). No installation or execution.
- Observed candidates: Vite `8.3.5`, WebContainer API `1.6.4`, React plugin `6.1.2`, Rolldown `1.2.16`, Lightning CSS `1.33.0`, TypeScript `7.0.2`, TypeScript VFS `1.6.5`.
- Finding: published Vite `8.3.5` depends on `rolldown ~1.2.14`, while the inspected repository manifest with the same Vite version says `~1.2.15`. Published metadata and source HEAD must not be conflated. E01 needs a lockfile and actual installed versions.
- Finding: React plugin `6.1.2` accepts Vite 8 and marks its Oxc React/Babel/compiler peers optional. Record whether the fixture enables any of these paths rather than adding them without need.
- Finding: TypeScript `latest` is `7.0.2`; its manifest uses native platform packages and exports unstable API entry points. The classic JavaScript language service cannot be assumed available by installing `typescript@latest`.
- Candidate evidence: the [official TypeScript VFS documentation](https://www.typescriptlang.org/dev/typescript-vfs/) describes an in-memory compiler and language-service environment used by the Playground. Its compatible compiler version and browser bundle still need verification; the VFS peer range alone does not prove compatibility with TypeScript 7.
- Interpretation: pinning a browser-capable TypeScript implementation is part of M1, not a detail to defer until editor integration. Evaluate its version/semantic differences explicitly if it is an older compiler line.
- Sources: version-specific registry URLs and artifact integrity values are retained in the snapshot. The WebContainer SDK's MIT package license does not establish the terms of the runtime service; retain R002's separate runtime-terms finding.
- Next: finish loader inspection and select the semantic-service candidate. Then execute [E01](research/E01-vite-runtime.md); do not use unpinned `latest` dependencies.

## R007 Loader audit and executable candidate selection

- Date: 2026-10-30.
- Evidence: npm published tarball inspection and registry metadata; details and sources in [M1 result](research/M1-feasibility.md).
- Findings: Rolldown's WebContainer fallback performs a separate pnpm install of a matching WASI binding. Vite's default development CSS transformer is PostCSS, but production minification can load native Lightning CSS. React Compiler is an optional path in the React plugin. TypeScript 6.0.3 still publishes the JavaScript compiler API; evaluate it with VFS 1.6.5 independently from the TypeScript 7 native release.
- Action: closed the M1 research gate and selected E01/E02 under D005. Installed exact host experiment/test dependencies with `npm install --ignore-scripts --no-audit --no-fund`; generated the browser fixture lockfile with `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` in its directory. These host commands are not browser execution evidence.
- Next: run the minimal browser harness. Preserve runtime-access failures separately from toolchain failures.

## R008 Actual Vite development and build-process investigation

- Date: 2026-10-30. Evidence: executed Playwright Chromium tests and captured runtime JSONL, not source-only inference.
- Environment: host Node 24.10.0; Playwright 1.64.1 Chromium 156.0.8078.4; browser runtime reported Node 22.22.3 and WebContainer revision `f8d6b2be`.
- Browser fixture: Vite 8.3.5, React plugin 6.1.2, React/ReactDOM 19.3.1; Rolldown 1.2.16. The browser log confirms its separate `@rolldown/binding-wasm32-wasi@1.2.16` acquisition.
- Executed `npm run test:e01`. Verified actual Vite development startup, interactive React render, component HMR retaining counter state, imported-module and CSS updates, dynamic import, syntax-error overlay and recovery, and forwarded runtime errors.
- First run emitted production assets and printed successful build output, but the integration test timed out before preview. A second diagnostic run recorded process exit 0 while stdout stayed open. The harness had awaited both and was stuck on stream completion. Fixed it to use process exit for command completion while continuing independent log collection. Added a browser unit regression with a deliberately open output stream and later output/error events.
- Corrected another harness issue: dev-server readiness could overwrite production-build status. The harness now distinguishes the requested preview port. Removed the speculative CSS-minification workaround: these runs did not demonstrate a native CSS failure, so there is no evidence to justify disabling default behavior.
- Artifacts: ignored local `experiments/e01-vite-runtime/artifacts/first-run.jsonl` and `process-exit-stream-open.jsonl`; subsequent Playwright runs write named JSONL/network files under `test-results/` and retain failure traces/screenshots.
- One diagnostic rerun was invalidated by a host tsconfig edit causing a harness reload; it is not a toolchain compatibility failure. Subsequent tests ran with the configuration held stable.
- Next: verify production preview after the harness fix, probe other browsers, and collect workload baselines.

## R009 Browser TypeScript API proof

- Date: 2026-10-30. Evidence: real compiler execution in Vitest Browser Mode and Playwright Chromium.
- Versions, fixture, commands, and boundaries: [E02 report](research/E02-typescript.md).
- Result: cross-file TSX type error detected and corrected; hover, definition navigation, and member completions verified. Browser context goes offline before edit/recheck, which still succeeds. Unit tests additionally verify syntax diagnostics.
- Commands: `npm run check` passed; `npm run test:coverage` passed with 100% statements, branches, functions, and lines per file across all seven application modules at this checkpoint. Application worker collection remains unverified because these spikes have not introduced an owned worker adapter yet.
- Decision: retain TypeScript 6/VFS as a demonstrated candidate. Do not claim an LSP implementation or TypeScript 7 parity. No editor dependency has been installed.
- Next: cross-browser results and larger-fixture measurements before closing M2.

## R010 Browser compatibility and default production build

- Date: 2026-10-30. Command: `npm run test:browsers`; 5 passed, 1 failed. Browser fixture defaults were preserved.
- Chromium and Playwright WebKit passed the entire Vite development/HMR/error/recovery/build/preview flow. TypeScript passed in Chromium, Firefox, and WebKit, including offline subsequent analysis.
- Firefox started Vite but could not render the iframe. Runtime error: `Relay could not find a running service worker.` This is a preview-delivery failure, not evidence that the compiler itself failed. No browser security settings were disabled to obtain a pass.
- Sources and full result: [E01](research/E01-vite-runtime.md). Upstream browser support documentation notes Firefox embedded-preview limitations, but its separate-window suggestion has not been validated here.
- Artifacts copied to ignored `experiments/e01-vite-runtime/artifacts/cross-browser-2026-10-30/` before later test runs could overwrite `test-results/`.
- Decision: D006 selects Chromium as initial acceptance browser; WebKit remains a passing local compatibility probe, Firefox preview remains unsupported in this configuration.

## R011 Workload data closes M2

- Date: 2026-10-30. Command: `npm run test:workload`; both sizes passed. Environment, individual samples, and limitations: [E03](research/E03-workload.md).
- Initial failed attempts found two experiment defects: an iframe locator also matched the runtime's hidden iframe, and the fixture lacked a CSS import declaration. Corrected the locator to the titled preview and supplied `src/assets.d.ts`; did not disable TypeScript's side-effect import checking.
- Retained the first exploratory samples (Vitest overlapped startup), then reran serially without concurrent test/build jobs. The final test also verifies actual preview reload and changed-file diagnostics, separating them from unchanged cached queries.
- Result: actual Vite builds both fixture sizes; larger-fixture repeated builds were 2.88/2.90 seconds, HMR 120–134 ms, TypeScript initialization 194 ms, first analysis 98 ms, and changed-file diagnostic queries 53–81 ms. These are local samples, not general latency guarantees.
- Memory and complete runtime download size are not available from page-only instrumentation. Recorded that limitation instead of treating page heap/network totals as complete.
- Decision: close the bounded M2 gate, select D006, and start M3 with a long-lived TypeScript worker and revision-aware scheduling. Editor, persistence, and Pi implementation remain sequenced after the foundation.

## R012 Real-worker coverage proof and host tooling

- Date: 2026-10-30. Evidence: [E04](research/E04-worker-coverage.md), actual Vitest browser Worker execution.
- Initial V8 result: both worker assertions passed but worker coverage was 0%; the explicit include caught it. Installed exact Istanbul provider and coverage-map dependencies, retained thresholds, and added a test-only worker snapshot bridge.
- `npm run test:coverage:worker-proof` passed its meta-checks: the negative run exited 1 with exactly one worker branch uncovered (50% worker branch coverage); the positive run passed 19 tests and reached 100% across all four metrics for all 11 source modules. No application file was excluded to get this result.
- Node 24.10.0 emitted engine warnings for the new instrumentation dependency graph. Installed and pinned host Node 24.11.0; ran the proof through `mise exec node@24.11.0 --`. Browser runtime Node is independent.
- CI workflow authored for type checking, negative/positive coverage controls, production build, Chromium integration, and retained artifacts. Its action revisions were checked against upstream repositories. Hosted execution has not occurred.
- Next: implement the workspace/revision contract and bounded queue, then migrate the TypeScript service to a covered worker adapter. Continue using these experiment results as acceptance fixtures.

## R013 Fresh-install and built-harness validation

- Date: 2026-10-30. Host Node 24.11.0.
- `npm ci --ignore-scripts --no-audit --no-fund` succeeded from the lockfile. `npm run check` and `npm run build` passed. The production build includes all three experiment pages and reports the expected large compiler/declaration chunk (~8.68 MB / 1.73 MB gzip).
- `npm run test:integration:built` passed both Chromium flows against `vite preview` serving the production-built harness, including isolation-header assertions. Actual project compilation still runs inside WebContainer; the build of the harness is a separate host operation.
- The complete worker-coverage proof passed after the fresh install: 19 positive-suite tests, 100% per-file statements/branches/functions/lines, and the intentional 50% worker-branch failure detected in the negative run. Coverage inclusion also names future `src/` application code and TSX/JS/JSX files so new source cannot disappear merely by changing its extension or directory.
- Local repository documentation links and whitespace checks passed. No deployment, remote CI execution, commit, or push was performed.
- Current checkpoint: M2 complete, M3 partially complete. Next executable task is the revisioned workspace API and bounded queue, followed by the covered TypeScript worker adapter. Persistence/editor/Pi remain later milestones.

## R014 Revisioned workspace and real TypeScript worker

- Date: 2026-10-30. M3 implementation: `src/workspace.ts`, `queue.ts`, `rpc.ts`, and `typescript.worker.ts`.
- Workspace commits serialize through one owner, compare expected revisions, validate paths, and publish only after storage acknowledges the complete snapshot. A failed save leaves the current revision unchanged. Returned snapshots are copies. Browser runtimes and language services consume snapshots rather than owning canonical files.
- The scheduler permits one running task and one replaceable pending task. Older pending jobs and stale results reject; cancellation rejects callers and signals the running task without permitting overlapping execution if a task ignores abort.
- Worker RPC serializes operations, propagates errors, rejects calls after shutdown, and rejects all outstanding calls on a worker crash. TypeScript runs in a real dedicated worker and rejects stale snapshots/queries. Initial implementation recreates its service on snapshot sync; incremental sync optimization remains measurable work.
- Validation: `npm run check` and browser coverage passed: 34 tests, 15 source modules, all four metrics 100%. Tests include persistence failures, concurrent revision conflicts, cancellation, stale results, transport failure, real-worker semantic queries, and worker errors. Test-only worker snapshots merge into the coverage report.
- Decision: simple queue state is sufficient here; no XState dependency is needed for these bounded transitions. Owned workers will be one TypeScript worker and one SQLite worker, in addition to WebContainer's library-managed workers. CI definition is present; remote CI remains unexecuted.
- Next: M4 SQLite/OPFS behind the storage interface, with exclusive tab ownership and transactional revision checks.

## R015 SQLite/OPFS and persistent UI

- Date: 2026-10-30. Selected `@sqlite.org/sqlite-wasm@3.54.1-build1`; official SQLite SAH pool VFS in a dedicated worker. Sources: [package README](https://github.com/sqlite/sqlite-wasm), [SQLite persistence documentation](https://sqlite.org/wasm/doc/trunk/persistence.md).
- Schema version 1 stores a project revision, file rows, and session status/messages. SQLite is authoritative; WebContainer and TypeScript receive mirrors. Saves use an immediate transaction, compare expected revisions, replace file rows atomically, and roll back on invalid paths or write errors. No executable agent loop is stored in SQLite.
- A browser Web Lock grants one editing tab exclusive ownership of the SAH pool. Another tab receives an actionable message. Tab exit/worker termination releases resources. Running sessions reopen as interrupted and are never replayed automatically.
- Executed real SQLite tests: transaction rollback after a partial write, read-only storage failure, migration guards, interrupted-session recovery, and OPFS reopen after worker termination. A small package type declaration gap required a typed adapter for the supported Emscripten `locateFile` option; the bundled WASM URL is explicit.
- Playwright `workspace --project=chromium` passed: edit, save, second-tab refusal, reload/reopen, TypeScript check, actual Vite preview, and production build. The temporary textarea made persistence reviewable before editor integration.
- Next: CodeMirror 6 adapter and semantic UI flows, preserving the storage/workspace interfaces. Live multi-tab concurrent editing is intentionally outside the single-owner prototype contract.

## R016 CodeMirror, semantic scheduling, and persistence gate

- Date: 2026-10-30. Local Chromium execution. CodeMirror state 6.7.6, view 6.43.15, autocomplete 6.20.4, JavaScript 6.2.5, lint 6.9.7, commands 6.11.1.
- Editor adapters expose real TypeScript completion, hover, definitions, and diagnostics over worker RPC. No LSP was added; tsrs remains excluded. Playwright drives actual CodeMirror text, tooltip, completion popup, and file navigation.
- A visible-UI test found background completion superseding an explicit type check. Foreground requests now prevent background requests until completion. Duplicate CodeMirror module instances during test dependency optimization were resolved with explicit dependency optimization and state/view deduplication.
- Human workflow passes: save/reload, second-tab refusal, actual Vite preview/build, type error/fix, HMR, semantic queries, and 375px viewport without horizontal overflow. Application cleanup releases the session if persisted-conversation loading fails.
- SQL tests exercise real transactions and rollback; worker tests reopen acknowledged state after termination. Startup marks active sessions interrupted without effect replay. RPC crash rejection is covered with an injected error event; it is not a power-loss durability claim.
- Decision: close M4/M5 with D008/D009. Same-file-set compiler snapshots now apply incremental changes to the existing service; adding/removing a source file recreates it. This supersedes R014's initial rebuild-on-every-sync implementation.

## R017 Real Pi and deterministic external inference

- Date: 2026-10-30. Installed current `@earendil-works/pi-agent-core`/`pi-ai` 1.4.0 after the old `@mariozechner` packages reported their rename. Exact package versions and both project lockfiles are retained.
- Pi runs in the browser. Its proxy stream protocol is adapted to a local OpenAI-compatible inference endpoint; server configuration fixes the upstream model/key. The fixture substitutes only external inference, leaving Pi orchestration, tools, SQLite, TypeScript, and WebContainer real.
- `npx playwright test agent --project=chromium`: five tests passed in 40 seconds. Verified prompt→list/read/edit/diagnostics/build→updated preview, persisted completed conversations, failed tools, human revision conflicts, cancellation, broken streaming, reload/interrupted status, and proxy Origin rejection.
- `npm run test:coverage`: 60 tests passed; 29 application modules reached 100% statements, branches, functions, and lines per file. Browser code runs in Chromium; proxy/config tests run in Node. An initial 99.55% branch result correctly failed the gate until repeated draft editing was tested.
- The user's Pi settings initially selected OpenAI/gpt-5.3-codex without credentials. The user then supplied `.env` with `OPENROUTER_API_KEY` and requested free models. `.env` is ignored; its value is never sent to the browser or logged. The proxy defaults to `openrouter/free` and rejects non-free explicit OpenRouter model names.
- Source for the free router and tool-aware routing: [OpenRouter free router](https://openrouter.ai/openrouter/free). The separately invoked `npm run test:live` tests the built UI with real inference; deterministic CI remains independent of provider availability.
- Next: record the live result, run the full production acceptance suite and clean-install coverage proof, and compare workload samples with M2.

## R018 Live free-provider smoke test

- Date: 2026-10-30. `npm run build` then `npm run test:live`, Chromium, the production bundle, real local proxy and real OpenRouter inference.
- Result: passed in 38.5 seconds total (36.9-second test). Pi called read_file, edit_file, diagnostics, and build, changed only the requested heading to `Live Pi verified`, rendered it through browser Vite, then reopened the saved revision and completed conversation after reload.
- Provider route: `openrouter/free`. This route selects a free backend; the test does not claim a fixed underlying model. Source: [OpenRouter router documentation](https://openrouter.ai/openrouter/free).
- Evidence: optional reproducible test `tests/live/pi.spec.ts`; local screenshot retained under ignored `experiments/e06-agent/artifacts/live-2026-10-30/`. Screenshot is after reload, when preview startup is intentionally explicit. The preview assertion passed before reload.
- This is one successful live smoke test, not an availability guarantee or an agent-quality benchmark. CI remains deterministic and independent of credentials. No secret was printed or bundled.
- Next: M7 production acceptance, isolated-source installation, coverage proof, and workload comparison.

## R019 Final validation closes M7

- Date: 2026-10-30. Complete result and support matrix: [M7 validation](research/M7-validation.md).
- Final source checks: `npm run check` passed. `npm run test:coverage:worker-proof` proved the intentionally uncovered worker branch fails at 50%, then passed 62 tests across 30 application modules/entries at 100% in all four metrics (764 statements, 254 branches, 193 functions, 557 lines). Proxy launcher coverage is explicit; no application exclusion or relaxed threshold was introduced.
- Added a real worker-exception test, proving outstanding RPC rejection and refusal of later calls. The OPFS reopen test now abruptly terminates the worker after acknowledged writes, without a graceful database close. These complement transactional rollback and visible reload/interrupted-session tests; they are not power-loss durability claims.
- Source review found JavaScript replacement-string expansion could corrupt literal `$&`/`$1` edit text. Switched to a replacement callback and added a literal-text regression assertion. CodeMirror also now uses its standard syntax highlighting.
- `npm run build` and the full `npm run test:integration:built` passed on the final application: eight tests, approximately 1.2 minutes. Desktop and 375px screenshots were inspected; evidence is retained in ignored `experiments/e05-workspace/artifacts/production-2026-10-30/`.
- Fresh isolated source snapshot (without `.env`, node_modules, or build output): locked install, type check, and build passed. All 20 built files matched byte-for-byte; the credential was absent from every output asset. This validates an uncommitted source snapshot, not a nonexistent committed checkout. The expected compiler/bundle-size warning remains visible.
- Repeated E03 serially, then ran the full three-test workload suite including the actual TypeScript worker. Final larger-fixture HMR 115–125 ms, repeated builds 2.85–2.88 seconds, startup 14.0 seconds versus 12.7-second M2 sample. Worker changed-file sync/query round trips 15.6–27.3 ms, initial worker load/sync/query 660 ms. Targets pass; cache variability, small samples, and different query scopes prevent broader performance claims. Both M7 sample sets are retained under `experiments/e03-workload/results/`.
- M1–M7 are complete for the bounded local first goal. README provides run/test commands and limits. Hosted CI, deployment, commit, and push were not performed. Cloudflare Worker/workerd browser execution remains separate future feasibility work.

## R020 User-reported initialization and command overlap

- Date: 2026-10-30. User observed a pause/error after Start preview, clicked Build, and later saw Browser-built React. Reproduced in the running production bundle: Starting preview → Building → `AbortError: Job cancelled or superseded` → Build passed, while the real preview eventually rendered. Initial idle workspace loading itself produced no page error in this reproduction.
- Cause: explicit Start/Build commands used the semantic latest-request queue, so Build invalidated startup's caller while its work continued. Startup also returned after spawning Vite, before server readiness. One global status element mixed saved-file state, command results, and runtime events. Existing sequential acceptance flows did not exercise this interaction; 100% code coverage did not establish this sequencing invariant.
- Added a bounded serialized job queue with operation/revision coalescing and explicit queued/running/cancelling/succeeded/failed/cancelled transitions. Preview startup and Build now share initialization without superseding each other. Separate preview/build feedback leaves saved revisions intact, including when a runtime mirror sync fails after a successful database save; older/disposed callbacks cannot overwrite newer job results.
- Startup now reports boot/install/server phases and awaits server-ready, rejects early exit/readiness timeout, tears down failed attempts, and permits retry. Build cancellation removes queued work or kills its active subprocess; cancellation during shared startup waits for initialization to settle. Preview messages remain visible separately as notices.
- Found and fixed an adjacent overlap: saving during startup previously skipped runtime sync because the runtime was not yet marked started. Saves now queue a sync once startup is requested, preserving the latest saved preview revision after an earlier build.
- Vitest Browser Mode/Node: 70 tests pass with 100% per-file statements, branches, functions, and lines across 31 application files/entries. Tests cover duplicate joining, FIFO ordering, queue bounds, cancellation, failure/retry, early exits, late callbacks, literal workspace revisions, and disposal.
- Production Playwright: all nine UI/API tests passed. The new regression drives repeated Start/Build, cancels a queued build, resubmits, saves during startup, verifies distinct build/preview revisions, and asserts the visible feedback contains neither AbortError nor superseded/failed status. Screenshots and feedback attachment are under ignored test-results. Follow-up teardown/late-DOM guards passed the focused production workspace rerun (two tests, 33.5 seconds). Queue-overflow feedback and failed-sync preservation of saved status are additionally covered by unit regressions.
- Decision: D011 records this distinction between replaceable analysis and explicit commands. Prior R019/M7 results remain historical evidence, not proof that every human interaction was correct. No new live-provider inference was needed for this UI/runtime fix.

## Entry format for future work

Use the next R number and record: date; question; evidence level; versions/commits; fixture/environment; commands and artifact paths; result; failures/limitations; interpretation; decision affected; next action. Keep raw reproducible experiment artifacts under `experiments/` when those experiments exist. Record access failures separately from unsupported functionality.
