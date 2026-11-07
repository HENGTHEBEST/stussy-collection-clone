// @vitest-environment node
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchAssets } from './fetch-assets.mjs';

let directory;
let server;
let origin;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'stussy-fetch-'));
  server = createServer((request, response) => {
    response.writeHead(request.url === '/missing' ? 404 : 200);
    response.end('fixture image bytes');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
});
afterEach(async () => {
  await new Promise(resolve => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
});

it('writes successful response bytes to the specified local asset filename', async () => {
  await fetchAssets(directory, new Map([['photo.jpg', `${origin}/photo`]]));
  expect(await readFile(join(directory, 'photo.jpg'), 'utf8')).toBe('fixture image bytes');
});

it('rejects unsuccessful responses without writing an asset', async () => {
  await expect(fetchAssets(directory, new Map([['photo.jpg', `${origin}/missing`]]))).rejects.toThrow('404');
  await expect(stat(join(directory, 'photo.jpg'))).rejects.toThrow();
});
