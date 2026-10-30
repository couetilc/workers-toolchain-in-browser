import { afterEach, expect, it } from 'vitest';
import { createService } from '../../experiments/e02-typescript/src/service';
import { libraryFiles, declarationFiles, projectFiles } from '../../experiments/e02-typescript/src/assets';

afterEach(() => { document.body.replaceChildren(); });

it('uses the real browser compiler for cross-file TSX diagnostics and semantic queries', () => {
  const service = createService(libraryFiles, declarationFiles, projectFiles);
  const file = '/src/Counter.tsx';
  const source = projectFiles[file];
  expect(service.version).toBe('6.0.3');
  expect(service.diagnostics(file)).toEqual([{ code: 2322, start: source.indexOf('initial:'), message: "Type 'string' is not assignable to type 'number'." }]);
  const symbol = service.query(file, source.indexOf('= count') + 3);
  expect(symbol.hover?.displayParts?.map(part => part.text).join('')).toContain('count: string');
  expect(symbol.definitions?.[0].fileName).toBe('/src/values.ts');
  expect(service.query(file, source.indexOf('settings.title') + 9).completions?.entries.map(entry => entry.name)).toEqual(['enabled', 'title']);
  service.update('/src/values.ts', projectFiles['/src/values.ts'].replace("string = 'one'", 'number = 1'));
  expect(service.diagnostics(file)).toEqual([]);
  service.update(file, 'export const broken = ;');
  expect(service.diagnostics(file).some(d => d.code === 1109)).toBe(true);
  expect(service.query(file, 0).hover).toBeUndefined();
  service.dispose();
});

it('exposes real compiler results through the page and disposes on pagehide', async () => {
  document.body.innerHTML = '<main id="app"></main>';
  await import('../../experiments/e02-typescript/src/main');
  const click = (id: string) => document.querySelector<HTMLButtonElement>(id)!.click();
  click('#analyze');
  expect(document.querySelector('[role=status]')!.textContent).toBe('1 diagnostics');
  click('#fix-types');
  expect(document.querySelector('[role=status]')!.textContent).toBe('0 diagnostics');
  click('#break-types');
  expect(document.querySelector('[role=status]')!.textContent).toBe('1 diagnostics');
  expect(JSON.parse(document.querySelector('pre')!.textContent!).symbol.definitions[0].fileName).toBe('/src/values.ts');
  window.dispatchEvent(new Event('pagehide'));
  expect(document.querySelector('#app')!.childElementCount).toBe(0);
});
