import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { FeedbackProvider } from '../state/FeedbackProvider';
import { WishlistProvider } from '../state/WishlistProvider';
import { CartProvider } from '../state/CartProvider';
import { SiteHeader } from '../components/shared/SiteHeader';
import { SiteFooter } from '../components/shared/SiteFooter';
import { NotFoundPage } from '../pages/NotFoundPage';
import { HomePage } from '../pages/HomePage';
import { ShopPage } from '../pages/ShopPage';
import { ProductPage } from '../pages/ProductPage';
import { WishlistPage } from '../pages/WishlistPage';
import { CartPage } from '../pages/CartPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { OrderPage } from '../pages/OrderPage';
import { AppErrorBoundary } from './AppErrorBoundary';
import { ScrollManager } from './ScrollManager';
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/commerce.css';

export interface AppProps { initialEntries?: string[] }

export function App({ initialEntries }: AppProps) {
  const shell = <FeedbackProvider><WishlistProvider><CartProvider>
    <ScrollManager />
    <SiteHeader />
    <main id="main-content" tabIndex={-1}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/product/:slug" element={<ProductPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order/:orderId" element={<OrderPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </main>
    <SiteFooter />
  </CartProvider></WishlistProvider></FeedbackProvider>;
  return <AppErrorBoundary>{initialEntries
    ? <MemoryRouter initialEntries={initialEntries}>{shell}</MemoryRouter>
    : <BrowserRouter>{shell}</BrowserRouter>}
  </AppErrorBoundary>;
}
