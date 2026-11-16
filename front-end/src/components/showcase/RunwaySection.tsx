import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { ArrowLeft, ArrowRight, Pause, Play, X } from 'lucide-react';
import { runwayAssets, runwayLooks, runwayProducts, wrapLook } from './runwayData';
import { useRunwayAnimation } from './useRunwayAnimation';
import { SafeImage } from '../shared/SafeImage';
import '../../styles/runway.css';

function ModelImage({ index, probe = false }: { index: number; probe?: boolean }) {
  const look = runwayLooks[index];
  return <SafeImage fallbackLabel={`${look.name} image unavailable`} src={`${runwayAssets}model-${look.model}-640.webp`}
    srcSet={`${runwayAssets}model-${look.model}-640.webp 640w, ${runwayAssets}original-look-${look.model}.webp 1080w`}
    sizes="(min-width: 1800px) 540px, (min-width: 750px) 420px, 320px"
    width="1100" height="1956" alt={look.name} draggable={false} decoding="async" crossOrigin="anonymous"
    onLoad={(event) => {
      const image = event.currentTarget;
      image.classList.add('is-decoded');
      if (!probe) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 48; canvas.height = Math.round(48 * image.naturalHeight / image.naturalWidth);
        const context = canvas.getContext('2d');
        if (!context) return;
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let y = canvas.height - 1; y >= 0; y--) {
          for (let x = 0; x < 48; x++) if (pixels[(y * 48 + x) * 4 + 3] > 40) {
            image.style.setProperty('--runway-foot', String(Math.min(.4, (canvas.height - 1 - y) / canvas.height)));
            return;
          }
        }
      } catch { /* Cross-origin failures retain the image's original baseline. */ }
    }} />;
}

export function RunwaySection() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasZoomed = useRef(false);
  const rows = useRef<(HTMLLIElement | null)[]>([]);
  const [target, setTarget] = useState(0);
  const [reduced, setReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [playing, setPlaying] = useState(!reduced);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const [hover, setHover] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [hot, setHot] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; time: number; target: number; active: boolean } | null>(null);
  const suppressClick = useRef(0);
  const cursor = useRef<HTMLSpanElement>(null);
  const index = wrapLook(target);
  const look = runwayLooks[index];
  const dragTo = useRunwayAnimation(stage, target, reduced, visible);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => { setReduced(media?.matches ?? false); if (media?.matches) setPlaying(false); };
    media?.addEventListener('change', update);
    const observer = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting)) : null;
    if (section.current) observer?.observe(section.current);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => { observer?.disconnect(); media?.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    if (!playing || reduced || !visible || !pageVisible || hover || zoomed || dragging) return;
    const timer = window.setTimeout(() => { setTarget(value => value + 1); setHot(null); }, 5000);
    return () => window.clearTimeout(timer);
  }, [target, playing, reduced, visible, pageVisible, hover, zoomed, dragging]);

  useEffect(() => {
    if (zoomed) closeButton.current?.focus({ preventScroll: true });
    else if (wasZoomed.current) stage.current?.focus({ preventScroll: true });
    wasZoomed.current = zoomed;
  }, [zoomed]);

  function move(value: number) {
    setTarget(value); setHot(null);
    if (zoomed) setZoomed(false);
  }
  function go(next: number) {
    let distance = wrapLook(next - index);
    if (distance > 3) distance -= 6;
    move(target + distance);
  }
  function closePreview() { setZoomed(false); }
  function highlight(piece: number) {
    setPlaying(false); setHot(piece);
    const row = rows.current[piece];
    const list = row?.parentElement;
    if (row && list) {
      const itemBounds = row.getBoundingClientRect(), listBounds = list.getBoundingClientRect();
      // Scroll the clothing list only, keeping the preview and page position stable.
      list.scrollTo?.({ left: window.innerWidth < 750 ? list.scrollLeft + itemBounds.left - listBounds.left - 20 : 0,
        top: window.innerWidth >= 750 ? list.scrollTop + itemBounds.top - listBounds.top : 0, behavior: reduced ? 'auto' : 'smooth' });
    }
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp, target, active: false };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    if (cursor.current && event.pointerType === 'mouse') {
      const box = event.currentTarget.getBoundingClientRect();
      cursor.current.style.transform = `translate(${event.clientX - box.left}px, ${event.clientY - box.top}px)`;
      cursor.current.dataset.view = String((event.target as HTMLElement).closest('.runway-view') !== null);
    }
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!start.active && Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx) / 1.2) { drag.current = null; return; }
    if (!start.active && Math.abs(dx) > 8 && Math.abs(dx) > 1.2 * Math.abs(dy)) {
      start.active = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (start.active) {
      const unit = window.innerWidth < 750 ? Math.max(90, event.currentTarget.clientWidth * .32 * 1.6) : Math.max(120, event.currentTarget.clientWidth * .3);
      dragTo(start.target - dx / unit);
    }
  }
  function pointerEnd(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    drag.current = null; setDragging(false); dragTo(null);
    if (!start?.active) return;
    suppressClick.current = performance.now() + 60;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type === 'pointercancel') return;
    const dx = event.clientX - start.x;
    const velocity = dx / Math.max(1, event.timeStamp - start.time);
    if (Math.abs(dx) < 30 && Math.abs(velocity) < .3) return;
    const steps = window.innerWidth < 750 ? 1 : Math.min(2, Math.max(1, Math.round((Math.abs(dx) + Math.abs(velocity) * 160) / Math.max(120, event.currentTarget.clientWidth * .3))));
    move(start.target + (dx < 0 ? steps : -steps));
  }

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let accumulated = 0, lockedUntil = 0;
    function wheel(event: WheelEvent) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      if (performance.now() < lockedUntil) return;
      accumulated += event.deltaX;
      if (Math.abs(accumulated) > 45) {
        setTarget(value => value + (accumulated > 0 ? 1 : -1)); setHot(null);
        accumulated = 0; lockedUntil = performance.now() + 520;
      }
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);

  const running = playing && visible && pageVisible && !hover && !zoomed && !dragging && !reduced;
  return <section id="runway" ref={section} className={`runway-section${zoomed ? ' is-previewing' : ''}${dragging ? ' is-dragging' : ''}`}
    aria-label="Try the Look" onKeyDown={(event) => { if (event.key === 'Escape' && zoomed) { event.preventDefault(); closePreview(); } }}>
    <div className="runway-grid">
      <div className="runway-left">
        <div className="runway-head"><h2>Try the Look.</h2><p>Six looks, styled head to toe. Tap a pin to see the piece.</p></div>
        <span className="runway-sr" aria-live={running ? 'off' : 'polite'} aria-atomic="true">Look {index + 1}: {look.name}</span>
        <div className="runway-stage" ref={stage} tabIndex={0} role="region" aria-roledescription="carousel"
          aria-label="Try the Look — use arrow keys or swipe to change look" inert={zoomed}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(target + (event.key === 'ArrowRight' ? 1 : -1)); }
          }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
          onClickCapture={(event) => { if (performance.now() < suppressClick.current) { event.preventDefault(); event.stopPropagation(); } }}>
          <div className="runway-actors" aria-hidden="true">{Array.from({ length: 12 }, (_, body) =>
            <div className="runway-body" key={body}><span className="runway-shadow" /><ModelImage index={body % 6} probe /></div>)}</div>
          <button className="runway-view" aria-label={`View look: ${look.name}`} onClick={() => { setPlaying(false); setZoomed(true); }}>
            <span>View look</span>
          </button>
          <span className="runway-cursor" ref={cursor} aria-hidden="true"><span className="drag-label">Drag</span><span className="view-label">View</span></span>
          <span className="runway-walk" aria-hidden="true"><span style={{ transform: `scaleX(${(index + 1) / 6})` }} /></span>
        </div>
        <div className="runway-controls" aria-label="Look navigation">
          <button aria-label="Previous look" onClick={() => move(target - 1)}><ArrowLeft size={26} strokeWidth={1.3} /></button>
          <div className="runway-ticks">{runwayLooks.map((item, i) => <button key={i} aria-current={i === index} aria-label={`Look ${i + 1}: ${item.name}`}
            className={`runway-tick${i < index ? ' is-past' : ''}`} onClick={() => go(i)}>
            <span className="runway-tick-bar"><span key={`${target}-${running}`} className={i === index && running ? 'is-running' : ''} /></span>
            <span className="runway-tick-label">0{i + 1}<span className="runway-tick-name">&nbsp;&nbsp;{item.name}</span></span>
          </button>)}</div>
          <button aria-label={playing ? 'Pause autoplay' : 'Start autoplay'} aria-pressed={playing} disabled={reduced}
            onClick={() => setPlaying(value => !value)}>{playing ? <Pause size={16} /> : <Play size={16} />}</button>
          <button aria-label="Next look" onClick={() => move(target + 1)}><ArrowRight size={26} strokeWidth={1.3} /></button>
        </div>
        {zoomed && <div className="runway-preview" role="region" aria-label="View look" onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
          <div className="runway-preview-head"><div><span>Look 0{index + 1}</span><h3>{look.name}</h3></div>
            <button ref={closeButton} aria-label="Close look preview" onClick={closePreview}><X size={20} strokeWidth={1.5} /></button></div>
          <div className="runway-preview-stage" onClick={(event) => { if (event.target === event.currentTarget) closePreview(); }}>
            <div className="runway-preview-model"><ModelImage index={index} />{look.products.map((id, piece) => {
              const positions = index === 0 ? [[47, 27], [48, 58], [45, 96]] : [[50, 28], [48, 58], [45, 88]];
              return <button key={id} className={`runway-pin${hot === piece ? ' is-hot' : ''}`} style={{ left: `${positions[piece][0]}%`, top: `${positions[piece][1]}%`, '--piece': piece } as CSSProperties}
                aria-label={`${piece + 1}: ${runwayProducts[id].name}`} aria-controls={`runway-piece-${piece}`} onClick={() => highlight(piece)}>
                {piece + 1}<span>{runwayProducts[id].name}</span></button>;
            })}</div>
          </div><p className="runway-preview-hint">Tap a dot to see the piece</p>
        </div>}
      </div>
      <aside className="runway-panel" aria-label="Clothing in this look" onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHover(true); }}
        onPointerLeave={() => setHover(false)} onFocusCapture={() => setPlaying(false)}>
        <div className="runway-panel-head"><h3>In this look</h3><span>3 pieces</span></div>
        <div className="runway-mobile-head" key={`title-${index}`}><h3>{look.name}</h3><span>3 pieces</span></div>
        <ul className="runway-items" key={index}>{look.products.map((id, piece) => {
          const product = runwayProducts[id];
          return <li id={`runway-piece-${piece}`} key={id} ref={(element) => { rows.current[piece] = element; }}
            className={`runway-item${hot === piece ? ' is-hot' : ''}`} style={{ '--piece': piece } as CSSProperties}>
            {look.newPiece === piece && <span className="runway-tag">New</span>}
            <div className="runway-media"><SafeImage src={`${runwayAssets}source-${id}.webp`} alt="" fallbackLabel={`${product.name} image unavailable`} loading="lazy" decoding="async" /><span>{piece + 1}</span></div>
            <div className="runway-info"><span>{product.vendor}</span><a href={`https://nike-makknzjs.myshopify.com/products/${id}`} target="_blank" rel="noopener noreferrer"
              onClick={() => setPlaying(false)}>{product.name}</a><span className="runway-price">${product.price.toFixed(2)}</span></div>
          </li>;
        })}</ul>
      </aside>
    </div>
  </section>;
}
