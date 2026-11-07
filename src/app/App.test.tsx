import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { App } from './App';
import { CART_STORAGE_KEY, WISHLIST_STORAGE_KEY } from '../lib/storage';
import { AppErrorBoundary } from './AppErrorBoundary';

beforeEach(() => { localStorage.clear(); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.style.overflow = ''; });

it.each([
  ['/', 'Summer Classics'], ['/shop', 'Shop'], ['/cart', 'Cart'],
  ['/wishlist', 'Wishlist'], ['/product/8-ball', 'Product'],
  ['/checkout', 'Checkout'], ['/order/DEMO-123', 'Order confirmation'],
  ['/missing', 'Page not found'],
])('renders the registered %s route', (path, heading) => {
  render(<App initialEntries={[path]} />);
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
});

it('exposes shell navigation and persisted provider counts', async () => {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, value: [1, 2] }));
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, value: { lines: [
    { productId: 1, size: 'M', color: 'Black', quantity: 3, unitPrice: 45 },
  ] } }));
  render(<App initialEntries={['/shop']} />);
  expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main-content');
  await userEvent.click(screen.getByRole('button', { name: 'Menu' }));
  const nav = within(screen.getByRole('navigation', { name: 'Mobile navigation' }));
  expect(nav.getByRole('link', { name: 'Shop' })).toHaveAttribute('href', '/shop');
  expect(nav.getByRole('link', { name: 'Wishlist (2)' })).toHaveAttribute('href', '/wishlist');
  expect(nav.getByRole('link', { name: 'Cart (3)' })).toHaveAttribute('href', '/cart');
  for (const [name, hash] of [['Home', 'hero'], ['Collection', 'collection'], ['About Us', 'about'], ['Contact', 'contact']]) {
    expect(nav.getByRole('link', { name })).toHaveAttribute('href', `/#${hash}`);
  }
  expect(screen.getAllByRole('status')).toHaveLength(1);
});

it('focuses a home hash target after cross-route navigation', async () => {
  const user = userEvent.setup();
  render(<App initialEntries={['/shop']} />);
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Contact' }));
  await waitFor(() => expect(screen.getByRole('contentinfo')).toHaveFocus());
  expect(screen.getByRole('heading', { name: 'Summer Classics' })).toBeInTheDocument();
});

it('contains rendering failures with recovery actions outside the router', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  function BrokenChild(): never { throw new Error('test rendering failure'); }
  render(<AppErrorBoundary><BrokenChild /></AppErrorBoundary>);
  expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
  consoleError.mockRestore();
});

it('provides recovery links for an unknown route', () => {
  render(<App initialEntries={['/missing']} />);
  const main = within(screen.getByRole('main'));
  expect(main.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
  expect(main.getByRole('link', { name: 'Explore shop' })).toHaveAttribute('href', '/shop');
});

it('manages mobile menu focus, Escape, and original scroll locking', async () => {
  const user = userEvent.setup();
  document.body.style.overflow = 'auto';
  render(<App initialEntries={['/']} />);
  const trigger = screen.getByRole('button', { name: 'Menu' });
  expect(trigger).toHaveAttribute('aria-controls', 'mobile-navigation');
  await user.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  const menu = screen.getByRole('navigation', { name: 'Mobile navigation' });
  expect(within(menu).getByRole('link', { name: 'Home' })).toHaveFocus();
  expect(document.body.style.overflow).toBe('hidden');
  await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(document.body.style.overflow).toBe('auto');
  await user.click(trigger);
  await user.click(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Shop' }));
  expect(screen.getByRole('heading', { name: 'Shop', level: 1 })).toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(document.body.style.overflow).toBe('auto');
});

it('validates newsletter locally, preserves invalid input and announces demo success', async () => {
  const user = userEvent.setup();
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  render(<App initialEntries={['/']} />);
  const email = screen.getByRole('textbox', { name: 'Email address' });
  await user.type(email, 'invalid@domain');
  fireEvent.submit(email.closest('form')!);
  expect(email).toHaveValue('invalid@domain');
  expect(email).toHaveAttribute('aria-invalid', 'true');
  expect(email).toHaveAccessibleDescription('Enter a valid email address.');
  await user.clear(email);
  await user.type(email, 'demo@example.com');
  await user.click(screen.getByRole('button', { name: 'Sign up' }));
  expect(email).toHaveValue('');
  expect(screen.getByRole('status')).toHaveTextContent('Demo signup complete — no email was sent.');
  expect(screen.getByText('Demo signup complete — no email was sent.', { selector: '.newsletter-message' })).toBeVisible();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(JSON.stringify(localStorage)).not.toContain('demo@example.com');
  expect(screen.queryByRole('link', { name: 'Instagram' })).not.toBeInTheDocument();
});
