import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const read = name => fs.readFileSync(path.join(dist, name), 'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));
const app = read('app.js');
const worker = read('sw.js');
const htmlFiles = ['index.html', 'showcase.html'];

// Resolve actual shipped references from the same two locations Pages supports.
function checkReference(ref, documentURL, appBase) {
  if (/^(https?:|data:|mailto:|#)/.test(ref)) return;
  assert.ok(!ref.startsWith('/'), `Root-absolute path breaks project Pages: ${ref}`);
  const resolved = new URL(ref, documentURL);
  assert.equal(resolved.origin, appBase.origin);
  assert.ok(resolved.pathname.startsWith(appBase.pathname), `Reference escapes app: ${ref}`);
  const relative = decodeURIComponent(resolved.pathname.slice(appBase.pathname.length)) || 'index.html';
  assert.ok(fs.existsSync(path.join(dist, relative)), `Missing shipped asset: ${relative}`);
}

for (const basePath of ['/', '/apex-f1/']) {
  const base = new URL(`https://example.github.io${basePath}`);
  for (const file of htmlFiles) {
    for (const match of read(file).matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
      checkReference(match[1], new URL(file, base), base);
    }
  }
  for (const match of read('styles.css').matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) {
    checkReference(match[1], new URL('styles.css', base), base);
  }
  const refs = [manifest.id, manifest.start_url, manifest.scope, ...manifest.icons.map(i => i.src)];
  for (const shortcut of manifest.shortcuts || []) refs.push(shortcut.url, ...(shortcut.icons || []).map(i => i.src));
  refs.forEach(ref => checkReference(ref, new URL('manifest.webmanifest', base), base));
  for (const name of ['replay.json', 'sw.js']) checkReference(name, new URL('app.js', base), base);
  assert.equal(new URL('./?demo=tour', new URL('showcase.html', base)).href, `${base.href}?demo=tour`);
}
assert.match(app, /const APP_BASE = new URL\('\.\/', import\.meta\.url\)/);
assert.match(app, /fetch\(appUrl\('replay\.json'\)\)/);
assert.match(app, /serviceWorker\.register\(appUrl\('sw\.js'\), \{scope: APP_BASE\.href\}\)/);
assert.ok(!/\b(?:fetch|register)\(['"]\//.test(app), 'App requests must not start at origin root');
assert.ok(!app.includes('ChatGPT'), 'Portable UI must not require the former hosting account');

async function checkWorker(basePath) {
  const base = new URL(`https://example.github.io${basePath}`);
  const handlers = new Map(), storage = new Map(), networkLog = [];
  let offline = false;
  const keyOf = value => typeof value === 'string' ? value : value.url;
  const makeCache = () => {
    const entries = new Map();
    return {
      async addAll(urls) {
        for (const url of urls) {
          const location = new URL(url);
          assert.equal(location.origin, base.origin);
          assert.ok(location.pathname.startsWith(base.pathname), `Precache escaped ${base.pathname}`);
          const relative = location.pathname.slice(base.pathname.length) || 'index.html';
          assert.ok(fs.existsSync(path.join(dist, relative)), `Precache asset missing: ${relative}`);
          entries.set(url, new Response(`cached:${relative}`, {headers:{'Content-Type': relative.endsWith('.html') ? 'text/html' : 'application/octet-stream'}}));
        }
      },
      async put(key, response) {entries.set(keyOf(key), response.clone());},
      async match(key) {return entries.get(keyOf(key))?.clone();}
    };
  };
  const caches = {
    async open(name) {if (!storage.has(name)) storage.set(name, makeCache()); return storage.get(name);},
    async keys() {return [...storage.keys()];},
    async delete(name) {return storage.delete(name);}
  };
  const self = {location:new URL('sw.js', base), addEventListener:(name, handler)=>handlers.set(name, handler), skipWaiting:async()=>{}, clients:{claim:async()=>{}}};
  const context = vm.createContext({self, caches, URL, Set, Response, fetch:async request=>{
    networkLog.push(keyOf(request));
    if (offline) throw new TypeError('Simulated offline network');
    return new Response('fresh response', {headers:{'Content-Type':'text/html'}});
  }});
  vm.runInContext(worker + '\nglobalThis.inspectWorker = {CACHE, CACHE_PREFIX, ASSET_URLS, INDEX_URL, SHOWCASE_URL};', context);
  const meta = context.inspectWorker;
  let pending;
  handlers.get('install')({waitUntil:value=>{pending=value;}}); await pending;
  const oldOwn = `${meta.CACHE_PREFIX}old-version`, foreign = 'apex-shell:%2Fother-project%2F:old-version';
  await caches.open(oldOwn); await caches.open(foreign); await caches.open('unrelated-service-worker');
  handlers.get('activate')({waitUntil:value=>{pending=value;}}); await pending;
  assert.ok(!storage.has(oldOwn), 'Activation should remove only old versions of this app');
  assert.ok(storage.has(foreign), 'Activation deleted another Pages project cache');
  assert.ok(storage.has('unrelated-service-worker'), 'Activation deleted unrelated application cache');

  async function dispatch(url, mode='navigate', method='GET') {
    let response;
    handlers.get('fetch')({request:{url,mode,method},respondWith:value=>{response=value;}});
    return response === undefined ? undefined : await response;
  }
  const tourURL = `${base.href}?demo=tour`;
  assert.equal(await (await dispatch(tourURL)).text(), 'fresh response');
  assert.equal(networkLog.at(-1), tourURL, 'Demo query must be preserved for online navigation');
  offline = true;
  assert.equal(await (await dispatch(tourURL)).text(), 'fresh response', 'Tour should fall back to the cached app page');
  assert.equal(await (await dispatch(new URL('showcase.html', base).href)).text(), 'cached:showcase.html', 'Showcase needs its own offline page, not index.html');
  assert.equal(await (await dispatch(new URL('replay.json', base).href, 'cors')).text(), 'cached:replay.json');
  for (const [url, mode, method] of [
    ['https://api.openf1.org/v1/sessions', 'cors', 'GET'],
    [`${base.origin}/other-project/`, 'navigate', 'GET'],
    [new URL('unknown-route', base).href, 'navigate', 'GET'],
    [new URL('unknown.json', base).href, 'cors', 'GET'],
    [new URL('app.js', base).href, 'cors', 'POST']
  ]) assert.equal(await dispatch(url, mode, method), undefined, `Worker must ignore ${method} ${url}`);
  return {base:base.pathname, precachedAssets:meta.ASSET_URLS.length, offline:'passed', cacheIsolation:'passed'};
}

const results = [];
for (const base of ['/', '/apex-f1/']) results.push(await checkWorker(base));
console.log('GitHub Pages portability checks passed.');
console.log(JSON.stringify(results, null, 2));
