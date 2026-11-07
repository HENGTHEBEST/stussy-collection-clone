import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const assets = new Map([
  ['stussy-logo.png', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/c97919ae4_Logo-Stussy.png'],
  ['hero-man.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/24c850c67_can_you_replace_the_man_202606021542.jpg'],
  ['hero-woman.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/29c2a14ae_GirlModel1.jpg'],
  ['lookbook-8-ball-black.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/5fa09e26f_can_you_replace_the_model_202606022153.jpg'],
  ['lookbook-summer-back.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/37f6030f6_so_can_you_put_the_202606021334.jpg'],
  ['lookbook-basic-back.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/3694b2b4e_can_you_make_the_sleeve_202606021432.jpg'],
  ['lookbook-summer-crop.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/3ca94a911_can_you_make_the_t-shirt__202606021507.jpg'],
  ['lookbook-basic-front.webp', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/ae8686b94_Classict-shirtfrontview.webp'],
  ['lookbook-dsm-crop.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/7f51b6f1e_can_you_replace_the_girl_202606021520.jpg'],
  ['lookbook-dsm-tee.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/e1811e5a5_black_t-shirt2.jpg'],
  ['lookbook-la-back.webp', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/acddfb48e_WHitet-shirtbackview.webp'],
  ['lookbook-8-ball-natural.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/0dadb3974_can_you_replace_the_model_202606022202.jpg'],
  ['lookbook-summer-women.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/ce869d1e7_can_you_make_the_model_202606021547.jpg'],
  ['lookbook-summer-front.webp', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/d7c156a9c_WHitet-shirtFrontview.webp'],
  ['lookbook-tough-gear.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/016455682_t-shirt1.jpg'],
  ['manifesto.jpg', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/346cceffe_StussClothforDecoration.jpg'],
  ['motif-dice.png', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/3bc6dff4f_Design2.png'],
  ['motif-8-ball.jpg', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/dbc15a74d_Design1.jpg'],
]);

export const assetDirectory = new URL('../public/assets/', import.meta.url);

export async function fetchAssets(directory = fileURLToPath(assetDirectory), entries = assets) {
  await mkdir(directory, { recursive: true });
  for (const [filename, url] of entries) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${filename}: HTTP ${response.status}`);
    await writeFile(join(directory, filename), Buffer.from(await response.arrayBuffer()));
  }
  return entries.size;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`Fetched ${await fetchAssets()} assets into public/assets.`);
}
