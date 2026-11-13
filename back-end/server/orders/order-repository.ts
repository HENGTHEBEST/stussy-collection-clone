import type {
  CheckoutCustomer, DeliveryAddress, DeliveryMethod, PublicOrder, PublicPaymentAttempt,
} from '../../../shared/commerce.js';

export interface StoredPaymentAttempt extends PublicPaymentAttempt {
  qrPayload: string;
  md5: string;
  transactionHash: string | null;
}

export interface StoredOrder extends Omit<PublicOrder, 'payment' | 'merchantName'> {
  requestId: string;
  customer: CheckoutCustomer;
  address: DeliveryAddress;
  delivery: DeliveryMethod;
  payment: StoredPaymentAttempt;
}

export interface CreateStoredOrderInput extends Omit<StoredOrder, 'id' | 'createdAt' | 'updatedAt'> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderRepository {
  createOrder(input: CreateStoredOrderInput): Promise<StoredOrder>;
  findById(id: string): Promise<StoredOrder | null>;
  findByRequestId(requestId: string): Promise<StoredOrder | null>;
  findByProviderReference(providerReference: string): Promise<StoredOrder | null>;
  markPaid(id: string, transactionHash: string, updatedAt: string): Promise<boolean>;
  markFailed(id: string, updatedAt: string): Promise<boolean>;
  markExpired(id: string, updatedAt: string): Promise<boolean>;
  close(): Promise<void>;
}
