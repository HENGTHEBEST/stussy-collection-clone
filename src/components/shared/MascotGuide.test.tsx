import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MascotGuide } from './MascotGuide';

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('opens and closes without changing the page or losing an unfinished question', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return <><input aria-label="Checkout name" defaultValue="Alex" /><MascotGuide pathname="/checkout" open={open} onOpenChange={setOpen} /></>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Open store guide' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask the store guide' }), { target: { value: 'How do I pay?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Close store guide' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open store guide' }));
  expect(screen.getByRole('textbox', { name: 'Ask the store guide' })).toHaveValue('How do I pay?');
  expect(screen.getByRole('textbox', { name: 'Checkout name' })).toHaveValue('Alex');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: 'Store guide' })).not.toBeInTheDocument();
});

it('changes idle expression around two seconds and pauses when offscreen', () => {
  vi.useFakeTimers();
  const { container } = render(<MascotGuide pathname="/shop" open={false} onOpenChange={() => {}} />);
  const sprite = container.querySelector('.mascot-sprite');
  expect(sprite).toHaveAttribute('data-expression', 'idle');
  act(() => vi.advanceTimersByTime(2100));
  expect(sprite).not.toHaveAttribute('data-expression', 'idle');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  fireEvent(document, new Event('visibilitychange'));
  const current = sprite?.getAttribute('data-expression');
  act(() => vi.advanceTimersByTime(4000));
  expect(sprite).toHaveAttribute('data-expression', current);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

it('stops cycling when the button leaves the viewport', () => {
  vi.useFakeTimers();
  let notify: IntersectionObserverCallback = () => {};
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe() {} disconnect() {}
  });
  const { container } = render(<MascotGuide pathname="/shop" open={false} onOpenChange={() => {}} />);
  const sprite = container.querySelector('.mascot-sprite');
  act(() => notify([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
  act(() => vi.advanceTimersByTime(4200));
  expect(sprite).toHaveAttribute('data-expression', 'idle');
});

it('keeps one expression when reduced motion is requested', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  const { container } = render(<MascotGuide pathname="/shop" open={false} onOpenChange={() => {}} />);
  act(() => vi.advanceTimersByTime(4200));
  expect(container.querySelector('.mascot-sprite')).toHaveAttribute('data-expression', 'idle');
});

it('looks thoughtful while answering and happy after a grounded answer', async () => {
  vi.useFakeTimers();
  const { container } = render(<MascotGuide pathname="/shop" open onOpenChange={() => {}} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Ask the store guide' }), { target: { value: 'How do I search?' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
  expect(container.querySelector('.mascot-sprite')).toHaveAttribute('data-expression', 'thoughtful');
  await act(async () => { await vi.advanceTimersByTimeAsync(350); });
  expect(container.querySelector('.mascot-sprite')).toHaveAttribute('data-expression', 'happy');
  expect(screen.getByText(/Open Shop to search products/)).toBeVisible();
});
