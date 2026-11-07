import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from '../app/App';
import { CART_STORAGE_KEY, ORDER_STORAGE_KEY } from '../lib/storage';
import { products } from '../data/products';

const line = { productId: 1, color: 'Black', size: 'M', quantity: 2, unitPrice: 45 };
const order = {
  orderId: 'DEMO-ABCDEF12', createdAt: '2026-11-07T08:00:00.000Z', lines: [line],
  subtotal: 90, shipping: 12, total: 102, deliveryLabel: 'Standard demo delivery',
};
const inputs = {
  Name: 'Private Buyer', Email: 'buyer@example.test', Phone: '+855 (12) 345-678',
  'Street address': 'Secret Street 987', City: 'Private City', Region: 'Private Region',
  'Postal code': 'PRIVATE-987', Country: 'Private Country', 'Cardholder name': 'Private Cardholder',
  'Demo card number': '4242 4242 4242 4242', 'Expiry (MM/YY)': '12/39', CVC: '987',
};
function seedCart() { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, value: { lines: [line] } })); }
function seedOrder(value: unknown = order) { localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify({ version: 1, value })); }
function fillCheckout() {
  for (const [label, value] of Object.entries(inputs)) fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
}
beforeEach(() => { localStorage.clear(); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

it('replace-redirects empty checkout to cart without presenting an actionable form', () => {
  window.history.replaceState(null, '', '/checkout');
  const historyLength = window.history.length;
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Cart', level: 1 })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Place demo order' })).not.toBeInTheDocument();
  expect(window.location.pathname).toBe('/cart');
  expect(window.history.length).toBe(historyLength);
});

it('announces invalid checkout once while associating errors and focusing the first invalid field', () => {
  seedCart(); render(<App initialEntries={['/checkout']} />);
  fireEvent.click(screen.getByRole('button', { name: 'Place demo order' }));
  const name = screen.getByLabelText('Name', { exact: true });
  expect(name).toHaveFocus();
  for (const label of Object.keys(inputs)) {
    const field = screen.getByLabelText(label, { exact: true });
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('This field is required.');
  }
  expect(localStorage.getItem(ORDER_STORAGE_KEY)).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Check the highlighted fields before placing your demo order.');
  expect(within(screen.getByRole('main')).getByText('Check the highlighted fields before placing your demo order.')).toBeVisible();
  expect(document.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).toHaveLength(1);
});

it('rejects a different card with an associated demo-mode error', () => {
  seedCart(); render(<App initialEntries={['/checkout']} />); fillCheckout();
  fireEvent.change(screen.getByLabelText('Demo card number'), { target: { value: '5555 5555 5555 4444' } });
  fireEvent.click(screen.getByRole('button', { name: 'Place demo order' }));
  const card = screen.getByLabelText('Demo card number');
  expect(card).toHaveFocus();
  expect(card).toHaveAccessibleDescription('Use the documented demo card number.');
  expect(localStorage.getItem(ORDER_STORAGE_KEY)).toBeNull();
});

it('creates one non-personal stored summary, clears cart, and replace-navigates to confirmation', () => {
  seedCart(); window.history.replaceState(null, '', '/checkout');
  const historyLength = window.history.length;
  const randomUUID = vi.spyOn(crypto, 'randomUUID');
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  const log = vi.spyOn(console, 'log'); const info = vi.spyOn(console, 'info');
  render(<App />); fillCheckout();
  const main = within(screen.getByRole('main'));
  expect(main.getByText(/simulation/i)).toBeVisible();
  expect(main.getByText(/4242 4242 4242 4242/)).toBeVisible();
  expect(main.getByText(/no personal or payment data is saved/i)).toBeVisible();
  for (const label of ['Cardholder name', 'Demo card number', 'Expiry (MM/YY)', 'CVC']) {
    expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute('inputmode');
  }
  const form = screen.getByRole('button', { name: 'Place demo order' }).closest('form')!;
  act(() => { fireEvent.submit(form); fireEvent.submit(form); });
  expect(screen.getByRole('heading', { name: 'Order confirmation', level: 1 })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Demo order placed. No payment was sent.');
  expect(randomUUID).toHaveBeenCalledTimes(1);
  const stored = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY)!);
  expect(stored).toMatchObject({ version: 1, value: { ...order, orderId: expect.stringMatching(/^DEMO-[0-9A-F]{8}$/), createdAt: expect.any(String) } });
  expect(window.location.pathname).toBe(`/order/${stored.value.orderId}`);
  expect(window.history.length).toBe(historyLength);
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!)).toEqual({ version: 1, value: { lines: [] } });
  const serialized = JSON.stringify(stored);
  for (const value of Object.values(inputs)) expect(serialized).not.toContain(JSON.stringify(value));
  for (const key of ['name', 'email', 'phone', 'street', 'city', 'region', 'postalCode', 'country', 'cardholder', 'cardNumber', 'expiry', 'cvc']) {
    expect(Object.keys(stored.value)).not.toContain(key);
    expect(Object.keys(stored.value.lines[0])).not.toContain(key);
  }
  expect(fetch).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled(); expect(info).not.toHaveBeenCalled();
  cleanup(); render(<App initialEntries={[`/order/${stored.value.orderId}`]} />);
  expect(screen.getByRole('heading', { name: 'Order confirmation', level: 1 })).toBeVisible();
  expect(screen.getByText(stored.value.orderId)).toBeVisible();
});

it('restores the latest matching order with captured prices, local product media, and demo delivery', () => {
  seedOrder(); render(<App initialEntries={['/order/DEMO-ABCDEF12']} />);
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('heading', { name: 'Order confirmation', level: 1 })).toBeVisible();
  expect(main.getByText('DEMO-ABCDEF12')).toBeVisible();
  expect(main.getByRole('img', { name: products[0].name })).toHaveAttribute('src', products[0].image);
  expect(main.getByText('Black / M')).toBeVisible();
  expect(main.getByText('Quantity: 2')).toBeVisible();
  expect(main.getByText('Unit price: $45.00')).toBeVisible();
  expect(main.getByText('Line total: $90.00')).toBeVisible();
  expect(main.getByText('$102.00')).toBeVisible();
  expect(main.getByText('Standard demo delivery')).toBeVisible();
  expect(main.getByText(/no payment was sent/i)).toBeVisible();
  expect(main.getByText(order.createdAt)).toHaveAttribute('datetime', order.createdAt);
  fireEvent.error(main.getByRole('img', { name: products[0].name }));
  expect(main.getByRole('img', { name: `${products[0].name} image unavailable` })).toBeVisible();
});

it.each([
  ['mismatched', order, '/order/DEMO-00000000'],
  ['corrupt', { ...order, email: 'leaked@example.test' }, '/order/DEMO-ABCDEF12'],
  ['unknown product', { ...order, lines: [{ ...line, productId: 999 }] }, '/order/DEMO-ABCDEF12'],
  ['missing', null, '/order/DEMO-ABCDEF12'],
])('recovers safely from a %s order without rendering partial data', (_name, value, path) => {
  if (value) seedOrder(value);
  render(<App initialEntries={[path]} />);
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('heading', { name: 'Order not available', level: 1 })).toBeVisible();
  expect(main.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
  expect(main.queryByRole('img')).not.toBeInTheDocument();
});

it('shows the current safe summary when storage writes fail and honestly describes refresh limits', () => {
  seedCart();
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Unavailable'); });
  window.history.replaceState(null, '', '/checkout');
  render(<App />); fillCheckout();
  fireEvent.click(screen.getByRole('button', { name: 'Place demo order' }));
  expect(screen.getByRole('heading', { name: 'Order confirmation', level: 1 })).toBeVisible();
  expect(screen.getByText(/refresh.*storage/i)).toBeVisible();
  expect(window.history.state.usr).toBeNull();
  cleanup(); render(<App />);
  expect(screen.getByRole('heading', { name: 'Order not available', level: 1 })).toBeVisible();
});
