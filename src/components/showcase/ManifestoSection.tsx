import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { useShowcaseMotion } from './CustomCursor';

export function ManifestoSection() {
  const section = useRef<HTMLElement>(null);
  const enabled = useShowcaseMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ['start end', 'end start'] });
  const imageY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);
  const headingY = useTransform(scrollYProgress, [0, 1], [35, -35]);
  return <section id="escape" ref={section} className="manifesto-section" tabIndex={-1}>
    <motion.img className="manifesto-image" src="/assets/manifesto.jpg" alt="Stussy streetwear editorial in an urban setting"
      loading="lazy" style={enabled ? { y: imageY } : undefined} />
    <div className="manifesto-shade" aria-hidden="true" />
    <img className="manifesto-watermark" src="/assets/stussy-logo.png" alt="" aria-hidden="true" loading="lazy" />
    <div className="manifesto-content"><p className="eyebrow">03 — BRAND MANIFESTO</p>
      <motion.h2 style={enabled ? { y: headingY } : undefined}>Escape</motion.h2>
      <p className="manifesto-tagline">STREET — STYLE</p>
      <p className="manifesto-copy">Our new collection is built to take you on an escape from the concrete jungle and into a world of creativity and self-expression. We believe that fashion is more than just clothes — it's a statement about who you are and what you stand for.</p>
    </div>
  </section>;
}
