# Working on the browser toolchain prototype

Read `docs/PLAN.md`, the latest entries in `docs/RESEARCH_LOG.md`, and `docs/DECISIONS.md` before continuing work.

- Start at the first incomplete milestone. Resolve toolchain feasibility before editor or agent implementation.
- The target is actual project tooling executing in the browser. Distinguish a browser UI backed by host-side compilation from browser-side compilation.
- Keep the product free of shell and terminal UI. A runtime may be controlled programmatically if its use is recorded in the architecture decision.
- Do not depend on tsrs capabilities absent from its shipped WASM package. Investigating the gap does not authorize a substantial tsrs port.
- Keep the research log chronological. Record sources, versions or commits, experiment commands, observations, limitations, and the next decision. Add corrections rather than silently rewriting historical findings.
- Update milestone checklists and decision records when evidence changes. Do not mark a gate complete solely because documentation suggests an approach works.
- Use Vitest for unit tests, with browser execution for browser application code, and Playwright for visible UI and HTTP API integration tests.
- Require 100% statements, branches, functions, and lines per file for our executable application code, including worker adapters and error paths. Include unimported source files. Do not exclude application code or weaken thresholds to make the gate pass.
- Verify coverage collection across workers explicitly. Test fixtures, generated files, dependencies, and type declarations are outside application coverage; explain any additional exclusion in the decision record.
- Keep real worker, filesystem, compiler, and persistence behavior in browser integration tests. Substitute the external model provider with a deterministic fixture for routine CI.
- XState is optional for lifecycle and orchestration logic. State-transition coverage supplements code coverage.
- Continue routine implementation and reversible experiments within the agreed scope. Ask for a decision only when evidence requires a material requirement change or unavailable external input.
