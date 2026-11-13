// @vitest-environment node
import sdk from 'bakong-khqr';
import QRCode from 'qrcode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BakongCredentials } from '../config.js';
import { BakongGateway } from './bakong-gateway.js';

const { BakongKHQR } = sdk;
const instant = '2030-01-01T00:00:00.000Z';
const expiresAt = '2030-01-01T00:10:00.000Z';
const credentials: BakongCredentials = {
  apiBaseUrl: 'https://api.example.test', apiToken: 'synthetic-secret-token',
  bakongAccountId: 'shop@bank', merchantId: 'SHOP01', acquiringBank: 'BANK01',
  merchantName: 'Test Shop', merchantCity: 'PHNOM PENH',
};
const order = { orderId: 'order-123', totalMinor: 3, currency: 'USD' as const, expiresAt };
const md5 = '0123456789abcdef0123456789abcdef';
const hash = 'AB'.repeat(32);

function response(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
}

function success(overrides: Record<string, unknown> = {}) {
  return { responseCode: 0, responseMessage: 'Success', data: {
    hash, fromAccountId: 'buyer@bank', toAccountId: credentials.bakongAccountId,
    currency: 'USD', amount: 0.03, ...overrides,
  } };
}

const checkInput = { providerReference: md5, expiresAt, totalMinor: 3, currency: 'USD' as const };

describe('BakongGateway', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(instant); });
  afterEach(() => vi.useRealTimers());

  it('generates a verified dynamic merchant KHQR for the exact trusted amount and expiry', async () => {
    const gateway = new BakongGateway(credentials, vi.fn(), () => new Date(instant));
    const payment = await gateway.createPayment(order);
    expect(payment).toMatchObject({
      status: 'pending', expiresAt, providerReference: expect.stringMatching(/^[a-f0-9]{32}$/),
      md5: expect.stringMatching(/^[a-f0-9]{32}$/), qrDataUrl: expect.stringMatching(/^data:image\/png;base64,iVBOR/),
    });
    expect(payment.providerReference).toBe(payment.md5);
    expect(BakongKHQR.verify(payment.qrPayload).isValid).toBe(true);
    const decoded = (BakongKHQR as unknown as { decode(qr: string): { data: Record<string, string> } }).decode(payment.qrPayload).data;
    expect(decoded).toMatchObject({
      bakongAccountID: credentials.bakongAccountId, merchantID: credentials.merchantId,
      acquiringBank: credentials.acquiringBank, merchantName: credentials.merchantName,
      merchantCity: credentials.merchantCity, transactionCurrency: '840', transactionAmount: '0.03',
      billNumber: order.orderId, expirationTimestamp: String(Date.parse(expiresAt)),
    });
  });

  it('uses high error correction for the centered payment emblem', async () => {
    const toDataURL = vi.spyOn(QRCode, 'toDataURL');
    const gateway = new BakongGateway(credentials, vi.fn(), () => new Date(instant));

    await gateway.createPayment(order);

    expect(toDataURL).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ errorCorrectionLevel: 'H' }));
  });

  it('fits UUID order IDs into the KHQR bill-number limit', async () => {
    const gateway = new BakongGateway(credentials, vi.fn(), () => new Date(instant));
    const uuidOrder = { ...order, orderId: '12345678-1234-4234-8234-123456789abc' };
    const payment = await gateway.createPayment(uuidOrder);
    const decoded = (BakongKHQR as unknown as { decode(qr: string): { data: Record<string, string> } })
      .decode(payment.qrPayload).data;
    expect(decoded.billNumber).toBe('1234567812344234823412345');
  });

  it('posts the MD5 with authorization and accepts only an exact verified transaction', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(success()));
    const gateway = new BakongGateway(credentials, fetcher, () => new Date(instant));
    await expect(gateway.checkPayment(checkInput)).resolves.toEqual({ status: 'paid', transactionHash: hash.toLowerCase() });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.example.test/v1/check_transaction_by_md5');
    expect(init).toMatchObject({ method: 'POST', body: JSON.stringify({ md5 }) });
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer synthetic-secret-token');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['destination', { toAccountId: 'other@bank' }],
    ['currency', { currency: 'KHR' }],
    ['amount', { amount: 0.04 }],
    ['floating amount boundary', { amount: 0.035 }],
    ['hash', { hash: 'not-a-hash' }],
    ['missing hash', { hash: undefined }],
    ['sender', { fromAccountId: undefined }],
  ])('rejects a success response with a mismatched %s', async (_label, override) => {
    const gateway = new BakongGateway(credentials, vi.fn<typeof fetch>().mockResolvedValue(response(success(override))), () => new Date(instant));
    await expect(gateway.checkPayment(checkInput)).rejects.toThrow('Invalid Bakong response.');
  });

  it.each([400, 401, 404, 429, 500])('rejects HTTP %i without marking the order paid', async status => {
    const gateway = new BakongGateway(credentials, vi.fn<typeof fetch>().mockResolvedValue(response(success(), status)), () => new Date(instant));
    await expect(gateway.checkPayment(checkInput)).rejects.toThrow('Bakong payment check failed.');
  });

  it.each([
    ['malformed JSON', response('{')],
    ['unexpected code', response({ responseCode: 2, data: null })],
    ['unexpected shape', response({ responseCode: 0, data: null })],
  ])('rejects %s', async (_label, providerResponse) => {
    const gateway = new BakongGateway(credentials, vi.fn<typeof fetch>().mockResolvedValue(providerResponse), () => new Date(instant));
    await expect(gateway.checkPayment(checkInput)).rejects.toThrow('Invalid Bakong response.');
  });

  it('maps explicit failure and treats not-found as pending before expiry and expired at expiry', async () => {
    const failed = new BakongGateway(credentials, vi.fn<typeof fetch>().mockResolvedValue(response({ responseCode: 1, responseMessage: ' Transaction Failed. ', data: null })), () => new Date(instant));
    await expect(failed.checkPayment(checkInput)).resolves.toEqual({ status: 'failed' });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response({ responseCode: 1, responseMessage: 'Transaction not found.', data: null }));
    await expect(new BakongGateway(credentials, fetcher, () => new Date(instant)).checkPayment(checkInput)).resolves.toEqual({ status: 'pending' });
    await expect(new BakongGateway(credentials, fetcher, () => new Date(expiresAt)).checkPayment(checkInput)).resolves.toEqual({ status: 'expired' });
  });

  it('rejects a code-1 response unless its data is explicitly null', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({
      responseCode: 1, responseMessage: 'Transaction not found.', data: { hash },
    }));
    await expect(new BakongGateway(credentials, fetcher, () => new Date(instant)).checkPayment(checkInput))
      .rejects.toThrow('Invalid Bakong response.');
  });

  it('sanitizes transport and KHQR generation errors', async () => {
    const rejected = new BakongGateway(credentials, vi.fn<typeof fetch>().mockRejectedValue(new Error('leaked provider body synthetic-secret-token')), () => new Date(instant));
    await expect(rejected.checkPayment(checkInput)).rejects.toThrow('Bakong payment check failed.');
    const invalid = new BakongGateway({ ...credentials, bakongAccountId: 'secret-invalid-account' }, vi.fn(), () => new Date(instant));
    await expect(invalid.createPayment(order)).rejects.toThrow(/^Unable to generate Bakong KHQR\.$/);
  });
});

it('reports the daily quota as unavailable, backs off, and never calls it an expired payment', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response({ responseCode: 1, errorCode: 17, responseMessage: 'Daily request limit of 100 exceeded. Please try again tomorrow.', data: null }));
  const gateway = new BakongGateway(credentials, fetcher, () => new Date(expiresAt));
  await expect(gateway.checkPayment(checkInput)).rejects.toThrow(/verification limit/);
  await expect(gateway.checkPayment(checkInput)).rejects.toThrow(/verification limit/);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('does not treat an unknown provider error as a pending or expired payment', async () => {
  const gateway = new BakongGateway(credentials, vi.fn<typeof fetch>().mockResolvedValue(response({ responseCode: 1, errorCode: 99, responseMessage: 'Unavailable', data: null })), () => new Date(expiresAt));
  await expect(gateway.checkPayment(checkInput)).rejects.toThrow();
});

it('recognizes the documented not-found error code without relying on message wording', async () => {
  const gateway = new BakongGateway(credentials, vi.fn<typeof fetch>().mockResolvedValue(response({ responseCode: 1, errorCode: 1, responseMessage: 'Transaction could not be found. Please check and try again.', data: null })), () => new Date(instant));
  await expect(gateway.checkPayment(checkInput)).resolves.toEqual({ status: 'pending' });
});

it('deduplicates concurrent bank checks and caches pending results for 30 seconds', async () => {
  let now = Date.parse(instant);
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response({ responseCode: 1, errorCode: 1, data: null }));
  const gateway = new BakongGateway(credentials, fetcher, () => new Date(now));
  await Promise.all([gateway.checkPayment(checkInput), gateway.checkPayment(checkInput)]);
  await gateway.checkPayment(checkInput);
  expect(fetcher).toHaveBeenCalledTimes(1);
  now += 30000;
  await gateway.checkPayment(checkInput);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
