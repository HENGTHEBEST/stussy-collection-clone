import type { PaymentStatus } from '../../shared/commerce';

export interface GatewayOrder {
  orderId: string; totalMinor: number; currency: 'USD'; expiresAt: string;
}
export interface GatewayPayment {
  providerReference: string; qrPayload: string; qrDataUrl: string;
  md5: string; expiresAt: string; status: PaymentStatus;
}
export interface GatewayCheckResult {
  status: PaymentStatus; transactionHash?: string;
}
export interface PaymentGateway {
  createPayment(order: GatewayOrder): Promise<GatewayPayment>;
  checkPayment(providerReference: string, expiresAt: string): Promise<GatewayCheckResult>;
}
