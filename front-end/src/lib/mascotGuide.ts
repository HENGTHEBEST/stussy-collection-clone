import { products } from '../data/products';
import { findProductBySlug } from './catalog';

const unknown = "I don't have that information in this shop. Please check the relevant page or contact the shop before relying on it.";

export function guideSuggestions(pathname: string): string[] {
  if (pathname.startsWith('/product/')) return ['What sizes and price?', 'How do I add this to cart?'];
  if (pathname === '/shop') return ['How do I find a product?', 'Are prices and stock live?'];
  if (pathname === '/cart') return ['How do I check out?', 'Can I change my cart?'];
  if (pathname === '/checkout') return ['How do I check out?', 'How do KHQR and cards work?'];
  if (pathname.startsWith('/order/')) return ['How do I know I paid?', 'What if payment verification fails?'];
  if (pathname === '/wishlist') return ['How does the wishlist work?', 'How do I check out?'];
  return ['What can I do here?', 'How do I shop?'];
}

// Integration point: replace this local answerer with a server AI endpoint when one is configured;
// ground it in current catalog and payment state, and retain the explicit unknown fallback.
export async function answerGuideQuestion(question: string, pathname: string): Promise<string> {
  const q = question.toLowerCase().trim();
  if (!q) return 'Ask me about this page, products, checkout, or payments.';
  if (/refund|return policy|tracking/.test(q)) return unknown;
  if (/parcel|arriv|delivery date|ship(?:ping)? time|delivery time/.test(q)) return 'Checkout lists Standard delivery as 3–5 business days and Express delivery as 1–2 business days. These are estimates; I do not have an exact arrival date or tracking information.';
  if (pathname === '/checkout' && /total|shipping cost|delivery cost/.test(q)) return 'Your current total and delivery charge appear in the checkout Order Summary after pricing loads. I cannot read or confirm your current order amount from this guide.';
  if (/khqr|qr|bakong/.test(q) && /card|credit|debit/.test(q)) return 'At checkout, KHQR displays a code to scan with a compatible banking app; Card sends you to PayWay’s hosted page. Neither method is confirmed paid until the server verifies it. I cannot confirm current provider availability here.';
  if (/find|search|filter|sort/.test(q)) return 'Open Shop to search products, filter by category, color, size, or availability, and change the sort order. Select a product to view its details.';

  const currentProduct = pathname.startsWith('/product/') ? findProductBySlug(pathname.slice(9)) : undefined;
  const namedProduct = products.find((product) => q.includes(product.name.toLowerCase()) || q.includes(product.slug.replaceAll('-', ' ')));
  const product = namedProduct ?? currentProduct;
  if (product && /price|cost|size|color|stock|availab|material|feature|tell me about|this product/.test(q)) {
    return `${product.name}: ${product.description} Shown color: ${product.color}. Sizes: ${product.sizes.join(', ')}. Demo price: $${product.demoPrice.toFixed(2)}. Displayed availability: ${product.available ? 'available' : 'unavailable'}. These product details and prices are illustrative; live inventory is not confirmed.`;
  }
  if (/add.*cart|buy this/.test(q)) return 'On a product page, choose a size and quantity, then select Add to cart. Open Cart to review items and proceed to checkout.';
  if (/wishlist|favorite|favourite|save/.test(q)) return 'Use the Save to wishlist button on a product page. Open Wishlist from the header to review or remove saved items.';
  if (/cart|quantity|remove item/.test(q) && !/checkout/.test(q)) return 'Open Cart from the header. Review your items, adjust quantities or remove items there, then select Proceed to checkout.';
  if (/khqr|qr|bakong/.test(q)) return 'At checkout, choose KHQR in the Payment step and scan the QR with a compatible banking app. The order is paid only after server-side verification; a displayed QR is not proof of payment. If verification is unavailable and you already paid, do not pay again.';
  if (/card|credit|debit|payway/.test(q)) return 'At checkout, choose Card if it is offered. Card details are entered on PayWay’s hosted page, not in this shop. I cannot confirm whether your current merchant account is enabled for real card payments.';
  if (/paid|payment status|confirm|verification|order/.test(q) && pathname.startsWith('/order/')) return 'The Order page shows the latest status returned by the shop server. Only a provider-verified paid status confirms payment. If verification is unavailable after you paid, keep your order ID and do not pay twice.';
  if (/checkout|how.*pay|payment/.test(q)) return 'Review your cart, continue to Contact & Delivery, then choose KHQR or Card in the Payment step if available. The shop creates an order and waits for provider verification before showing it as paid. Current provider acceptance cannot be confirmed from this guide.';
  if (/live|real|stock|availab|price|product/.test(q)) return `The shop displays ${products.length} catalog products. Use Shop search and filters to browse them. Prices, variants, and availability are labeled illustrative, so I cannot confirm live stock or final pricing here.`;
  if (/find|search|filter|sort|shop/.test(q)) return 'Open Shop to search products, filter by category, color, size, or availability, and change the sort order. Select a product to view its details.';
  if (/\b(here|page|screen|use|help)\b|what can/.test(q)) {
    if (pathname === '/wishlist') return 'This is your Wishlist. Review saved products, open a product for details, or clear the list.';
    if (pathname === '/cart') return 'This is your Cart. Review items and quantities, then use Proceed to checkout when ready.';
    if (pathname === '/checkout') return 'This is Checkout. Complete Contact & Delivery, then choose an available payment method in the Payment step.';
    if (pathname.startsWith('/order/')) return 'This Order page shows your order status and payment details. Keep the order ID if you need help with a payment.';
    if (pathname.startsWith('/product/')) return 'This product page shows its description, illustrative variants and price, and controls for the wishlist and cart.';
    if (pathname === '/shop') return 'This is Shop. Use search, filters, and sorting to browse the catalog, then open a product.';
    return 'Explore the collection on Home, open Shop for product search, and use the header for Wishlist and Cart.';
  }
  return unknown;
}
