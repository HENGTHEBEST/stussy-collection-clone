import { useId } from 'react';
export function QuantityControl({ quantity, onChange }: { quantity: number; onChange: (value: number) => void }) {
  const id = useId();
  const update = (value: number) => onChange(Number.isFinite(value) ? Math.min(10, Math.max(1, Math.floor(value))) : 1);
  return <div className="quantity-control"><label htmlFor={id}>Quantity</label><div>
    <button type="button" aria-label="Decrease quantity" disabled={quantity <= 1} onClick={() => update(quantity - 1)}>−</button>
    <input id={id} type="number" min="1" max="10" step="1" value={quantity} onChange={(event) => update(Number(event.target.value))} />
    <button type="button" aria-label="Increase quantity" disabled={quantity >= 10} onClick={() => update(quantity + 1)}>+</button>
  </div></div>;
}
