import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = await Promise.all([
  'front-end/src/styles/tokens.css',
  'front-end/src/styles/base.css',
  'front-end/src/styles/showcase.css',
  'front-end/src/styles/commerce.css',
].map((path) => readFile(resolve(process.cwd(), path), 'utf8')));

describe('neutral interface theme', () => {
  it('contains no coral, orange, or red interface tokens', () => {
    const css = styles.join('\n').toLowerCase();
    expect(css).not.toMatch(/--coral|--orange|#ff6b6b|#ff6b35|rgb\(255 107 107/);
  });

  it('uses a white marquee and white cursor outline without dot or logo-trail styles', () => {
    const showcase = styles[2];
    expect(showcase).toMatch(/\.marquee-strip\s*\{[^}]*background:\s*var\(--white\)[^}]*color:\s*var\(--black\)/s);
    expect(showcase).toMatch(/\.cursor-ring\s*\{[^}]*border:\s*1px solid var\(--white\)/s);
    expect(showcase).not.toMatch(/\.cursor-dot|\.cursor-trail|cursor-fade/);
  });
});
