import { SafeImage } from '../shared/SafeImage';

const timeline = [
  ['1980', 'Founded by Shawn Stussy in Laguna Beach, California.'],
  ['1991', 'International Stussy Tribe established across major cities.'],
  ['2001', 'Shawn Stussy departs; brand continues as a global icon.'],
  ['2026', 'Summer Classics collection — back to the roots.'],
];
export function AboutSection() {
  return <section id="about" className="about-section" tabIndex={-1}>
    <div className="about-image"><SafeImage src="/assets/lookbook-8-ball-black.jpg" alt="Black Stussy 8-ball tee from the Summer Classics lookbook" fallbackLabel="Black Stussy 8-ball tee from the Summer Classics lookbook image unavailable" loading="lazy" /></div>
    <div className="about-content"><p className="eyebrow">04 — ABOUT US</p><h2>Born on the Board</h2>
      <p className="about-copy">What started as hand-shaped surfboards and hand-printed tees in Laguna Beach became one of the most influential streetwear brands in history. Stussy bridges surf, skate, hip-hop and high fashion — authentic to the core.</p>
      <ol className="about-timeline">{timeline.map(([year, text]) => <li key={year}><span className="timeline-year">{year}</span><p>{text}</p></li>)}</ol>
    </div>
  </section>;
}
