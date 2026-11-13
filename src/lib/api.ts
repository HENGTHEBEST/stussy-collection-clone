import type { CheckoutPricing, CreateOrderRequest, PublicOrder } from '../../shared/commerce';
import type { CheckoutFields } from './checkout';

type AddressLocation = Pick<CheckoutFields, 'city' | 'region' | 'country'>;
type AddressCheck = { address?: AddressLocation; errors: Partial<Record<keyof AddressLocation, string>> };

const unavailable = 'The shop service is temporarily unavailable.';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError'; }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
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
  return body as T;
}

export function createOrder(input: CreateOrderRequest): Promise<PublicOrder> {
  return requestJson('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
}

export async function checkAddress(address: AddressLocation): Promise<AddressCheck> {
  const result = await requestJson<AddressCheck>('/api/validate-address', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(address),
  });
  if (!result || typeof result.errors !== 'object' || result.errors === null
    || (!Object.keys(result.errors).length && !result.address)) throw new ApiError(unavailable, 500);
  return result;
}

export function getOrder(orderId: string, signal?: AbortSignal): Promise<PublicOrder> {
  return requestJson('/api/orders/' + encodeURIComponent(orderId), { signal });
}

export function simulateMockPayment(orderId: string): Promise<PublicOrder> {
  return requestJson('/api/orders/' + encodeURIComponent(orderId) + '/mock-payment', { method: 'POST' });
}

export async function getCheckoutPricing(signal?: AbortSignal): Promise<CheckoutPricing> {
  const pricing = await requestJson<unknown>('/api/checkout-pricing', { signal });
  if (typeof pricing !== 'object' || pricing === null
    || !('unitPriceMinor' in pricing) || !('freeShipping' in pricing)
    || !(pricing.unitPriceMinor === null || (Number.isSafeInteger(pricing.unitPriceMinor) && Number(pricing.unitPriceMinor) >= 1))
    || typeof pricing.freeShipping !== 'boolean') {
    throw new ApiError(unavailable, 500);
  }
  return { unitPriceMinor: pricing.unitPriceMinor as number | null, freeShipping: pricing.freeShipping,
    ...('cardAvailable' in pricing ? { cardAvailable: pricing.cardAvailable === true } : {}) };
}
