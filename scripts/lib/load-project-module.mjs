import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const rootDir = process.cwd();
const moduleCache = new Map();

export function loadProjectModule(modulePath) {
  if (moduleCache.has(modulePath)) return moduleCache.get(modulePath);
  if (modulePath.endsWith('.json')) return JSON.parse(fs.readFileSync(modulePath, 'utf8'));
  const transpiled = ts.transpileModule(fs.readFileSync(modulePath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
  const commonJsModule = { exports: {} };
  moduleCache.set(modulePath, commonJsModule.exports);
  vm.runInNewContext(transpiled, {
    URL, URLSearchParams, module: commonJsModule, exports: commonJsModule.exports,
    require(specifier) {
      const localPath = specifier.startsWith('@/') ? path.join(rootDir, 'src', specifier.slice(2)) : path.resolve(path.dirname(modulePath), specifier);
      if (!localPath.startsWith(`${path.join(rootDir, 'src')}${path.sep}`)) throw new Error('Only project source imports are supported');
      return loadProjectModule(path.extname(localPath) ? localPath : `${localPath}.ts`);
    },
  }, { filename: modulePath });
  return commonJsModule.exports;
}
