import { StrictMode, createElement } from 'react';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CART_STORAGE_KEY, WISHLIST_STORAGE_KEY, isWishlistIds, readJson, writeJson, removeValue } from './storage';
import { isCartState, type CartLine } from '../state/cartReducer';
import { CartProvider, useCart } from '../state/CartProvider';
import { WishlistProvider, useWishlist } from '../state/WishlistProvider';
import { FeedbackProvider, useFeedback } from '../state/FeedbackProvider';

const line: CartLine = { productId: 1, color: 'Black', size: 'M', quantity: 2, unitPrice: 48 };
const fallback = { lines: [] };
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe('validated storage', () => {
  it('round trips versioned data under the public keys', () => {
    writeJson(CART_STORAGE_KEY, { lines: [line] });
    expect(JSON.parse(localStorage.getItem('stussy-demo-cart-v1')!)).toEqual({ version: 1, value: { lines: [line] } });
    expect(readJson(CART_STORAGE_KEY, isCartState, fallback)).toEqual({ lines: [line] });
    writeJson(WISHLIST_STORAGE_KEY, [1, 2]);
    expect(readJson('stussy-demo-wishlist-v1', isWishlistIds, [])).toEqual([1, 2]);
    writeJson('test-storage-key', { id: 'demo' });
    removeValue('test-storage-key');
    expect(localStorage.getItem('test-storage-key')).toBeNull();
  });
  it.each([
    '{broken', 'null', JSON.stringify({ version: 2, value: { lines: [line] } }),
    ...[{ productId: 999 }, { color: 'Red' }, { size: 'XXL' }, { quantity: 0 },
      { quantity: 11 }, { quantity: 1.5 }, { unitPrice: 0 }, { unitPrice: null }]
      .map((change) => JSON.stringify({ version: 1, value: { lines: [line, { ...line, ...change }] } })),
  ])('returns the whole fallback for invalid payload %s', (payload) => {
    localStorage.setItem(CART_STORAGE_KEY, payload);
    expect(readJson(CART_STORAGE_KEY, isCartState, fallback)).toBe(fallback);
  });
  it('rejects invalid wishlist IDs and duplicates wholesale', () => {
    for (const ids of [[1, 1], [1, 999], [1, '2'], null]) {
      writeJson(WISHLIST_STORAGE_KEY, ids);
      const safe: number[] = [];
      expect(readJson(WISHLIST_STORAGE_KEY, isWishlistIds, safe)).toBe(safe);
    }
    expect(isCartState({ lines: [{ ...line, unitPrice: Infinity }] })).toBe(false);
    expect(isCartState({ lines: [line, line] })).toBe(false);
  });
  it.each<CartLine>([
    { ...line, color: 'White' }, { ...line, size: 'XS' }, { ...line, color: 'White', size: 'XS' },
  ])('recovers the whole persisted cart for an unsupported product variant: %j', (invalid) => {
    writeJson(CART_STORAGE_KEY, { lines: [line, invalid] });
    expect(readJson(CART_STORAGE_KEY, isCartState, fallback)).toBe(fallback);
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    expect(result.current.lines).toEqual([]);
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({ version: 1, value: { lines: [] } });
  });
  it('rejects personal fields in hydrated cart data and strips extras from additions', () => {
    writeJson(CART_STORAGE_KEY, { lines: [{ ...line, email: 'private@example.test' }] });
    expect(readJson(CART_STORAGE_KEY, isCartState, fallback)).toBe(fallback);
    const { result } = renderHook(useCart, { wrapper: CartProvider });
    act(() => result.current.add({ ...line, email: 'private@example.test' } as CartLine));
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toContain('private@example.test');
    expect(result.current.lines).toEqual([line]);
  });
  it('falls back when absent and absorbs blocked storage, quota, and serialization errors', () => {
    expect(readJson(CART_STORAGE_KEY, isCartState, fallback)).toBe(fallback);
    const circular: { self?: unknown } = {}; circular.self = circular;
    expect(() => writeJson('circular', circular)).not.toThrow();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota'); });
    expect(() => writeJson(CART_STORAGE_KEY, fallback)).not.toThrow();
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked'); });
    expect(readJson(CART_STORAGE_KEY, isCartState, fallback)).toBe(fallback);
    expect(() => writeJson(CART_STORAGE_KEY, fallback)).not.toThrow();
    expect(() => removeValue(CART_STORAGE_KEY)).not.toThrow();
  });
});

describe('providers', () => {
  it('hydrates once without overwriting saved cart data and persists derived mutations', () => {
    writeJson(CART_STORAGE_KEY, { lines: [line] });
    const writes: unknown[] = [];
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === CART_STORAGE_KEY) writes.push(JSON.parse(value).value);
      original.call(this, key, value);
    });
    const { result } = renderHook(useCart, { wrapper: ({ children }) => createElement(StrictMode, null, createElement(CartProvider, null, children)) });
    expect(result.current.itemCount).toBe(2);
    expect(result.current.subtotal).toBe(96);
    expect(writes).not.toContainEqual({ lines: [] });
    act(() => result.current.add(line));
    expect(result.current.itemCount).toBe(4);
    expect(readJson(CART_STORAGE_KEY, isCartState, fallback).lines[0].quantity).toBe(4);
    act(() => result.current.setQuantity('1:Black:M', 3));
    expect(result.current.subtotal).toBe(144);
    act(() => result.current.remove('1:Black:M'));
    expect(result.current.lines).toEqual([]);
    act(() => { result.current.add(line); result.current.clear(); });
    expect(result.current.itemCount).toBe(0);
  });
  it('hydrates wishlist and toggles unique valid IDs', () => {
    writeJson(WISHLIST_STORAGE_KEY, [2]);
    const { result } = renderHook(useWishlist, { wrapper: WishlistProvider });
    expect(result.current.has(2)).toBe(true);
    act(() => { result.current.toggle(1); result.current.toggle(999); });
    expect(result.current.ids).toEqual([2, 1]);
    act(() => result.current.toggle(2));
    expect(readJson(WISHLIST_STORAGE_KEY, isWishlistIds, [])).toEqual([1]);
    act(() => result.current.clear());
    expect(result.current.ids).toEqual([]);
  });
  it('guards hooks outside providers', () => {
    for (const hook of [useCart, useWishlist, useFeedback]) {
      expect(() => renderHook(hook as () => unknown)).toThrow(/must be used within/);
    }
  });
  it('owns one polite live region and re-announces repeated messages', async () => {
    let announce!: (message: string) => void;
    function Consumer() { announce = useFeedback().announce; return null; }
    render(createElement(FeedbackProvider, null, createElement(Consumer)));
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    await act(async () => announce('Added to cart'));
    expect(region).toHaveTextContent('Added to cart');
    const first = region.firstChild;
    await act(async () => announce('Added to cart'));
    expect(region).toHaveTextContent('Added to cart');
    expect(region.firstChild).not.toBe(first);
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});
