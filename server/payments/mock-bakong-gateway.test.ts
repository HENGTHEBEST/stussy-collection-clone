// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MockBakongGateway } from './mock-bakong-gateway.js';

const instant = '2026-11-09T10:00:00.000Z';
const expiresAt = '2026-11-09T10:10:00.000Z';
const order = { orderId: 'order-123', totalMinor: 10800, currency: 'USD' as const, expiresAt };

describe('MockBakongGateway', () => {
  it('creates a stable mock reference and a real PNG QR for the mock payload', async () => {
    const gateway = new MockBakongGateway(() => new Date(instant));
    const payment = await gateway.createPayment(order);
    expect(payment).toMatchObject({ status: 'pending', expiresAt, providerReference: 'mock-order-123' });
    expect(Date.parse(payment.expiresAt) - Date.parse(instant)).toBe(600000);
    expect(payment.qrPayload).toMatch(/^mock-khqr:/);
    expect(payment.qrPayload).toContain('10800');
    expect(payment.qrPayload).toContain('USD');
    expect(payment.md5).toBe(createHash('md5').update(payment.qrPayload).digest('hex'));
    expect(payment.qrDataUrl.startsWith('data:image/png;base64,iVBOR')).toBe(true);
    expect(await gateway.createPayment(order)).toEqual(payment);
  });

  it('only pays the simulated reference and keeps transaction hashes stable', async () => {
    const gateway = new MockBakongGateway(() => new Date(instant));
    const payment = await gateway.createPayment(order);
    const input = { providerReference: payment.providerReference, expiresAt, totalMinor: order.totalMinor, currency: 'USD' as const };
    expect(await gateway.checkPayment(input)).toEqual({ status: 'pending' });
    gateway.simulateSuccess(payment.providerReference);
    const paid = await gateway.checkPayment(input);
    expect(paid).toMatchObject({ status: 'paid', transactionHash: expect.stringMatching(/^mock-/) });
    expect(await gateway.checkPayment(input)).toEqual(paid);
    expect(await gateway.checkPayment({ ...input, providerReference: 'other' })).toEqual({ status: 'pending' });
  });

  it('expires at the deadline even when success was simulated', async () => {
    const gateway = new MockBakongGateway(() => new Date(expiresAt));
    gateway.simulateSuccess('mock-order-123');
    expect(await gateway.checkPayment({ providerReference: 'mock-order-123', expiresAt, totalMinor: order.totalMinor, currency: 'USD' })).toEqual({ status: 'expired' });
  });
});
