import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { RunwaySection } from './RunwaySection';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('wraps look navigation and keeps the matching clothing panel without shopping controls', () => {
  render(<RunwaySection />);
  const panel = screen.getByRole('complementary', { name: 'Clothing in this look' });
  expect(within(panel).getByText('Air Jordan 12 Retro')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Previous look' }));
  expect(screen.getByRole('button', { name: 'Look 6: Studio Day' })).toHaveAttribute('aria-current', 'true');
  expect(within(panel).getByText('Luka 5')).toBeVisible();
  fireEvent.keyDown(screen.getByRole('region', { name: /use arrow keys/i }), { key: 'ArrowRight' });
  expect(screen.getByRole('button', { name: 'Look 1: The City Edit' })).toHaveAttribute('aria-current', 'true');
  expect(screen.queryByRole('button', { name: /add.*bag/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('radio')).not.toBeInTheDocument();
});

it('supports preview pins, stops autoplay, and restores focus when the preview closes', () => {
  render(<RunwaySection />);
  fireEvent.click(screen.getByRole('button', { name: 'View look: The City Edit' }));
  const preview = screen.getByRole('region', { name: 'View look' });
  fireEvent.click(within(preview).getByRole('button', { name: '2: Tshirt' }));
  expect(screen.getByRole('complementary').querySelector('.is-hot')).toHaveTextContent('Tshirt');
  expect(screen.getByRole('button', { name: /autoplay/i })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.keyDown(preview, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'View look' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: /use arrow keys/i })).toHaveFocus();
});

it('advances every five seconds and respects pause and reduced motion', () => {
  vi.useFakeTimers();
  const { unmount } = render(<RunwaySection />);
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole('button', { name: 'Look 2: Gallery Opening' })).toHaveAttribute('aria-current', 'true');
  fireEvent.click(screen.getByRole('button', { name: /autoplay/i }));
  act(() => { vi.advanceTimersByTime(10000); });
  expect(screen.getByRole('button', { name: 'Look 2: Gallery Opening' })).toHaveAttribute('aria-current', 'true');
  unmount();
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<RunwaySection />);
  act(() => { vi.advanceTimersByTime(10000); });
  expect(screen.getByRole('button', { name: 'Look 1: The City Edit' })).toHaveAttribute('aria-current', 'true');
});

it('holds autoplay offscreen and cleans up the observer and timer', () => {
  vi.useFakeTimers();
  let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof notify) { notify = callback; }
    observe() {}
    disconnect = disconnect;
  });
  const { unmount } = render(<RunwaySection />);
  act(() => { vi.advanceTimersByTime(10000); });
  expect(screen.getByRole('button', { name: 'Look 1: The City Edit' })).toHaveAttribute('aria-current', 'true');
  act(() => { notify([{ isIntersecting: true }]); });
  act(() => { vi.advanceTimersByTime(5000); });
  expect(screen.getByRole('button', { name: 'Look 2: Gallery Opening' })).toHaveAttribute('aria-current', 'true');
  act(() => { notify([{ isIntersecting: false }]); });
  act(() => { vi.advanceTimersByTime(10000); });
  expect(screen.getByRole('button', { name: 'Look 2: Gallery Opening' })).toHaveAttribute('aria-current', 'true');
  unmount();
  expect(disconnect).toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('provides a fallback if a preview model cannot load', () => {
  render(<RunwaySection />);
  fireEvent.click(screen.getByRole('button', { name: 'View look: The City Edit' }));
  const preview = screen.getByRole('region', { name: 'View look' });
  fireEvent.error(within(preview).getByRole('img', { name: 'The City Edit' }));
  expect(within(preview).getByRole('img', { name: 'The City Edit image unavailable' })).toBeVisible();
});
