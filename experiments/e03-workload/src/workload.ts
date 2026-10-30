/** Deterministic extra modules for comparing the same toolchain at two sizes. */
export function workloadFiles(count: number): Record<string, string> {
  if (!Number.isInteger(count) || count < 0 || count > 1000) throw new Error('Module count must be an integer from 0 to 1000');
  const modules = Array.from({ length: count }, (_, index) => ({
    path: `src/generated/module${index}.ts`,
    source: `export const value${index}: number = ${index};\nexport const samples${index}: number[] = [${Array.from({ length: 100 }, (_, offset) => index + offset).join(',')}];\n`,
  }));
  return {
    ...Object.fromEntries(modules.map(module => [module.path, module.source])),
    'src/workload.ts': modules.map((_, index) => `import { value${index}, samples${index} } from './generated/module${index}';`).join('\n')
      + `\nexport const total: number = ${Array.from({ length: count }, (_, index) => `value${index} + samples${index}.length`).join(' + ') || '0'};\n`,
  };
}
