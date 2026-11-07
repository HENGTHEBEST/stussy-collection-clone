import { useEffect, useRef, useState } from 'react';

// Shared capability gate also prevents hero parallax on touch and reduced motion.
export function useShowcaseMotion() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const fine = window.matchMedia('(pointer: fine)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setEnabled(fine.matches && !reduced.matches);
    update();
    fine.addEventListener('change', update);
    reduced.addEventListener('change', update);
    return () => {
      fine.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);
  return enabled;
}

export function CustomCursor() {
  const enabled = useShowcaseMotion();
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled || !layer.current) return;
    const root = layer.current;
    const dot = root.querySelector<HTMLElement>('.cursor-dot')!;
    const ring = root.querySelector<HTMLElement>('.cursor-ring')!;
    const trails = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    let frame = 0;
    let x = 0;
    let y = 0;
    function removeTrail(node: HTMLElement) {
      clearTimeout(trails.get(node));
      trails.delete(node);
      node.remove();
    }
    function paint() {
      frame = 0;
      dot.style.transform = ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      root.classList.add('cursor-active');
      if (trails.size >= 24) removeTrail(trails.keys().next().value!);
      const trail = document.createElement('img');
      trail.src = '/assets/stussy-logo.png';
      trail.alt = '';
      trail.className = 'cursor-trail';
      trail.setAttribute('aria-hidden', 'true');
      trail.style.left = `${x}px`;
      trail.style.top = `${y}px`;
      root.append(trail);
      trails.set(trail, setTimeout(() => removeTrail(trail), 1200));
    }
    function move(event: PointerEvent) {
      if (event.pointerType === 'touch') return;
      // Native controls keep their usual pointer and keyboard interactions.
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    }
    function hide() { root.classList.remove('cursor-active'); }
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('blur', hide);
    document.addEventListener('keydown', hide);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('blur', hide);
      document.removeEventListener('keydown', hide);
      cancelAnimationFrame(frame);
      [...trails.keys()].forEach(removeTrail);
    };
  }, [enabled]);
  if (!enabled) return null;
  return <div className="custom-cursor" ref={layer} aria-hidden="true">
    <div className="cursor-dot" aria-hidden="true" /><div className="cursor-ring" aria-hidden="true" />
  </div>;
}
