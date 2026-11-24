import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = [
  ['--check', 'dist/app.js'],
  ['--check', 'dist/api.js'],
  ['--check', 'dist/engine.js'],
  ['--check', 'dist/sw.js'],
  ['--check', 'scripts/serve.mjs'],
  ['tests/check-engine.mjs'],
  ['tests/check-portability.mjs']
];
for (const args of checks) {
  const result = spawnSync(process.execPath, args, {cwd:root,stdio:'inherit'});
  if (result.error) {console.error(result.error.message);process.exit(1);}
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('APEX: wszystkie kontrole zakończone powodzeniem.');
