import { render, screen } from '@testing-library/react';
import { it, expect } from 'vitest';
import { HeroSection } from './HeroSection';

it('keeps the establishment line, title, and scroll cue as separate hero layers', () => {
  render(<HeroSection />);
  expect(screen.getByText(/est\. 1980/i)).toHaveClass('hero-est');
  expect(screen.getByRole('heading', { name: 'Summer Classics' })).toHaveClass('hero-title');
  expect(screen.getByRole('link', { name: /scroll/i })).toHaveClass('hero-scroll');
});
