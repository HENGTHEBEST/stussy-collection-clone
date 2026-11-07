import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { products } from '../../data/products';

export function LookbookSection() {
  return <section id="collection" className="lookbook-section" tabIndex={-1}>
    <div className="section-intro"><div><p className="eyebrow">02 — THE COLLECTION</p><h2>The Lookbook</h2></div>
      <p className="eyebrow collection-season">SUMMER CLASSICS / S/S 2026</p></div>
    <div className="lookbook-grid">{products.map((product) =>
      <motion.article key={product.id} className={`lookbook-card lookbook-${product.gridSpan} lookbook-${product.slug}`}
        initial={false} whileInView={typeof IntersectionObserver === 'undefined' ? undefined : { y: [24, 0], opacity: [.8, 1] }}
        viewport={{ once: true, margin: '-80px' }} transition={{ duration: .65 }}>
        <Link to={`/product/${product.slug}`}>
          <img src={product.image} alt={product.name} loading="lazy" style={{ objectPosition: product.objectPosition }} />
          <div className="lookbook-copy"><p className="eyebrow">{product.label}</p><h3>{product.name}</h3>
            <p>{product.description}</p><span className="lookbook-action">VIEW PRODUCT <span aria-hidden="true">↗</span></span></div>
        </Link>
      </motion.article>)}</div>
  </section>;
}
