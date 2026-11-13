import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return <div className="page-shell error-page">
    <p className="eyebrow">404</p><h1>Page not found</h1>
    <p>This page is outside the collection. Find your way back.</p>
    <div className="action-row"><Link to="/">Return home</Link><Link to="/shop">Explore shop</Link></div>
  </div>;
}
