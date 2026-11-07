// Optional QA-only runner. Reuse an installed Playwright module without adding
// a production dependency: PLAYWRIGHT_MODULE may be an absolute file URL.
import assert from 'node:assert/strict';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(process.env.QA_URL || 'http://127.0.0.1:5173');
    await page.locator('.hero-logo').waitFor();
    for (const selector of ['.site-logo img', '.hero-logo']) {
      assert.equal(await page.locator(selector).evaluate((node) => getComputedStyle(node).filter), 'brightness(0) invert(1)', `${width}: ${selector} remains visible over dark surfaces`);
    }
    assert.equal(await page.locator('.marquee-strip').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)', `${width}: marquee uses the neutral white treatment`);
    assert.equal(await page.getByText('Unofficial demo store').count(), 0, `${width}: demo badge is removed`);
    await page.mouse.move(120, 140);
    await page.waitForFunction(() => document.querySelector('.custom-cursor')?.classList.contains('cursor-active'));
    assert.equal(await page.locator('.cursor-ring').evaluate((node) => getComputedStyle(node).borderTopColor), 'rgb(255, 255, 255)', `${width}: cursor outline is white`);
    assert.equal(await page.locator('.cursor-dot, .cursor-trail, .custom-cursor img').count(), 0, `${width}: cursor has no dot or logo trail`);
    assert.equal(await page.locator('h1').evaluate((node) => getComputedStyle(node).outlineStyle), 'none', `${width}: route-heading focus does not frame the hero`);
    await page.locator('.hero-scroll').focus();
    assert.equal(await page.locator('.hero-scroll').evaluate((node) => getComputedStyle(node).outlineStyle), 'solid', `${width}: interactive keyboard focus stays visible`);
    await page.locator('.manifesto-content h2').scrollIntoViewIfNeeded();
    const heading = await page.locator('.manifesto-content h2').evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      return { textWidth: range.getBoundingClientRect().width, width: node.getBoundingClientRect().width, lines: range.getClientRects().length };
    });
    assert.equal(heading.lines, 1, `${width}: Escape remains one line`);
    assert.ok(heading.textWidth <= heading.width + 1, `${width}: Escape fits its container`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}: no horizontal overflow`);
    console.log(`PASS ${width}px: neutral theme, simple white cursor, heading focus, single-line Escape, viewport fit`);
  }
} finally {
  await browser.close();
}
