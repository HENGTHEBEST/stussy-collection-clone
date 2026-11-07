import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { CustomCursor } from './CustomCursor';
import { HeroSection } from './HeroSection';

function capabilities(fine: boolean, reduced: boolean) {
  const queries = new Map<string, MediaQueryList>();
  vi.stubGlobal('matchMedia', (query: string) => {
    if (!queries.has(query)) queries.set(query, Object.assign(new EventTarget(), {
      matches: query === '(pointer: fine)' ? fine : reduced, media: query, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
    }) as MediaQueryList);
    return queries.get(query)!;
  });
  return queries;
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([[false, false], [true, true], [false, true]])('omits cursor when fine=%s and reduced=%s', (fine, reduced) => {
  capabilities(fine, reduced);
  const { container } = render(<CustomCursor />);
  expect(container).toBeEmptyDOMElement();
});

it('renders only a white-outline ring, throttles movement, and releases pending work on unmount', () => {
  capabilities(true, false);
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const flush = () => act(() => { const current = [...frames.values()]; frames.clear(); current.forEach((callback) => callback(0)); });
  const { container, unmount } = render(<CustomCursor />);
  expect(container.querySelector('.cursor-ring')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('.cursor-dot')).not.toBeInTheDocument();
  expect(container.querySelector('.cursor-trail')).not.toBeInTheDocument();
  fireEvent.pointerMove(window, { clientX: 10, clientY: 20 });
  fireEvent.pointerMove(window, { clientX: 30, clientY: 40 });
  expect(frames.size).toBe(1);
  flush();
  expect(container.querySelector('.cursor-ring')).toHaveStyle({ transform: 'translate3d(30px, 40px, 0)' });
  expect(container.querySelector('.custom-cursor')).toHaveClass('cursor-active');
  fireEvent.pointerMove(window, { clientX: 90, clientY: 100 });
  unmount();
  expect(frames.size).toBe(0);
  fireEvent.pointerMove(window, { clientX: 90, clientY: 100 });
  expect(frames.size).toBe(0);
});

it('removes cursor immediately when motion preference changes', () => {
  const queries = capabilities(true, false);
  const { container } = render(<CustomCursor />);
  expect(container.querySelector('.cursor-ring')).toBeInTheDocument();
  const reduced = queries.get('(prefers-reduced-motion: reduce)')!;
  act(() => { Object.defineProperty(reduced, 'matches', { value: true }); reduced.dispatchEvent(new Event('change')); });
  expect(container).toBeEmptyDOMElement();
});

it.each([[false, false], [true, true]])('keeps hero still when fine=%s and reduced=%s', (fine, reduced) => {
  capabilities(fine, reduced);
  const { container } = render(<HeroSection />);
  fireEvent.pointerMove(container.querySelector('#hero')!, { clientX: 900, clientY: 700 });
  expect(container.querySelector('.hero-images')).not.toHaveAttribute('style');
});

it('caps and throttles hero parallax, then cancels work and listeners on unmount', () => {
  capabilities(true, false);
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const { container, unmount } = render(<HeroSection />);
  const hero = container.querySelector('#hero')!;
  const images = container.querySelector('.hero-images')!;
  // MouseEvent carries coordinates in jsdom, which has no native PointerEvent.
  hero.dispatchEvent(new MouseEvent('pointermove', { clientX: 10000, clientY: 10000 }));
  hero.dispatchEvent(new MouseEvent('pointermove', { clientX: 20000, clientY: 20000 }));
  expect(frames.size).toBe(1);
  act(() => { const current = [...frames.values()]; frames.clear(); current.forEach((callback) => callback(0)); });
  expect(images).toHaveStyle({ transform: 'translate3d(12px, 8px, 0) scale(1.04)' });
  hero.dispatchEvent(new MouseEvent('pointermove', { clientX: -10000, clientY: -10000 }));
  unmount();
  expect(frames.size).toBe(0);
  expect(images).not.toHaveAttribute('style');
  hero.dispatchEvent(new MouseEvent('pointermove', { clientX: 10000, clientY: 10000 }));
  expect(frames.size).toBe(0);
});
