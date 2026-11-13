const key = 'stussy-checkout-pending-orders-v1';

export function clearCheckoutOrderIds() {
  try { sessionStorage.removeItem(key); } catch { /* Browser storage can be blocked. */ }
}

export function readCheckoutOrderIds(): string[] {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored === null) return [];
    const ids: unknown = JSON.parse(stored);
    if (Array.isArray(ids) && ids.length >= 1 && ids.length <= 2
      && ids.every((id: unknown) => typeof id === 'string' && id.length > 0 && id.length <= 128)
      && new Set(ids).size === ids.length) return ids;
  } catch { /* Invalid or blocked storage cannot authorize a payment. */ }
  clearCheckoutOrderIds();
  return [];
}

// The first ID is selected; no order snapshot or customer/provider data is stored.
export function saveCheckoutOrderIds(ids: string[]) {
  try { sessionStorage.setItem(key, JSON.stringify(ids)); } catch { /* Payment still works when persistence is blocked. */ }
}

export function removeCheckoutOrderId(id: string): string[] {
  const remaining = readCheckoutOrderIds().filter((pendingId) => pendingId !== id);
  if (remaining.length) saveCheckoutOrderIds(remaining);
  else clearCheckoutOrderIds();
  return remaining;
}
