// @vitest-environment node
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';

const supabaseEnv = { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-key' };

const directories: string[] = [];
const children: ChildProcess[] = [];
afterEach(async () => {
  await Promise.all(children.splice(0).map(stop));
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })));
});
function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise(resolve => { child.once('exit', () => resolve()); child.kill(); });
}
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), 'stussy-api-'));
  directories.push(directory);
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port.');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return { directory, port, url: 'http://127.0.0.1:' + port };
}
function launch(directory: string, env: NodeJS.ProcessEnv) {
  const childEnv = { ...process.env };
  for (const key of Object.keys(childEnv)) {
    if (/^(SUPABASE_|BAKONG_|PAYWAY_|TEST_)|^(PAYMENT_MODE|API_PORT|APP_ORIGIN|STORAGE_MODE|SQLITE_PATH|MERCHANT_NAME|MERCHANT_CITY|ORDER_CURRENCY)$/.test(key)) delete childEnv[key];
  }
  const child = spawn(process.execPath, ['--import', pathToFileURL(resolve('node_modules/tsx/dist/loader.mjs')).href,
    resolve('back-end/server/index.ts')], { cwd: directory, env: { ...childEnv, ...env }, windowsHide: true, stdio: 'pipe' });
  children.push(child);
  let output = '';
  child.stdout?.on('data', chunk => { output += chunk; });
  child.stderr?.on('data', chunk => { output += chunk; });
  return { child, output: () => output };
}
async function ready(url: string, child: ChildProcess) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (child.exitCode !== null) throw new Error('Runtime exited before readiness.');
    try { const response = await fetch(url + '/api/health'); if (response.ok) return response.json(); } catch { /* Wait for startup. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Runtime did not become ready.');
}
it('loads Supabase configuration from .env.local and owns the local listener', async () => {
  const { directory, port, url } = await setup();
  await writeFile(join(directory, '.env.local'), 'PAYMENT_MODE=mock\nAPI_PORT=' + port
    + '\nSTORAGE_MODE=supabase\nSUPABASE_URL=https://project.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=synthetic-service-role-key\n');
  const first = launch(directory, {});
  expect(await ready(url, first.child)).toEqual({ ready: true, paymentMode: 'mock' });
  expect(first.output()).not.toContain('synthetic-service-role-key');
  await stop(first.child);
  await expect(fetch(url + '/api/health')).rejects.toThrow();
  const restarted = launch(directory, {});
  expect(await ready(url, restarted.child)).toEqual({ ready: true, paymentMode: 'mock' });
  await expect(readFile(join(directory, 'data/store.sqlite'))).rejects.toMatchObject({ code: 'ENOENT' });
}, 15000);
it('starts from environment settings when .env.local is absent', async () => {
  const { directory, port, url } = await setup();
  const runtime = launch(directory, { ...supabaseEnv, PAYMENT_MODE: 'mock', API_PORT: String(port) });
  expect(await ready(url, runtime.child)).toEqual({ ready: true, paymentMode: 'mock' });
}, 10000);
it.each(['sit', 'production'])('fails closed for incomplete %s credentials without exposing credentials', async paymentMode => {
  const { directory, port } = await setup();
  const runtime = launch(directory, { ...supabaseEnv, PAYMENT_MODE: paymentMode, API_PORT: String(port), BAKONG_API_TOKEN: 'secret-token' });
  const code = await new Promise<number | null>(resolve => runtime.child.once('exit', resolve));
  expect(code).toBe(1);
  expect(runtime.output()).not.toMatch(/secret-token|\n\s+at /);
  await expect(readFile(join(directory, 'data/store.sqlite'))).rejects.toMatchObject({ code: 'ENOENT' });
}, 10000);

it.each(['sit', 'production'])('starts a configured %s runtime without contacting the provider', async paymentMode => {
  const { directory, port, url } = await setup();
  const runtime = launch(directory, {
    ...supabaseEnv, PAYMENT_MODE: paymentMode, API_PORT: String(port),
    BAKONG_API_BASE_URL: 'https://api.example.test', BAKONG_API_TOKEN: 'synthetic-token',
    BAKONG_ACCOUNT_ID: 'shop@example', BAKONG_MERCHANT_ID: 'merchant-1',
    BAKONG_ACQUIRING_BANK: 'TEST BANK', MERCHANT_NAME: 'Test Shop', MERCHANT_CITY: 'PHNOM PENH',
    TEST_UNIT_PRICE_MINOR: '1', TEST_FREE_SHIPPING: 'true',
  });
  expect(await ready(url, runtime.child)).toEqual({ ready: true, paymentMode });
  expect(runtime.output()).not.toMatch(/synthetic-token|shop@example|merchant-1|TEST BANK/);
}, 10000);

it.each([
  { SUPABASE_URL: undefined, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-role-key' },
  { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: undefined },
  { ...supabaseEnv, STORAGE_MODE: 'sqlite' },
])('fails closed for incomplete or unsupported storage configuration', async env => {
  const { directory, port, url } = await setup();
  const runtime = launch(directory, { ...env, PAYMENT_MODE: 'mock', API_PORT: String(port) });
  const code = await new Promise<number | null>(resolve => runtime.child.once('exit', resolve));
  expect(code).toBe(1);
  expect(runtime.output()).not.toMatch(/synthetic-service-role-key|\n\s+at /);
  await expect(fetch(url + '/api/health')).rejects.toThrow();
}, 10000);
