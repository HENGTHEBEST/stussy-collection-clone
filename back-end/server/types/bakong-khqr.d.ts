declare module 'bakong-khqr' {
  export const khqrData: { currency: { usd: 840 } };

  export interface MerchantOptions {
    currency?: typeof khqrData.currency.usd;
    amount?: number;
    billNumber?: string;
    expirationTimestamp?: number;
    merchantCategoryCode?: string;
  }

  export class MerchantInfo {
    constructor(
      bakongAccountId: string,
      merchantName: string,
      merchantCity: string,
      merchantId: string,
      acquiringBank: string,
      options?: MerchantOptions,
    );
  }

  export interface KHQRResponse {
    status: { code: number; errorCode: number | null; message: string | null };
    data: { qr: string; md5: string } | null;
  }

  export class BakongKHQR {
    generateMerchant(merchantInfo: MerchantInfo): KHQRResponse;
    static verify(qr: string): { isValid: boolean };
  }

  const sdk: {
    khqrData: typeof khqrData;
    MerchantInfo: typeof MerchantInfo;
    BakongKHQR: typeof BakongKHQR;
  };
  export default sdk;
}
