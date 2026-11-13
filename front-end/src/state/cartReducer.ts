import { products } from '../data/products';
import type { ProductColor, ProductSize } from '../types/commerce';

export interface CartLine {
  productId: number;
  size: ProductSize;
  color: ProductColor;
  quantity: number;
  unitPrice: number;
}

export interface CartState { lines: CartLine[]; completedOrders?: string[] }

export type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' }
  | { type: 'purchase'; orderId: string; lines: Pick<CartLine, 'productId' | 'color' | 'size' | 'quantity'>[] }
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
  const product = products.find((item) => item.id === line.productId);
  return Boolean(product && product.color === line.color && product.sizes.includes(line.size as ProductSize))
    && typeof line.quantity === 'number'
    && typeof line.unitPrice === 'number' && Number.isFinite(line.unitPrice) && line.unitPrice > 0;
}

export function isCartState(value: unknown): value is CartState {
  if (typeof value !== 'object' || value === null || !('lines' in value) || !Array.isArray(value.lines)) return false;
  const lines = value.lines;
  const fields = ['productId', 'size', 'color', 'quantity', 'unitPrice'];
  return Object.keys(value).every((key) => key === 'lines' || key === 'completedOrders')
    && (!('completedOrders' in value) || (Array.isArray(value.completedOrders) && value.completedOrders.every(id => typeof id === 'string' && id.length > 0)))
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
      return { ...state, lines: existing ? state.lines.map((item) => cartLineKey(item) === key
        ? { ...item, quantity: clampQuantity(item.quantity + line.quantity) } : item) : [...state.lines, line] };
    }
    case 'setQuantity':
      return { ...state, lines: state.lines.map((line) => cartLineKey(line) === action.key
        ? { ...line, quantity: clampQuantity(action.quantity) } : line) };
    case 'remove': return { ...state, lines: state.lines.filter((line) => cartLineKey(line) !== action.key) };
    case 'clear': return { ...state, lines: [] };
    case 'purchase': {
      if (state.completedOrders?.includes(action.orderId)) return state;
      return { completedOrders: [...(state.completedOrders ?? []), action.orderId], lines: state.lines.flatMap(line => {
        const purchased = action.lines.find(item => item.productId === line.productId && item.color === line.color && item.size === line.size);
        const quantity = line.quantity - (purchased?.quantity ?? 0);
        return quantity > 0 ? [{ ...line, quantity }] : [];
      }) };
    }
    case 'replace': {
      if (!action.state || !Array.isArray(action.state.lines) || !action.state.lines.every(isLineData)) return state;
      return action.state.lines.reduce((next, line) => cartReducer(next, { type: 'add', line }), { ...state, lines: [] } as CartState);
    }
  }
}
