import { expect, it, vi } from 'vitest';
import { CompletionContext } from '@codemirror/autocomplete';
import { createEditor } from '../../src/editor';

it('adapts completions, hover, diagnostics, external document changes, and user changes', async () => {
  const parent = document.createElement('div'); document.body.append(parent);
  const query = vi.fn().mockResolvedValue({}), changed = vi.fn();
  const editor = createEditor(parent, query, changed);
  editor.setDocument('count'); expect(changed).not.toHaveBeenCalled();
  expect(editor.text).toBe('count');
  expect(await editor.completion(new CompletionContext(editor.view.state, 5, true))).toBeNull();
  expect(await editor.hover(editor.view, 1)).toBeNull();
  query.mockResolvedValue({ completions: { entries: [{ name: 'counter' }] }, hover: { textSpan: { start: 0, length: 5 }, displayParts: [{ text: 'const count: number' }] } });
  expect(await editor.completion(new CompletionContext(editor.view.state, 5, true))).toEqual({ from: 0, options: [{ label: 'counter' }] });
  expect((await editor.hover(editor.view, 1))!.create().dom.textContent).toBe('const count: number');
  editor.view.dispatch({ changes: { from: 0, insert: 'x' } }); expect(changed).toHaveBeenCalled();
  editor.diagnostics([{ start: 0, message: 'type mismatch' }, { message: 'project error' }]);
  editor.close(); parent.remove();
});
