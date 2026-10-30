import { afterEach, expect, it, vi } from 'vitest';
import { workloadFiles } from '../../experiments/e03-workload/src/workload';
import { createService } from '../../experiments/e02-typescript/src/service';
import { libraryFiles, declarationFiles } from '../../experiments/e02-typescript/src/assets';

const { mockBoot } = vi.hoisted(() => ({ mockBoot: vi.fn() }));
vi.mock('@webcontainer/api', () => ({ WebContainer: { boot: mockBoot } }));
afterEach(() => { document.body.replaceChildren(); });

it('generates deterministic modules and resolves their types through the real compiler', () => {
  expect(workloadFiles(0)).toEqual({ 'src/workload.ts': '\nexport const total: number = 0;\n' });
  const generated = workloadFiles(250);
  expect(Object.keys(generated)).toHaveLength(251);
  expect(generated).toEqual(workloadFiles(250));
  expect(generated['src/generated/module249.ts']).toContain('value249: number = 249');
  const service = createService(libraryFiles, declarationFiles, Object.fromEntries(Object.entries(generated).map(([path, contents]) => ['/' + path, contents])));
  expect(service.diagnostics('/src/workload.ts')).toEqual([]);
  service.dispose();
});

it.each([-1, 1001, 0.5, NaN])('rejects invalid workload size %s', count => {
  expect(() => workloadFiles(count)).toThrow('Module count must be an integer from 0 to 1000');
});

it('loads the workload page through its real entry and cleans up', async () => {
  document.body.innerHTML = '<main id="app"></main><section id="analysis"></section>';
  mockBoot.mockRejectedValueOnce(new Error('workload runtime unavailable'));
  await import('../../experiments/e03-workload/src/main');
  document.querySelector<HTMLButtonElement>('#start')!.click();
  await vi.waitFor(() => expect(document.querySelector('[role=status]')!.textContent).toBe('Failed: workload runtime unavailable'));
  expect(mockBoot).toHaveBeenCalledWith({ coep: 'require-corp', workdirName: 'workload-experiment', forwardPreviewErrors: true });
  document.querySelector<HTMLButtonElement>('#analysis button')!.click();
  expect(JSON.parse(document.querySelector('#analysis pre')!.textContent!).diagnostics).toEqual([]);
  document.querySelector<HTMLButtonElement>('#type-error')!.click();
  expect(JSON.parse(document.querySelector('#analysis pre')!.textContent!).diagnostics[0].code).toBe(2322);
  document.querySelector<HTMLButtonElement>('#type-fix')!.click();
  expect(JSON.parse(document.querySelector('#analysis pre')!.textContent!).diagnostics).toEqual([]);
  window.dispatchEvent(new Event('pagehide'));
  expect(document.querySelector('#app')!.childElementCount).toBe(0);
  expect(document.querySelector('#analysis')!.childElementCount).toBe(0);
});
