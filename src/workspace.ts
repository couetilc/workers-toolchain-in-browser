export interface Snapshot { revision: number; files: Record<string, string> }
export interface Storage {
  read(): Promise<Snapshot | null>;
  save(expected: number, snapshot: Snapshot): Promise<void>;
}

export function validatePath(path: string) {
  if (!/^[\w.-]+(?:\/[\w.-]+)*$/.test(path) || path.split('/').some(part => ['.', '..', 'node_modules', 'dist'].includes(part))) {
    throw new Error(`Invalid workspace path: ${path}`);
  }
}

export async function openWorkspace(storage: Storage, initial: Record<string, string>) {
  let current = await storage.read();
  if (!current) {
    Object.keys(initial).forEach(validatePath);
    current = { revision: 0, files: { ...initial } };
    await storage.save(-1, current);
  }
  let tail: Promise<unknown> = Promise.resolve();
  return {
    snapshot: () => structuredClone(current!),
    commit(expected: number, edits: Record<string, string | null>) {
      const work = tail.then(async () => {
        if (expected !== current!.revision) throw new Error('Revision conflict: reload the latest files');
        const files = { ...current!.files };
        for (const [path, contents] of Object.entries(edits)) {
          validatePath(path);
          if (contents === null) delete files[path];
          else files[path] = contents;
        }
        const next = { revision: expected + 1, files };
        await storage.save(expected, next);
        current = next;
        return structuredClone(next);
      });
      tail = work.catch(() => {});
      return work;
    },
  };
}

export type Workspace = Awaited<ReturnType<typeof openWorkspace>>;
