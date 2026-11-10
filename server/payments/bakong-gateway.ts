import QRCode from 'qrcode';
import sdk from 'bakong-khqr';
import type { BakongCredentials } from '../config.js';
import type {
  GatewayCheckInput, GatewayCheckResult, GatewayOrder, GatewayPayment, PaymentGateway,
} from './payment-gateway.js';

const { BakongKHQR, MerchantInfo, khqrData } = sdk;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class BakongGateway implements PaymentGateway {
  constructor(
    private readonly credentials: BakongCredentials,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async createPayment(order: GatewayOrder): Promise<GatewayPayment> {
    try {
      const merchant = new MerchantInfo(
        this.credentials.bakongAccountId,
        this.credentials.merchantName,
        this.credentials.merchantCity,
        this.credentials.merchantId,
        this.credentials.acquiringBank,
        {
          currency: khqrData.currency.usd,
          amount: order.totalMinor / 100,
          billNumber: order.orderId,
          expirationTimestamp: Date.parse(order.expiresAt),
        },
      );
      const generated = new BakongKHQR().generateMerchant(merchant);
      if (generated.status.code !== 0 || !generated.data
        || !/^[a-f0-9]{32}$/.test(generated.data.md5)
        || BakongKHQR.verify(generated.data.qr).isValid !== true) {
        throw new Error();
      }
      return {
        providerReference: generated.data.md5,
        qrPayload: generated.data.qr,
        qrDataUrl: await QRCode.toDataURL(generated.data.qr, { errorCorrectionLevel: 'M', margin: 4, width: 640 }),
        md5: generated.data.md5,
        expiresAt: order.expiresAt,
        status: 'pending',
      };
    } catch {
      throw new Error('Unable to generate Bakong KHQR.');
    }
  }

  async checkPayment(input: GatewayCheckInput): Promise<GatewayCheckResult> {
    let providerResponse: Response;
    try {
      providerResponse = await this.fetcher(this.credentials.apiBaseUrl + '/v1/check_transaction_by_md5', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.credentials.apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ md5: input.providerReference }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new Error('Bakong payment check failed.');
    }
    if (!providerResponse.ok) throw new Error('Bakong payment check failed.');

    let body: unknown;
    try {
      body = await providerResponse.json();
    } catch {
      throw new Error('Invalid Bakong response.');
    }
    if (!isRecord(body)) throw new Error('Invalid Bakong response.');

    if (body.responseCode === 1) {
      if (typeof body.responseMessage === 'string'
        && body.responseMessage.trim().toLowerCase() === 'transaction failed.') {
        return { status: 'failed' };
      }
      return this.now().getTime() >= Date.parse(input.expiresAt)
        ? { status: 'expired' }
        : { status: 'pending' };
    }
    if (body.responseCode !== 0 || !isRecord(body.data)) throw new Error('Invalid Bakong response.');

    const data = body.data;
    if (typeof data.hash !== 'string' || !/^[a-f0-9]{64}$/i.test(data.hash)
      || data.toAccountId !== this.credentials.bakongAccountId
      || data.currency !== input.currency
      || typeof data.amount !== 'number' || !Number.isFinite(data.amount)
      || Math.round(data.amount * 100) !== input.totalMinor
      || typeof data.fromAccountId !== 'string' || !data.fromAccountId.trim()) {
      throw new Error('Invalid Bakong response.');
    }
    return { status: 'paid', transactionHash: data.hash.toLowerCase() };
  }
}
