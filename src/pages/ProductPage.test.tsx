import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProductPage } from './ProductPage';
import { CartProvider, useCart } from '../state/CartProvider';
import { WishlistProvider } from '../state/WishlistProvider';
import { FeedbackProvider } from '../state/FeedbackProvider';
import { CART_STORAGE_KEY, WISHLIST_STORAGE_KEY } from '../lib/storage';

beforeEach(() => localStorage.clear());
afterEach(cleanup);
function Count() { return <span aria-label="Cart count">{useCart().itemCount}</span>; }
function setup(slug = '8-ball-tee-black') { return render(<MemoryRouter initialEntries={['/product/' + slug]}><FeedbackProvider><WishlistProvider><CartProvider><Routes><Route path="/product/:slug" element={<ProductPage />} /></Routes><Count /></CartProvider></WishlistProvider></FeedbackProvider></MemoryRouter>); }

it('requires a size with associated error and focus, then adds the selected variant and quantity', async () => {
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
  const sizes = screen.getByRole('radiogroup', { name: 'Size' });
  expect(sizes).toHaveFocus(); expect(sizes).toHaveAccessibleDescription('Choose a size before adding to cart.');
  expect(screen.getByLabelText('Cart count')).toHaveTextContent('0');
  await userEvent.click(screen.getByRole('radio', { name: /^M$/ }));
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  await userEvent.click(screen.getByRole('button', { name: 'Add to cart' }));
  expect(screen.getByLabelText('Cart count')).toHaveTextContent('2');
  expect(screen.getByRole('status')).toHaveTextContent('Added 2');
  expect(screen.getByText(/Added 2/, { selector: '.product-feedback' })).toBeVisible();
  expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)!).value.lines).toEqual([{ productId: 1, size: 'M', color: 'Black', quantity: 2, unitPrice: 48 }]);
});

it('clamps numeric input and step controls to quantities 1 through 10', async () => {
  setup(); const quantity = screen.getByLabelText('Quantity');
  await userEvent.click(screen.getByRole('button', { name: 'Decrease quantity' })); expect(quantity).toHaveValue(1);
  fireEvent.change(quantity, { target: { value: '99' } }); expect(quantity).toHaveValue(10);
  await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' })); expect(quantity).toHaveValue(10);
  fireEvent.change(quantity, { target: { value: '-5' } }); expect(quantity).toHaveValue(1);
  fireEvent.change(quantity, { target: { value: '2.8' } }); expect(quantity).toHaveValue(2);
  fireEvent.change(quantity, { target: { value: '' } }); expect(quantity).toHaveValue(1);
});

it('persists and announces wishlist toggles with pressed state', async () => {
  const view = setup();
  await userEvent.click(screen.getByRole('button', { name: 'Save 8-Ball Tee — Black to wishlist' }));
  expect(screen.getByRole('button', { name: 'Remove 8-Ball Tee — Black from wishlist' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Added to wishlist');
  expect(JSON.parse(localStorage.getItem(WISHLIST_STORAGE_KEY)!).value).toContain(1);
  view.unmount(); setup();
  await userEvent.click(screen.getByRole('button', { name: 'Remove 8-Ball Tee — Black from wishlist' }));
  expect(screen.getByRole('status')).toHaveTextContent('Removed from wishlist');
});

it('uses observed copy and local media, marks demo details, and excludes current product from related cards', () => {
  setup();
  expect(screen.getByRole('heading', { level: 1, name: '8-Ball Tee — Black' })).toBeVisible();
  expect(screen.getByText('Heavyweight cotton. Iconic 8-ball chest graphic. Unisex cut.')).toBeVisible();
  expect(screen.getByAltText('8-Ball Tee — Black')).toHaveAttribute('src', '/assets/lookbook-8-ball-black.jpg');
  expect(within(screen.getByRole('region', { name: 'Product details' })).getByText('Demo price: $48.00')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Product details' })).getByText('Demo availability: Available')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Demo features' })).toBeVisible();
  expect(within(screen.getByRole('radiogroup', { name: 'Color' })).getAllByRole('radio')).toHaveLength(1);
  expect(screen.getByRole('radio', { name: 'Black' })).toBeChecked();
  const related = screen.getByRole('region', { name: 'Related products' });
  expect(within(related).getAllByRole('article')).toHaveLength(3);
  expect(within(related).queryByRole('link', { name: '8-Ball Tee — Black' })).not.toBeInTheDocument();
});

it('prevents unavailable product additions', async () => {
  setup('dsm-new-york-crop-black');
  expect(within(screen.getByRole('region', { name: 'Product details' })).getByText('Demo availability: Unavailable')).toBeVisible();
  const add = screen.getByRole('button', { name: 'Unavailable' }); expect(add).toBeDisabled();
  await userEvent.click(add); expect(screen.getByLabelText('Cart count')).toHaveTextContent('0');
});

it('recovers from an unknown product slug', () => {
  setup('unknown');
  expect(screen.getByRole('heading', { name: 'Product not found' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Explore shop' })).toHaveAttribute('href', '/shop');
  expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
});
