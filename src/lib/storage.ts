import { products } from '../data/products';

export const CART_STORAGE_KEY = 'stussy-demo-cart-v1';
export const WISHLIST_STORAGE_KEY = 'stussy-demo-wishlist-v1';
export const ORDER_STORAGE_KEY = 'stussy-demo-order-v1';

export interface StoredEnvelope<T> { version: 1; value: T }

export function isWishlistIds(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((id: unknown) => products.some((product) => product.id === id))
    && new Set(value).size === value.length;
}

export function readJson<T>(key: string, validate: (value: unknown) => value is T, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const envelope: unknown = JSON.parse(stored);
    if (typeof envelope === 'object' && envelope !== null && 'version' in envelope
      && envelope.version === 1 && 'value' in envelope && validate(envelope.value)) {
      return envelope.value;
    }
  } catch { /* Blocked storage and malformed data use the caller's safe state. */ }
  return fallback;
}

export function writeJson<T>(key: string, value: T): void {
  try {
    const envelope: StoredEnvelope<T> = { version: 1, value };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch { /* Persistence is optional when storage is blocked or full. */ }
}

export function removeValue(key: string): void {
  try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
}
