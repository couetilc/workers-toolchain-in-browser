const libraries = import.meta.glob<string>('/node_modules/typescript/lib/lib*.d.ts', {
  eager: true, query: '?raw', import: 'default',
});
const declarations = import.meta.glob<string>([
  '/node_modules/@types/react/**/*.d.ts', '/node_modules/@types/react/package.json',
  '/node_modules/@types/react-dom/**/*.d.ts', '/node_modules/@types/react-dom/package.json',
  '/node_modules/csstype/index.d.ts', '/node_modules/csstype/package.json',
], { eager: true, query: '?raw', import: 'default' });
const fixture = import.meta.glob<string>('../fixture/*', { eager: true, query: '?raw', import: 'default' });

export const libraryFiles = Object.fromEntries(Object.entries(libraries).map(([path, text]) => [path.replace('/node_modules/typescript/lib/', '/'), text]));
export const declarationFiles = declarations;
export const projectFiles = Object.fromEntries(Object.entries(fixture).map(([path, text]) => [path.replace('../fixture/', '/src/'), text]));
