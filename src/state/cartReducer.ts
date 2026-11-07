import { products } from '../data/products';
import type { ProductColor, ProductSize } from '../types/commerce';

export interface CartLine {
  productId: number;
  size: ProductSize;
  color: ProductColor;
  quantity: number;
  unitPrice: number;
}

export interface CartState { lines: CartLine[] }

export type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' }
  | { type: 'replace'; state: CartState };

export function cartLineKey(line: CartLine): string {
  return `${line.productId}:${line.color}:${line.size}`;
}

export function clampQuantity(quantity: number): number {
  return Number.isFinite(quantity) ? Math.min(10, Math.max(1, Math.trunc(quantity))) : 1;
}

function isLineData(value: unknown): value is CartLine {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return products.some((product) => product.id === line.productId)
    && ['Black', 'White', 'Natural'].includes(line.color as string)
    && ['XS', 'S', 'M', 'L', 'XL'].includes(line.size as string)
    && typeof line.quantity === 'number'
    && typeof line.unitPrice === 'number' && Number.isFinite(line.unitPrice) && line.unitPrice > 0;
}

export function isCartState(value: unknown): value is CartState {
  if (typeof value !== 'object' || value === null || !('lines' in value) || !Array.isArray(value.lines)) return false;
  const lines = value.lines;
  const fields = ['productId', 'size', 'color', 'quantity', 'unitPrice'];
  return Object.keys(value).every((key) => key === 'lines')
    && lines.every((line: unknown) => isLineData(line) && Object.keys(line).every((key) => fields.includes(key))
    && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 10)
    && new Set(lines.map(cartLineKey)).size === lines.length;
}

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add': {
      if (!isLineData(action.line)) return state;
      const { productId, color, size, unitPrice, quantity } = action.line;
      const line = { productId, color, size, unitPrice, quantity: clampQuantity(quantity) };
      const key = cartLineKey(line);
      const existing = state.lines.some((item) => cartLineKey(item) === key);
      return { lines: existing ? state.lines.map((item) => cartLineKey(item) === key
        ? { ...item, quantity: clampQuantity(item.quantity + line.quantity) } : item) : [...state.lines, line] };
    }
    case 'setQuantity':
      return { lines: state.lines.map((line) => cartLineKey(line) === action.key
        ? { ...line, quantity: clampQuantity(action.quantity) } : line) };
    case 'remove': return { lines: state.lines.filter((line) => cartLineKey(line) !== action.key) };
    case 'clear': return { lines: [] };
    case 'replace': {
      if (!action.state || !Array.isArray(action.state.lines) || !action.state.lines.every(isLineData)) return state;
      return action.state.lines.reduce((next, line) => cartReducer(next, { type: 'add', line }), { lines: [] } as CartState);
    }
  }
}
