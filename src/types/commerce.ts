import type { Product, ProductColor, ProductSize } from '../../shared/commerce';

export type {
  Product, ProductSize, ProductColor, DeliveryMethod, OrderStatus, PaymentStatus,
  CheckoutCustomer, DeliveryAddress, CheckoutLineInput, CreateOrderRequest,
  PublicOrderLine, PublicPaymentAttempt, PublicOrder,
} from '../../shared/commerce';

export interface CatalogFilters {
  query: string;
  categories: Product['category'][];
  colors: ProductColor[];
  sizes: ProductSize[];
  availableOnly: boolean;
}

export type CatalogSort = 'featured' | 'name-asc' | 'price-asc' | 'price-desc';
