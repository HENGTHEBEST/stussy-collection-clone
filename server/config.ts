export interface PricingPolicy {
  unitPriceMinor: number | null;
  freeShipping: boolean;
}

export interface BakongCredentials {
  apiBaseUrl: string;
  apiToken: string;
  bakongAccountId: string;
  merchantId: string;
  acquiringBank: string;
  merchantName: string;
  merchantCity: string;
}

export interface ServerConfig {
  port: number;
  appOrigin: string;
  paymentMode: 'mock' | 'sit' | 'production';
  merchantName: string;
  merchantCity: string;
  bakongAccountId: string;
  currency: 'USD';
  sqlitePath: string;
  pricing: PricingPolicy;
}

export function loadBakongCredentials(
  env: NodeJS.ProcessEnv,
  mode: ServerConfig['paymentMode'],
): BakongCredentials | null {
  if (mode === 'mock') return null;
  function required(key: string, maximum: number): string {
    const value = env[key]?.trim();
    if (!value || value.length > maximum) throw new Error('Invalid server setting: ' + key);
    return value;
  }
  const apiBaseUrl = required('BAKONG_API_BASE_URL', 255);
  let url: URL;
  try { url = new URL(apiBaseUrl); } catch { throw new Error('Invalid server setting: BAKONG_API_BASE_URL'); }
  if (url.protocol !== 'https:' || url.origin !== apiBaseUrl || url.username || url.password) {
    throw new Error('Invalid server setting: BAKONG_API_BASE_URL');
  }
  return {
    apiBaseUrl,
    apiToken: required('BAKONG_API_TOKEN', 4096),
    bakongAccountId: required('BAKONG_ACCOUNT_ID', 32),
    merchantId: required('BAKONG_MERCHANT_ID', 32),
    acquiringBank: required('BAKONG_ACQUIRING_BANK', 32),
    merchantName: required('MERCHANT_NAME', 25),
    merchantCity: required('MERCHANT_CITY', 15),
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  function text(key: string, fallback: string): string {
    const value = (env[key] ?? fallback).trim();
    if (!value) throw new Error('Invalid server setting: ' + key);
    return value;
  }
  const portText = text('API_PORT', '8787');
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid server setting: API_PORT');
  }
  const appOrigin = text('APP_ORIGIN', 'http://localhost:5173');
  let origin: URL;
  try { origin = new URL(appOrigin); } catch { throw new Error('Invalid server setting: APP_ORIGIN'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== appOrigin) {
    throw new Error('Invalid server setting: APP_ORIGIN');
  }
  const paymentMode = text('PAYMENT_MODE', 'mock');
  if (paymentMode !== 'mock' && paymentMode !== 'sit' && paymentMode !== 'production') {
    throw new Error('Invalid server setting: PAYMENT_MODE');
  }
  loadBakongCredentials(env, paymentMode);
  const currency = text('ORDER_CURRENCY', 'USD');
  if (currency !== 'USD') throw new Error('Invalid server setting: ORDER_CURRENCY');
  const priceText = env.TEST_UNIT_PRICE_MINOR;
  const unitPriceMinor = priceText === undefined ? null : Number(priceText);
  if (unitPriceMinor !== null && (!/^\d+$/.test(priceText ?? '') || !Number.isInteger(unitPriceMinor)
    || unitPriceMinor < 1 || unitPriceMinor > 999999)) {
    throw new Error('Invalid server setting: TEST_UNIT_PRICE_MINOR');
  }
  const freeShipping = env.TEST_FREE_SHIPPING ?? 'false';
  if (freeShipping !== 'true' && freeShipping !== 'false') {
    throw new Error('Invalid server setting: TEST_FREE_SHIPPING');
  }
  return {
    port, appOrigin, paymentMode, currency,
    pricing: { unitPriceMinor, freeShipping: freeShipping === 'true' },
    merchantName: text('MERCHANT_NAME', 'Stussy Collection Showcase'),
    merchantCity: text('MERCHANT_CITY', 'Phnom Penh'),
    bakongAccountId: paymentMode === 'mock' ? env.BAKONG_ACCOUNT_ID?.trim() || 'demo@mock' : text('BAKONG_ACCOUNT_ID', 'demo@mock'),
    sqlitePath: text('SQLITE_PATH', './data/store.sqlite'),
  };
}
