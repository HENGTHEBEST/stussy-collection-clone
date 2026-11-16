export const runwayAssets = 'https://reel-ref-try-the-look.vercel.app/assets/';

export const runwayProducts = {
  'tatum-5-orbit-copy': { name: 'Air Jordan 12 Retro', vendor: 'Nikey | Password: 1', price: 149 },
  tshirt: { name: 'Tshirt', vendor: 'Nike', price: 199 },
  sweatshirt: { name: 'Sweatshirt', vendor: 'Nike', price: 199 },
  'tatum-5-orbit': { name: 'Tatum 5 Orbit', vendor: 'Nikey | Password: 1', price: 149 },
  'hoodie-black': { name: 'Hoodie Black', vendor: 'Nike', price: 199 },
  'sweatshirt-plus': { name: 'Sweatshirt Plus', vendor: 'Nike', price: 199 },
  hoodie: { name: 'Hoodie', vendor: 'Nike', price: 199 },
  'air-jordan-12-retro-copy': { name: 'Luka 5', vendor: 'Nikey | Password: 1', price: 149 },
};

type RunwayLook = { name: string; model: number; products: (keyof typeof runwayProducts)[]; newPiece?: number };
export const runwayLooks: RunwayLook[] = [
  { name: 'The City Edit', model: 1, products: ['tatum-5-orbit-copy', 'tshirt', 'sweatshirt'] },
  { name: 'Gallery Opening', model: 5, products: ['tatum-5-orbit', 'hoodie-black', 'tshirt'], newPiece: 1 },
  { name: 'Gallery Opening', model: 4, products: ['sweatshirt-plus', 'tatum-5-orbit', 'tshirt'], newPiece: 1 },
  { name: 'Studio Day', model: 6, products: ['hoodie-black', 'tatum-5-orbit-copy', 'tshirt'] },
  { name: 'Studio Day', model: 3, products: ['sweatshirt', 'tatum-5-orbit', 'tshirt'] },
  { name: 'Studio Day', model: 2, products: ['hoodie', 'air-jordan-12-retro-copy', 'tshirt'] },
];

export const wrapLook = (value: number) => ((value % runwayLooks.length) + runwayLooks.length) % runwayLooks.length;
