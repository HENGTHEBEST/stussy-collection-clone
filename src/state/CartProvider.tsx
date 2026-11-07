import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { CART_STORAGE_KEY, readJson, writeJson } from '../lib/storage';
import { cartReducer, isCartState, type CartLine } from './cartReducer';

interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  subtotal: number;
  add: (line: CartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  // Read synchronously during initialization so no empty render can overwrite storage.
  const [state, dispatch] = useReducer(cartReducer, undefined,
    () => readJson(CART_STORAGE_KEY, isCartState, { lines: [] }));
  useEffect(() => { writeJson(CART_STORAGE_KEY, state); }, [state]);
  const value = useMemo<CartContextValue>(() => ({
    lines: state.lines,
    itemCount: state.lines.reduce((count, line) => count + line.quantity, 0),
    subtotal: state.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    add: (line) => dispatch({ type: 'add', line }),
    setQuantity: (key, quantity) => dispatch({ type: 'setQuantity', key, quantity }),
    remove: (key) => dispatch({ type: 'remove', key }),
    clear: () => dispatch({ type: 'clear' }),
  }), [state]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart must be used within CartProvider');
  return value;
}
