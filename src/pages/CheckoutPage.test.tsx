import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { CART_STORAGE_KEY } from '../lib/storage';
import type { CreateOrderRequest, PublicOrder } from '../../shared/commerce';
import { OrderService } from '../../server/orders/order-service';
import { SqliteOrderRepository } from '../../server/orders/sqlite-order-repository';
import { MockBakongGateway } from '../../server/payments/mock-bakong-gateway';
import { checkAddress } from '../lib/api';
import type { CheckoutFields } from '../lib/checkout';

vi.mock('../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/api')>(),
  checkAddress: vi.fn(async (address: Pick<CheckoutFields, 'city' | 'region' | 'country'>) => ({ address, errors: {} })),
}));

const line = { productId: 1, color: 'Black', size: 'M', quantity: 2, unitPrice: 45 };
const order: PublicOrder = {
  id: '019a6215-d300-4000-8000-000000000001', status: 'awaiting_payment', createdAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z',
  merchantName: 'Stussy Collection',
  deliveryLabel: 'Express delivery', currency: 'USD', subtotalMinor: 9600, shippingMinor: 2400, totalMinor: 12000,
  lines: [{ productId: 1, slug: 'tee', name: 'Server Tee', image: '/tee.png', size: 'M', color: 'Black', quantity: 2, unitPriceMinor: 4800 }],
  payment: { status: 'pending', qrDataUrl: 'data:image/png;base64,AAAA', expiresAt: '2099-11-09T00:15:00.000Z', providerReference: 'mock-1' }, mockMode: true,
};
const inputs = {
  Name: 'Buyer', Email: 'buyer@example.test', Phone: '+855 (12) 345-678',
  'Street address': 'Street 1', City: 'Phnom Penh', Region: 'Phnom Penh', 'Postal code': '12000', Country: 'Cambodia',
};
const pricing = { unitPriceMinor: 1, freeShipping: true };
const recoveryKey = 'stussy-checkout-pending-orders-v1';
function withPricing(handler: (url: string, options?: RequestInit) => Promise<Response> | Response = async () => { throw new TypeError('Unexpected order request'); }) {
  return vi.fn((url: string, options?: RequestInit) => url === '/api/checkout-pricing'
    ? Promise.resolve(new Response(JSON.stringify(pricing))) : handler(url, options));
}
function seedCart() { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, value: { lines: [line] } })); }
function fillCheckout() {
  for (const [label, value] of Object.entries(inputs)) fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.click(screen.getByRole('radio', { name: /Express delivery/ }));
}
function getForm() { return screen.getByRole('button', { name: 'Continue to payment' }).closest('form')!; }
async function submitAndPay(form = getForm()) {
  fireEvent.submit(form);
  fireEvent.click(await screen.findByRole('button', { name: /^Pay \$/ }));
}
async function waitForPricing() { await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeEnabled()); }
// The popup is a portal to document.body; browser QA covers focus and Escape.
const visibilitychange = () => fireEvent(document, new Event('visibilitychange'));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('scrollTo', vi.fn()); vi.stubGlobal('fetch', withPricing());
  vi.mocked(checkAddress).mockImplementation(async address => ({ address, errors: {} })); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

it('submits only selected variants, retains the cart while pending, and removes purchased quantities after verification', async () => {
  const other = { ...line, size: 'L' };
  seedCart();
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, value: { lines: [line, other] } }));
  localStorage.setItem('stussy-cart-excluded-v1', JSON.stringify({ version: 1, value: ['1:Black:L'] }));
  let paid = false;
  const fetch = withPricing(async () => new Response(JSON.stringify({ ...order, status: paid ? 'paid' : 'awaiting_payment' })));
  vi.stubGlobal('fetch', fetch); render(<App initialEntries={['/checkout']} />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('region', { name: 'KHQR payment' });
  const sent = JSON.parse(fetch.mock.calls.find(([, options]) => options?.method === 'POST')![1]!.body as string);
  expect(sent.lines).toEqual([{ productId: 1, color: 'Black', size: 'M', quantity: 2 }]);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line, other]);
  paid = true; visibilitychange();
  expect(await within(screen.getByRole('dialog')).findByText('Payment Successful')).toBeVisible();
  await screen.findByRole('heading', { name: 'Order Confirmed!' });
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([other]);
});

it('retries a failed order through checkout with its products and a new payment request', async () => {
  vi.stubGlobal('fetch', withPricing(async () => new Response(JSON.stringify({ ...order, status: 'failed' }))));
  render(<App initialEntries={['/order/' + order.id]} />);
  await screen.findByRole('heading', { name: 'Payment Failed' });
  fireEvent.click(screen.getByRole('button', { name: 'Retry Payment' }));
  await screen.findByRole('heading', { name: 'Contact & Delivery' });
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([{ productId: 1, color: 'Black', size: 'M', quantity: 2, unitPrice: 48 }]);
  expect(screen.getByLabelText('Email', { exact: true })).toHaveValue('');
});

it('keeps an invented city on Contact & Delivery with a field error', async () => {
  vi.mocked(checkAddress).mockResolvedValueOnce({ errors: { city: 'Enter a real city in Cambodia.' } });
  const fetch = withPricing(); vi.stubGlobal('fetch', fetch);
  seedCart(); render(<App initialEntries={['/checkout']} />); await waitForPricing(); fillCheckout();
  fireEvent.change(screen.getByLabelText('City', { exact: true }), { target: { value: 'Madeup City' } });
  fireEvent.submit(getForm());
  expect(await screen.findByText('Enter a real city in Cambodia.')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Contact & Delivery' })).toBeVisible();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
});

it('replace-redirects empty checkout to cart without an actionable form', () => {
  window.history.replaceState(null, '', '/checkout');
  const historyLength = window.history.length;
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Continue to payment' })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/cart');
  expect(window.history.length).toBe(historyLength);
});

it('updates the delivery estimate and accepts optional province and postal code', async () => {
  const fetch = vi.fn(async (url: string) => new Response(JSON.stringify(url === '/api/checkout-pricing'
    ? { unitPriceMinor: 4800, freeShipping: false } : order)));
  vi.stubGlobal('fetch', fetch); seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing();
  const summary = within(screen.getByRole('complementary', { name: 'Order Summary' }));
  expect(summary.getByText('$108.00')).toBeVisible();
  fireEvent.click(screen.getByRole('radio', { name: /Express delivery/ }));
  expect(summary.getByText('$116.00')).toBeVisible();
  for (const [label, value] of Object.entries(inputs)) {
    if (label !== 'Region' && label !== 'Postal code') fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  }
  await submitAndPay();
  await screen.findByRole('region', { name: 'KHQR payment' });
});

it('returns to saved delivery details without creating another payment or losing the order', async () => {
  const fetch = withPricing(async () => new Response(JSON.stringify(order)));
  vi.stubGlobal('fetch', fetch); seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('region', { name: 'KHQR payment' });
  fireEvent.click(screen.getByRole('button', { name: 'Back to Contact & Delivery' }));
  expect(screen.getByLabelText('Name', { exact: true })).toHaveValue('Buyer');
  expect(screen.getByLabelText('Email', { exact: true })).toHaveValue('buyer@example.test');
  await submitAndPay();
  expect(screen.getByRole('region', { name: 'KHQR payment' })).toBeVisible();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it('focuses the first invalid field and associates errors with one polite announcement', async () => {
  const fetch = withPricing(); vi.stubGlobal('fetch', fetch);
  seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing();
  fireEvent.submit(getForm());
  expect(screen.getByLabelText('Name', { exact: true })).toHaveFocus();
  for (const label of ['Name', 'Email', 'Phone', 'Street address', 'City']) {
    const field = screen.getByLabelText(label, { exact: true });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('This field is required.');
  }
  expect(screen.getByRole('status')).toHaveTextContent(/highlighted fields/i);
  expect(document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).toHaveLength(1);
  expect(fetch.mock.calls.filter(([url]) => url === '/api/orders')).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
});

it('shows delivery first and fails closed when trusted pricing is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private pricing failure')));
  seedCart(); render(<App initialEntries={['/checkout']} />);
  expect(await screen.findByText('The shop service is temporarily unavailable.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  expect(screen.queryByRole('radio', { name: /KHQR/ })).not.toBeInTheDocument();
  expect(screen.queryByText('$90.00')).not.toBeInTheDocument();
});

it('switches in place to signed hosted card checkout and reuses pending method orders', async () => {
  const cardOrder: PublicOrder = { ...order, id: 'card-order', payment: { ...order.payment, method: 'card', qrDataUrl: '',
    checkout: { action: 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase',
      fields: { merchant_id: 'sandbox-merchant', tran_id: 'card-1', amount: '120.00', payment_option: 'cards', hash: 'signed' } } }, mockMode: false };
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/checkout-pricing') return new Response(JSON.stringify({ ...pricing, cardAvailable: true }));
    const isCard = options?.method === 'POST' ? JSON.parse(options.body as string).paymentMethod === 'card' : url.endsWith('card-order');
    return new Response(JSON.stringify(isCard ? cardOrder : order));
  });
  vi.stubGlobal('fetch', fetch);
  seedCart(); window.history.replaceState(null, '', '/checkout'); render(<App />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('region', { name: 'KHQR payment' });
  expect(screen.getByRole('radio', { name: /KHQR/ })).toBeChecked();
  expect(screen.queryByLabelText('Email', { exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /Credit \/ debit card/ }));
  const launch = await screen.findByRole('button', { name: 'Pay securely with ABA PayWay' });
  expect(window.location.pathname).toBe('/checkout');
  expect(screen.queryByLabelText(/card number|cvv|cvc|expiry/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Bakong KHQR payment code/ })).not.toBeInTheDocument();
  expect(launch.closest('form')).toHaveAttribute('action', cardOrder.payment.checkout!.action);
  expect(launch.closest('form')).toHaveAttribute('method', 'post');
  expect(launch.closest('form')!.querySelector('input[name="hash"]')).toHaveValue('signed');
  fireEvent.click(screen.getByRole('radio', { name: /KHQR/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Pay \$/ }));
  await screen.findByRole('img', { name: /Bakong KHQR payment code/ });
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(2);
});

it('keeps unavailable card checkout closed with customer-facing recovery copy', async () => {
  vi.stubGlobal('fetch', withPricing(async () => new Response(JSON.stringify(order))));
  seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('region', { name: 'KHQR payment' });
  fireEvent.click(screen.getByRole('radio', { name: /Credit \/ debit card/ }));
  expect(screen.getByText(/Card checkout is temporarily unavailable/)).toBeVisible();
  expect(screen.queryByRole('button', { name: /Pay securely/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/credentials|sandbox credentials/)).not.toBeInTheDocument();
});

it('creates one server order, preserves the cart until creation succeeds, then displays Payment without clearing the cart', async () => {
  let resolve!: (response: Response) => void;
  const fetch = withPricing(() => new Promise<Response>((done) => { resolve = done; }));
  vi.stubGlobal('fetch', fetch);
  const requestId = '019a6215-d300-4000-8000-000000000002';
  const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue(requestId);
  seedCart(); window.history.replaceState(null, '', '/checkout');
  const historyLength = window.history.length;
  render(<App />); await waitForPricing(); fillCheckout();
  const form = getForm();
  fireEvent.submit(form);
  const pay = await screen.findByRole('button', { name: /^Pay \$/ });
  act(() => { fireEvent.click(pay); fireEvent.click(pay); });
  expect(fetch.mock.calls.filter(([url]) => url === '/api/orders')).toHaveLength(1);
  expect(randomUUID).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('region', { name: 'Payment' })).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText('Creating your payment...')).toBeVisible();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  expect(window.location.pathname).toBe('/checkout');
  const submission = fetch.mock.calls.find(([url]) => url === '/api/orders')!;
  expect(JSON.parse(submission[1]!.body as string)).toEqual({
    requestId, customer: { name: 'Buyer', email: 'buyer@example.test', phone: '+855 (12) 345-678' },
    address: { street: 'Street 1', city: 'Phnom Penh', region: 'Phnom Penh', postalCode: '12000', country: 'Cambodia' },
    delivery: 'express', lines: [{ productId: 1, size: 'M', color: 'Black', quantity: 2 }],
  });
  await act(async () => resolve(new Response(JSON.stringify(order), { status: 201 })));
  expect(window.location.pathname).toBe('/checkout');
  expect(window.history.length).toBe(historyLength);
  expect(screen.getByText('Payment', { selector: '[aria-current=step]' })).toBeVisible();
  expect(screen.getByText(order.id)).toBeVisible();
  expect(screen.queryByLabelText('Name', { exact: true })).not.toBeInTheDocument();
  expect(screen.getByRole('dialog').querySelector('.khqr-amount-value')).toHaveTextContent('120.00 USD');
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  expect(localStorage.getItem('stussy-demo-order-v1')).toBeNull();
  expect(JSON.stringify(localStorage)).not.toContain('buyer@example.test');
});

it('keeps the cart and form on network failure, announces once, and allows retry', async () => {
  const orderFetch = vi.fn().mockRejectedValueOnce(new TypeError('private transport details'))
    .mockResolvedValueOnce(new Response(JSON.stringify(order), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(order), { status: 200 }));
  const fetch = withPricing(orderFetch);
  vi.stubGlobal('fetch', fetch);
  seedCart(); render(<App initialEntries={['/checkout']} />); await waitForPricing(); fillCheckout();
  const form = getForm(); await submitAndPay(form);
  await waitForPricing();
  const message = 'The shop service is temporarily unavailable.';
  expect(screen.getByRole('status')).toHaveTextContent(message);
  expect(within(screen.getByRole('main')).getByText(message)).toBeVisible();
  expect(document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).toHaveLength(1);
  expect(screen.getByLabelText('Email', { exact: true })).toHaveValue('buyer@example.test');
  expect(screen.getByRole('button', { name: 'Continue to payment' })).toBeEnabled();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  expect(screen.queryByText(/private transport/)).not.toBeInTheDocument();
  await submitAndPay();
  await waitFor(() => expect(screen.getByText(order.id)).toBeVisible());
  expect(fetch.mock.calls.filter(([url]) => url === '/api/orders')).toHaveLength(2);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/orders/' + order.id, { signal: expect.any(AbortSignal) }));
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
});

it('retries a committed order with the exact same payload after losing the first response', async () => {
  const repository = new SqliteOrderRepository(':memory:');
  const gateway = new MockBakongGateway();
  const createPayment = vi.spyOn(gateway, 'createPayment');
  const service = new OrderService(repository, gateway);
  const committed: PublicOrder[] = [];
  const orderFetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      const created = await service.createOrder(JSON.parse(options.body as string) as CreateOrderRequest);
      committed.push(created);
      if (committed.length === 1) throw new TypeError('Response lost after commit');
      return new Response(JSON.stringify(created), { status: 201 });
    }
    return new Response(JSON.stringify(await service.getOrder(url.split('/').at(-1)!)), { status: 200 });
  });
  const fetch = withPricing(orderFetch);
  vi.stubGlobal('fetch', fetch);
  try {
    seedCart(); render(<App initialEntries={['/checkout']} />); await waitForPricing(); fillCheckout();
    const form = getForm(); await submitAndPay(form);
    await waitForPricing();
    expect(repository.findById(committed[0].id)).not.toBeNull();
    await submitAndPay();
    await waitFor(() => expect(committed).toHaveLength(2));
    const submissions = fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(submissions).toHaveLength(2);
    expect(submissions[1][1]!.body).toBe(submissions[0][1]!.body);
    expect(committed).toEqual([committed[0], committed[0]]);
    expect(createPayment).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(committed[0].id)).toBeVisible());
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  } finally {
    cleanup();
    repository.close();
  }
});

it.each([
  ['Name', 'Another Buyer'],
  ['Street address', 'Street 2'],
  ['Delivery option', 'standard'],
])('uses a fresh request ID after changing %s for a retry', async (label, value) => {
  const orderFetch = vi.fn().mockRejectedValue(new TypeError('Response lost'));
  const fetch = withPricing(orderFetch);
  vi.stubGlobal('fetch', fetch);
  const randomUUID = vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('019a6215-d300-4000-8000-000000000002')
    .mockReturnValueOnce('019a6215-d300-4000-8000-000000000003');
  seedCart(); render(<App initialEntries={['/checkout']} />); await waitForPricing(); fillCheckout();
  const form = getForm(); await submitAndPay(form);
  await waitForPricing();
  if (label === 'Delivery option') fireEvent.click(screen.getByRole('radio', { name: /Standard delivery/ }));
  else fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  await submitAndPay();
  await waitForPricing();
  const first = JSON.parse(orderFetch.mock.calls[0][1].body) as CreateOrderRequest;
  const retry = JSON.parse(orderFetch.mock.calls[1][1].body) as CreateOrderRequest;
  expect(retry.requestId).not.toBe(first.requestId);
  expect({ ...retry, requestId: first.requestId }).not.toEqual(first);
  expect(randomUUID).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
});

it('shows a public service validation error without clearing the cart', async () => {
  vi.stubGlobal('fetch', withPricing(async () => new Response(JSON.stringify({ error: { code: 'invalid_checkout', message: 'Check the highlighted checkout information.' } }), { status: 400 })));
  seedCart(); render(<App initialEntries={['/checkout']} />); await waitForPricing(); fillCheckout();
  await submitAndPay();
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Check the highlighted checkout information.'));
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
});

it.each([201, 503])('ignores an abandoned checkout response (%s) after cart edits and preserves navigation', async (status) => {
  let resolve!: (response: Response) => void;
  const fetch = withPricing(() => new Promise<Response>((done) => { resolve = done; }));
  vi.stubGlobal('fetch', fetch);
  seedCart(); window.history.replaceState(null, '', '/checkout');
  render(<App />); await waitForPricing(); fillCheckout();
  await submitAndPay();
  expect(fetch.mock.calls.filter(([url]) => url === '/api/orders')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Shopping' })).getByRole('link', { name: 'Cart (2)' }));
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  const cartAnnouncement = screen.getByRole('status').textContent;
  expect(window.location.pathname).toBe('/cart');
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([{ ...line, quantity: 3 }]);
  await act(async () => resolve(new Response(JSON.stringify(status === 201 ? order : { error: { message: 'The shop service is temporarily unavailable.' } }), { status })));
  expect(window.location.pathname).toBe('/cart');
  expect(screen.getByRole('heading', { name: 'Your Cart', level: 1 })).toBeVisible();
  expect(screen.getByLabelText('Quantity')).toHaveValue(3);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([{ ...line, quantity: 3 }]);
  expect(screen.getByRole('status').textContent).toBe(cartAnnouncement);
});

it.each(['paid', 'expired', 'failed', 'cancelled'] as const)('opens final order only after the shop API reports %s', async (status) => {
  const fetch = withPricing(async (url, options) => new Response(JSON.stringify(options?.method === 'POST' ? order : { ...order, status })));
  vi.stubGlobal('fetch', fetch);
  seedCart(); window.history.replaceState(null, '', '/checkout'); render(<App />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await waitFor(() => expect(window.location.pathname).toBe('/order/' + order.id));
  expect(await screen.findByRole('heading', { level: 1, name: status === 'paid' ? 'Order Confirmed!' : 'Payment ' + status[0].toUpperCase() + status.slice(1) })).toBeVisible();
});

it('refreshes only through the shop API and preserves pending status after a connection error', async () => {
  let fail = false;
  const fetch = withPricing(async (url, options) => {
    if (fail) throw new TypeError('private transport details');
    return new Response(JSON.stringify(order), { status: options?.method === 'POST' ? 201 : 200 });
  });
  vi.stubGlobal('fetch', fetch); seedCart(); window.history.replaceState(null, '', '/checkout'); render(<App />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('dialog', { name: 'KHQR' });
  await waitFor(() => expect(fetch.mock.calls.some(([url]) => url === '/api/orders/' + order.id)).toBe(true));
  fail = true; visibilitychange();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to refresh this order');
  expect(window.location.pathname).toBe('/checkout');
  expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Bakong KHQR payment code/ })).toBeVisible();
  fail = false; visibilitychange();
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(fetch.mock.calls.every(([url]) => url.startsWith('/api/'))).toBe(true);
});

it('polls without overlap, waits for server expiry, and aborts status work on unmount', async () => {
  const expiring = { ...order, payment: { ...order.payment, expiresAt: new Date(Date.now() + 2000).toISOString() } };
  let slow = false;
  let signal: AbortSignal | undefined;
  const fetch = withPricing(async (_url, options) => {
    if (slow) {
      signal = options?.signal as AbortSignal;
      return new Promise<Response>(() => {});
    }
    return new Response(JSON.stringify(expiring));
  });
  vi.stubGlobal('fetch', fetch); seedCart(); window.history.replaceState(null, '', '/checkout');
  const page = render(<App />); await waitForPricing(); fillCheckout();
  vi.useFakeTimers();
  await act(async () => fireEvent.submit(getForm()));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Pay \$/ })));
  expect(screen.getByRole('img', { name: /Bakong KHQR payment code/ })).toBeVisible();
  const before = fetch.mock.calls.length;
  await act(async () => vi.advanceTimersByTimeAsync(2000));
  expect(screen.getByText('Waiting for confirmation')).toBeVisible();
  expect(screen.getByText(/Waiting for the shop to confirm expiration/)).toBeVisible();
  expect(screen.queryByRole('img', { name: /Bakong KHQR payment code/ })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/checkout');
  slow = true;
  await act(async () => vi.advanceTimersByTimeAsync(13000));
  expect(fetch.mock.calls).toHaveLength(before + 1);
  expect(signal?.aborted).toBe(false);
  page.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(fetch.mock.calls).toHaveLength(before + 1);
});

it('ignores a selected method status response after switching to another method', async () => {
  let resolve!: (response: Response) => void;
  let pendingSignal: AbortSignal | undefined;
  const cardOrder = { ...order, id: 'card-order', payment: { ...order.payment, method: 'card' } };
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === '/api/checkout-pricing') return new Response(JSON.stringify({ ...pricing, cardAvailable: true }));
    if (options?.method === 'POST') return new Response(JSON.stringify(JSON.parse(options.body as string).paymentMethod === 'card' ? cardOrder : order));
    if (url.endsWith('card-order')) return new Response(JSON.stringify(cardOrder));
    pendingSignal = options?.signal as AbortSignal;
    return new Promise<Response>((done) => { resolve = done; });
  });
  vi.stubGlobal('fetch', fetch); seedCart(); window.history.replaceState(null, '', '/checkout'); render(<App />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('region', { name: 'KHQR payment' });
  fireEvent.click(screen.getByRole('radio', { name: /Credit \/ debit card/ }));
  await screen.findByRole('region', { name: 'Card payment' });
  expect(pendingSignal?.aborted).toBe(true);
  await act(async () => resolve(new Response(JSON.stringify({ ...order, status: 'paid' }))));
  expect(window.location.pathname).toBe('/checkout');
  expect(screen.getByRole('region', { name: 'Card payment' })).toBeVisible();
});

it('restores the in-place pending payment from the shop API after remount with an empty cart', async () => {
  const fetch = withPricing(async () => new Response(JSON.stringify(order)));
  vi.stubGlobal('fetch', fetch); seedCart(); window.history.replaceState(null, '', '/checkout');
  const first = render(<App />); await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('region', { name: 'KHQR payment' });
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual([order.id]);
  expect(sessionStorage.getItem(recoveryKey)).not.toMatch(/buyer|providerReference|checkout|hash/);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  first.unmount();
  const before = fetch.mock.calls.length;
  render(<App />);
  expect(await screen.findByRole('region', { name: 'KHQR payment' })).toBeVisible();
  expect(window.location.pathname).toBe('/checkout');
  expect(screen.getByText(order.id)).toBeVisible();
  expect(screen.getByRole('radio', { name: /KHQR/ })).toBeChecked();
  expect(fetch.mock.calls.slice(before).some(([url, options]) => url === '/api/orders/' + order.id && !options?.method)).toBe(true);
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it.each(['paid', 'expired', 'failed', 'cancelled'] as const)('clears restored order IDs only after the API reports %s', async (status) => {
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id]));
  vi.stubGlobal('fetch', withPricing(async () => new Response(JSON.stringify({ ...order, status }))));
  window.history.replaceState(null, '', '/checkout'); render(<App />);
  expect(await screen.findByRole('heading', { name: status === 'paid' ? 'Order Confirmed!' : 'Payment ' + status[0].toUpperCase() + status.slice(1) })).toBeVisible();
  expect(window.location.pathname).toBe('/order/' + order.id);
  expect(sessionStorage.getItem(recoveryKey)).toBeNull();
});

it.each(['not-json', JSON.stringify(['']), JSON.stringify([order.id, 'second', 'third'])])('clears invalid recovery state before empty-cart recovery', async (stored) => {
  sessionStorage.setItem(recoveryKey, stored);
  window.history.replaceState(null, '', '/checkout'); render(<App />);
  expect(await screen.findByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  expect(sessionStorage.getItem(recoveryKey)).toBeNull();
});

it('clears a missing recovered order and returns to the cart', async () => {
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id]));
  vi.stubGlobal('fetch', withPricing(async () => new Response(JSON.stringify({ error: { message: 'Order not found' } }), { status: 404 })));
  window.history.replaceState(null, '', '/checkout'); render(<App />);
  expect(await screen.findByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  expect(sessionStorage.getItem(recoveryKey)).toBeNull();
});

it('retains recovery IDs through a connection error and restores after retry', async () => {
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id]));
  let fail = true;
  vi.stubGlobal('fetch', withPricing(async () => {
    if (fail) throw new TypeError('Connection lost');
    return new Response(JSON.stringify(order));
  }));
  window.history.replaceState(null, '', '/checkout'); render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to restore your payment');
  expect(sessionStorage.getItem(recoveryKey)).toBe(JSON.stringify([order.id]));
  expect(window.location.pathname).toBe('/checkout');
  fail = false; fireEvent.click(screen.getByRole('button', { name: 'Retry restoring payment' }));
  expect(await screen.findByRole('region', { name: 'KHQR payment' })).toBeVisible();
});

it('restores the selected hosted card order and both cached methods using only saved IDs', async () => {
  const cardOrder: PublicOrder = { ...order, id: 'card-order', mockMode: false,
    payment: { ...order.payment, method: 'card', qrDataUrl: '', checkout: {
      action: 'https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase', fields: { hash: 'server-signature' },
    } } };
  sessionStorage.setItem(recoveryKey, JSON.stringify([cardOrder.id, order.id]));
  const fetch = withPricing(async (url) => new Response(JSON.stringify(url.endsWith(cardOrder.id) ? cardOrder : order)));
  vi.stubGlobal('fetch', fetch); window.history.replaceState(null, '', '/checkout'); render(<App />);
  const launch = await screen.findByRole('button', { name: 'Pay securely with ABA PayWay' });
  expect(screen.getByRole('radio', { name: /Credit \/ debit card/ })).toBeChecked();
  expect(launch.closest('form')!.querySelector('input[name="hash"]')).toHaveValue('server-signature');
  expect(screen.queryByLabelText(/card number|cvv|cvc|expiry/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: /KHQR/ }));
  expect(await screen.findByRole('region', { name: 'KHQR payment' })).toBeVisible();
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual([order.id, cardOrder.id]);
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  expect(window.location.pathname).toBe('/checkout');
});

it.each(['network', 'server'] as const)('retains a secondary pending ID after a %s failure and recovers its method on reload', async (failure) => {
  const cardOrder: PublicOrder = { ...order, id: 'card-order', payment: { ...order.payment, method: 'card', qrDataUrl: '' } };
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id, cardOrder.id]));
  let fail = true;
  const fetch = withPricing(async (url) => {
    if (!url.endsWith(cardOrder.id)) return new Response(JSON.stringify(order));
    if (fail && failure === 'network') throw new TypeError('Connection lost');
    if (fail) return new Response(JSON.stringify({ error: { message: 'Try later' } }), { status: 503 });
    return new Response(JSON.stringify(cardOrder));
  });
  vi.stubGlobal('fetch', fetch); window.history.replaceState(null, '', '/checkout');
  const first = render(<App />);
  expect(await screen.findByRole('region', { name: 'KHQR payment' })).toBeVisible();
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual([order.id, cardOrder.id]);
  first.unmount(); fail = false;
  render(<App />);
  await screen.findByRole('region', { name: 'KHQR payment' });
  expect(screen.getByRole('radio', { name: /Credit \/ debit card/ })).toBeEnabled();
  fireEvent.click(screen.getByRole('radio', { name: /Credit \/ debit card/ }));
  expect(await screen.findByRole('region', { name: 'Card payment' })).toBeVisible();
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual([cardOrder.id, order.id]);
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
});

it('retries restoring a temporarily unavailable secondary method without creating another order', async () => {
  const cardOrder: PublicOrder = { ...order, id: 'card-order', payment: { ...order.payment, method: 'card', qrDataUrl: '' } };
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id, cardOrder.id]));
  let fail = true;
  const fetch = withPricing(async (url) => {
    if (!url.endsWith(cardOrder.id)) return new Response(JSON.stringify(order));
    if (fail) throw new TypeError('Connection lost');
    return new Response(JSON.stringify(cardOrder));
  });
  vi.stubGlobal('fetch', fetch); window.history.replaceState(null, '', '/checkout'); render(<App />);
  await screen.findByRole('region', { name: 'KHQR payment' });
  expect(screen.getByRole('radio', { name: /Credit \/ debit card/ })).toBeDisabled();
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Retry restoring payment methods' }));
  await waitFor(() => expect(screen.getByRole('radio', { name: /Credit \/ debit card/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('radio', { name: /Credit \/ debit card/ }));
  expect(await screen.findByRole('region', { name: 'Card payment' })).toBeVisible();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
});

it.each(['404', 'paid', 'expired', 'failed', 'cancelled'])('removes a secondary ID only when its API lookup verifies %s', async (status) => {
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id, 'card-order']));
  vi.stubGlobal('fetch', withPricing(async (url) => {
    if (!url.endsWith('card-order')) return new Response(JSON.stringify(order));
    return status === '404' ? new Response(JSON.stringify({ error: { message: 'Missing' } }), { status: 404 })
      : new Response(JSON.stringify({ ...order, id: 'card-order', status }));
  }));
  window.history.replaceState(null, '', '/checkout'); render(<App />);
  expect(await screen.findByRole('region', { name: 'KHQR payment' })).toBeVisible();
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual([order.id]);
  expect(screen.queryByRole('button', { name: 'Retry restoring payment methods' })).not.toBeInTheDocument();
});

it.each(['paid', 'expired', 'failed', 'cancelled'] as const)('retains a secondary pending ID when the selected API order is %s', async (status) => {
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id, 'card-order']));
  vi.stubGlobal('fetch', withPricing(async (url) => {
    if (url.endsWith('card-order')) throw new TypeError('Secondary status unavailable');
    return new Response(JSON.stringify({ ...order, status }));
  }));
  window.history.replaceState(null, '', '/checkout'); render(<App />);
  expect(await screen.findByRole('heading', { name: status === 'paid' ? 'Order Confirmed!' : 'Payment ' + status[0].toUpperCase() + status.slice(1) })).toBeVisible();
  expect(window.location.pathname).toBe('/order/' + order.id);
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual(['card-order']);
});

it('retains a secondary pending ID when the selected API order is missing', async () => {
  sessionStorage.setItem(recoveryKey, JSON.stringify([order.id, 'card-order']));
  vi.stubGlobal('fetch', withPricing(async (url) => {
    if (url.endsWith('card-order')) throw new TypeError('Secondary status unavailable');
    return new Response(JSON.stringify({ error: { message: 'Missing selected order' } }), { status: 404 });
  }));
  window.history.replaceState(null, '', '/checkout'); render(<App />);
  expect(await screen.findByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual(['card-order']);
});

it('waits for Pay before generating KHQR and reopens the existing code', async () => {
  const fetch = withPricing(async () => new Response(JSON.stringify(order)));
  vi.stubGlobal('fetch', fetch); seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing(); fillCheckout(); fireEvent.submit(getForm());
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  expect(screen.queryByRole('img', { name: /Bakong KHQR/ })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: /^Pay \$/ }));
  const dialog = await screen.findByRole('dialog', { name: 'KHQR' });
  expect(within(dialog).getByText('Stüssy Collection')).toBeVisible();
  expect(dialog.querySelector('.khqr-amount-value')).toHaveTextContent('120.00 USD');
  expect(within(dialog).getByRole('img', { name: 'Bakong logo' })).toBeVisible();
  expect(within(dialog).getByText('Payment is verified automatically.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close KHQR' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /^Pay \$/ }));
  expect(await screen.findByRole('dialog')).toBeVisible();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
});

it('pauses automatic verification on the bank quota error and keeps the pending order recoverable', async () => {
  const message = 'Daily verification limit reached. Do not pay again.';
  const fetch = withPricing(async (_url, options) => options?.method === 'POST' ? new Response(JSON.stringify(order)) : new Response(JSON.stringify({ error: { message } }), { status: 429 }));
  vi.stubGlobal('fetch', fetch); seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('alert');
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(within(screen.getByRole('dialog')).getByText('Payment verification is temporarily unavailable.')).toBeVisible();
  expect(within(screen.getByRole('dialog')).getByText('Already paid? Do not pay again. We will confirm your payment once verification is restored.')).toBeVisible();
  const checks = fetch.mock.calls.length;
  vi.useFakeTimers();
  await act(async () => vi.advanceTimersByTimeAsync(30000));
  expect(fetch).toHaveBeenCalledTimes(checks);
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual([order.id]);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  visibilitychange();
  await act(async () => {});
  expect(fetch).toHaveBeenCalledTimes(checks);
  expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(message);
});

it('does not offer a second payment while an expired QR is unresolved', async () => {
  const expired = { ...order, payment: { ...order.payment, expiresAt: new Date(Date.now() - 1000).toISOString() } };
  const fetch = withPricing(async () => new Response(JSON.stringify(expired)));
  vi.stubGlobal('fetch', fetch); seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing(); fillCheckout(); await submitAndPay();
  await screen.findByRole('dialog');
  expect(screen.queryByRole('button', { name: 'Generate new QR' })).not.toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
  expect(JSON.parse(sessionStorage.getItem(recoveryKey)!)).toEqual([order.id]);
});

it('automatically opens confirmation after a scheduled verified payment check', async () => {
  let paid = false;
  vi.stubGlobal('fetch', withPricing(async () => new Response(JSON.stringify({ ...order, status: paid ? 'paid' : 'awaiting_payment' }))));
  seedCart(); render(<App initialEntries={['/checkout']} />);
  await waitForPricing(); fillCheckout();
  vi.useFakeTimers();
  await act(async () => fireEvent.submit(getForm()));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /^Pay \$/ })));
  expect(screen.getByRole('dialog')).toBeVisible();
  paid = true;
  await act(async () => vi.advanceTimersByTimeAsync(5000));
  await act(async () => vi.advanceTimersByTimeAsync(700));
  expect(screen.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe('hidden');
});
