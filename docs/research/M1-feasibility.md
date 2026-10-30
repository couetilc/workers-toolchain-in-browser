# M1 Browser toolchain feasibility result

Date: 2026-10-30. Gate: source/package investigation complete; execution acceptance belongs to M2.

## Selected experiments

Run actual Vite 8.3.5 in WebContainer API 1.6.4 with React plugin 6.1.2 and React 19.3.1. Pin Rolldown 1.2.16 with a fixture lockfile. Start with Vite defaults, observe production CSS minification, and record any bounded configuration adaptation separately. A failed default build must remain visible in the results.

Test TypeScript 6.0.3 with TypeScript VFS 1.6.5 as a separate browser language-service candidate. TypeScript 6.0.3 publishes `lib/typescript.js` with no native dependency; its language-service behavior still needs an executable test. This uses the TypeScript 6 semantics, not TypeScript 7 or tsrs semantics. No editor or LSP adapter is selected by this experiment.

## Published artifact inspection

Inspected the package tarballs referenced by version-specific npm registry records, without executing their code during the audit:

| Capability | Finding | Integration category |
| --- | --- | --- |
| Vite runtime | Node filesystem/server/watch interfaces require a browser Node runtime | Published runtime configuration |
| Rolldown 1.2.16 | Its generated binding loader detects `process.versions.webcontainer`; fallback downloads `@rolldown/binding-wasm32-wasi` of the matching version into `/tmp/rolldown-<version>` using pnpm | Published fallback; network acquisition and resolved transitive dependencies must be observed |
| Vite dev CSS | Default transformer is PostCSS | Configuration; test ordinary CSS imports |
| Vite production CSS | Default minification can import Lightning CSS; published Lightning CSS loader selects a native package or `.node` file | Runtime risk; test default first, then consider explicit `cssMinify: false` if native loading fails |
| React plugin | Its `oxc-transform-react` import is behind the optional React Compiler path | Use default plugin; do not enable React Compiler in the first fixture |
| Package acquisition | Browser runtime owns project install; fixture lockfile constrains it, but Rolldown's fallback performs a separate install | Observe and record both dependency graphs; not an offline guarantee |
| Preview/HMR | Runtime emits a server-ready URL; Vite supplies its own update protocol | Browser integration test, including React state preservation |
| TypeScript service | TypeScript 6.0.3 JavaScript API plus VFS; TypeScript 7.0.2 metadata instead points to native packages | Bounded browser adapter; semantic-version difference explicit |
| tsrs language service | Excluded from shipped WASM package; native threaded/blocking implementation | Substantial port investigation; excluded from prototype |

The WebContainer runtime requires isolation headers and external boot assets. Its browser support and commercial-use constraints remain those recorded in R002. SDK pinning does not pin the remotely delivered runtime implementation; capture its reported version during each run.

## Failure decisions

- Boot failure: distinguish browser isolation, service access, and browser support. Do not infer Vite incompatibility before Vite starts.
- Binding failure: preserve the loader error; try a documented configuration or published WASM path before considering a replacement runtime.
- TypeScript API failure: inspect the pinned VFS/compiler pairing, then evaluate another shipped JavaScript version. Do not switch to native TypeScript 7 inside a browser without evidence of a supported runtime path.
- Fundamental Vite failure: document the blocker and present the reduced compatibility of a browser-bundler alternative before adopting it.

## Sources and reproduction

- Published records: [Vite](https://registry.npmjs.org/vite/8.3.5), [Rolldown](https://registry.npmjs.org/rolldown/1.2.16), [Lightning CSS](https://registry.npmjs.org/lightningcss/1.33.0), [React plugin](https://registry.npmjs.org/@vitejs%2fplugin-react/6.1.2), [TypeScript 6](https://registry.npmjs.org/typescript/6.0.3), [VFS](https://registry.npmjs.org/@typescript%2fvfs/1.6.5).
- Read `dist/shared/binding-*.mjs` in Rolldown's tarball, `dist/node/chunks/node.js` in Vite's, `node/index.js` in Lightning CSS's, and `dist/index.js` in the React plugin's. Published artifact integrity is retained in lockfiles when installed.
- [TypeScript VFS purpose and language-service API](https://www.typescriptlang.org/dev/typescript-vfs/).
- [WebContainer quickstart and preview protocol](https://webcontainers.io/guides/quickstart).

No source finding here claims a passing browser test. M2 begins with E01 and E02.
