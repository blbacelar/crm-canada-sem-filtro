import { JourneyState } from '@/types/database.types';

export interface HotmartWebhookPayload {
  id?: string;
  creation_date?: number;
  event: string;
  version?: string;
  hottok?: string;
  data: {
    product?: {
      id?: number;
      name?: string;
    };
    buyer?: {
      name?: string;
      email?: string;
      checkout_phone?: string;
      document?: string;
      address?: {
        country?: string;
        country_iso?: string;
        zip_code?: string;
        city?: string;
        state?: string;
        address?: string;
        neighborhood?: string;
        number?: string;
        complement?: string;
      };
    };
    purchase?: {
      transaction?: string;
      order_date?: number | string;
      status?: string;
      price?: {
        value?: number;
        currency_value?: string;
      };
      original_offer_price?: {
        value?: number;
      };
    };
  };
}

export interface ParsedHotmartEvent {
  eventType: string;
  transactionCode: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  buyerDocument: string | null;
  buyerCountry: string | null;
  buyerZipCode: string | null;
  buyerCity: string | null;
  buyerState: string | null;
  buyerAddress: string | null;
  buyerDistrict: string | null;
  buyerNumber: string | null;
  buyerComplement: string | null;
  productName: string;
  priceGross: number;
  priceNet: number;
  purchaseDate: string;
  mappedJourneyState: JourneyState;
}

const ACCESS_GRANTING_EVENTS = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'PURCHASE_COMPLETED',
  'APPROVED',
  'COMPLETE',
]);

export function grantsDiagnosticAccess(eventType: string) {
  return ACCESS_GRANTING_EVENTS.has(eventType.trim().toUpperCase());
}

export function parseHotmartWebhook(payload: HotmartWebhookPayload): ParsedHotmartEvent | null {
  if (!payload || !payload.event || !payload.data) {
    return null;
  }

  const data = payload.data;
  const buyer: any = data.buyer || {};
  const address: any = buyer.address || {};
  const purchase = data.purchase || {};
  const product = data.product || {};

  const eventType = payload.event.toUpperCase();
  const transactionCode = purchase.transaction || payload.id || `TX-${Date.now()}`;
  const buyerName = buyer.name || 'Cliente Hotmart';
  const buyerEmail = buyer.email ? buyer.email.toLowerCase().trim() : '';
  const buyerPhone = buyer.checkout_phone || buyer.phone || null;
  const buyerDocument = buyer.document || null;
  const buyerCountry = address.country || address.country_iso || 'Brasil';
  const buyerZipCode = address.zip_code || address.postal_code || null;
  const buyerCity = address.city || null;
  const buyerState = address.state || address.province || null;
  const buyerAddress = address.address || address.street || null;
  const buyerDistrict = address.neighborhood || address.district || null;
  const buyerNumber = address.number || null;
  const buyerComplement = address.complement || null;

  const productName = product.name || 'Produto Canadá Sem Filtro';
  const priceGross = purchase.price?.value || 0;
  const priceNet = purchase.original_offer_price?.value || priceGross * 0.9;
  const purchaseDate = purchase.order_date
    ? new Date(purchase.order_date).toISOString()
    : new Date().toISOString();

  let mappedJourneyState: JourneyState = 'compra';

  if (['PURCHASE_APPROVED', 'APPROVED', 'COMPLETE'].includes(eventType)) {
    mappedJourneyState = 'compra';
  } else if (['PURCHASE_CANCELED', 'CANCELED'].includes(eventType)) {
    mappedJourneyState = 'cancelamento';
  } else if (['REFUNDED', 'REFUND', 'CHARGEBACK'].includes(eventType)) {
    mappedJourneyState = 'reembolso';
  }

  return {
    eventType,
    transactionCode,
    buyerName,
    buyerEmail,
    buyerPhone,
    buyerDocument,
    buyerCountry,
    buyerZipCode,
    buyerCity,
    buyerState,
    buyerAddress,
    buyerDistrict,
    buyerNumber,
    buyerComplement,
    productName,
    priceGross,
    priceNet,
    purchaseDate,
    mappedJourneyState,
  };
}
