import { CustomCursor } from '../components/showcase/CustomCursor';
import { GrainOverlay } from '../components/showcase/GrainOverlay';
import { HeroSection } from '../components/showcase/HeroSection';
import { MarqueeStrip } from '../components/showcase/MarqueeStrip';
import { LookbookSection } from '../components/showcase/LookbookSection';
import { ManifestoSection } from '../components/showcase/ManifestoSection';
import { MotifsSection } from '../components/showcase/MotifsSection';
import { AboutSection } from '../components/showcase/AboutSection';
import '../styles/showcase.css';

export function HomePage() {
  return <div className="showcase-home"><CustomCursor /><GrainOverlay /><HeroSection /><MarqueeStrip />
    <LookbookSection /><ManifestoSection /><MotifsSection /><AboutSection /></div>;
}
