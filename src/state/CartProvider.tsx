import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import type { PublicOrder } from '../../shared/commerce';
import { CART_STORAGE_KEY, readJson, writeJson } from '../lib/storage';
import { cartLineKey, cartReducer, isCartState, type CartLine } from './cartReducer';

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  add: (line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  selectedLines: CartLine[];
  select: (key: string, selected: boolean) => void;
  settlePaidOrder: (order: PublicOrder) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // Read synchronously during initialization so no empty render can overwrite storage.
  const [state, dispatch] = useReducer(cartReducer, undefined,
    () => readJson(CART_STORAGE_KEY, isCartState, { lines: [] }));
  useEffect(() => { writeJson(CART_STORAGE_KEY, state); }, [state]);
  const [excluded, setExcluded] = useState<string[]>(() => readJson('stussy-cart-excluded-v1',
    (value): value is string[] => Array.isArray(value) && value.every(key => typeof key === 'string'), []));
  useEffect(() => { writeJson('stussy-cart-excluded-v1', excluded); }, [excluded]);
  const settlePaidOrder = useCallback((order: PublicOrder) => {
    if (order.status === 'paid') dispatch({ type: 'purchase', orderId: order.id, lines: order.lines });
  }, []);
  const value = useMemo<CartContextValue>(() => ({
    lines: state.lines,
    selectedLines: state.lines.filter(line => !excluded.includes(cartLineKey(line))),
    select: (key, selected) => setExcluded(current => selected ? current.filter(item => item !== key) : [...new Set([...current, key])]),
    settlePaidOrder,
    itemCount: state.lines.reduce((count, line) => count + line.quantity, 0),
    subtotal: state.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    add: (line) => { setExcluded(current => current.filter(key => key !== cartLineKey(line))); dispatch({ type: 'add', line }); },
    setQuantity: (key, quantity) => dispatch({ type: 'setQuantity', key, quantity }),
    remove: (key) => dispatch({ type: 'remove', key }),
    clear: () => dispatch({ type: 'clear' }),
  }), [state, excluded, settlePaidOrder]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used within CartProvider');
  return value;
}
