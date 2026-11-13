import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, vi } from 'vitest';
import { BrowserRouter, MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ShopPage } from './ShopPage';
import { WishlistProvider } from '../state/WishlistProvider';
import { FeedbackProvider } from '../state/FeedbackProvider';

let media: MediaQueryList;
let change: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  media = { matches: false, addEventListener: (_: string, callback: () => void) => { change = callback; }, removeEventListener: () => {} } as unknown as MediaQueryList;
  vi.stubGlobal('matchMedia', () => media);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.body.style.overflow = ''; });
function Location() {
  const location = useLocation(); const navigate = useNavigate();
  return <><output aria-label="Location">{location.pathname}{location.search}</output><button onClick={() => navigate('/shop?q=missing')}>Other search</button><button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button></>;
}
function Page() { return <FeedbackProvider><WishlistProvider><ShopPage /><Location /></WishlistProvider></FeedbackProvider>; }
function setup(path = '/shop') { return render(<MemoryRouter initialEntries={[path]}><Page /></MemoryRouter>); }

it('derives supported filters from URL, clears all, and writes Natural while preserving search and sort', async () => {
  setup('/shop?q=8-ball&color=Black&sort=name-asc');
  expect(screen.getByLabelText('Search products')).toHaveValue('8-ball');
  expect(screen.getByLabelText('Black')).toBeChecked();
  expect(screen.getByLabelText('Sort products')).toHaveValue('name-asc');
  expect(screen.getByLabelText('Product results')).toHaveTextContent('1 product');
  expect(screen.getByRole('link', { name: '8-Ball Tee — Black' })).toHaveAttribute('href', '/product/8-ball-tee-black');
  await userEvent.click(screen.getByLabelText('Natural'));
  expect(screen.getByLabelText('Location')).toHaveTextContent('q=8-ball&color=Black&color=Natural&sort=name-asc');
  await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(screen.getByLabelText('Product results')).toHaveTextContent('13 products');
  expect(screen.getByLabelText('Location')).toHaveTextContent(/^\/shop$/);
  await userEvent.click(screen.getByLabelText('Natural'));
  expect(screen.getByLabelText('Location')).toHaveTextContent('color=Natural');
});

it('drops unsupported query values on updates, preserves valid filter families, and offers empty recovery', async () => {
  setup('/shop?q=missing&category=T-Shirts&category=invalid&color=Black&color=Red&size=M&size=XXL&available=1&sort=invalid&bad=1');
  expect(screen.getByLabelText('Sort products')).toHaveValue('featured');
  expect(screen.getByRole('heading', { name: 'No products found' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Sort products'), { target: { value: 'price-desc' } });
  const location = screen.getByLabelText('Location').textContent!;
  expect(location).toContain('category=T-Shirts'); expect(location).toContain('color=Black');
  expect(location).toContain('size=M'); expect(location).toContain('available=1');
  expect(location).not.toMatch(/invalid|Red|XXL|bad=/);
  await userEvent.click(within(screen.getByLabelText('Empty results')).getByRole('button', { name: 'Clear all' }));
  expect(screen.getByLabelText('Product results')).toHaveTextContent('13 products');
});

it('restores controls and results from Back and Forward navigation', async () => {
  setup('/shop?q=8-ball&color=Black');
  await userEvent.click(screen.getByRole('button', { name: 'Other search' }));
  expect(screen.getByLabelText('Search products')).toHaveValue('missing');
  await userEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Search products')).toHaveValue('8-ball');
  expect(screen.getByLabelText('Black')).toBeChecked();
  await userEvent.click(screen.getByRole('button', { name: 'Forward' }));
  expect(screen.getByLabelText('Product results')).toHaveTextContent('0 products');
});

it('replaces filter history rather than adding a history entry', async () => {
  window.history.replaceState(null, '', '/shop');
  const initialLength = window.history.length;
  render(<BrowserRouter><Page /></BrowserRouter>);
  await userEvent.click(screen.getByLabelText('Natural'));
  expect(window.location.search).toBe('?color=Natural');
  expect(window.history.length).toBe(initialLength);
  window.history.replaceState(null, '', '/');
});

it('renders a single mobile drawer, traps focus, restores scrolling and focus, and responds to mode changes', async () => {
  Object.defineProperty(media, 'matches', { value: true, configurable: true });
  document.body.style.overflow = 'auto';
  const view = setup();
  expect(screen.queryByLabelText('Black')).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Filters' });
  await userEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Product filters' });
  const close = within(dialog).getByRole('button', { name: 'Close filters' });
  expect(close).toHaveFocus(); expect(document.body.style.overflow).toBe('hidden');
  await userEvent.tab({ shift: true }); expect(within(dialog).getByRole('button', { name: 'Apply filters' })).toHaveFocus();
  await userEvent.tab(); expect(close).toHaveFocus();
  await userEvent.click(screen.getByLabelText('Natural'));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Clear all' }));
  expect(screen.getByLabelText('Natural')).not.toBeChecked();
  await userEvent.keyboard('{Escape}'); expect(trigger).toHaveFocus(); expect(document.body.style.overflow).toBe('auto');
  await userEvent.click(trigger); await userEvent.click(screen.getByRole('button', { name: 'Apply filters' })); expect(trigger).toHaveFocus();
  await userEvent.click(trigger); await userEvent.click(screen.getByRole('button', { name: 'Close filters' })); expect(trigger).toHaveFocus();
  await userEvent.click(trigger);
  act(() => { Object.defineProperty(media, 'matches', { value: false }); change?.(); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(screen.getAllByLabelText('Black')).toHaveLength(1);
  expect(document.body.style.overflow).toBe('auto');
  act(() => { Object.defineProperty(media, 'matches', { value: true }); change?.(); });
  await userEvent.click(screen.getByRole('button', { name: 'Filters' })); view.unmount();
  expect(document.body.style.overflow).toBe('auto');
});
