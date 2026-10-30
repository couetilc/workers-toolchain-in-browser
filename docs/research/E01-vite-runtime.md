# E01 Actual Vite in a browser runtime

Status: implemented; the complete flow passed in Playwright Chromium and WebKit on 2026-10-30. Firefox started Vite but failed preview delivery. This is local evidence, not a deployed service or arbitrary-plugin compatibility claim.

## Executed result

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npx playwright install chromium firefox webkit`, then `npm run test:e01` for the Chromium test or `npm run test:browsers` for the compatibility probe. For manual use, run `npm run dev` and open `http://127.0.0.1:4170/`.

| Engine | Actual Vite dev/React/HMR | Production build and preview | Result |
| --- | --- | --- | --- |
| Chromium 156.0.8078.4 | Passed | Passed, default configuration | 18.5-second full test |
| Playwright WebKit 27.2 | Passed | Passed, default configuration | 19.9-second full test |
| Playwright Firefox 157 | Server started; preview did not render | Not reached | Runtime relay could not find a running service worker |

The passing flow tests the visible iframe, React counter state through HMR, imported modules, CSS, dynamic import, syntax-error overlay/recovery, and forwarded runtime errors. Build output is served by Vite preview inside the WebContainer. The host Vite server only serves the harness and raw fixture assets.

The Chromium runtime reported Node 22.22.3 and WebContainer revision `f8d6b2be`. Logs confirm separate Rolldown WASI binding acquisition at 1.2.16. One successful sample recorded boot at 1,321 ms, npm dependency installation from 2,478 to 4,686 ms, development readiness at 11,311 ms, build from 14,297 to 16,304 ms, and production preview readiness at 17,870 ms. These are single-run harness-relative marks with uncontrolled upstream caches, not benchmark guarantees.

Page request observations included `stackblitz.com`, `c.staticblitz.com`, `nr.staticblitz.com`, `t.staticblitz.com`, `w-corp-staticblitz.com`, and runtime-generated `*.webcontainer-api.io` preview hosts. This is a page-level observation, not a complete inventory of worker or package-manager traffic. Runtime assets and package acquisition remain external dependencies.

The first build timeout was a harness bug: npm exited 0 but its output stream stayed open. The harness now treats process exit as completion and drains logs independently, with a Vitest regression. No CSS-minification workaround is used. See R008/R010 in the research log.

Firefox's failure is preserved under `test-results/...firefox/`. Upstream [browser support documentation](https://webcontainers.io/guides/browser-support) describes Firefox preview limitations and suggests a separate-window workaround; that workaround has not been validated here and does not satisfy the intended embedded preview yet. Passing WebKit automation is not proof of every shipping Safari configuration.

## Question and decision

Can a pinned Vite/React project run, rebuild, and produce output inside a WebContainer in our own test page? Success would justify this runtime as a candidate for M2. It would not establish arbitrary plugin compatibility, offline startup, cross-browser support, or tsrs language-service support.

## Pinned dependencies and remaining boundaries

Published metadata is captured in [the registry snapshot](2026-10-29-package-metadata.json). The fixture lockfile establishes the project dependency graph; Rolldown's additional runtime WASI installation is observed separately.

| Component | Pinned version | Known boundary | Result / remaining boundary |
| --- | --- | --- | --- |
| Runtime SDK | `@webcontainer/api@1.6.4` | Runtime assets separate from SDK | Boot/version/origins observed; offline startup unproven |
| Vite | `vite@8.3.5` | Node filesystem, HTTP, watcher/HMR services | Actual browser-hosted server, updates and build passed |
| React integration | `@vitejs/plugin-react@6.1.2` | Optional compiler paths | Default React refresh and TSX passed; optional compiler not tested |
| Bundler | `rolldown@1.2.16` | Additional WebContainer WASI acquisition | Matching WASI binding observed in runtime logs |
| CSS | `lightningcss@1.33.0` | Native loader exists in package | Default fixture build passed; no workaround needed |
| React | React/ReactDOM `19.3.1` | Browser library | Render, interaction, refresh, and build passed |
| TypeScript | `6.0.3` / VFS `1.6.5` | TypeScript 6 semantics; tsrs WASM lacks LSP | Separate E02 browser API proof; no TypeScript 7 parity claim |

Do not interpret a version appearing in this table as a successful browser compatibility result.

## Harness shape

- A minimal page with Start, component/import/CSS changes, Break syntax, Fix syntax, and Build controls; status and a preview iframe. Reload the page to reset. No editor or terminal.
- A local server serves the harness and required isolation headers. It never receives project source for compilation.
- WebContainer boots once, mounts the fixture and lockfile, installs or mounts dependencies, and starts the actual Vite server programmatically.
- Register readiness/error listeners before launching the runtime server. Capture process output for experiment artifacts without exposing a terminal UI.
- Display the preview using the runtime's readiness URL. Observe HMR and distinguish preserved React state from a full page reload.
- Capture the runtime-reported Node version, package versions, request origins, errors, and timing marks. Host Node version is recorded separately.

## Fixture and observations

Use a small project with `index.html`, `src/main.tsx`, `src/App.tsx`, an imported component/value, CSS, `tsconfig.json`, and Vite configuration. Pin and lock React, ReactDOM, Vite, plugin, and any type declarations before running comparisons.

1. Start from an empty browser profile and capture cold boot/dependency/server/preview timings.
2. Verify rendered content and an interactive React counter through Playwright iframe locators.
3. Increment the counter, change component text through the page control, and observe whether the count survives the update.
4. Change an imported module and CSS; verify actual rendered effects.
5. Introduce a syntax error, observe the visible error, fix it, and verify recovery.
6. Run the runtime's production build and inspect emitted files through its filesystem API. Serve and exercise those emitted files inside the browser runtime.
7. Repeat warm runs and retain individual measurements.
8. Run targeted Firefox/WebKit probes and record concrete failures and required configuration separately.

Type checking and semantic-service behavior belong to E02. A Vite build of TypeScript does not satisfy that experiment.

## Failure classification

Distinguish failed runtime boot, missing isolation, network/service access, unsupported native binding, package resolution, server startup, preview transport, HMR, and application compilation. Preserve the first actionable error and reproduction.

If a bounded configuration or published WASM path resolves the issue, record the change and repeat the affected checks. If the path requires a major port or replacement of Vite, stop extending that candidate and document the tradeoff before changing the defining requirement.

## Artifacts and tests

Harness and fixture lockfile live under `experiments/e01-vite-runtime/`; Playwright tests live in `tests/integration/`. This report retains concise results. Bulky traces/screenshots are ignored local artifacts or CI artifacts.

Use Vitest for application logic introduced by the harness and Playwright for the visible behavior. The 100% application-code requirement applies; M3 verifies the worker instrumentation architecture and CI gate before product work expands. Do not mark this experiment as production-ready while its relevant test requirements remain unmet.
