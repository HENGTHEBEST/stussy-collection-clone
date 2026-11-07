import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the Stussy application shell', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /summer classics/i })).toBeInTheDocument();
});
