import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CartProvider } from '../state/CartProvider';
import { WishlistProvider } from '../state/WishlistProvider';
import { FeedbackProvider } from '../state/FeedbackProvider';
import { CART_STORAGE_KEY, WISHLIST_STORAGE_KEY } from '../lib/storage';
import type { CartLine } from '../state/cartReducer';
import { CartPage } from './CartPage';
import { WishlistPage } from './WishlistPage';
import { calculateTotals, OrderSummary } from '../components/commerce/OrderSummary';
import { products } from '../data/products';

const line: CartLine = { productId: 1, color: 'Black', size: 'M', quantity: 1, unitPrice: 48 };
beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); document.body.style.overflow = ''; });
function setup(lines: CartLine[] = [line], wishlist = false) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ version: 1, value: { lines } }));
  return render(<MemoryRouter><FeedbackProvider><WishlistProvider><CartProvider>{wishlist ? <WishlistPage /> : <CartPage />}<Location /></CartProvider></WishlistProvider></FeedbackProvider></MemoryRouter>);
}
function Location() { return <span aria-label="Current path">{useLocation().pathname}</span>; }

it('preserves selection when quantities change and only removes selected items after confirmation', async () => {
  setup([line, { ...line, size: 'L', quantity: 2 }]);
  const boxes = screen.getAllByRole('checkbox');
  fireEvent.click(boxes[2]);
  expect(boxes[0]).toBePartiallyChecked();
  fireEvent.change(screen.getAllByLabelText('Quantity')[0], { target: { value: '3' } });
  expect(screen.getAllByRole('checkbox')[2]).not.toBeChecked();
  expect(within(screen.getByRole('region', { name: 'Order summary' })).getByText('$156.00')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: 'Remove Selected' }));
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remove selected' }));
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([{ ...line, size: 'L', quantity: 2 }]);
  expect(screen.getByRole('button', { name: 'Proceed to checkout' })).toBeDisabled();
});

it('has no total or checkout action in the empty state', () => {
  setup([]);
  expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Order summary' })).not.toBeInTheDocument();
  expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/shop');
});

it.each([
  [[], { subtotal: 0, shipping: 0, total: 0 }],
  [[{ ...line, unitPrice: 149.99 }], { subtotal: 149.99, shipping: 12, total: 161.99 }],
  [[{ ...line, unitPrice: 150 }], { subtotal: 150, shipping: 0, total: 150 }],
  [[{ ...line, quantity: 2, unitPrice: 80 }], { subtotal: 160, shipping: 0, total: 160 }],
])('calculates exact demo shipping thresholds for %j', (lines, expected) => {
  expect(calculateTotals(lines as CartLine[])).toEqual(expected);
});

it('renders captured prices, local media, variant details and editable totals with accurate announcements', async () => {
  setup([{ ...line, unitPrice: 40 }]);
  expect(screen.getAllByRole('link', { name: products[0].name })[0]).toHaveAttribute('href', `/product/${products[0].slug}`);
  expect(screen.getByAltText(products[0].name)).toHaveAttribute('src', products[0].image);
  expect(screen.getByText('Black / M')).toBeVisible();
  expect(screen.getByText('Unit price: $40.00')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } });
  expect(screen.getByLabelText('Quantity')).toHaveValue(3);
  expect(screen.getByLabelText('Line total: $120.00')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent(`Updated ${products[0].name} (Black / M) to 3.`);
  expect(within(screen.getByRole('region', { name: 'Order summary' })).getByText('$132.00')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Proceed to checkout' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: `Remove ${products[0].name} (Black / M) from cart` }));
  expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent(`Removed ${products[0].name} (Black / M) from cart.`);
  expect(screen.queryByRole('link', { name: 'Proceed to checkout' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Checkout' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove Selected' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/shop');
});

it('formats fractional captured prices and disables empty summary checkout semantically', () => {
  const view = render(<MemoryRouter><OrderSummary lines={[{ ...line, quantity: 3, unitPrice: 0.1 }]} /></MemoryRouter>);
  expect(screen.getByText('$0.30')).toBeVisible();
  expect(screen.getByText('$12.30')).toBeVisible();
  expect(screen.getByText(/estimates only/i)).toBeVisible();
  expect(screen.getByRole('link', { name: 'Proceed to checkout' })).toHaveAttribute('href', '/checkout');
  view.rerender(<MemoryRouter><OrderSummary lines={[]} /></MemoryRouter>);
  expect(screen.getByText('Free')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled();
  expect(screen.queryByRole('link', { name: 'Checkout' })).not.toBeInTheDocument();
});

it('confirms clear with focus trapping, cancel, Escape, scroll restoration and focus return', async () => {
  document.body.style.overflow = 'auto';
  setup([line, { ...line, size: 'L', quantity: 2 }]);
  const user = userEvent.setup();
  const trigger = screen.getByRole('button', { name: 'Remove Selected' });
  await user.click(trigger);
  let dialog = screen.getByRole('dialog', { name: 'Remove selected items?' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  const cancel = within(dialog).getByRole('button', { name: 'Cancel' });
  const confirm = within(dialog).getByRole('button', { name: 'Remove selected' });
  expect(cancel).toHaveFocus(); expect(document.body.style.overflow).toBe('hidden');
  await user.tab({ shift: true }); expect(confirm).toHaveFocus();
  await user.tab(); expect(cancel).toHaveFocus();
  await user.click(cancel);
  expect(trigger).toHaveFocus(); expect(document.body.style.overflow).toBe('auto');
  expect(screen.getAllByLabelText('Quantity')).toHaveLength(2);
  await user.click(trigger); await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus(); expect(document.body.style.overflow).toBe('auto');
  await user.click(trigger); dialog = screen.getByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: 'Remove selected' }));
  expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveFocus(); expect(document.body.style.overflow).toBe('auto');
  expect(screen.getByRole('status')).toHaveTextContent('Removed 3 selected items.');
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([]);
  expect(trigger).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Remove selected' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Continue shopping' }));
  expect(screen.getByLabelText('Current path')).toHaveTextContent('/shop');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('restores scroll on dialog unmount', async () => {
  document.body.style.overflow = 'scroll'; const view = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Remove Selected' }));
  view.unmount(); expect(document.body.style.overflow).toBe('scroll');
});

it('identifies a cart product when its image fails', () => {
  setup();
  fireEvent.error(screen.getByAltText(products[0].name));
  expect(screen.getByRole('img', { name: `${products[0].name} image unavailable` })).toBeVisible();
});

it('renders persisted wishlist in saved order with separate card controls, removes and clears', async () => {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, value: [2, 1] }));
  setup([], true);
  expect(screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent)).toEqual([products[1].name, products[0].name]);
  const remove = screen.getByRole('button', { name: `Remove ${products[1].name} from wishlist` });
  expect(remove.closest('a')).toBeNull();
  await userEvent.click(remove);
  expect(screen.queryByRole('link', { name: products[1].name })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(`Removed from wishlist: ${products[1].name}`);
  await userEvent.click(screen.getByRole('button', { name: 'Clear wishlist' }));
  expect(screen.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Cleared wishlist: removed 1 product.');
  expect(screen.getByRole('link', { name: 'Explore shop' })).toHaveAttribute('href', '/shop');
  expect(JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)!).value).toEqual([]);
});

it('recovers from invalid persisted wishlist IDs without rendering missing products', () => {
  localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify({ version: 1, value: [1, 999] }));
  setup([], true);
  expect(screen.getByRole('heading', { name: 'Your wishlist is empty' })).toBeVisible();
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
});
