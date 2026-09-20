const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const ts = require('typescript');
// Execute real TypeScript modules with browser storage isolated from the user's save.
function runtime({ saved, mode = 'production', storage = new Map(), external = {}, globals = {} } = {}) {
  const key = mode === 'test' ? 'one-more-card-test-progress' : 'one-more-card-progress';
  if (saved) storage.set(key, JSON.stringify(saved));
  let failWrite = false;
  const localStorage = {
    getItem: (name) => storage.get(name) ?? null,
    setItem: (name, value) => { if (failWrite) throw new Error('storage denied'); storage.set(name, value); },
  };
  const modules = new Map();
  function load(file) {
    file = path.resolve(file);
    if (file.endsWith('/runtimeMode.ts')) return { getRuntimeMode: () => mode, isTestMode: () => mode === 'test', setRuntimeMode: (value) => { mode = value; } };
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    // Vite replaces this flag in production; mirror that for scene integration tests.
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText.replaceAll('import.meta.env.DEV', 'false');
    const context = { module, exports: module.exports, localStorage, crypto, console, ...globals,
      require: (request) => {
        if (external[request]) return external[request];
        const target = path.resolve(path.dirname(file), request);
        return load(fs.existsSync(target + '.ts') ? target + '.ts' : path.join(target, 'index.ts'));
      } };
    vm.runInNewContext(code, context, { filename: file });
    return module.exports;
  }
  const progress = load('src/game/progress.ts');
  return { progress, load, storage, key, failWrite: (value = true) => { failWrite = value; } };
}

module.exports = { runtime };
