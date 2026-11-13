import { createHmac } from 'node:crypto';
import type { PayWayCredentials } from '../config.js';
import type { CheckoutCustomer } from '../../shared/commerce.js';
import type { GatewayCheckInput, GatewayCheckResult, GatewayOrder, GatewayPayment, PaymentGateway } from './payment-gateway.js';

const purchaseFields = [
  'req_time', 'merchant_id', 'tran_id', 'amount', 'items', 'shipping', 'firstname', 'lastname',
  'email', 'phone', 'type', 'payment_option', 'return_url', 'cancel_url', 'continue_success_url',
  'return_deeplink', 'currency', 'custom_fields', 'return_params', 'payout', 'lifetime',
  'additional_params', 'google_pay_token', 'skip_success_page',
] as const;

function requestTime(date: Date): string {
  return date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class PayWayGateway implements PaymentGateway {
  readonly action: string;
  readonly sandbox: boolean;

  constructor(
    private readonly credentials: PayWayCredentials,
    private readonly appOrigin: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.sandbox = credentials.environment === 'sandbox';
    this.action = `https://checkout${credentials.environment === 'sandbox' ? '-sandbox' : ''}.payway.com.kh/api/payment-gateway/v1/payments/purchase`;
  }

  private sign(value: string): string {
    return createHmac('sha512', this.credentials.apiKey).update(value).digest('base64');
  }

  async createPayment(order: GatewayOrder): Promise<GatewayPayment> {
    return {
      providerReference: 'payway-' + order.orderId.replaceAll('-', '').slice(0, 20),
      qrPayload: '', qrDataUrl: '', md5: '', expiresAt: order.expiresAt, status: 'pending',
    };
  }

  checkout(order: { id: string; providerReference: string; totalMinor: number; currency: 'USD'; customer: CheckoutCustomer }): { action: string; fields: Record<string, string> } {
    const [firstname, ...lastname] = order.customer.name.split(/\s+/);
    const fields: Record<string, string> = {
      req_time: requestTime(this.now()), merchant_id: this.credentials.merchantId,
      tran_id: order.providerReference.slice('payway-'.length), amount: (order.totalMinor / 100).toFixed(2),
      firstname, lastname: lastname.join(' '), email: order.customer.email, phone: order.customer.phone,
      type: 'purchase', payment_option: 'cards', currency: order.currency,
      cancel_url: `${this.appOrigin}/order/${order.id}`,
      continue_success_url: `${this.appOrigin}/order/${order.id}`,
      lifetime: '5', view_type: 'hosted_view', payment_gate: '0',
    };
    fields.hash = this.sign(purchaseFields.map(key => fields[key] ?? '').join(''));
    return { action: this.action, fields };
  }

  async checkPayment(input: GatewayCheckInput): Promise<GatewayCheckResult> {
    if (!/^payway-[a-f0-9]{20}$/.test(input.providerReference)) throw new Error('Invalid PayWay transaction reference.');
    const reqTime = requestTime(this.now());
    const tranId = input.providerReference.slice('payway-'.length);
    let response: Response;
    try {
      response = await this.fetcher(this.action.replace('/purchase', '/check-transaction-2'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ req_time: reqTime, merchant_id: this.credentials.merchantId, tran_id: tranId,
          hash: this.sign(reqTime + this.credentials.merchantId + tranId) }),
        signal: AbortSignal.timeout(5000),
      });
    } catch { throw new Error('PayWay payment check failed.'); }
    if (!response.ok) throw new Error('PayWay payment check failed.');
    let body: unknown;
    try { body = await response.json(); } catch { throw new Error('Invalid PayWay response.'); }
    if (!record(body) || !record(body.status)) throw new Error('Invalid PayWay response.');
    if (body.status.code === 6 && typeof body.status.message === 'string'
      && /(?:tran_id|transaction) not found/i.test(body.status.message)) return { status: 'pending' };
    if (body.status.code !== '00') throw new Error('PayWay payment check failed.');
    if (!record(body.data)) throw new Error('Invalid PayWay response.');
    if (body.status.tran_id !== tranId || typeof body.data.total_amount !== 'number'
      || !Number.isFinite(body.data.total_amount) || body.data.total_amount !== input.totalMinor / 100
      || body.data.payment_currency !== input.currency) {
      throw new Error('Invalid PayWay response.');
    }
    if (body.data.payment_status_code === 2 && body.data.payment_status === 'PENDING') return { status: 'pending' };
    if ((body.data.payment_status_code === 3 && body.data.payment_status === 'DECLINED')
      || (body.data.payment_status_code === 7 && body.data.payment_status === 'CANCELLED')) return { status: 'failed' };
    if (body.data.payment_status_code !== 0 || body.data.payment_status !== 'APPROVED') throw new Error('Invalid PayWay response.');
    return { status: 'paid', transactionHash: 'payway-' + tranId };
  }
}
