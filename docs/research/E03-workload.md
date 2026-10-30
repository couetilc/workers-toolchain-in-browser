# E03 Toolchain workload baseline

Status: two fixture sizes passed the complete measurement flow on 2026-10-30.

## Method

Run `npm run test:workload` with no concurrent test/build jobs. Hardware: Apple M1 MacBookAir10,1, 16 GiB RAM. Browser: Playwright Chromium 156.0.8078.4. Each fixture starts in a fresh browser context; upstream package caches and host caches are uncontrolled. This is **fresh-context startup**, not a fully cold-network or statistical performance study.

The larger fixture deterministically adds 250 modules, each with a numeric value and a 100-element array. The application renders their computed total, proving the modules participate in the graph. Both sizes exercise three HMR updates that retain React counter state and three default production builds. Repeated builds verify the preview actually reloads by checking counter reset. Compiler analysis covers every project TypeScript file, then measures changed-file diagnostics separately from cached unchanged queries.

The TypeScript experiment and WebContainer use separate copies of the fixture at this stage. TypeScript's edit controls modify its VFS only. M3 will introduce the shared revisioned workspace boundary; this spike is not evidence of synchronized production state.

## Serial-run observations

| Measurement | Small: 6 TS files | Larger: 256 TS files |
| --- | --- | --- |
| Start click to interactive preview | 13,243 ms | 12,722 ms |
| HMR observations | 141, 123, 119 ms | 134, 123, 120 ms |
| First build to preview | 4,057 ms | 4,440 ms |
| Repeated builds to preview | 2,396, 2,448 ms | 2,882, 2,901 ms |
| TypeScript service initialization | 173.4 ms | 194.0 ms |
| First all-file diagnostic query | 55.3 ms | 98.2 ms |
| Diagnostic query after type edit | 27.6, 18.3, 14.8 ms | 80.9, 53.2, 52.7 ms |
| Unchanged cached diagnostic queries | 0.10, 0.08 ms | 0.46, 0.32 ms |

The slightly faster larger-fixture startup is run variation, not evidence that more modules improve startup. The first production build includes starting a preview server; later builds reuse it. UI-observed HMR/build timings include Playwright polling and rendering. Compiler durations use `performance.now()` around synchronous API work, with initialization measured separately.

The earlier exploratory run overlapped Vitest startup and lacked changed-file timing. Both records are preserved: [initial samples](../../experiments/e03-workload/results/2026-10-30.json), [serial baseline](../../experiments/e03-workload/results/2026-10-30-serial.json). Raw runtime logs/traces are ignored local artifacts under `experiments/e03-workload/artifacts/`.

## Decision and limits

- Keep actual Vite/WebContainers as the demonstrated prototype runtime. No replacement bundler or CSS workaround is needed for this fixture.
- Put TypeScript in a dedicated long-lived worker before the editor: measured initialization and analysis can block the main thread for hundreds of milliseconds.
- Initial regression targets on this fixture/device: HMR below 250 ms, repeated larger-fixture builds below 5 seconds, and changed-file diagnostic round trips below 200 ms after worker migration. These are provisional comparison targets, not cross-device product guarantees or statistically established percentiles.
- The built TypeScript/compiler/declaration payload is approximately 8.7 MB uncompressed / 1.7 MB gzip in the initial host build. Loading/splitting it is a later optimization. Total WebContainer/package download size was not measured: page-level network events omit some runtime-internal traffic.
- Complete runtime memory is unavailable from this harness. Reporting only the page heap would omit workers/WASM, so no total memory number is claimed.
- Broader package/plugin compatibility, mobile hardware, repeated independent cold trials, and offline startup remain unproven.
