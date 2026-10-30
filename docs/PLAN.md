# Browser toolchain prototype plan

Build a browser workspace that can compile and preview a TS/React project, persist its files, and eventually let Pi edit it. Resolve whether the intended toolchain works before investing in an editor. The README's later Cloudflare Worker/workerd goal remains a separate feasibility track.

## Current checkpoint

- **M1–M7 complete for the local first-goal prototype.** Actual Vite/React, browser TypeScript, SQLite persistence, CodeMirror, and real Pi tools work together at `/workspace/`.
- Post-prototype hardening: D011/R020 fix overlapping Start preview → Build and save-during-startup feedback. Explicit commands now serialize/coalesce and show separate preview/build states.
- Validation: 70 Vitest tests; 100% statements, branches, functions, and lines per file across 31 application files/entries. The intentional uncovered-worker control still fails correctly.
- Production acceptance: all nine Chromium UI/API tests pass. A separate real `openrouter/free` smoke test passed through edit, diagnostics, build, preview, and persisted reload.
- Reproducibility: clean isolated source installation/typecheck/build passed, and all 20 build outputs matched. Three workload tests pass; the larger-fixture worker edit round trips were 16–27 ms.
- [Final validation/capability matrix](research/M7-validation.md), [research log](RESEARCH_LOG.md), and [decisions](DECISIONS.md) retain evidence and limitations.
- Hosted CI execution and deployment have not been performed. Git records the local commit/publication status. Browser-hosted Cloudflare Workers/workerd remains a separate feasibility track; this prototype does not claim that capability.

## Requirements and decision rules

- Toolchain first; editor selection comes after executable evidence.
- Target actual Vite in the browser. A replacement bundler is a documented alternative, not an equivalent result.
- tsrs is not a prototype dependency while the required browser language-service capability is absent. M1 investigates that limitation without undertaking a port.
- No shell or terminal in the product UI.
- Browser-local workspace and execution; model inference may use a remote provider through a small proxy.
- SQLite is the intended persistence layer. Its filesystem integration follows the proven runtime's needs.
- Pi core is the intended agent loop. XState may coordinate application lifecycle, scheduling, and cancellation.
- Vitest: 100% statements, branches, functions, and lines per file across our executable application source. Playwright: real visible UI and HTTP API behavior.
- Routine technical choices proceed when the evidence supports them. Changes to a defining requirement, such as replacing actual Vite or requiring remote compilation, need a concrete tradeoff presented to the user.
- A failed candidate is useful evidence. Preserve its result and evaluate the next bounded option; do not describe failure as success through a silent fallback.

## Evidence required at every gate

Record the question, exact versions, environment, reproducible command, result, and remaining uncertainty. Distinguish upstream documentation, source inspection, locally executed behavior, and deployed behavior. Include failures and browser-specific limitations.

For performance experiments, use the same fixtures and device, separate cold and warm runs, and record individual samples plus a summary. Measure startup, initial dependency acquisition, rebuild and diagnostic latency, download size, and memory only where the browser exposes a meaningful measurement. Record unavailable memory measurements as unavailable. Establish performance targets from the first baseline before using them to choose an architecture.

Each gate must update this checklist, link its evidence, record the decision, and identify the next executable task. Source research can close a research question; it cannot close a runtime acceptance check.

## M1 Browser toolchain feasibility

**Question:** Can the intended Vite and TypeScript tooling execute locally in a browser with a practical integration effort?

- [x] Inspect the repository and preserve its original goals.
- [x] Check actual Vite runtime entry points and Node dependencies.
- [x] Identify an upstream-documented path for actual Vite in-browser: WebContainers.
- [x] Verify the shipped tsrs WASM capabilities and LSP exclusion at a pinned source revision.
- [x] Inspect the tsrs WASM/LSP dependency boundary to distinguish missing transport from missing runtime support.
- [x] Complete the candidate matrix: Vite runtime, transitive native/WASM bindings, React plugin, package acquisition, filesystem, server/HMR transport, browser requirements, and external runtime dependencies.
- [x] Identify a shipped browser TypeScript language-service candidate for later testing; do not select an editor to solve this question.
- [x] Record whether each candidate needs configuration, a bounded adapter, or substantial porting. Avoid unsupported time estimates.
- [x] Select and pin the smallest E01 experiment, with failure conditions and a next candidate.

**Gate:** a sourced feasibility decision and a reproducible experiment specification. Runtime compatibility remains provisional until M2. No editor, SQLite schema, or agent UI work begins here.

## M2 Executable toolchain proof

**Input:** M1 candidate and dependency/runtime map.

- [x] Create minimal pages and TS/React fixtures with CSS, dependency imports, cross-file type errors, and runtime errors.
- [x] Run actual Vite in the chosen browser runtime and render an interactive React preview.
- [x] Change files through buttons and verify HMR retains React counter state.
- [x] Exercise syntax error/recovery, dynamic imports, CSS updates, and locked dependency installation.
- [x] Prove type checking separately, including offline subsequent analysis and semantic queries in E02.
- [x] Record browser runtime versions, raw fixture delivery, runtime build output, and page network observations. The host serves the harness, not project compilation.
- [x] Run Playwright and preserve failures and environment details.
- [x] Compare fresh-context startup and repeated warm operations on small and 250-module fixtures. Upstream/host caches are uncontrolled; these are not fully cold-network measurements.
- [x] Probe Firefox and WebKit; preserve the Firefox preview-relay failure and WebKit pass.

**Gate:** working, repeatable browser build/typecheck/preview evidence and a decision on runtime, dependency strategy, supported browsers, and preview delivery. If actual Vite fails, report the concrete blocker before choosing a reduced toolchain.

## M3 Runtime and testing foundation

**Input:** measured behavior and chosen runtime from M2.

- [x] Define the workspace API: immutable snapshots, serialized revision-checked commits, publish after storage acknowledgement.
- [x] Decide worker boundaries: one TypeScript worker and one SQLite worker, plus library-managed WebContainer workers.
- [x] Implement bounded queues, newest-pending replacement, stale-result rejection, errors, and cancellation semantics.
- [x] Evaluate XState: the current small queue needs no additional state-machine dependency; transitions are independently tested.
- [x] Set up Vitest Browser Mode with a Playwright provider. Browser application code runs in Chromium.
- [x] Configure explicit source inclusion and 100% per-file coverage for all four metrics.
- [x] Prove worker coverage collection with a real worker and automated negative/positive controls in E04.
- [x] Establish the CI definition for checks, coverage proof, production build, and Playwright artifacts. Local commands pass; hosted execution is still pending.

Testing starts with the first executable spike in M2; this milestone hardens and verifies the complete test architecture. A diagnostic spike is not production-ready until the applicable gates pass.

**Gate:** a measured, testable runtime boundary and a demonstrably effective coverage gate, before substantial product code is added.

## M4 Persistent workspace

**Input:** workspace API and filesystem/runtime requirements from M3.

- [x] Add versioned SQLite migrations for projects, files, sessions, and messages as needed.
- [x] Integrate SQLite/OPFS with the runtime; explicitly choose the source of truth and any runtime filesystem mirror.
- [x] Make related file edits atomic with revision conflict detection and rollback.
- [x] Verify reload/reopen persistence, worker failure, storage failure, and second-tab behavior in real browsers.
- [x] Define interrupted-operation recovery; avoid automatically replaying uncertain writes or agent tool effects.

**Gate:** reliable persistence behind the tested workspace API; no divergent editor/runtime/database file copies. All application coverage thresholds remain at 100%.

## M5 Editor and preview workflow

**Input:** proven runtime, language capabilities, and persistent workspace.

- [x] Evaluate CodeMirror first against the available language service and visible-UI requirements. Record the editor decision (D009).
- [x] Add file list, editor, preview, save/build status, and actionable diagnostics, with no terminal.
- [x] Verify supported completion, hover, navigation, and diagnostics using real browser UI interactions.
- [x] Verify changes initiated outside the editor update both the document and language-service state.
- [x] Check preview isolation and its limited diagnostics channel.
- [x] Complete edit/build/error/fix/reload Playwright flows at desktop and narrow viewports.

**Gate:** a reliable human editing workflow ready for an agent to use through the same API.

## M6 Pi integration

**Input:** tested workspace, build, diagnostic, and cancellation interfaces.

- [x] Integrate Pi core and a minimal streaming model proxy.
- [x] Add list/read/edit/build/diagnostic tools over the shared workspace API.
- [x] Persist conversation messages and tool results; distinguish completed and interrupted runs.
- [x] Use a deterministic model fixture server with real Pi orchestration for CI.
- [x] Test user/agent edit conflicts, tool errors, cancellation, streaming failures, reload, and interrupted sessions.
- [x] Run Playwright UI and HTTP API tests against the real proxy and fixture upstream.
- [x] Perform a separately identified live-provider smoke test when credentials are available; fixture success is not live-provider verification. R018 records the real free OpenRouter pass.

**Gate:** prompt to tool execution to persistent file change to updated preview works through visible UI, with 100% application code coverage and passing integration tests.

## M7 Complete prototype validation

- [x] Run the production bundle through the complete UI/API suite.
- [x] Repeat the original fixtures and compare results to M2 baselines.
- [x] Publish a supported-capabilities matrix with measured browser limitations.
- [x] Verify setup from a clean source snapshot with locked dependency versions and documented commands (uncommitted work; no committed checkout is claimed).
- [x] Record remaining work, including the separate Cloudflare Worker/workerd feasibility question.

**Gate:** a reproducible demonstration, passing tests and coverage, and an accurate account of what executes in-browser. Deployment is not implied by local validation.

## Experiment backlog

| Experiment | Milestone | Purpose | Status |
| --- | --- | --- | --- |
| [E01 Actual Vite runtime](research/E01-vite-runtime.md) | M2 | Actual Vite, React, HMR and production preview | Chromium/WebKit passed; Firefox preview failed |
| [E02 TypeScript services](research/E02-typescript.md) | M2 | Browser type checking and semantic service without an editor | Passed in all three engines |
| [E03 Toolchain workload](research/E03-workload.md) | M2 | Small/larger fixtures; startup and repeated operations | Local baseline collected |
| [E04 Worker coverage](research/E04-worker-coverage.md) | M3 | Uncovered worker code fails; covered code passes | Verified; Istanbul with explicit snapshot merge |
| E05 Persistence | M4 | Real SQLite/OPFS, atomic edits, reload, failure, second tab | Passed; R015/R016 |
| E06 Agent workflow | M6 | Deterministic streaming provider through real Pi/tools/proxy to preview | Passed; R017 |

Experiment source and concise results live under `experiments/`; bulky raw artifacts are ignored locally and retained in CI. Planned commands are not treated as available commands until their scripts exist and have been run.
