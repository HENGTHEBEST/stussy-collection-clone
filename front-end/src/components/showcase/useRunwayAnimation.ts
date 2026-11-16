import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const wrap = (value: number) => ((value % 12) + 12) % 12;

// The queue is painted outside React so spring frames do not rerender the clothing panel.
export function useRunwayAnimation(stage: RefObject<HTMLDivElement | null>, target: number, reduced: boolean, visible: boolean) {
  const destination = useRef(target);
  const kick = useRef<() => void>(() => {});
  useEffect(() => { destination.current = target; kick.current(); }, [target]);

  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    const bodies = [...root.querySelectorAll<HTMLElement>('.runway-body')];
    let width = 0, height = 0, mobile = false, frame = 0, previous = 0;
    let current = destination.current - (reduced ? 0 : 1.15), velocity = 0;
    const line = bodies.map((_, i) => ({ x: wrap(i - destination.current) + (reduced ? 0 : 1.15), g: wrap(i - destination.current), v: 0, goal: wrap(i - destination.current), from: 0, trip: false }));

    function render(time: number) {
      frame = 0;
      const dt = Math.min(.034, previous ? (time - previous) / 1000 : 1 / 60);
      previous = time;
      const h = dt / 3;
      let still = true;
      if (reduced) { current = destination.current; velocity = 0; }
      else for (let j = 0; j < 3; j++) {
        velocity += (-95 * (current - destination.current) - 2 * Math.sqrt(95) * velocity) * h;
        current += velocity * h;
      }
      if (Math.abs(current - destination.current) < .0005 && Math.abs(velocity) < .0005) current = destination.current;
      else still = false;

      bodies.forEach((body, a) => {
        let x: number, bottom: number, scale: number, opacity: number, blur: number, z: number;
        if (mobile) {
          const s = line[a];
          const goal = wrap(a - destination.current);
          if (Math.abs(goal - s.goal) > 6) { s.trip = true; s.from = s.x; }
          s.goal = goal;
          if (reduced) { s.x = s.g = goal; s.v = 0; s.trip = false; }
          else {
            const tau = s.trip ? .1 : .03 + .04 * Math.min(goal, 4);
            s.g += (goal - s.g) * (1 - Math.exp(-dt / tau));
            for (let j = 0; j < 3; j++) {
              s.v += (-95 * (s.x - s.g) - 2 * Math.sqrt(95) * s.v) * h;
              s.x += s.v * h;
            }
          }
          if (Math.abs(s.x - goal) < .0006 && Math.abs(s.v) < .0006) { s.x = s.g = goal; s.v = 0; }
          else still = false;
          if (Math.abs(s.x - goal) < .02) s.trip = false;
          let k = s.x, exit = -1;
          if (s.trip) {
            const u = clamp(Math.abs(s.x - s.from) / Math.max(.001, Math.abs(goal - s.from)), 0, 1);
            if (goal > s.from) { if (u < .5) exit = 2 * u * 1.4; else k = goal + 2 * (1 - u); }
            else if (u < .5) k = s.from + 2 * u;
            else exit = 2 * (1 - u) * 1.4;
          } else if (k < 0) exit = Math.min(-k, 1.4);
          if (exit >= 0) {
            x = width * (.3 - .55 * exit); bottom = 22 - 22 * exit; scale = 1 + .14 * exit;
            opacity = Math.max(0, 1 - 1.05 * exit); blur = 4 * Math.min(exit, 1); z = 1100;
          } else {
            x = width * (.3 + .32 * k); bottom = 22 + 22 * k; scale = .76 ** k;
            opacity = k <= 3 ? 1 - .13 * k : Math.max(0, .61 * (4 - k));
            blur = Math.min(.9 * k, 3.2); z = 1000 - Math.round(10 * k);
          }
        } else {
          const phi = (wrap(a - current + 6) - 6) * Math.PI / 6;
          const depth = .62 * width * (1 - Math.cos(phi));
          const perspective = 1.65 * width / (1.65 * width + depth || 1);
          const slot = Math.abs(phi) / (Math.PI / 6);
          scale = perspective * (1 + .08 * clamp(1 - slot, 0, 1));
          x = .5 * width + .62 * width * Math.sin(phi) * perspective;
          bottom = height - (.36 * height + (height - 34 - .36 * height) * perspective);
          blur = slot <= 1 ? 1.8 * slot : Math.min(1.8 + (slot - 1) * 2, 6.5);
          opacity = clamp((Math.cos(phi) + .55) / .3, 0, 1); z = Math.round(scale * 1000);
        }
        body.style.transform = `translate3d(${x}px, ${-bottom}px, 0) translateX(-50%) scale(${scale})`;
        body.style.opacity = String(opacity);
        body.style.filter = blur > .05 ? `blur(${blur.toFixed(1)}px)` : '';
        body.style.zIndex = String(z);
        body.style.visibility = opacity < .01 ? 'hidden' : 'visible';
      });
      root!.classList.toggle('is-settled', still);
      if (!still && visible && !document.hidden) frame = requestAnimationFrame(render);
    }
    function start() {
      if (!frame && visible && !document.hidden) { previous = 0; frame = requestAnimationFrame(render); }
    }
    function measure() {
      width = root!.clientWidth; height = root!.clientHeight;
      mobile = window.innerWidth < 750;
      root!.style.setProperty('--runway-model-height', `${Math.max(200, Math.round(mobile ? height - 42 : (height - 52) / 1.08))}px`);
      start();
    }
    function visibility() {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start();
    }
    kick.current = start;
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    window.addEventListener('resize', measure);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame); observer?.disconnect(); kick.current = () => {};
      window.removeEventListener('resize', measure);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [stage, reduced, visible]);
  return (position: number | null) => {
    destination.current = position ?? target;
    kick.current();
  };
}
