import { products } from '../../../shared/catalog.js';
import { shippingPriceMinor } from '../../../shared/commerce.js';
import type { CheckoutLineInput, DeliveryMethod, PublicOrderLine } from '../../../shared/commerce.js';
import type { PricingPolicy } from '../config.js';

export class OrderPricingError extends Error {}

export interface PricedOrder {
  lines: PublicOrderLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
}

export function priceOrder(
  lines: CheckoutLineInput[],
  delivery: DeliveryMethod,
  policy: PricingPolicy = { unitPriceMinor: null, freeShipping: false },
): PricedOrder {
  if (!Array.isArray(lines) || lines.length === 0) throw new OrderPricingError('Cart is empty.');

  const pricedLines = lines.map((line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    if (!product || !product.available || !product.sizes.includes(line.size)
      || product.color !== line.color || !Number.isInteger(line.quantity)
      || line.quantity < 1 || line.quantity > 10) {
      throw new OrderPricingError('Cart contains an unavailable item or variant.');
    }

    return {
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      size: line.size,
      color: line.color,
      quantity: line.quantity,
      unitPriceMinor: policy.unitPriceMinor ?? Math.round(product.demoPrice * 100),
    } satisfies PublicOrderLine;
  });

  const subtotalMinor = pricedLines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const shippingMinor = shippingPriceMinor(subtotalMinor, delivery, policy.freeShipping);
  return { lines: pricedLines, subtotalMinor, shippingMinor, totalMinor: subtotalMinor + shippingMinor };
}
