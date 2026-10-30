import ts from 'typescript';
import { createSystem, createVirtualTypeScriptEnvironment } from '@typescript/vfs';

export function createService(libraries: Record<string, string>, declarations: Record<string, string>, files: Record<string, string>) {
  const env = createVirtualTypeScriptEnvironment(
    createSystem(new Map(Object.entries({ ...libraries, ...declarations, ...files }))),
    Object.keys(files), ts,
    { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX,
      strict: true, noEmit: true, types: ['react', 'react-dom'] },
  );
  return {
    version: ts.version,
    diagnostics(file: string) {
      return [
        ...env.languageService.getCompilerOptionsDiagnostics(),
        ...env.languageService.getSyntacticDiagnostics(file),
        ...env.languageService.getSemanticDiagnostics(file),
      ].map(diagnostic => ({
        code: diagnostic.code, start: diagnostic.start,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      }));
    },
    query(file: string, position: number) {
      return {
        hover: env.languageService.getQuickInfoAtPosition(file, position),
        definitions: env.languageService.getDefinitionAtPosition(file, position),
        completions: env.languageService.getCompletionsAtPosition(file, position, {}),
      };
    },
    update: env.updateFile,
    dispose: () => env.languageService.dispose(),
  };
}
