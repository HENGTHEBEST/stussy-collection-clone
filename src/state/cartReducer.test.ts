import { describe, expect, it } from 'vitest';
import { cartLineKey, cartReducer, clampQuantity, type CartLine } from './cartReducer';

const line: CartLine = { productId: 1, color: 'Black', size: 'M', quantity: 2, unitPrice: 48 };

describe('cartReducer', () => {
  it('merges identical variants while preserving the captured price', () => {
    expect(cartLineKey(line)).toBe('1:Black:M');
    expect(cartReducer({ lines: [line] }, { type: 'add', line: { ...line, unitPrice: 99 } }))
      .toEqual({ lines: [{ ...line, quantity: 4 }] });
  });
  it('keeps different sizes and colors distinct', () => {
    let state = cartReducer({ lines: [line] }, { type: 'add', line: { ...line, size: 'L' } });
    state = cartReducer(state, { type: 'add', line: { ...line, productId: 2, color: 'White' } });
    expect(state.lines).toHaveLength(3);
  });
  it.each<CartLine>([
    { ...line, color: 'White' }, { ...line, size: 'XS' }, { ...line, color: 'White', size: 'XS' },
  ])('rejects unsupported product variants on add and replacement: %j', (invalid) => {
    const state = { lines: [line] };
    expect(cartReducer(state, { type: 'replace', state: { lines: [{ ...line, size: 'L' }, invalid] } })).toBe(state);
    expect(cartReducer(state, { type: 'add', line: invalid })).toBe(state);
  });
  it.each([[0, 1], [-3, 1], [2.9, 2], [40, 10], [NaN, 1], [Infinity, 1]])
    ('clamps %s to %s on add, set, and replace', (quantity, expected) => {
      expect(clampQuantity(quantity)).toBe(expected);
      expect(cartReducer({ lines: [] }, { type: 'add', line: { ...line, quantity } }).lines[0].quantity).toBe(expected);
      expect(cartReducer({ lines: [line] }, { type: 'setQuantity', key: '1:Black:M', quantity }).lines[0].quantity).toBe(expected);
      expect(cartReducer({ lines: [] }, { type: 'replace', state: { lines: [{ ...line, quantity }] } }).lines[0].quantity).toBe(expected);
    });
  it('caps merged quantities and normalizes duplicate replacements', () => {
    expect(cartReducer({ lines: [{ ...line, quantity: 9 }] }, { type: 'add', line }).lines[0].quantity).toBe(10);
    expect(cartReducer({ lines: [] }, { type: 'replace', state: { lines: [line, line] } }))
      .toEqual({ lines: [{ ...line, quantity: 4 }] });
  });
  it('removes only the addressed variant and clears all lines', () => {
    const state = { lines: [line, { ...line, size: 'L' as const }] };
    expect(cartReducer(state, { type: 'remove', key: '1:Black:M' })).toEqual({ lines: [state.lines[1]] });
    expect(cartReducer(state, { type: 'clear' })).toEqual({ lines: [] });
  });
  it('rejects invalid product data on add and replacement', () => {
    const state = { lines: [line] };
    for (const invalid of [{ ...line, productId: 999 }, { ...line, unitPrice: 0 }]) {
      expect(cartReducer(state, { type: 'add', line: invalid })).toEqual(state);
      expect(cartReducer(state, { type: 'replace', state: { lines: [invalid] } })).toEqual(state);
    }
  });
});
