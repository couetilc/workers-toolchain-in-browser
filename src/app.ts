import type { Session } from './session';
import type { createRuntime } from './runtime';
import { latestQueue } from './queue';
import { serialJobs, type JobEvent } from './jobs';
import { createEditor, type Semantics } from './editor';
import type { Snapshot } from './workspace';
import { closeCompletion } from '@codemirror/autocomplete';
import { mountAgent } from './agent-view';

export async function mountApp(root: HTMLElement, open: () => Promise<Session>, runtime: ReturnType<typeof createRuntime>) {
  root.innerHTML = `<header><h1>Browser workspace</h1><p>Your project lives in this browser.</p></header>
    <p role="status">Opening workspace…</p><label>File <select aria-label="File" disabled></select></label>
    <div id="editor"></div>
    <nav><button id="save" disabled>Save</button><button id="reload" disabled>Discard draft</button><button id="preview" disabled>Start preview</button><button id="build" disabled>Build</button><button id="cancel" disabled>Cancel build</button><button id="check" disabled>Check types</button><button id="definition" disabled>Go to definition</button></nav>
    <ul aria-label="Diagnostics"></ul><section aria-label="Project tasks"><p aria-label="Preview status" aria-live="polite">Preview not started</p><p aria-label="Build status" aria-live="polite">No build requested</p><p aria-label="Runtime notice" aria-live="polite"></p></section><iframe title="Project preview" sandbox="allow-scripts allow-same-origin allow-forms"></iframe><section aria-label="Agent"></section>`;
  const status = root.querySelector<HTMLElement>('[role=status]')!;
  const select = root.querySelector<HTMLSelectElement>('select')!;
  const diagnostics = root.querySelector('ul')!;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
  const session = await open();
  let saved: any;
  try { saved = await session.storage.call('session', null); }
  catch (error) { session.close(); throw error; }
  let current = session.workspace.snapshot();
  let path = 'src/App.tsx';
  let runtimeRequested = false;
  let dirty = false;
  let draftRevision = current.revision;
  type Task = { kind: 'build' | 'start' | 'sync'; snapshot: Snapshot };
  let disposed = false;
  const latest: Record<string, number> = {};
  const buildButton = root.querySelector<HTMLButtonElement>('#build')!;
  const previewButton = root.querySelector<HTMLButtonElement>('#preview')!;
  const cancelButton = root.querySelector<HTMLButtonElement>('#cancel')!;
  function jobChanged(event: JobEvent<Task>) {
    const lane = event.task.kind === 'build' ? 'build' : 'preview';
    if (disposed || event.id < (latest[lane] ?? 0)) return;
    latest[lane] = event.id;
    const { kind, snapshot } = event.task;
    const build = kind === 'build';
    const label = build ? 'Build' : 'Preview';
    const messages = {
      queued: `${label} queued · revision ${snapshot.revision}`,
      running: build ? `Building · revision ${snapshot.revision}…` : 'Preparing preview…',
      cancelling: 'Cancelling build…',
      cancelled: 'Build cancelled',
      succeeded: build ? `Build passed · revision ${snapshot.revision}` : `Preview ready · revision ${snapshot.revision}`,
      failed: `${label} failed: ${String(event.error)}. Try again.`,
    };
    root.querySelector(`[aria-label="${label} status"]`)!.textContent = messages[event.state];
    const busy = ['queued', 'running', 'cancelling'].includes(event.state);
    if (build) { buildButton.disabled = busy; cancelButton.disabled = !busy || event.state === 'cancelling'; }
    else previewButton.disabled = busy;
  }
  const builds = serialJobs<Task>(async (task, signal) => {
    if (task.kind === 'build') return runtime.build(task.snapshot, signal);
    if (task.kind === 'start') return runtime.start(task.snapshot);
    return runtime.sync(task.snapshot);
  }, jobChanged);
  const submit = (kind: Task['kind'], snapshot: Snapshot) => { runtimeRequested = true; return builds.submit(`${kind}:${snapshot.revision}`, { kind, snapshot }); };
  let analysisRevision = 0;
  let foregroundQueries = 0;
  const analysis = latestQueue(async (task: { snapshot: Snapshot; method: string; path: string; position: number }) => {
    await session.compiler.call('sync', task.snapshot);
    return session.compiler.call<any>(task.method, { revision: task.snapshot.revision, path: task.path, position: task.position });
  });
  const analyze = (method: string, position: number, target = path, files = { ...current.files, [path]: editor.text }) => analysis.submit({ snapshot: { revision: ++analysisRevision, files }, method, path: target, position });
  async function foreground(method: string, position: number, target = path, files = { ...current.files, [path]: editor.text }) {
    foregroundQueries++;
    closeCompletion(editor.view);
    try { return await analyze(method, position, target, files); }
    finally { foregroundQueries--; }
  }
  const editor = createEditor(root.querySelector<HTMLElement>('#editor')!, async position => {
    if (foregroundQueries) return {};
    try { return await analyze('query', position); } catch { return {}; }
  }, () => { if (!dirty) draftRevision = current.revision; dirty = true; status.textContent = 'Unsaved changes'; });
  const report = (error: unknown) => { if (error instanceof DOMException && error.name === 'AbortError') return; status.textContent = String(error); };
  function render() {
    select.replaceChildren(...Object.keys(current.files).sort().map(name => { const option = document.createElement('option'); option.value = name; option.textContent = name; return option; }));
    select.value = path;
    editor.setDocument(current.files[path]);
    dirty = false;
    draftRevision = current.revision;
    status.textContent = `Saved · revision ${current.revision}`;
  }
  render(); select.disabled = false;
  buttons.forEach(button => { button.disabled = false; });
  cancelButton.disabled = true;
  select.onchange = () => {
    if (dirty) { select.value = path; status.textContent = 'Save changes before switching files'; return; }
    path = select.value; render();
  };
  const actions: Record<string, () => Promise<void>> = {
    async save() {
      const submitted = editor.text;
      current = await session.workspace.commit(draftRevision, { [path]: submitted });
      draftRevision = current.revision;
      if (editor.text === submitted) render();
      if (runtimeRequested) await submit('sync', current).catch(() => {});
    },
    async reload() { current = session.workspace.snapshot(); render(); },
    async preview() { await submit('start', current).catch(() => {}); },
    async build() {
      if (dirty) throw new Error('Save changes before building');
      await submit('build', current).catch(() => {});
    },
    async cancel() { builds.cancel(task => task.kind === 'build'); },
    async check() {
      status.textContent = 'Checking types…';
      const result: {message: string; start?: number}[] = await foreground('diagnostics', 0);
      editor.diagnostics(result);
      diagnostics.replaceChildren(...result.map(item => { const li = document.createElement('li'); li.textContent = item.message; return li; }));
      status.textContent = `${result.length} diagnostics`;
    },
    async definition() {
      status.textContent = 'Finding definition…';
      const result: Semantics = await foreground('query', editor.view.state.selection.main.head);
      const definition = result.definitions?.[0];
      if (!definition || !(definition.fileName.slice(1) in current.files)) { status.textContent = 'No workspace definition found'; return; }
      if (dirty) throw new Error('Save changes before navigating');
      path = definition.fileName.slice(1); render(); editor.setDocument(current.files[path], definition.textSpan.start);
    },
  };
  buttons.forEach(button => { button.onclick = () => { void actions[button.id]().catch(report); }; });
  const closeAgent = mountAgent(root.querySelector<HTMLElement>('section[aria-label=Agent]')!, {
    workspace: session.workspace, canEdit: () => !dirty,
    async changed(snapshot) { current = snapshot; if (!dirty) render(); if (runtimeRequested) await submit('sync', snapshot); },
    async build() { const revision = await submit('build', session.workspace.snapshot()); return revision; },
    diagnostics: target => foreground('diagnostics', 0, target, current.files),
    persist: (status, messages) => session.storage.call('saveSession', { status, messages }),
  }, saved);
  return () => { disposed = true; closeAgent(); builds.cancel(() => true); analysis.cancel(); editor.close(); runtime.close(); session.close(); root.replaceChildren(); };
}
