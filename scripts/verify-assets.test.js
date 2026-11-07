// @vitest-environment node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyAssets } from './verify-assets.mjs';

let directory;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'stussy-assets-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

it('rejects missing required assets', async () => {
  await expect(verifyAssets(directory, ['required.jpg'])).rejects.toThrow('required.jpg');
});

it('rejects zero-byte required assets', async () => {
  await writeFile(join(directory, 'empty.jpg'), '');
  await expect(verifyAssets(directory, ['empty.jpg'])).rejects.toThrow('empty.jpg');
});

it('accepts nonempty required assets and returns the verified count', async () => {
  await writeFile(join(directory, 'present.jpg'), 'image bytes');
  await expect(verifyAssets(directory, ['present.jpg'])).resolves.toBe(1);
});
