import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { products } from '../data/products';
import { WISHLIST_STORAGE_KEY, isWishlistIds, readJson, writeJson } from '../lib/storage';

interface WishlistContextValue {
  ids: number[];
  has: (id: number) => boolean;
  toggle: (id: number) => void;
  clear: () => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState(() => readJson(WISHLIST_STORAGE_KEY, isWishlistIds, []));
  useEffect(() => { writeJson(WISHLIST_STORAGE_KEY, ids); }, [ids]);
  const value = useMemo<WishlistContextValue>(() => ({
    ids,
    has: (id) => ids.includes(id),
    toggle: (id) => {
      if (!products.some((product) => product.id === id)) return;
      setIds((previous) => previous.includes(id) ? previous.filter((saved) => saved !== id) : [...previous, id]);
    },
    clear: () => setIds([]),
  }), [ids]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const value = useContext(WishlistContext);
  if (!value) throw new Error('useWishlist must be used within WishlistProvider');
  return value;
}
