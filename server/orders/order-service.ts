import { randomUUID } from 'node:crypto';
import type { CreateOrderRequest, PublicOrder } from '../../shared/commerce.js';
import { priceOrder } from '../catalog/order-pricing.js';
import { verifyAddressLocation } from '../locations/address.js';
import type { PricingPolicy } from '../config.js';
import { MockBakongGateway } from '../payments/mock-bakong-gateway.js';
import type { PaymentGateway } from '../payments/payment-gateway.js';
import { PayWayGateway } from '../payments/payway-gateway.js';
import type { OrderRepository, StoredOrder } from './order-repository.js';

export class OrderValidationError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new OrderValidationError(field + ' is required.');
  }
  return value.trim();
}

function validateRequest(input: CreateOrderRequest): CreateOrderRequest {
  if (!isRecord(input)) throw new OrderValidationError('Invalid checkout request.');
  const requestId = requiredText(input.requestId, 'Request ID').toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)) {
    throw new OrderValidationError('Request ID must be a UUID.');
  }
  if (!isRecord(input.customer) || !isRecord(input.address)) {
    throw new OrderValidationError('Customer and delivery address are required.');
  }
  if (input.paymentMethod !== undefined && input.paymentMethod !== 'khqr' && input.paymentMethod !== 'card') {
    throw new OrderValidationError('Invalid payment method.');
  }
  const customer = {
    name: requiredText(input.customer.name, 'Name'),
    email: requiredText(input.customer.email, 'Email'),
    phone: requiredText(input.customer.phone, 'Phone'),
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new OrderValidationError('Enter a valid email address.');
  }
  if (customer.phone.length < 7 || customer.phone.length > 30) {
    throw new OrderValidationError('Phone must contain 7 to 30 characters.');
  }
  const address = {
    street: requiredText(input.address.street, 'Street'),
    city: requiredText(input.address.city, 'City'),
    region: typeof input.address.region === 'string' ? input.address.region.trim() : requiredText(input.address.region, 'Region'),
    postalCode: typeof input.address.postalCode === 'string' ? input.address.postalCode.trim() : requiredText(input.address.postalCode, 'Postal code'),
    country: requiredText(input.address.country, 'Country'),
  };
  if (input.delivery !== 'standard' && input.delivery !== 'express') {
    throw new OrderValidationError('Invalid delivery method.');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new OrderValidationError('Cart must contain at least one item.');
  }
  const lines = input.lines.map(line => {
    if (!isRecord(line) || !Number.isInteger(line.productId) || !Number.isInteger(line.quantity)
      || typeof line.size !== 'string' || typeof line.color !== 'string') {
      throw new OrderValidationError('Invalid cart item.');
    }
    return { productId: line.productId, size: line.size, color: line.color, quantity: line.quantity };
  });
  return { requestId, customer, address, delivery: input.delivery, lines, ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}) };
}

function publicOrder(order: StoredOrder, merchantName: string, cardGateway?: PayWayGateway, now = new Date()): PublicOrder {
  const card = order.payment.providerReference.startsWith('payway-');
  return {
    id: order.id, status: order.status, createdAt: order.createdAt, updatedAt: order.updatedAt,
    merchantName,
    deliveryLabel: order.deliveryLabel, currency: order.currency,
    subtotalMinor: order.subtotalMinor, shippingMinor: order.shippingMinor, totalMinor: order.totalMinor,
    lines: order.lines.map(line => ({
      productId: line.productId, slug: line.slug, name: line.name, image: line.image,
      size: line.size, color: line.color, quantity: line.quantity, unitPriceMinor: line.unitPriceMinor,
    })),
    payment: {
      status: order.payment.status, qrDataUrl: order.payment.qrDataUrl,
      expiresAt: order.payment.expiresAt, providerReference: order.payment.providerReference,
      ...(card ? { method: 'card' as const, ...(cardGateway?.sandbox ? { sandbox: true } : {}), ...(order.status === 'awaiting_payment'
        && now.getTime() < Date.parse(order.payment.expiresAt) - 5 * 60 * 1000 && cardGateway
        ? { checkout: cardGateway.checkout({ id: order.id, providerReference: order.payment.providerReference,
          totalMinor: order.totalMinor, currency: order.currency, customer: order.customer }) } : {}) } : {}),
    },
    mockMode: order.mockMode,
  };
}

export class OrderService {
  // shortcut: in-flight deduplication is process-local; use durable provider idempotency before adding live payments.
  private readonly creating = new Map<string, Promise<PublicOrder>>();

  constructor(
    private readonly repository: OrderRepository,
    private readonly gateway: PaymentGateway,
    private readonly now: () => Date = () => new Date(),
    private readonly pricing: PricingPolicy = { unitPriceMinor: null, freeShipping: false },
    private readonly merchantName = 'Stussy Collection',
    private readonly cardGateway?: PayWayGateway,
  ) {}

  async createOrder(input: CreateOrderRequest): Promise<PublicOrder> {
    const request = validateRequest(input);
    const existing = await this.repository.findByRequestId(request.requestId);
    if (existing) return (await this.getOrder(existing.id))!;
    const pending = this.creating.get(request.requestId);
    if (pending) return pending;
    const creating = this.persistOrder(request);
    this.creating.set(request.requestId, creating);
    try {
      return await creating;
    } finally {
      this.creating.delete(request.requestId);
    }
  }

  private async persistOrder(request: CreateOrderRequest): Promise<PublicOrder> {
    const location = await verifyAddressLocation(request.address);
    if (!location.address) throw new OrderValidationError(Object.values(location.errors)[0] ?? 'Invalid delivery location.');
    const pricing = priceOrder(request.lines, request.delivery, this.pricing);
    const id = randomUUID();
    const createdAt = this.now().toISOString();
    const expiresAt = new Date(Date.parse(createdAt) + 10 * 60 * 1000).toISOString();
    if (request.paymentMethod === 'card' && !this.cardGateway) throw new OrderValidationError('Card payments are not configured.');
    const selectedGateway = request.paymentMethod === 'card' ? this.cardGateway! : this.gateway;
    const payment = await selectedGateway.createPayment({ orderId: id, totalMinor: pricing.totalMinor, currency: 'USD', expiresAt });
    const stored = await this.repository.createOrder({
      id, requestId: request.requestId, customer: request.customer, address: { ...request.address, ...location.address },
      delivery: request.delivery, deliveryLabel: request.delivery === 'express' ? 'Express delivery' : 'Standard delivery',
      status: 'awaiting_payment', createdAt, updatedAt: createdAt, currency: 'USD', ...pricing,
      payment: { ...payment, transactionHash: null }, mockMode: selectedGateway instanceof MockBakongGateway,
    });
    return publicOrder(stored, this.merchantName, this.cardGateway, this.now());
  }

  async getOrder(id: string): Promise<PublicOrder | null> {
    const order = await this.repository.findById(id);
    if (!order) return null;
    if (order.status !== 'awaiting_payment' || order.payment.status !== 'pending') return publicOrder(order, this.merchantName, this.cardGateway, this.now());
    const card = order.payment.providerReference.startsWith('payway-');
    const updatedAt = this.now().toISOString();
    if (order.mockMode && !card && Date.parse(updatedAt) >= Date.parse(order.payment.expiresAt)) {
      await this.repository.markExpired(id, updatedAt);
    } else {
      const selectedGateway = card ? this.cardGateway : this.gateway;
      if (!selectedGateway) throw new Error('Card payment gateway is unavailable.');
      const result = await selectedGateway.checkPayment({
        providerReference: order.payment.providerReference,
        expiresAt: order.payment.expiresAt,
        totalMinor: order.totalMinor,
        currency: order.currency,
      });
      const checkedAt = this.now().toISOString();
      if (order.mockMode && !card && Date.parse(checkedAt) >= Date.parse(order.payment.expiresAt)) {
        await this.repository.markExpired(id, checkedAt);
      } else if (result.status === 'paid') {
        if (!result.transactionHash?.trim()) throw new Error('Paid gateway result requires a transaction hash.');
        await this.repository.markPaid(id, result.transactionHash, checkedAt);
      } else if (result.status === 'failed') {
        await this.repository.markFailed(id, checkedAt);
      } else if (result.status === 'expired') {
        await this.repository.markExpired(id, checkedAt);
      } else if (card && Date.parse(checkedAt) >= Date.parse(order.payment.expiresAt) + 5 * 60 * 1000) {
        // shortcut: poll through a five-minute provider settlement grace before expiring card orders.
        await this.repository.markExpired(id, checkedAt);
      }
    }
    const updated = await this.repository.findById(id);
    if (!updated) throw new Error('Order disappeared after payment update.');
    return publicOrder(updated, this.merchantName, this.cardGateway, this.now());
  }

  async reconcilePayWay(providerReference: string): Promise<PublicOrder | null> {
    if (!/^payway-[a-f0-9]{20}$/.test(providerReference)) return null;
    const order = await this.repository.findByProviderReference(providerReference);
    if (!order) return null;
    return this.getOrder(order.id);
  }

  async simulateSuccess(id: string): Promise<PublicOrder | null> {
    const order = await this.repository.findById(id);
    if (!order) return null;
    if (!(this.gateway instanceof MockBakongGateway) || !order.mockMode) {
      throw new Error('Payment simulation is available only in mock mode.');
    }
    if (order.status === 'awaiting_payment' && this.now().getTime() < Date.parse(order.payment.expiresAt)) {
      this.gateway.simulateSuccess(order.payment.providerReference);
    }
    return this.getOrder(id);
  }
}
