import type { FileSystemTree } from '@webcontainer/api';

export function fileTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split('/');
    const name = parts.pop()!;
    let parent = tree;
    for (const part of parts) {
      parent[part] ??= { directory: {} };
      parent = (parent[part] as { directory: FileSystemTree }).directory;
    }
    parent[name] = { file: { contents } };
  }
  return tree;
}
