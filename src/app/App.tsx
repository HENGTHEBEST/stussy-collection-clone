import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { FeedbackProvider } from '../state/FeedbackProvider';
import { WishlistProvider } from '../state/WishlistProvider';
import { CartProvider } from '../state/CartProvider';
import { SiteHeader } from '../components/shared/SiteHeader';
import { SiteFooter } from '../components/shared/SiteFooter';
import { NotFoundPage } from '../pages/NotFoundPage';
import { HomePage } from '../pages/HomePage';
import { AppErrorBoundary } from './AppErrorBoundary';
import { ScrollManager } from './ScrollManager';
import '../styles/tokens.css';
import '../styles/base.css';

export interface AppProps { initialEntries?: string[] }

// Dedicated page implementations replace these headings in subsequent tasks.
function ShopPage() { return <div className="page-shell"><h1>Shop</h1></div>; }
function ProductPage() { return <div className="page-shell"><h1>Product</h1></div>; }
function WishlistPage() { return <div className="page-shell"><h1>Wishlist</h1></div>; }
function CartPage() { return <div className="page-shell"><h1>Cart</h1></div>; }
function CheckoutPage() { return <div className="page-shell"><h1>Checkout</h1></div>; }
function OrderPage() { return <div className="page-shell"><h1>Order confirmation</h1></div>; }

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
