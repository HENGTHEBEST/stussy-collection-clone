// Optional QA-only runner. Reuse an installed Playwright module without adding
// a production dependency: PLAYWRIGHT_MODULE may be an absolute file URL.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

// Run against the full mock API + Vite stack, using the configured APP_ORIGIN.
const baseUrl = process.env.QA_URL || 'http://localhost:5173';
const screenshotDir = process.env.QA_SCREENSHOT_DIR;
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });

async function assertNeutralTheme(page, label) {
  const redColors = await page.evaluate(() => {
    const offenders = [];
    for (const node of document.querySelectorAll('*')) {
      const style = getComputedStyle(node);
      for (const property of ['color', 'backgroundColor', 'borderTopColor', 'outlineColor', 'fill', 'stroke']) {
        const value = style[property];
        const channels = value?.match(/^rgba?\((\d+),?\s+(\d+),?\s+(\d+)(?:,?\s+([\d.]+))?\)/);
        if (!channels || Number(channels[4] ?? 1) === 0) continue;
        const [, r, g, b] = channels.map(Number);
        if (r > 100 && r > g * 1.25 && r > b * 1.25) offenders.push({ tag: node.tagName, property, value });
      }
    }
    return offenders;
  });
  assert.deepEqual(redColors, [], label + ': no red or coral interface colors');
}

async function assertViewportFit(page, label) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, label + ': no horizontal overflow');
}

async function capture(page, name) {
  if (screenshotDir) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: screenshotDir + '/' + name + '.png', fullPage: true });
  }
}

async function cartQuantity(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('stussy-demo-cart-v1') || '{"value":{"lines":[]}}').value.lines.reduce((sum, line) => sum + line.quantity, 0));
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(10000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const health = await page.request.get(baseUrl + '/api/health');
  assert.equal(health.status(), 200, 'mock API is available through Vite');
  assert.deepEqual(await health.json(), { ready: true, paymentMode: 'mock' }, 'the selected URL serves the mock API, not a frontend fallback');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseUrl);
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
    await assertNeutralTheme(page, width + ' home');
    await verifyCheckout(page, width);
    console.log(`PASS ${width}px: showcase, neutral theme, checkout without cards, real API QR/amount/countdown, cart lifecycle, simulated success/reload, unknown-order recovery`);
  }
  assert.deepEqual(pageErrors, [], 'browser emitted no uncaught page errors');
} finally {
  await browser.close();
}

async function verifyCheckout(page, width) {
  await page.goto(baseUrl + '/product/8-ball-tee-black');
  await page.getByRole('radio', { name: 'M', exact: true }).check();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).click();
  assert.equal(await cartQuantity(page), 1, width + ': available variant added');
  await page.goto(baseUrl + '/cart');
  await page.getByRole('heading', { name: 'Cart', exact: true }).waitFor();
  await assertViewportFit(page, width + ' cart');
  await page.getByRole('link', { name: 'Checkout', exact: true }).click();
  await page.getByRole('heading', { name: 'Checkout', exact: true }).waitFor();
  assert.equal(await page.getByRole('textbox', { name: /card|cvc|cvv|expiry/i }).count(), 0, width + ': no card fields');
  assert.equal(await page.locator('input[autocomplete^="cc-"], input[id*="card"], input[id*="cvc"], input[id*="cvv"]').count(), 0, width + ': no hidden card inputs');
  for (const [label, value] of Object.entries({ Name: 'Mock QA Customer', Email: 'qa@example.test', Phone: '012345678', 'Street address': '123 Test Street', City: 'Phnom Penh', Region: 'Phnom Penh', 'Postal code': '12000', Country: 'Cambodia' })) {
    await page.getByLabel(label, { exact: true }).fill(value);
  }
  await assertNeutralTheme(page, width + ' checkout');
  await assertViewportFit(page, width + ' checkout');
  await capture(page, width + '-checkout');

  // Pause only request dispatch: the response still comes from the real local API.
  let release;
  const requestReady = page.waitForRequest(request => request.url().endsWith('/api/orders') && request.method() === 'POST');
  const requestGate = new Promise(resolve => { release = resolve; });
  await page.route('**/api/orders', async route => {
    await requestGate;
    await route.continue();
  }, { times: 1 });
  const submit = page.getByRole('button', { name: 'Continue to KHQR', exact: true });
  const responseReady = page.waitForResponse(response => response.url().endsWith('/api/orders') && response.request().method() === 'POST');
  try {
    await submit.click();
    await requestReady;
    assert.equal(await cartQuantity(page), 1, width + ': cart retained while order creation is pending');
    assert.equal(await submit.isDisabled(), true, width + ': duplicate submit disabled');
  } finally {
    release();
  }
  const response = await responseReady;
  assert.equal(response.status(), 201, width + ': server created order');
  const order = await response.json();
  assert.equal(order.mockMode, true, width + ': mock mode is explicit');
  assert.equal(order.totalMinor, 6000, width + ': server amount is $48 plus $12 standard shipping');
  await page.waitForURL('**/order/' + order.id);
  await page.getByRole('heading', { name: 'Awaiting payment', exact: true }).waitFor();
  assert.equal(await cartQuantity(page), 0, width + ': cart cleared after server success');
  await page.getByText('Simulation only - no money will move', { exact: true }).waitFor();
  const qr = page.getByRole('img', { name: 'Simulated Bakong KHQR payment code', exact: true });
  await qr.waitFor();
  assert.equal(await qr.evaluate(img => img.complete && img.naturalWidth > 0 && img.src.startsWith('data:image/png;base64,')), true, width + ': QR image decoded');
  await page.getByText('Amount due: $60.00', { exact: true }).waitFor();
  await page.getByText('Payment currency: USD', { exact: true }).waitFor();
  assert.match(await page.locator('.payment-countdown').innerText(), /^Time remaining: \d+:\d{2}$/, width + ': countdown is visible');
  const countdown = await page.locator('.payment-countdown').innerText();
  await page.waitForFunction(previous => document.querySelector('.payment-countdown')?.textContent !== previous, countdown);
  await assertNeutralTheme(page, width + ' pending order');
  await assertViewportFit(page, width + ' pending order');
  await capture(page, width + '-pending');
  await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).click();
  await page.getByText('Payment confirmed', { exact: true }).waitFor();
  assert.equal(await qr.count(), 0, width + ': paid state removes payable QR');
  await page.reload();
  await page.getByText('Payment confirmed', { exact: true }).waitFor();
  await page.getByText('Simulation only - no money will move', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Simulate successful payment', exact: true }).count(), 0, width + ': paid state has no simulation action');
  await assertNeutralTheme(page, width + ' paid order');
  await assertViewportFit(page, width + ' paid order');
  await capture(page, width + '-paid');
  await page.goto(baseUrl + '/order/00000000-0000-4000-8000-000000000000');
  await page.getByRole('heading', { name: 'Order not available', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Continue shopping', exact: true }).getAttribute('href'), '/shop', width + ': unknown order recovery link');
  await assertViewportFit(page, width + ' unknown order');
}
