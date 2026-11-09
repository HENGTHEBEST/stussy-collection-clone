import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PublicOrder } from '../../shared/commerce';
import { ApiError, getOrder, simulateMockPayment } from '../lib/api';
import { OrderPage } from './OrderPage';

vi.mock('../lib/api', async (importOriginal) => ({ ...await importOriginal<typeof import('../lib/api')>(), getOrder: vi.fn(), simulateMockPayment: vi.fn() }));
const order: PublicOrder = {
  id: 'order-1', status: 'awaiting_payment', createdAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z',
  deliveryLabel: 'Standard delivery', currency: 'USD', subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800,
  lines: [{ productId: 1, slug: 'snapshot-tee', name: 'Server snapshot tee', image: '/snapshot.png', size: 'M', color: 'Black', quantity: 2, unitPriceMinor: 4800 }],
  payment: { status: 'pending', qrDataUrl: 'data:image/png;base64,AAAA', expiresAt: '2026-11-09T00:15:00.000Z', providerReference: 'mock-1' }, mockMode: true,
};
const paid: PublicOrder = { ...order, status: 'paid', payment: { ...order.payment, status: 'paid' } };
const get = vi.mocked(getOrder);
const simulate = vi.mocked(simulateMockPayment);
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function settle() { await act(async () => {}); }
function NextOrder() { const navigate = useNavigate(); return <button onClick={() => navigate('/order/order-2')}>Next order</button>; }
function show(seed?: PublicOrder) {
  return render(<MemoryRouter initialEntries={[{ pathname: '/order/order-1', state: seed ? { order: seed } : null }]}>
    <NextOrder /><Routes><Route path="/order/:orderId" element={<OrderPage />} /></Routes>
  </MemoryRouter>);
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-09T00:00:00.000Z')); get.mockReset().mockResolvedValue(order); simulate.mockReset().mockResolvedValue(paid); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('renders a matching navigation seed immediately and replaces it with the API snapshot', async () => {
  const response = deferred<PublicOrder>(); get.mockReturnValue(response.promise);
  show(order);
  expect(screen.getByText('Server snapshot tee')).toBeVisible();
  expect(get).toHaveBeenCalledWith('order-1', expect.any(AbortSignal));
  await act(async () => response.resolve({ ...paid, lines: [{ ...paid.lines[0], name: 'Refreshed snapshot tee' }] }));
  expect(screen.getByText('Refreshed snapshot tee')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
});

it('loads a direct route without local storage and renders exact server totals and QR', async () => {
  show(); expect(screen.getByRole('heading', { name: 'Loading order' })).toBeVisible(); await settle();
  expect(screen.getByText('Simulation only - no money will move')).toBeVisible();
  expect(screen.getByRole('img', { name: 'Simulated Bakong KHQR payment code' })).toHaveAttribute('src', order.payment.qrDataUrl);
  expect(screen.getByText('$108.00')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Payment status' })).getByText('Amount due: $108.00')).toBeVisible();
  expect(screen.getByText('USD')).toBeVisible();
  expect(screen.getByText('Time remaining: 15:00')).toBeVisible();
  expect(screen.getByText('Unit price: $48.00')).toBeVisible();
  expect(screen.getByText('Line total: $96.00')).toBeVisible();
  expect(document.querySelector('time[datetime="2026-11-09T00:15:00.000Z"]')).toBeInTheDocument();
});

it('polls every five seconds while pending and stops after the server confirms payment', async () => {
  get.mockResolvedValueOnce(order).mockResolvedValueOnce(order).mockResolvedValueOnce(paid);
  show(); await settle();
  await act(async () => vi.advanceTimersByTimeAsync(4999)); expect(get).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1)); expect(get).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(5000)); expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
  expect(screen.queryByRole('img', { name: 'Simulated Bakong KHQR payment code' })).not.toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(15000)); expect(get).toHaveBeenCalledTimes(3); expect(vi.getTimerCount()).toBe(0);
});

it('prevents overlapping polls while an earlier status request is pending', async () => {
  const response = deferred<PublicOrder>(); get.mockResolvedValueOnce(order).mockReturnValue(response.promise);
  show(); await settle(); await act(async () => vi.advanceTimersByTimeAsync(15000));
  expect(get).toHaveBeenCalledTimes(2);
  await act(async () => response.resolve(paid)); expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
});

it('submits one simulation request and announces the paid confirmation', async () => {
  const response = deferred<PublicOrder>(); simulate.mockReturnValue(response.promise);
  show(); await settle();
  const button = screen.getByRole('button', { name: 'Simulate successful payment' });
  act(() => { fireEvent.click(button); fireEvent.click(button); });
  expect(simulate).toHaveBeenCalledExactlyOnceWith('order-1'); expect(button).toBeDisabled();
  await act(async () => response.resolve(paid));
  expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
  expect(screen.getByRole('heading', { name: 'Order confirmation' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Simulate successful payment' })).not.toBeInTheDocument();
});

it('ignores an old polling result after simulation has confirmed payment', async () => {
  const response = deferred<PublicOrder>(); get.mockResolvedValueOnce(order).mockReturnValue(response.promise);
  show(); await settle(); await act(async () => vi.advanceTimersByTimeAsync(5000));
  fireEvent.click(screen.getByRole('button', { name: 'Simulate successful payment' })); await settle();
  await act(async () => response.resolve(order)); expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
});

it.each(['expired', 'failed', 'cancelled'] as const)('offers recovery for %s orders without payment confirmation', async (status) => {
  get.mockResolvedValue({ ...order, status }); show(); await settle();
  expect(screen.getByRole('heading', { name: 'Order ' + status })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Return to checkout' })).toHaveAttribute('href', '/checkout');
  expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/shop');
  expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Simulated Bakong KHQR payment code' })).not.toBeInTheDocument();
  await act(async () => vi.advanceTimersByTimeAsync(10000)); expect(get).toHaveBeenCalledTimes(1);
});

it('counts down each second but waits for server expiration before changing status', async () => {
  get.mockResolvedValue({ ...order, payment: { ...order.payment, expiresAt: '2026-11-09T00:00:02.000Z' } });
  show(); await settle(); expect(screen.getByText('Time remaining: 0:02')).toBeVisible();
  await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(screen.getByText('Time remaining: 0:01')).toBeVisible();
  await act(async () => vi.advanceTimersByTimeAsync(1000)); expect(screen.getByText('Time remaining: 0:00')).toBeVisible();
  expect(screen.getByText(/waiting for the shop to confirm expiration/i)).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Awaiting payment' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Simulate successful payment' })).toBeDisabled();
});

it('does not show a simulation control for a non-mock order', async () => {
  get.mockResolvedValue({ ...order, mockMode: false }); show(); await settle();
  expect(screen.queryByRole('button', { name: 'Simulate successful payment' })).not.toBeInTheDocument();
  expect(screen.queryByText('Simulation only - no money will move')).not.toBeInTheDocument();
});

it('renders not-found for a 404 response', async () => {
  get.mockRejectedValue(new ApiError('Unknown order', 404)); show(); await settle();
  expect(screen.getByRole('heading', { name: 'Order not available' })).toBeVisible();
  expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
});

it('offers retry on connection failure without marking payment failed', async () => {
  get.mockRejectedValueOnce(new ApiError('private transport detail', 0)); show(); await settle();
  expect(screen.getByRole('alert')).toHaveTextContent('Unable to refresh this order. Please try again.');
  expect(screen.queryByText(/failed|private transport detail/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await settle();
  expect(screen.getByRole('heading', { name: 'Awaiting payment' })).toBeVisible();
  expect(get).toHaveBeenCalledTimes(2);
});

it('retains pending details after a poll error and retries through the API', async () => {
  get.mockResolvedValueOnce(order).mockRejectedValueOnce(new ApiError('Unavailable', 503)).mockResolvedValueOnce(paid);
  show(); await settle(); await act(async () => vi.advanceTimersByTimeAsync(5000));
  expect(screen.getByRole('alert')).toBeVisible(); expect(screen.getByText('Server snapshot tee')).toBeVisible();
  expect(screen.queryByText('Payment failed')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' })); await settle(); expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
});

it('recovers from a simulation connection failure without claiming a failed payment', async () => {
  simulate.mockRejectedValue(new ApiError('Unavailable', 503)); show(); await settle();
  fireEvent.click(screen.getByRole('button', { name: 'Simulate successful payment' })); await settle();
  expect(screen.getByRole('alert')).toBeVisible(); expect(screen.queryByText('Payment confirmed')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
});

it('ignores AbortError without displaying a connection error', async () => {
  get.mockRejectedValue(new DOMException('Cancelled', 'AbortError')); show(order); await settle();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument(); expect(screen.getByText('Server snapshot tee')).toBeVisible();
});

it('aborts active requests and clears timers on unmount', async () => {
  const response = deferred<PublicOrder>(); get.mockResolvedValueOnce(order).mockReturnValue(response.promise);
  const page = show(); await settle(); await act(async () => vi.advanceTimersByTimeAsync(5000));
  const signal = get.mock.calls[1][1]!; page.unmount();
  expect(signal.aborted).toBe(true); expect(vi.getTimerCount()).toBe(0);
  await act(async () => response.reject(new DOMException('Cancelled', 'AbortError')));
});

it('clears the previous order on route changes and ignores its late response', async () => {
  const old = deferred<PublicOrder>(); const next = deferred<PublicOrder>(); get.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  show(order); fireEvent.click(screen.getByRole('button', { name: 'Next order' }));
  expect(screen.queryByText('Server snapshot tee')).not.toBeInTheDocument();
  expect(get.mock.calls[0][1]!.aborted).toBe(true);
  await act(async () => next.resolve({ ...paid, id: 'order-2', lines: [{ ...paid.lines[0], name: 'Second order tee' }] }));
  await act(async () => old.resolve(order));
  expect(screen.getByText('Second order tee')).toBeVisible(); expect(screen.getByRole('status')).toHaveTextContent('Payment confirmed');
});
