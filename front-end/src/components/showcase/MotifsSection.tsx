import { SafeImage } from '../shared/SafeImage';

export function MotifsSection() {
  return <section id="motifs" className="motifs-section" tabIndex={-1}>
    <div className="section-intro"><div><p className="eyebrow">04 — GRAPHIC HERITAGE</p><h2>The Motifs</h2></div></div>
    <div className="motif-grid">
      <article className="motif-panel motif-dice">
        <img className="motif-watermark" src="/assets/stussy-logo.png" alt="" aria-hidden="true" loading="lazy" />
        <SafeImage className="motif-art" src="/assets/motif-dice.png" alt="Stussy Lucky Dice graphic" fallbackLabel="Stussy Lucky Dice graphic image unavailable" loading="lazy" />
        <div className="motif-copy"><h3>LUCKY DICE</h3><p className="eyebrow">ICONIC SYMBOL — STUSSY HERITAGE</p></div>
      </article>
      <article className="motif-panel motif-ball">
        <img className="motif-watermark" src="/assets/stussy-logo.png" alt="" aria-hidden="true" loading="lazy" />
        <SafeImage className="motif-art" src="/assets/motif-8-ball.jpg" alt="Stussy 8-ball with flame graphic" fallbackLabel="Stussy 8-ball with flame graphic image unavailable" loading="lazy" />
        <div className="motif-copy"><h3>8-BALL FLAME</h3><p className="eyebrow">ETERNAL FLAME — STUSSY ICON</p></div>
      </article>
    </div>
  </section>;
}
