import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { SafeImage } from './SafeImage';

afterEach(cleanup);

it('replaces a failed source with labelled media while preserving the caller error handler and layout', () => {
  const onError = vi.fn();
  const { container } = render(<SafeImage src="/broken.jpg" alt="Black tee" fallbackLabel="Black tee image unavailable" className="product-image" width={300} height={400} style={{ objectPosition: 'top' }} onError={onError} />);
  fireEvent.error(screen.getByRole('img', { name: 'Black tee' }));
  const fallback = screen.getByRole('img', { name: 'Black tee image unavailable' });
  expect(fallback).toHaveClass('media-fallback', 'product-image');
  expect(fallback.style.aspectRatio).toBe('300 / 400');
  expect(fallback.style.objectPosition).toBe('center top');
  expect(container.querySelector('img')).toBeNull();
  expect(onError).toHaveBeenCalledTimes(1);
});

it('retries only when its source changes, including returning to a previously failed source', () => {
  const view = render(<SafeImage src="/first.jpg" alt="First tee" fallbackLabel="Tee image unavailable" />);
  fireEvent.error(screen.getByRole('img'));
  view.rerender(<SafeImage src="/first.jpg" alt="First tee" fallbackLabel="Tee image unavailable" />);
  expect(screen.getByRole('img')).not.toHaveAttribute('src');
  view.rerender(<SafeImage src="/second.jpg" alt="Second tee" fallbackLabel="Tee image unavailable" />);
  expect(screen.getByRole('img', { name: 'Second tee' })).toHaveAttribute('src', '/second.jpg');
  view.rerender(<SafeImage src="/first.jpg" alt="First tee" fallbackLabel="Tee image unavailable" />);
  expect(screen.getByRole('img', { name: 'First tee' })).toHaveAttribute('src', '/first.jpg');
});
