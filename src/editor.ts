import { EditorView, keymap, lineNumbers, hoverTooltip } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion, completionKeymap, type CompletionContext } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { setDiagnostics } from '@codemirror/lint';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import type ts from 'typescript';

export interface Semantics { completions?: ts.CompletionInfo; hover?: ts.QuickInfo; definitions?: readonly ts.DefinitionInfo[] }
export function createEditor(parent: HTMLElement, query: (position: number) => Promise<Semantics>, change: () => void) {
  let replacing = false;
  const completion = async (context: CompletionContext) => {
    const result = await query(context.pos);
    if (!result.completions) return null;
    const word = context.matchBefore(/\w*/)!;
    return { from: word.from, options: result.completions.entries.map(entry => ({ label: entry.name })) };
  };
  const hover = async (_view: EditorView, position: number) => {
    const result = await query(position);
    if (!result.hover) return null;
    const info = result.hover;
    return { pos: info.textSpan.start, end: info.textSpan.start + info.textSpan.length,
      create() { const dom = document.createElement('div'); dom.textContent = info.displayParts!.map(part => part.text).join(''); return { dom }; },
    };
  };
  const view = new EditorView({ parent, state: EditorState.create({ extensions: [
    lineNumbers(), history(), javascript({ typescript: true, jsx: true }), syntaxHighlighting(defaultHighlightStyle),
    keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
    autocompletion({ override: [completion] }), hoverTooltip(hover),
    EditorView.contentAttributes.of({ 'aria-label': 'File contents' }),
    EditorView.updateListener.of(update => { if (update.docChanged && !replacing) change(); }),
  ] }) });
  return {
    view, completion, hover,
    get text() { return view.state.doc.toString(); },
    setDocument(text: string, position = 0) {
      replacing = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: position } });
      replacing = false;
    },
    diagnostics(items: { start?: number; message: string }[]) {
      view.dispatch(setDiagnostics(view.state, items.map(item => ({ from: item.start ?? 0, to: item.start ?? 0, severity: 'error', message: item.message }))));
    },
    close: () => view.destroy(),
  };
}
