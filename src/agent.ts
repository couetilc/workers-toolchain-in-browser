import { Agent, streamProxy, type AgentMessage, type AgentTool, type StreamFn } from '@earendil-works/pi-agent-core';
import { Type } from 'typebox';
import type { Model } from '@earendil-works/pi-ai';
import type { Workspace, Snapshot } from './workspace';

export const model: Model<'openai-completions'> = { id: 'configured-model', name: 'Configured model', api: 'openai-completions', provider: 'openai', baseUrl: '', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32000, maxTokens: 2048 };
export const proxyStream: StreamFn = (model, context, options) => streamProxy(model, context, { ...options, proxyUrl: location.origin, authToken: 'local-prototype' });

export interface AgentHost {
  workspace: Workspace;
  canEdit(): boolean;
  changed(snapshot: Snapshot): Promise<void>;
  build(): Promise<unknown>;
  diagnostics(path: string): Promise<unknown>;
  persist(status: string, messages: AgentMessage[]): Promise<void>;
  display(messages: AgentMessage[], streaming: AgentMessage | undefined): void;
}
export function createAgent(host: AgentHost, stream: StreamFn, messages: AgentMessage[]) {
  const result = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], details: value });
  const tools: AgentTool<any>[] = [
    { name: 'list_files', label: 'List files', description: 'List workspace files and current revision.', parameters: Type.Object({}),
      execute: async () => result({ revision: host.workspace.snapshot().revision, files: Object.keys(host.workspace.snapshot().files) }) },
    { name: 'read_file', label: 'Read file', description: 'Read a file and revision before editing.', parameters: Type.Object({ path: Type.String() }),
      execute: async (_id, value) => {
        const args = value as { path: string };
        const snapshot = host.workspace.snapshot();
        if (!(args.path in snapshot.files)) throw new Error('File not found');
        return result({ revision: snapshot.revision, contents: snapshot.files[args.path] });
      } },
    { name: 'edit_file', label: 'Edit file', description: 'Replace one unique exact text occurrence at the revision returned by read_file.',
      parameters: Type.Object({ path: Type.String(), search: Type.String({ minLength: 1 }), replacement: Type.String(), expectedRevision: Type.Integer() }),
      execute: async (_id, value, signal) => {
        const args = value as { path: string; search: string; replacement: string; expectedRevision: number };
        signal?.throwIfAborted();
        if (!host.canEdit()) throw new Error('Unsaved human edits; save before applying an agent edit');
        const source = host.workspace.snapshot().files[args.path];
        if (source === undefined || !args.search || source.split(args.search).length !== 2) throw new Error('Search must match exactly once');
        const next = await host.workspace.commit(args.expectedRevision, { [args.path]: source.replace(args.search, () => args.replacement) });
        await host.changed(next);
        return result({ revision: next.revision });
      } },
    { name: 'build', label: 'Build project', description: 'Run actual Vite production build in the browser.', parameters: Type.Object({}), execute: async () => result(await host.build()) },
    { name: 'diagnostics', label: 'Check types', description: 'Get TypeScript diagnostics for a workspace source file.', parameters: Type.Object({ path: Type.String() }), execute: async (_id, args) => result(await host.diagnostics((args as { path: string }).path)) },
  ];
  const agent = new Agent({ streamFn: stream, toolExecution: 'sequential', initialState: {
    model, messages, tools,
    systemPrompt: 'You edit a browser TypeScript/React workspace. Read before editing, use exact revisions, preserve human work, check diagnostics and build after edits. Never claim a change succeeded if a tool failed. You have no shell.',
  } });
  let cancelled = false;
  agent.subscribe(async event => {
    host.display(agent.state.messages, agent.state.streamingMessage);
    if (event.type === 'message_end' || event.type === 'tool_execution_start') await host.persist('running', agent.state.messages);
  });
  return {
    agent,
    async run(prompt: string) {
      if (agent.state.isStreaming) throw new Error('Agent already running');
      cancelled = false;
      await host.persist('running', agent.state.messages);
      try {
        await agent.prompt(prompt);
        const status = cancelled ? 'cancelled' : agent.state.errorMessage ? 'failed' : 'completed';
        await host.persist(status, agent.state.messages);
        return status;
      } catch (error) { await host.persist('failed', agent.state.messages); throw error; }
    },
    cancel() { cancelled = true; agent.abort(); },
  };
}
