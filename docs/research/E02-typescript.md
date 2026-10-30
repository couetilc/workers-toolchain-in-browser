# E02 Browser TypeScript services

## Question and implementation

Can a shipped JavaScript compiler provide type checking and editor semantics inside the browser, without tsrs or an editor dependency?

The experiment uses `typescript@6.0.3`, `@typescript/vfs@1.6.5`, `@types/react@19.3.0`, `@types/react-dom@19.3.0`, and `csstype@3.2.3`, pinned in the root lockfile. It mounts the shipped TypeScript standard libraries, React declarations, and two project files into VFS. These are static assets; the host does not answer compiler queries.

The fixture imports a string into a number declaration in a React TSX component. The visible page exposes Analyze, Fix imported type, and Restore type error controls, plus structured results. The API exercises semantic and syntactic diagnostics, quick information, definitions, and member completions. This is the TypeScript API directly, not an LSP implementation.

## Reproduce

```sh
npm ci --ignore-scripts --no-audit --no-fund
npx playwright install chromium firefox webkit
npm run test:e02
npm run test:coverage
```

For manual use, run `npm run dev` and visit `http://127.0.0.1:4170/experiments/e02-typescript/`.

## Observations

- Chromium, Firefox, and WebKit integration passed on 2026-10-30: diagnostic 2322, definition in `/src/values.ts`, hover changing from `count: string` to `count: number`, and `enabled`/`title` member completions.
- After initial analysis, Playwright sets the browser context offline. Fixing and restoring the imported type still updates diagnostics through the visible UI. This demonstrates local subsequent analysis, not offline initial loading.
- Browser-mode unit tests use the real compiler and declarations. They also introduce a syntax error and verify diagnostic 1109.
- Analysis timings are emitted in the result artifact. [E03](E03-workload.md) supplies larger-fixture comparisons; moving analysis into a worker remains M3 work.

## Limits

This proves TypeScript 6 semantics, not TypeScript 7 parity. The prototype has no LSP transport, editor adapter, cancellation, worker isolation, or arbitrary package/type acquisition yet. The initial spike runs synchronously on the main thread; its measurements will inform the worker boundary. Only the static fixture's declarations are available. M3 must prove worker coverage before moving the service into a worker.
