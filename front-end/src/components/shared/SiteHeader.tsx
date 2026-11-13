import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { useCart } from '../../state/CartProvider';
import { useWishlist } from '../../state/WishlistProvider';
import { MascotGuide } from './MascotGuide';

export function SiteHeader() {
  const { itemCount } = useCart();
  const { ids } = useWishlist();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const close = () => { setOpen(false); trigger.current?.focus(); };

  useLayoutEffect(() => {
    // History navigation must restore focus before the menu becomes hidden.
    // ScrollManager can then focus the destination heading or requested section.
    if (open) close();
    setHidden(false);
  }, [location.pathname, location.hash, location.key]);
  useEffect(() => {
    lastScrollY.current = window.scrollY;
    const scroll = () => {
      const nextScrollY = window.scrollY;
      const change = nextScrollY - lastScrollY.current;
      if (open || nextScrollY < 16) setHidden(false);
      else if (Math.abs(change) >= 8) setHidden(change > 0);
      lastScrollY.current = nextScrollY;
    };
    window.addEventListener('scroll', scroll, { passive: true });
    return () => window.removeEventListener('scroll', scroll);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    const resize = () => { if (window.innerWidth >= 1100) close(); };
    document.addEventListener('keydown', escape);
    window.addEventListener('resize', resize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', escape);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  const links = [
    ['Home', '/#hero'], ['Collection', '/#collection'], ['About Us', '/#about'], ['Contact', '/#contact'],
    ['Shop', '/shop'], [`Wishlist (${ids.length})`, '/wishlist'], [`Cart (${itemCount})`, '/cart'],
  ];
  function containFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const anchors = menu.current?.querySelectorAll<HTMLAnchorElement>('a');
    if (!anchors?.length) return;
    const first = anchors[0];
    const last = anchors[anchors.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className={'site-header' + (/^\/(cart|checkout|order)(\/|$)/.test(location.pathname) ? ' checkout-header' : '') + (hidden ? ' is-hidden' : '')} onFocusCapture={() => setHidden(false)}>
      <Link className="site-logo" to="/" aria-label="Stussy Collection home">
        <img src="/assets/stussy-logo.png" alt="" aria-hidden="true" width="96" height="64" />
      </Link>
      <nav className="desktop-navigation" aria-label="Primary navigation">
        {links.slice(0, 5).map(([label, to]) => <Link key={to} to={to}>{label}</Link>)}
      </nav>
      <nav className="header-actions" aria-label="Shopping">
        <Link to="/wishlist" aria-label={`Wishlist (${ids.length})`} title="Wishlist"><Heart aria-hidden="true" /><span className="header-count" aria-hidden="true">{ids.length}</span></Link>
        <Link to="/cart" aria-label={`Cart (${itemCount})`} title="Cart"><ShoppingCart aria-hidden="true" /><span className="header-count" aria-hidden="true">{itemCount}</span></Link>
      </nav>
      <button className="menu-trigger" type="button" ref={trigger} aria-expanded={open}
        aria-controls="mobile-navigation" onClick={() => open ? close() : setOpen(true)}>Menu</button>
      <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile navigation"
        hidden={!open} ref={menu} onKeyDown={containFocus}>
        {links.map(([label, to]) => <Link key={to} to={to} onClick={close}>{label}</Link>)}
      </nav>
    </header>
    <MascotGuide pathname={location.pathname} open={guideOpen} onOpenChange={setGuideOpen} />
  </>;
}
