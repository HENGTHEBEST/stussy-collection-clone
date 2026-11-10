// @vitest-environment node
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import type { PublicOrder } from '../shared/commerce.js';
import { createOrderRequest } from './test/fixtures.js';

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
  for (const key of ['PAYMENT_MODE', 'API_PORT', 'APP_ORIGIN', 'SQLITE_PATH', 'BAKONG_API_BASE_URL',
    'BAKONG_API_TOKEN', 'BAKONG_ACCOUNT_ID', 'BAKONG_MERCHANT_ID', 'BAKONG_ACQUIRING_BANK',
    'MERCHANT_NAME', 'MERCHANT_CITY', 'TEST_UNIT_PRICE_MINOR', 'TEST_FREE_SHIPPING']) delete childEnv[key];
  const child = spawn(process.execPath, ['--import', pathToFileURL(resolve('node_modules/tsx/dist/loader.mjs')).href,
    resolve('server/index.ts')], { cwd: directory, env: { ...childEnv, ...env }, windowsHide: true, stdio: 'pipe' });
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
it('loads .env.local and composes durable SQLite orders across runtime restarts', async () => {
  const { directory, port, url } = await setup();
  await writeFile(join(directory, '.env.local'), 'PAYMENT_MODE=mock\nAPI_PORT=' + port + '\nSQLITE_PATH=./nested/store.sqlite\n');
  const first = launch(directory, {});
  expect(await ready(url, first.child)).toEqual({ ready: true, paymentMode: 'mock' });
  const created = await fetch(url + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createOrderRequest()) });
  expect(created.status).toBe(201);
  const order = await created.json() as PublicOrder;
  expect((await fetch(url + '/api/orders/' + order.id + '/mock-payment', { method: 'POST' })).status).toBe(200);
  await stop(first.child);
  const restarted = launch(directory, {});
  await ready(url, restarted.child);
  expect(await (await fetch(url + '/api/orders/' + order.id)).json()).toMatchObject({ id: order.id, status: 'paid' });
  expect((await readFile(join(directory, 'nested/store.sqlite'))).subarray(0, 15).toString()).toBe('SQLite format 3');
}, 15000);
it('starts from environment settings when .env.local is absent', async () => {
  const { directory, port, url } = await setup();
  const runtime = launch(directory, { PAYMENT_MODE: 'mock', API_PORT: String(port), SQLITE_PATH: './data/store.sqlite' });
  expect(await ready(url, runtime.child)).toEqual({ ready: true, paymentMode: 'mock' });
}, 10000);
it.each(['sit', 'production'])('fails closed for incomplete %s credentials without exposing credentials', async paymentMode => {
  const { directory, port } = await setup();
  const runtime = launch(directory, { PAYMENT_MODE: paymentMode, API_PORT: String(port), BAKONG_API_TOKEN: 'secret-token', SQLITE_PATH: './data/store.sqlite' });
  const code = await new Promise<number | null>(resolve => runtime.child.once('exit', resolve));
  expect(code).toBe(1);
  expect(runtime.output()).not.toMatch(/secret-token|\n\s+at /);
  await expect(readFile(join(directory, 'data/store.sqlite'))).rejects.toMatchObject({ code: 'ENOENT' });
}, 10000);

it.each(['sit', 'production'])('starts a configured %s runtime without contacting the provider', async paymentMode => {
  const { directory, port, url } = await setup();
  const runtime = launch(directory, {
    PAYMENT_MODE: paymentMode, API_PORT: String(port), SQLITE_PATH: ':memory:',
    BAKONG_API_BASE_URL: 'https://api.example.test', BAKONG_API_TOKEN: 'synthetic-token',
    BAKONG_ACCOUNT_ID: 'shop@example', BAKONG_MERCHANT_ID: 'merchant-1',
    BAKONG_ACQUIRING_BANK: 'TEST BANK', MERCHANT_NAME: 'Test Shop', MERCHANT_CITY: 'PHNOM PENH',
    TEST_UNIT_PRICE_MINOR: '1', TEST_FREE_SHIPPING: 'true',
  });
  expect(await ready(url, runtime.child)).toEqual({ ready: true, paymentMode });
  expect(runtime.output()).not.toMatch(/synthetic-token|shop@example|merchant-1|TEST BANK/);
}, 10000);
