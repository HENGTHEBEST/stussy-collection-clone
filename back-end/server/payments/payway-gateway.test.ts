// @vitest-environment node
import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PayWayGateway } from './payway-gateway.js';

const now = new Date('2026-11-11T08:09:10.000Z');
const credentials = { merchantId: 'sandbox-merchant', apiKey: 'synthetic-secret', environment: 'sandbox' as const };
const reference = 'payway-1234567890abcdef1234';
const input = { providerReference: reference, expiresAt: '2026-11-11T08:19:10.000Z', totalMinor: 1200, currency: 'USD' as const };

describe('PayWay hosted card checkout', () => {
  it('signs the server-priced transaction without exposing the API key or card fields', async () => {
    const gateway = new PayWayGateway(credentials, 'https://shop.example.test', fetch, () => now);
    const payment = await gateway.createPayment({ orderId: '12345678-90ab-cdef-1234-567890abcdef', totalMinor: 1200, currency: 'USD', expiresAt: input.expiresAt });
    expect(payment.providerReference).toBe(reference);
    const checkout = gateway.checkout({ id: 'order-1', providerReference: reference, totalMinor: 1200, currency: 'USD',
      customer: { name: 'Sam Test', email: 'sam@example.test', phone: '012345678' } });
    expect(checkout.action).toBe('https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase');
    expect(checkout.fields).toMatchObject({ tran_id: '1234567890abcdef1234', amount: '12.00', currency: 'USD', payment_option: 'cards',
      cancel_url: 'https://shop.example.test/order/order-1', continue_success_url: 'https://shop.example.test/order/order-1' });
    const fields = checkout.fields;
    const signed = [fields.req_time, fields.merchant_id, fields.tran_id, fields.amount, '', '', fields.firstname,
      fields.lastname, fields.email, fields.phone, fields.type, fields.payment_option, '', fields.cancel_url,
      fields.continue_success_url, '', fields.currency, '', '', '', fields.lifetime, '', '', ''].join('');
    expect(fields.hash).toBe(createHmac('sha512', credentials.apiKey).update(signed).digest('base64'));
    expect(JSON.stringify(checkout)).not.toContain(credentials.apiKey);
    expect(JSON.stringify(checkout)).not.toMatch(/card_number|cvv|cvc/i);
  });

  it('marks paid only for the matching approved USD amount and transaction ID', async () => {
    const fetcher = vi.fn(async (_url: string, _options?: RequestInit) => new Response(JSON.stringify({ status: { code: '00', tran_id: '1234567890abcdef1234' },
      data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 12, payment_currency: 'USD' } })));
    const gateway = new PayWayGateway(credentials, 'https://shop.example.test', fetcher as typeof fetch, () => now);
    expect(await gateway.checkPayment(input)).toEqual({ status: 'paid', transactionHash: reference });
    const request = JSON.parse(fetcher.mock.calls[0][1]!.body as string);
    expect(request.hash).toBe(createHmac('sha512', credentials.apiKey)
      .update(request.req_time + request.merchant_id + request.tran_id).digest('base64'));
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ status: { code: '00', tran_id: '1234567890abcdef1234' },
      data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 13, payment_currency: 'USD' } })));
    await expect(gateway.checkPayment(input)).rejects.toThrow('Invalid PayWay response.');
  });

  it('does not mistake PayWay domain rejection for an unpaid transaction', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: { code: 6, message: 'wrong domain' } })));
    const gateway = new PayWayGateway(credentials, 'https://shop.example.test', fetcher as typeof fetch, () => now);
    await expect(gateway.checkPayment(input)).rejects.toThrow('PayWay payment check failed.');
  });

  it.each([
    { total_amount: 12.004 }, { total_amount: '12' }, { total_amount: -12 },
    { payment_currency: 'KHR' }, { payment_currency: 'KHR', payment_status_code: 3, payment_status: 'DECLINED' },
    { payment_status: 'PENDING' }, { payment_status_code: 2 },
  ])('rejects inconsistent or mismatched provider data: %j', async mismatch => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: { code: '00', tran_id: '1234567890abcdef1234' },
      data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 12, payment_currency: 'USD', ...mismatch } })));
    const gateway = new PayWayGateway(credentials, 'https://shop.example.test', fetcher as typeof fetch, () => now);
    await expect(gateway.checkPayment(input)).rejects.toThrow('Invalid PayWay response.');
  });
});
