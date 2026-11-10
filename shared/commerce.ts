export type ProductSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type ProductColor = 'Black' | 'White' | 'Natural';
export type DeliveryMethod = 'standard' | 'express';
export type OrderStatus = 'awaiting_payment' | 'paid' | 'failed' | 'expired' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface Product {
  id: number;
  slug: string;
  label: string;
  name: string;
  description: string;
  image: string;
  category: 'T-Shirts' | 'Crops';
  color: ProductColor;
  sizes: ProductSize[];
  demoPrice: number;
  available: boolean;
  featuredRank: number;
  features: string[];
  gridSpan: 'wide' | 'medium' | 'standard';
  objectPosition: 'top' | 'center';
}

export interface CheckoutCustomer { name: string; email: string; phone: string }
export interface DeliveryAddress {
  street: string; city: string; region: string; postalCode: string; country: string;
}
export interface CheckoutLineInput {
  productId: number; size: ProductSize; color: ProductColor; quantity: number;
}
export interface CreateOrderRequest {
  requestId: string;
  customer: CheckoutCustomer;
  address: DeliveryAddress;
  delivery: DeliveryMethod;
  lines: CheckoutLineInput[];
}
export interface PublicOrderLine {
  productId: number; slug: string; name: string; image: string;
  size: ProductSize; color: ProductColor; quantity: number; unitPriceMinor: number;
}
export interface PublicPaymentAttempt {
  status: PaymentStatus; qrDataUrl: string; expiresAt: string; providerReference: string;
}
export interface PublicOrder {
  id: string; status: OrderStatus; createdAt: string; updatedAt: string;
  merchantName: string;
  deliveryLabel: 'Standard delivery' | 'Express delivery'; currency: 'USD';
  subtotalMinor: number; shippingMinor: number; totalMinor: number;
  lines: PublicOrderLine[]; payment: PublicPaymentAttempt;
  mockMode: boolean;
}
