import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { App } from './App';
import { CART_STORAGE_KEY, WISHLIST_STORAGE_KEY } from '../lib/storage';
import { AppErrorBoundary } from './AppErrorBoundary';
import { products } from '../data/products';
import { ApiError, getOrder } from '../lib/api';
import type { PublicOrder } from '../../shared/commerce';

vi.mock('../lib/api', async (importOriginal) => ({ ...await importOriginal<typeof import('../lib/api')>(), getOrder: vi.fn() }));

beforeEach(() => { vi.mocked(getOrder).mockReset().mockRejectedValue(new ApiError('Unknown order', 404)); localStorage.clear(); vi.stubGlobal('scrollTo', vi.fn()); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.style.overflow = ''; });

it('composes the complete showcase with local media and all thirteen product actions in catalog order', () => {
  render(<App initialEntries={['/']} />);
  for (const name of ['Summer Classics', 'The Lookbook', 'Escape', 'The Motifs', 'Born on the Board']) {
    expect(screen.getByRole('heading', { name })).toBeVisible();
  }
  const sections = ['hero', 'collection', 'escape', 'motifs', 'about', 'contact'];
  expect([...document.querySelectorAll('section[id], footer[id]')].map((node) => node.id)).toEqual(sections);
  expect(screen.getAllByRole('contentinfo')).toHaveLength(1);
  const cards = within(document.getElementById('collection')!).getAllByRole('link');
  expect(cards).toHaveLength(13);
  expect(cards.map((card) => card.getAttribute('href'))).toEqual(products.map((product) => `/product/${product.slug}`));
  for (const [index, product] of products.entries()) {
    expect(cards[index]).toHaveAccessibleName(new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    expect(cards[index]).toHaveTextContent(product.label);
    expect(cards[index]).toHaveTextContent(product.description);
    expect(within(cards[index]).getByRole('img')).toHaveAttribute('src', product.image);
  }
  const images = [...document.querySelectorAll('main img')];
  const hero = within(document.getElementById('hero')!);
  expect(hero.getByRole('img', { name: 'Man wearing a white Stussy script logo tee' })).toHaveAttribute('src', '/assets/hero-man.jpg');
  expect(hero.getByRole('img', { name: 'Woman wearing a black Stussy tee' })).toHaveAttribute('src', '/assets/hero-woman.jpg');
  expect(images.every((image) => image.getAttribute('src')?.startsWith('/assets/'))).toBe(true);
  for (const path of ['hero-man.jpg', 'hero-woman.jpg', 'stussy-logo.png', 'manifesto.jpg', 'motif-dice.png', 'motif-8-ball.jpg', 'lookbook-8-ball-black.jpg']) {
    expect(document.querySelector(`main img[src="/assets/${path}"]`)).toBeInTheDocument();
  }
  for (const year of ['1980', '1991', '2001', '2026']) expect(within(document.getElementById('about')!).getByText(year)).toBeVisible();
  expect(screen.getByText('04 — ABOUT US')).toBeVisible();
  expect(screen.getByText('04 — GRAPHIC HERITAGE')).toBeVisible();
});

it.each([
  ['/', 'Summer Classics'], ['/shop', 'Shop'], ['/cart', 'Cart'],
  ['/wishlist', 'Wishlist'], ['/product/8-ball', 'Product not found'],
  ['/checkout', 'Cart'],
  ['/missing', 'Page not found'],
])('renders the registered %s route', (path, heading) => {
  render(<App initialEntries={[path]} />);
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
});


it('loads a server order directly at its registered route without local storage', async () => {
  vi.mocked(getOrder).mockResolvedValue({
    id: 'direct-order', status: 'paid', createdAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z',
    merchantName: 'Stussy Collection',
    deliveryLabel: 'Standard delivery', currency: 'USD', subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800,
    lines: [{ productId: 1, slug: 'snapshot-tee', name: 'Server snapshot tee', image: '/snapshot.png', size: 'M', color: 'Black', quantity: 2, unitPriceMinor: 4800 }],
    payment: { status: 'paid', qrDataUrl: '', expiresAt: '2026-11-09T00:15:00.000Z', providerReference: 'mock-direct' }, mockMode: true,
  } satisfies PublicOrder);
  render(<App initialEntries={['/order/direct-order']} />);
  expect(await screen.findByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  expect(screen.getByText('Server snapshot tee')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Payment Summary' })).getByText('$108.00')).toBeVisible();
  expect(getOrder).toHaveBeenCalledWith('direct-order', expect.any(AbortSignal));
});

it('shows recovery when a direct order route returns 404', async () => {
  render(<App initialEntries={['/order/missing-order']} />);
  expect(await screen.findByRole('heading', { name: 'Order not available' })).toBeVisible();
});

it.each(['/shop', '/wishlist', '/product/8-ball-tee-black', '/missing', '/#missing', '/#%E0%A4%A'])('focuses the destination heading without a usable hash at %s', async (path) => {
  render(<App initialEntries={[path]} />);
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
});

it('keeps search focus during query-only navigation', async () => {
  render(<App initialEntries={['/shop']} />);
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveFocus());
  const search = screen.getByRole('searchbox');
  await userEvent.type(search, '8-ball');
  expect(search).toHaveFocus();
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveAttribute('tabindex');
});

it('recovers every meaningful showcase image and hides decorative branding', () => {
  render(<App initialEntries={['/']} />);
  const images = [...document.querySelectorAll<HTMLImageElement>('main img')];
  for (const image of images) {
    if (image.src.endsWith('stussy-logo.png')) {
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveAttribute('aria-hidden', 'true');
    } else {
      const alt = image.alt;
      fireEvent.error(image);
      expect(screen.getAllByRole('img', { name: `${alt} image unavailable` }).length).toBeGreaterThan(0);
      expect(image).not.toBeInTheDocument();
    }
  }
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

it('hides the header only while scrolling down and keeps the footer logo decorative', async () => {
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  render(<App initialEntries={['/']} />);
  const header = document.querySelector<HTMLElement>('header.site-header')!;
  expect(header).not.toHaveClass('is-hidden');
  await act(async () => { window.scrollY = 120; fireEvent.scroll(window); });
  expect(header).toHaveClass('is-hidden');
  await act(async () => { window.scrollY = 40; fireEvent.scroll(window); });
  expect(header).not.toHaveClass('is-hidden');
  expect(document.querySelector('footer .footer-watermark')).toHaveAttribute('aria-hidden', 'true');
});

it('removes the unofficial demo badge while retaining an honest independent showcase label', () => {
  render(<App initialEntries={['/']} />);
  expect(screen.queryAllByText(/unofficial demo store/i)).toHaveLength(0);
  expect(screen.getByText('Independent collection showcase')).toBeVisible();
});

it('focuses a home hash target after cross-route navigation', async () => {
  const user = userEvent.setup();
  render(<App initialEntries={['/shop']} />);
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Contact' }));
  await waitFor(() => expect(screen.getByRole('contentinfo')).toHaveFocus());
  expect(screen.getByRole('heading', { name: 'Summer Classics' })).toBeInTheDocument();
});

it('closes the menu and focuses destination headings on Back and Forward', async () => {
  window.history.replaceState(null, '', '/shop');
  window.history.pushState(null, '', '/cart');
  const user = userEvent.setup();
  render(<App />);
  const trigger = screen.getByRole('button', { name: 'Menu' });
  await user.click(trigger);
  expect(within(screen.getByRole('navigation', { name: 'Mobile navigation' })).getByRole('link', { name: 'Home' })).toHaveFocus();
  await act(async () => {
    const changed = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
    window.history.back();
    await changed;
  });
  expect(screen.getByRole('heading', { name: 'Shop', level: 1 })).toBeInTheDocument();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Shop', level: 1 })).toHaveFocus());
  await act(async () => {
    const changed = new Promise<void>((resolve) => window.addEventListener('popstate', () => resolve(), { once: true }));
    window.history.forward();
    await changed;
  });
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Cart', level: 1 })).toHaveFocus());
  window.history.replaceState(null, '', '/');
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
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Shop', level: 1 })).toHaveFocus());
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
