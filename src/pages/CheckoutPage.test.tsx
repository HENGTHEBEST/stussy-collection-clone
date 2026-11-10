import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { CART_STORAGE_KEY } from '../lib/storage';
import type { CreateOrderRequest, PublicOrder } from '../../shared/commerce';
import { OrderService } from '../../server/orders/order-service';
import { SqliteOrderRepository } from '../../server/orders/sqlite-order-repository';
import { MockBakongGateway } from '../../server/payments/mock-bakong-gateway';

const line = { productId: 1, color: 'Black', size: 'M', quantity: 2, unitPrice: 45 };
const order: PublicOrder = {
  id: '019a6215-d300-4000-8000-000000000001', status: 'awaiting_payment', createdAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z',
  merchantName: 'Stussy Collection',
  deliveryLabel: 'Express delivery', currency: 'USD', subtotalMinor: 9600, shippingMinor: 2400, totalMinor: 12000,
  lines: [{ productId: 1, slug: 'tee', name: 'Server Tee', image: '/tee.png', size: 'M', color: 'Black', quantity: 2, unitPriceMinor: 4800 }],
  payment: { status: 'pending', qrDataUrl: 'data:image/png;base64,AAAA', expiresAt: '2026-11-09T00:15:00.000Z', providerReference: 'mock-1' }, mockMode: true,
};
const inputs = {
  Name: 'Buyer', Email: 'buyer@example.test', Phone: '+855 (12) 345-678',
  'Street address': 'Street 1', City: 'Phnom Penh', Region: 'Phnom Penh', 'Postal code': '12000', Country: 'Cambodia',
};
function seedCart() { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, value: { lines: [line] } })); }
function fillCheckout() {
  for (const [label, value] of Object.entries(inputs)) fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.change(screen.getByLabelText('Delivery option'), { target: { value: 'express' } });
}
function getForm() { return screen.getByRole('button', { name: 'Continue to KHQR' }).closest('form')!; }
beforeEach(() => { localStorage.clear(); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

it('replace-redirects empty checkout to cart without an actionable form', () => {
  window.history.replaceState(null, '', '/checkout');
  const historyLength = window.history.length;
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Continue to KHQR' })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/cart');
  expect(window.history.length).toBe(historyLength);
});

it('focuses the first invalid field and associates errors with one polite announcement', () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  seedCart(); render(<App initialEntries={['/checkout']} />);
  fireEvent.submit(getForm());
  expect(screen.getByLabelText('Name', { exact: true })).toHaveFocus();
  for (const label of Object.keys(inputs)) {
    const field = screen.getByLabelText(label, { exact: true });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('This field is required.');
  }
  expect(screen.getByRole('status')).toHaveTextContent(/highlighted fields/i);
  expect(document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).toHaveLength(1);
  expect(fetch).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
});

it('shows contact and address fields with KHQR copy and no removed payment fields', () => {
  seedCart(); render(<App initialEntries={['/checkout']} />);
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('button', { name: 'Continue to KHQR' })).toBeVisible();
  expect(main.getByText(/estimates only/i)).toBeVisible();
  for (const label of ['Cardholder name', 'Demo card number', 'Expiry (MM/YY)', 'CVC']) {
    expect(screen.queryByLabelText(label)).not.toBeInTheDocument();
  }
  expect(screen.getByRole('main').textContent).not.toMatch(/card|4242|no personal.*saved/i);
});

it('reviews cart items as compact product thumbnails before KHQR', () => {
  seedCart(); render(<App initialEntries={['/checkout']} />);
  const review = within(screen.getByRole('complementary', { name: 'Review your order' }));
  expect(review.getByRole('img', { name: /8-Ball Tee/ })).toHaveAttribute('src', '/assets/lookbook-8-ball-black.jpg');
  expect(review.getByText('Black / M')).toBeVisible();
  expect(review.getByText('Quantity 2')).toBeVisible();
  expect(within(review.getByRole('article')).getByText('$90.00')).toBeVisible();
  expect(review.queryByRole('link', { name: 'Checkout' })).not.toBeInTheDocument();
  expect(review.getByRole('button', { name: 'Continue to KHQR' })).toHaveAttribute('form', 'checkout-form');
});

it('creates one server order, preserves the cart while pending, then clears and replace-navigates with the order', async () => {
  let resolve!: (response: Response) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done; }));
  vi.stubGlobal('fetch', fetch);
  const requestId = '019a6215-d300-4000-8000-000000000002';
  const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue(requestId);
  seedCart(); window.history.replaceState(null, '', '/checkout');
  const historyLength = window.history.length;
  render(<App />); fillCheckout();
  const form = getForm();
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(randomUUID).toHaveBeenCalledTimes(1);
  expect(form).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByRole('button', { name: 'Continue to KHQR' })).toBeDisabled();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  expect(window.location.pathname).toBe('/checkout');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
    requestId, customer: { name: 'Buyer', email: 'buyer@example.test', phone: '+855 (12) 345-678' },
    address: { street: 'Street 1', city: 'Phnom Penh', region: 'Phnom Penh', postalCode: '12000', country: 'Cambodia' },
    delivery: 'express', lines: [{ productId: 1, size: 'M', color: 'Black', quantity: 2 }],
  });
  await act(async () => resolve(new Response(JSON.stringify(order), { status: 201 })));
  expect(window.location.pathname).toBe('/order/' + order.id);
  expect(window.history.length).toBe(historyLength);
  expect(window.history.state.usr).toEqual({ order });
  expect(screen.getByText(order.id)).toBeVisible();
  expect(screen.getByText('Unit price: $48.00')).toBeVisible();
  expect(screen.getByText('Line total: $96.00')).toBeVisible();
  expect(screen.getByText('$120.00')).toBeVisible();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([]);
  expect(localStorage.getItem('stussy-demo-order-v1')).toBeNull();
  expect(JSON.stringify(localStorage)).not.toContain('buyer@example.test');
});

it('keeps the cart and form on network failure, announces once, and allows retry', async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new TypeError('private transport details'))
    .mockResolvedValueOnce(new Response(JSON.stringify(order), { status: 201 }))
    .mockResolvedValueOnce(new Response(JSON.stringify(order), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  seedCart(); render(<App initialEntries={['/checkout']} />); fillCheckout();
  const form = getForm(); fireEvent.submit(form);
  await waitFor(() => expect(form).toHaveAttribute('aria-busy', 'false'));
  const message = 'The shop service is temporarily unavailable.';
  expect(screen.getByRole('status')).toHaveTextContent(message);
  expect(within(screen.getByRole('main')).getByText(message)).toBeVisible();
  expect(document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).toHaveLength(1);
  expect(screen.getByLabelText('Email', { exact: true })).toHaveValue('buyer@example.test');
  expect(screen.getByRole('button', { name: 'Continue to KHQR' })).toBeEnabled();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
  expect(screen.queryByText(/private transport/)).not.toBeInTheDocument();
  fireEvent.submit(form);
  await waitFor(() => expect(screen.getByText(order.id)).toBeVisible());
  expect(fetch.mock.calls.filter(([url]) => url === '/api/orders')).toHaveLength(2);
  await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/orders/' + order.id, { signal: expect.any(AbortSignal) }));
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([]);
});

it('retries a committed order with the exact same payload after losing the first response', async () => {
  const repository = new SqliteOrderRepository(':memory:');
  const gateway = new MockBakongGateway();
  const createPayment = vi.spyOn(gateway, 'createPayment');
  const service = new OrderService(repository, gateway);
  const committed: PublicOrder[] = [];
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'POST') {
      const created = await service.createOrder(JSON.parse(options.body as string) as CreateOrderRequest);
      committed.push(created);
      if (committed.length === 1) throw new TypeError('Response lost after commit');
      return new Response(JSON.stringify(created), { status: 201 });
    }
    return new Response(JSON.stringify(await service.getOrder(url.split('/').at(-1)!)), { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  try {
    seedCart(); render(<App initialEntries={['/checkout']} />); fillCheckout();
    const form = getForm(); fireEvent.submit(form);
    await waitFor(() => expect(form).toHaveAttribute('aria-busy', 'false'));
    expect(repository.findById(committed[0].id)).not.toBeNull();
    fireEvent.submit(form);
    await waitFor(() => expect(committed).toHaveLength(2));
    const submissions = fetch.mock.calls.filter(([, options]) => options?.method === 'POST');
    expect(submissions).toHaveLength(2);
    expect(submissions[1][1]!.body).toBe(submissions[0][1]!.body);
    expect(committed).toEqual([committed[0], committed[0]]);
    expect(createPayment).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText(committed[0].id)).toBeVisible());
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([]);
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
  const fetch = vi.fn().mockRejectedValue(new TypeError('Response lost'));
  vi.stubGlobal('fetch', fetch);
  const randomUUID = vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('019a6215-d300-4000-8000-000000000002')
    .mockReturnValueOnce('019a6215-d300-4000-8000-000000000003');
  seedCart(); render(<App initialEntries={['/checkout']} />); fillCheckout();
  const form = getForm(); fireEvent.submit(form);
  await waitFor(() => expect(form).toHaveAttribute('aria-busy', 'false'));
  fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.submit(form);
  await waitFor(() => expect(form).toHaveAttribute('aria-busy', 'false'));
  const first = JSON.parse(fetch.mock.calls[0][1].body) as CreateOrderRequest;
  const retry = JSON.parse(fetch.mock.calls[1][1].body) as CreateOrderRequest;
  expect(retry.requestId).not.toBe(first.requestId);
  expect({ ...retry, requestId: first.requestId }).not.toEqual(first);
  expect(randomUUID).toHaveBeenCalledTimes(2);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
});

it('shows a public service validation error without clearing the cart', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'invalid_checkout', message: 'Check the highlighted checkout information.' } }), { status: 400 })));
  seedCart(); render(<App initialEntries={['/checkout']} />); fillCheckout();
  fireEvent.submit(getForm());
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Check the highlighted checkout information.'));
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([line]);
});

it.each([201, 503])('ignores an abandoned checkout response (%s) after cart edits and preserves navigation', async (status) => {
  let resolve!: (response: Response) => void;
  const fetch = vi.fn().mockImplementation(() => new Promise<Response>((done) => { resolve = done; }));
  vi.stubGlobal('fetch', fetch);
  seedCart(); window.history.replaceState(null, '', '/checkout');
  render(<App />); fillCheckout();
  fireEvent.submit(getForm());
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }));
  fireEvent.click(screen.getByRole('link', { name: 'Cart (2)' }));
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  const cartAnnouncement = screen.getByRole('status').textContent;
  expect(window.location.pathname).toBe('/cart');
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([{ ...line, quantity: 3 }]);
  await act(async () => resolve(new Response(JSON.stringify(status === 201 ? order : { error: { message: 'The shop service is temporarily unavailable.' } }), { status })));
  expect(window.location.pathname).toBe('/cart');
  expect(screen.getByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  expect(screen.getByLabelText('Quantity')).toHaveValue(3);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([{ ...line, quantity: 3 }]);
  expect(screen.getByRole('status').textContent).toBe(cartAnnouncement);
});
