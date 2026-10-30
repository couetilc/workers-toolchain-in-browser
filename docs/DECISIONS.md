# Prototype decisions

Record requirements separately from implementation choices. Each architecture choice must link evidence in the [research log](RESEARCH_LOG.md) and state what would cause reconsideration.

## D001 Toolchain before editor

- Status: accepted user requirement.
- Date: 2026-10-29.
- Decision: investigate Vite and tsrs first, then prove the viable toolchain in a minimal page before selecting an editor.
- Consequence: editor selection follows the toolchain gate; D009 records the later CodeMirror choice. Browser-hosted workerd remains a separate investigation.

## D002 Unsupported tsrs functionality

- Status: accepted user constraint; confirmed by source review in R003.
- Date: 2026-10-29.
- Decision: do not adopt tsrs as a prototype dependency while the required language-service functionality is unavailable in its shipped WASM build. Its available compiler functionality does not satisfy the missing language-service requirement.
- Consequence: investigate the implementation boundary and alternatives, but do not undertake a substantial upstream port as routine prototype work.
- Reconsider when a shipped browser-capable implementation exists or the user explicitly changes scope.

## D003 Tests and coverage

- Status: accepted user requirement; page and owned-worker coverage collection verified in E04.
- Date: 2026-10-29.
- Decision: Vitest unit tests, browser execution for browser application code, and 100% statements/branches/functions/lines per file across our executable application code, including worker code. Playwright tests the visible UI and HTTP API.
- Consequence: verify source inclusion and collection from workers early. Model fixtures replace external inference in CI; real workers/compiler/persistence remain integrated. XState transition tests supplement code coverage.

## D004 Vite runtime candidate

- Status: proposed experiment, not an architecture selection.
- Date: 2026-10-29.
- Evidence: R001, R002, R004.
- Proposal: test actual Vite inside WebContainers first because Vite and WebContainers document this path. Verify the pinned Vite/Rolldown/CSS/React dependency combination, isolation headers, preview/HMR, and automation in our own harness.
- Alternatives: browser-native Rolldown or esbuild composition. These would change the Vite compatibility contract and need an explicit tradeoff decision before adoption.
- Unknowns: measured compatibility, package acquisition behavior, runtime asset dependencies, and browser limitations in our application.
- Reconsider if the executable proof fails, constraints conflict with runtime requirements, or a viable browser-native Vite implementation is found.

## Unmade decisions

Production dependency distribution and deployment target remain unselected. D008–D010 resolve persistence, editor, and local model integration for the prototype.

## D005 Execute the bounded toolchain candidates

- Status: selected experiments; production architecture remains provisional.
- Date: 2026-10-30.
- Evidence: [M1 report](research/M1-feasibility.md).
- Decision: execute actual Vite/WebContainers E01 and JavaScript TypeScript 6.0.3/VFS E02. Keep tsrs excluded. TypeScript 6 is an explicit semantic-version tradeoff to measure, not a claim of TypeScript 7 parity.
- Consequence: use exact versions and lockfiles, retain default-runtime failures, and test real browser behavior before selecting runtime/editor architecture.

## D006 Toolchain selected for the prototype

- Status: selected from local M2 runtime evidence; production scope remains limited.
- Date: 2026-10-30. Evidence: E01, E02, E03 and R008–R011.
- Use actual Vite 8.3.5 / React plugin 6.1.2 inside WebContainers 1.6.4, with the fixture lockfile and observed Rolldown WASI fallback. Keep Vite's default CSS configuration. The runtime controls processes programmatically; product UI has no terminal.
- Use TypeScript 6.0.3 / VFS 1.6.5 for the semantic service. This is the shipped JavaScript API, not tsrs, an LSP, or TypeScript 7 parity. Standard libraries and the supported package declarations ship as static assets initially.
- Chromium is the initial acceptance browser. WebKit passed the local flow and remains a compatibility probe. Firefox's embedded preview failed with a runtime relay/service-worker error; it is not a supported preview configuration yet. TypeScript passed in all three engines.
- Preview delivery uses the runtime's separate origin and iframe. Initial dependency installation uses locked `npm ci`, plus the observed matching Rolldown WASI acquisition. No offline runtime-startup or arbitrary-package guarantee is made.
- External runtime asset access and package distribution are dependencies of this decision. Reconsider if these requirements conflict with a later deployment, licensing, offline, or supported-browser requirement.

## D007 Testing and worker direction

- Status: coverage mechanism and application worker/queue implementation verified in M3–M7.
- Date: 2026-10-30. Evidence: E03 timings and [E04](research/E04-worker-coverage.md).
- Use Vitest Browser Mode with Istanbul for the 100% application coverage gate, collecting owned-worker snapshots through test-only entries. Keep Playwright UI/API integration separate. The negative-control script must continue to fail on the deliberately uncovered worker branch and pass when covered.
- Move TypeScript analysis into one long-lived dedicated worker before editor integration. Measured initialization and initial analysis can block the main thread for hundreds of milliseconds. Keep bounded, revision-aware requests instead of spawning a worker per edit.
- Treat WebContainer-created workers separately from owned workers. Do not derive a concurrency limit by assuming a fixed browser-wide worker quota. Final scheduler and storage-worker boundaries belong to M3/M4.

## D008 SQLite owns persistent state

- Status: implemented and locally verified. Date: 2026-10-30. Evidence: R015/R016.
- Official SQLite WASM SAH pool VFS runs in one dedicated worker. Schema v1 stores project revision, file contents, and session status/messages. Executable agent code remains in the application bundle.
- Revision-checked SQL transactions publish complete snapshots only after durable acknowledgement. WebContainer is an execution mirror; TypeScript is an analysis mirror; unsaved editor drafts are explicit.
- A Web Lock permits one editing tab. Reload turns running sessions into interrupted sessions without replaying effects. A failed/crashed worker requires reload; there is no claim of automatic crash recovery during an uncertain transaction.
- Reconsider for collaborative multi-tab/multi-user editing or large binary projects; neither is implemented here.

## D009 CodeMirror with the native TypeScript API

- Status: implemented and locally verified. Date: 2026-10-30. Evidence: R016.
- CodeMirror 6 provides editing and presentation. Completion, hover, definition navigation, and diagnostics use the proven TypeScript 6/VFS worker directly; no LSP transport is necessary.
- Foreground type checks/navigation take priority over background completion. One running and one replaceable pending semantic request prevent an unbounded queue. Same-file-set edits update the existing TypeScript service; adding/removing source files recreates it.
- The supported declaration set is the bundled React fixture, not arbitrary npm dependencies or automatic type acquisition. A full IDE/file manager is outside this first prototype.
- Preview executes in the runtime's separate-origin sandboxed iframe. Preview errors may be displayed as text; they do not invoke workspace or agent tools. This is not a complete hostile-code isolation assessment.

## D010 Pi in the browser with a local inference proxy

- Status: deterministic workflow verified; live-provider result recorded separately. Date: 2026-10-30. Evidence: R017.
- Use the current renamed packages `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai` 1.4.0. The agent loop and list/read/edit/diagnostics/build tools execute in the browser. Only inference and credentials live behind the local Node proxy.
- Browser tools use the same revision-checked workspace as the editor. Agent edits refuse unsaved human drafts, require a unique exact match and expected revision, and update editor/runtime mirrors after commit.
- Conversations/tool results and lifecycle status persist in SQLite. Cancelling inference stops further model work; already acknowledged edits remain saved. D011 supersedes the initial cancellation behavior: queued builds cancel immediately, active build commands receive a kill signal, and a build waiting for shared preview startup cancels after that initialization settles.
- The proxy binds loopback, checks the workspace Origin, and fixes provider/key/model on the server. Its public local token is not production authentication. Hosting requires a separate authentication/deployment design.
- The user selected OpenRouter free models; `.env` is ignored and read only by the proxy. Default `openrouter/free` or an explicit `:free` model is allowed. CI uses a deterministic provider and never needs that key.
- Node-only proxy logic uses Vitest's Node project; browser application code uses Chromium Browser Mode. Application logic under `src/` and the proxy launch script `scripts/proxy.mjs` are in the strict coverage include. Build/test configuration and test infrastructure are outside application coverage.

## D011 Human commands have job lifecycles

- Status: implemented after the user reported misleading initialization feedback. Date: 2026-10-30. Evidence: R020.
- Keep latest-request scheduling for replaceable semantic queries. Explicit project commands instead serialize in a bounded FIFO queue; duplicate operation/revision requests join one promise. A new Build does not supersede startup or turn it into an error.
- Track queued/running/cancelling/succeeded/failed/cancelled per job. Only the latest job in a visible status area may publish its terminal result; disposed views and old runtime attempts ignore late events. The queue admits at most eight pending jobs; overflow rejects with a wait-and-retry message.
- Separate saved-file state, preview startup, build outcome, runtime notices, and Pi lifecycle. Disable duplicate manual Start/Build requests while their jobs are active. Cancellation does not clear unrelated preview progress or saved-file status.
- Preview startup reports runtime boot, dependency installation, and server startup. Readiness requires the actual server-ready event, with a bounded server-readiness wait. Failure tears down the attempt and permits retry. This does not establish a timeout for every upstream network request during boot/install.
- Saving after startup has been requested queues a filesystem sync even if initialization has not finished. Build results name their requested revision; a later saved revision is reflected separately in preview status.
- Active build subprocesses are killed on cancellation. Shared startup continues when a build waiting on it is cancelled; the UI remains cancelling until that step settles. No stopped/superseded semantic query is presented as a failed user command.
