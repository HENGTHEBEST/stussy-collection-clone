const phrase = 'SUMMER CLASSICS — STUSSY — EST. 1980 — LOS ANGELES — ';
export function MarqueeStrip() {
  return <div className="marquee-strip">
    <p className="showcase-sr-only">{phrase}</p>
    <div className="marquee-track" aria-hidden="true">
      <span>{phrase.repeat(4)}</span><span>{phrase.repeat(4)}</span>
    </div>
  </div>;
}
