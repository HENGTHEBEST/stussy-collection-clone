import { Check } from 'lucide-react';
import type { PublicOrderLine } from '../../../../shared/commerce';
import { SafeImage } from '../shared/SafeImage';
import { formatMinorCurrency } from './OrderSummary';

export function CheckoutProgress({ step }: { step: 1 | 2 | 3 }) {
  return <ol className="checkout-steps" aria-label="Checkout progress">
    {['Contact & Delivery', 'Payment', 'Confirmation'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined}>
      <span>{step > index + 1 ? <Check size={20} aria-label="Completed" /> : index + 1}</span>{label}
    </li>)}
  </ol>;
}

export function CheckoutWatermarks() {
  return <><img className="checkout-watermark" src="/assets/stussy-logo.png" alt="" aria-hidden="true" />
    <img className="checkout-watermark checkout-watermark-bottom" src="/assets/stussy-logo.png" alt="" aria-hidden="true" /></>;
}

export function CheckoutItems({ lines }: { lines: PublicOrderLine[] }) {
  return <div className="checkout-items">{lines.map(line => <article className="checkout-review-item" key={`${line.productId}:${line.size}:${line.color}`}>
    <SafeImage src={line.image} alt={line.name} fallbackLabel="Product image unavailable" />
    <div><h3>{line.name}</h3><p>{line.color} / Size {line.size}</p><p>Qty: {line.quantity}</p></div>
    <strong>{formatMinorCurrency(line.unitPriceMinor * line.quantity, 'USD')}</strong>
  </article>)}</div>;
}
