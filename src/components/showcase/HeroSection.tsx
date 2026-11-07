import { useEffect, useRef, type CSSProperties } from 'react';
import { useShowcaseMotion } from './CustomCursor';
import { SafeImage } from '../shared/SafeImage';

export function HeroSection() {
  const section = useRef<HTMLElement>(null);
  const images = useRef<HTMLDivElement>(null);
  const enabled = useShowcaseMotion();
  useEffect(() => {
    if (!enabled || !section.current || !images.current) return;
    const element = section.current;
    const media = images.current;
    let frame = 0;
    let x = 0;
    let y = 0;
    const paint = () => { frame = 0; media.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.04)`; };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      const bounds = element.getBoundingClientRect();
      x = Math.max(-12, Math.min(12, (event.clientX - bounds.left - bounds.width / 2) / Math.max(1, bounds.width / 2) * 12));
      y = Math.max(-8, Math.min(8, (event.clientY - bounds.top - bounds.height / 2) / Math.max(1, bounds.height / 2) * 8));
      schedule();
    };
    const reset = () => { x = 0; y = 0; schedule(); };
    element.addEventListener('pointermove', move, { passive: true });
    element.addEventListener('pointerleave', reset);
    return () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', reset);
      cancelAnimationFrame(frame);
      media.removeAttribute('style');
    };
  }, [enabled]);
  return <section id="hero" ref={section} className="hero-section" tabIndex={-1}>
    <div className="hero-images" ref={images}>
      <SafeImage src="/assets/hero-man.jpg" alt="Man wearing a black Stussy script logo tee" fallbackLabel="Man wearing a black Stussy script logo tee image unavailable" fetchPriority="high" />
      <SafeImage src="/assets/hero-woman.jpg" alt="Woman wearing a white Stussy Summer Classics tee" fallbackLabel="Woman wearing a white Stussy Summer Classics tee image unavailable" fetchPriority="high" />
    </div>
    <div className="hero-shade" aria-hidden="true" /><div className="hero-divider" aria-hidden="true" />
    <div className="hero-content">
      <img className="hero-logo" src="/assets/stussy-logo.png" alt="" aria-hidden="true" />
      <p className="eyebrow hero-est">EST. 1980 — LOS ANGELES, CA USA</p>
      <h1 aria-label="Summer Classics">{'SUMMER CLASSICS'.split('').map((letter, index) =>
        <span aria-hidden="true" key={index} style={{ '--letter-index': index } as CSSProperties}>{letter === ' ' ? '\u00a0' : letter}</span>)}</h1>
    </div>
    <span className="hero-label hero-him">HIM</span><span className="hero-label hero-her">HER</span>
    <a className="hero-scroll" href="#collection">SCROLL <span aria-hidden="true">↓</span></a>
  </section>;
}
