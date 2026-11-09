import { createHash } from 'node:crypto';
import QRCode from 'qrcode';
import type { GatewayCheckResult, GatewayOrder, GatewayPayment, PaymentGateway } from './payment-gateway';

// Test/demo provider only: these QR codes cannot initiate a real Bakong payment.
export class MockBakongGateway implements PaymentGateway {
  private readonly simulatedReferences = new Set<string>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async createPayment(order: GatewayOrder): Promise<GatewayPayment> {
    const providerReference = 'mock-' + order.orderId;
    const qrPayload = 'mock-khqr:' + JSON.stringify({
      reference: providerReference, totalMinor: order.totalMinor,
      currency: order.currency, expiresAt: order.expiresAt,
    });
    return {
      providerReference, qrPayload, qrDataUrl: await QRCode.toDataURL(qrPayload),
      md5: createHash('md5').update(qrPayload).digest('hex'),
      expiresAt: order.expiresAt, status: 'pending',
    };
  }

  async checkPayment(providerReference: string, expiresAt: string): Promise<GatewayCheckResult> {
    if (this.now().getTime() >= Date.parse(expiresAt)) return { status: 'expired' };
    return this.simulatedReferences.has(providerReference)
      ? { status: 'paid', transactionHash: 'mock-tx-' + providerReference }
      : { status: 'pending' };
  }

  simulateSuccess(providerReference: string): void {
    this.simulatedReferences.add(providerReference);
  }
}
