import { useEffect, useRef, useState } from 'react';
import type { CatalogFilters, Product, ProductColor, ProductSize } from '../../types/commerce';

export const categories: Product['category'][] = ['T-Shirts', 'Crops'];
export const colors: ProductColor[] = ['Black', 'White', 'Natural'];
export const sizes: ProductSize[] = ['XS', 'S', 'M', 'L', 'XL'];

export function FilterPanel({ filters, onChange, onClear }: {
  filters: CatalogFilters; onChange: (filters: CatalogFilters) => void; onClear: () => void;
}) {
  const [mobile, setMobile] = useState(() => window.matchMedia?.('(max-width: 767px)').matches ?? false);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null); const drawer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 767px)');
    if (!media) return;
    const update = () => { setMobile(media.matches); setOpen(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!mobile || !open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.body.style.overflow = previous; trigger.current?.focus(); };
  }, [mobile, open]);
  const controls = <>
    <fieldset><legend>Category</legend>{categories.map((value) => <label key={value}><input type="checkbox" checked={filters.categories.includes(value)} onChange={() => onChange({ ...filters, categories: filters.categories.includes(value) ? filters.categories.filter((item) => item !== value) : [...filters.categories, value] })} />{value}</label>)}</fieldset>
    <fieldset><legend>Color</legend>{colors.map((value) => <label key={value}><input type="checkbox" checked={filters.colors.includes(value)} onChange={() => onChange({ ...filters, colors: filters.colors.includes(value) ? filters.colors.filter((item) => item !== value) : [...filters.colors, value] })} />{value}</label>)}</fieldset>
    <fieldset><legend>Size</legend>{sizes.map((value) => <label key={value}><input type="checkbox" checked={filters.sizes.includes(value)} onChange={() => onChange({ ...filters, sizes: filters.sizes.includes(value) ? filters.sizes.filter((item) => item !== value) : [...filters.sizes, value] })} />{value}</label>)}</fieldset>
    <label><input type="checkbox" checked={filters.availableOnly} onChange={(event) => onChange({ ...filters, availableOnly: event.target.checked })} />Demo available only</label>
    <button type="button" onClick={onClear}>Clear all</button>
  </>;
  if (!mobile) return <aside className="filter-rail" aria-label="Product filters">{controls}</aside>;
  return <><button ref={trigger} type="button" aria-expanded={open} aria-controls="product-filters" onClick={() => setOpen(true)}>Filters</button>
    {open && <div className="filter-backdrop"><div ref={drawer} id="product-filters" className="filter-drawer" role="dialog" aria-modal="true" aria-label="Product filters"
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
        if (event.key !== 'Tab') return;
        const items = drawer.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]');
        if (!items?.length) return;
        const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <button type="button" onClick={() => setOpen(false)}>Close filters</button><h2>Product filters</h2>{controls}
      <button type="button" onClick={() => setOpen(false)}>Apply filters</button>
    </div></div>}
  </>;
}
