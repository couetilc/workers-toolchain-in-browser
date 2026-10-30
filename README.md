# Browser toolchain prototype

A browser coding workspace with CodeMirror, TypeScript services, SQLite persistence, and Pi. Actual Vite builds and serves a React project inside WebContainers. The product has no shell or terminal UI.

The original first goal—edit a TS/React project beside its browser preview—is implemented locally. Running a Cloudflare Worker/workerd inside a browser remains a separate, unproven second goal. tsrs is excluded because the required language service is not shipped in its WASM package; this prototype uses TypeScript 6's JavaScript API.

## Run

Use Node **24.11.0** (`.node-version`). With mise, prefix commands with `mise exec node@24.11.0 --` if needed.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run dev
```

Open **http://127.0.0.1:4170/workspace/** in Chromium. Edit, Save, Check types, Start preview, or Build. Hover and Ctrl-Space provide TypeScript information; Go to definition opens workspace source. Preview reports runtime startup, dependency installation, and server readiness. Build waits behind startup; repeated requests join the same job. Saved-file, preview, and build status are separate. Save or discard a draft before switching files. Reload preserves saved files and conversations; preview startup is explicit after reload. A second editing tab is refused.

To enable Pi, put `OPENROUTER_API_KEY=...` in the ignored `.env` file and run this in another development process:

```sh
npm run proxy
```

The default model is `openrouter/free`. Optional `OPENROUTER_MODEL` must be `openrouter/free` or end in `:free`. The server keeps credentials out of the browser. Ask Pi to change the heading, check types, and build. Agent edits use the same revision checks as human edits. Build cancellation removes queued work or stops the build subprocess; shared preview initialization is allowed to settle. Cancellation preserves already-saved edits; interrupted sessions are shown after reload and never automatically replayed.

For a deterministic demo without a credential, run `npm run model:fixture` and `npm run proxy:fixture` alongside the app. Fixture responses are scripted; they do not represent model intelligence.

## Verify

```sh
npx playwright install chromium
npm run check
npm run test:coverage:worker-proof
npm run build
npm run test:integration:built
```

| Command | Purpose |
| --- | --- |
| `npm run test:coverage` | Browser Vitest for browser code; Node Vitest for the proxy. 100% per-file statements, branches, functions, lines |
| `npm run test:coverage:worker-proof` | An uncovered real-worker branch must fail, then the complete coverage suite must pass |
| `npm run test:integration` | Visible human/Pi UI, real tools, persistence, compiler, preview, and HTTP API; fixture inference |
| `npm run test:integration:built` | Same Chromium flows against the production bundle; build first |
| `npm run test:live` | Optional real free-provider UI smoke test; build first and configure `.env` |
| `npm run test:workload` | Original small/250-module measurements; run without concurrent test/build jobs |
| `npm run test:browsers` | Compatibility probe; install Firefox/WebKit first. Firefox embedded preview currently fails |

Playwright starts and stops its own servers on ports 4170–4172; stop manual servers first. Traces/screenshots live under `test-results/`; coverage reports under `coverage/`. GitHub Actions is configured for deterministic checks, but hosted CI has not been run in this session.

## Execution and limits

- **Browser:** Pi loop/tools, CodeMirror, TypeScript/VFS worker, SQLite WASM/OPFS worker, WebContainer filesystem, npm installation, actual Vite development/HMR and builds.
- **Host:** serves the application bundle and proxies model inference. It does not compile the project being edited.
- **Persistence:** SQLite is authoritative for saved files/revisions and session messages/status. Editor drafts are explicit; runtime files are a mirror. Only one editing tab owns the database.
- **Supported acceptance browser:** Chromium. The original Vite/TypeScript probes passed in WebKit; the complete workspace is not certified there. Firefox TypeScript works, but embedded Vite preview has an unresolved relay/service-worker failure.
- **Network:** initial runtime startup, locked npm installation, and inference require external services. Offline startup is not supported. COOP/COEP headers are required and configured locally.
- **Scope:** one bundled React project and its declarations, not arbitrary npm type acquisition, a full IDE, collaborative editing, or a browser-hosted Cloudflare Workers runtime. Reload after a worker failure; uncertain effects are not replayed.
- **Hosting:** the loopback proxy's Origin check/public local token are prototype controls, not production authentication. No deployment is included.

The experiment pages remain available at `/`, `/experiments/e02-typescript/`, and `/experiments/e03-workload/?size=250`.

[Milestones](docs/PLAN.md) · [Research log](docs/RESEARCH_LOG.md) · [Decisions](docs/DECISIONS.md) · [Validation and capability matrix](docs/research/M7-validation.md)
