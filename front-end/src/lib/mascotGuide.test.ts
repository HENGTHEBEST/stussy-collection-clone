import { describe, expect, it } from 'vitest';
import { answerGuideQuestion } from './mascotGuide';

describe('mascot guide answers', () => {
  it('uses the current product and catalog facts without implying live stock', async () => {
    const answer = await answerGuideQuestion('What sizes and price?', '/product/8-ball-tee-black');
    expect(answer).toContain('8-Ball Tee');
    expect(answer).toContain('$48.00');
    expect(answer).toContain('S, M, L, XL');
    expect(answer).toContain('illustrative');
  });

  it('explains checkout payments without claiming provider acceptance', async () => {
    const answer = await answerGuideQuestion('Can I pay by card?', '/checkout');
    expect(answer).toContain('PayWay');
    expect(answer).toContain('hosted');
    expect(answer).toContain('cannot confirm');
  });

  it('uses listed delivery estimates but does not invent an arrival date', async () => {
    expect(await answerGuideQuestion('When will my parcel arrive?', '/checkout')).toContain('3–5 business days');
    expect(await answerGuideQuestion('When will my parcel arrive?', '/checkout')).toContain('do not have an exact arrival date');
  });

  it('states an unknown answer instead of guessing', async () => {
    expect(await answerGuideQuestion('Where are the clothes manufactured?', '/shop')).toMatch(/don.t have|not available/i);
  });
});
