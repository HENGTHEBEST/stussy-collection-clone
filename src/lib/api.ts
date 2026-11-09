import type { CreateOrderRequest, PublicOrder } from '../../shared/commerce';

const unavailable = 'The shop service is temporarily unavailable.';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

async function requestOrder(path: string, options: RequestInit = {}): Promise<PublicOrder> {
  let response: Response;
  try { response = await fetch(path, options); }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') throw error;
    throw new ApiError(unavailable, 0);
  }
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new ApiError(unavailable, response.status); }
  if (!response.ok) {
    const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : null;
    const message = typeof error === 'object' && error !== null && 'message' in error
      && typeof error.message === 'string' && error.message.trim() ? error.message : unavailable;
    throw new ApiError(message, response.status);
  }
  return body as PublicOrder;
}

export function createOrder(input: CreateOrderRequest): Promise<PublicOrder> {
  return requestOrder('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export function getOrder(orderId: string, signal?: AbortSignal): Promise<PublicOrder> {
  return requestOrder('/api/orders/' + encodeURIComponent(orderId), { signal });
}

export function simulateMockPayment(orderId: string): Promise<PublicOrder> {
  return requestOrder('/api/orders/' + encodeURIComponent(orderId) + '/mock-payment', { method: 'POST' });
}
