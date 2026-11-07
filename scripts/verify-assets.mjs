import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assets, assetDirectory } from './fetch-assets.mjs';

export async function verifyAssets(directory = fileURLToPath(assetDirectory), filenames = [...assets.keys()]) {
  for (const filename of filenames) {
    const details = await stat(join(directory, filename));
    if (!details.isFile() || details.size === 0) throw new Error(`Empty or invalid asset: ${filename}`);
  }
  return filenames.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Verified ${await verifyAssets()} nonempty assets in public/assets.`);
}
