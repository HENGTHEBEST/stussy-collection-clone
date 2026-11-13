import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function ScrollManager() {
  const { pathname, hash, key } = useLocation();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    const pathChanged = previousPath.current !== pathname;
    if (pathChanged) {
      window.scrollTo?.({ top: 0, left: 0, behavior: 'instant' });
      previousPath.current = pathname;
    }
    let target: HTMLElement | null = null;
    try { if (hash) target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { /* Malformed anchors use the page heading. */ }
    function focus(element: HTMLElement) {
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1');
        element.addEventListener('blur', () => element.removeAttribute('tabindex'), { once: true });
      }
      element.focus({ preventScroll: true });
    }
    if (!target) {
      if (pathChanged) {
        const heading = document.querySelector<HTMLElement>('main h1');
        if (heading) focus(heading);
      }
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      focus(target);
      target.scrollIntoView?.({ block: 'start', behavior: 'instant' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash, key]);
  return null;
}
