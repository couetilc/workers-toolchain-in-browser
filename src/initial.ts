const imported = import.meta.glob<string>('../experiments/e01-vite-runtime/fixture/**/*', { eager: true, query: '?raw', import: 'default' });
export const initialFiles = Object.fromEntries(Object.entries(imported).map(([path, contents]) => [path.slice('../experiments/e01-vite-runtime/fixture/'.length), contents]));
