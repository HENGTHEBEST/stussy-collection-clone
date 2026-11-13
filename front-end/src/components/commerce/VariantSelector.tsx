import { useId, type RefObject } from 'react';
import type { Product, ProductSize } from '../../types/commerce';
export function VariantSelector({ product, size, onSizeChange, error, sizeRef }: {
  product: Product; size: ProductSize | ''; onSizeChange: (size: ProductSize) => void;
  error: string; sizeRef: RefObject<HTMLDivElement | null>;
}) {
  const id = useId();
  return <div className="variant-selector">
    <fieldset><legend>Demo color</legend><div role="radiogroup" aria-label="Color">
      <label><input type="radio" name={`${id}-color`} value={product.color} checked readOnly />{product.color}</label>
    </div></fieldset>
    <fieldset><legend id={`${id}-size`}>Size</legend>
      <div role="radiogroup" aria-labelledby={`${id}-size`} aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error} tabIndex={-1} ref={sizeRef}>
        {product.sizes.map((value) => <label key={value}><input type="radio" name={`${id}-size`} value={value} checked={size === value} onChange={() => onSizeChange(value)} />{value}</label>)}
      </div>
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </fieldset>
  </div>;
}
