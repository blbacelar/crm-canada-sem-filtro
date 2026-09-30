import { expect, test } from '@playwright/test';
import { grantsDiagnosticAccess, parseHotmartCartAbandonment, parseHotmartWebhook } from '../src/lib/hotmart';

test('identifies the annual product and uses the approval date for access', () => {
  const approvalDate = Date.UTC(2026, 8, 10, 12, 30);
  const parsed = parseHotmartWebhook({
    event: 'PURCHASE_APPROVED',
    creation_date: Date.UTC(2026, 8, 11, 10, 0),
    data: {
      product: { id: '8575181', name: 'Produto anual' },
      buyer: { email: ' Buyer@Example.Test ', name: 'Comprador' },
      purchase: {
        transaction: 'HP-ANNUAL-TEST',
        order_date: Date.UTC(2026, 8, 9, 18, 0),
        approved_date: approvalDate,
      },
    },
  });

  expect(parsed).toMatchObject({
    productId: 8575181,
    buyerEmail: 'buyer@example.test',
    approvedAt: new Date(approvalDate).toISOString(),
    purchaseDate: new Date(Date.UTC(2026, 8, 9, 18, 0)).toISOString(),
  });
  expect(grantsDiagnosticAccess(parsed!.eventType)).toBe(true);
});

test('does not treat pending payment as approved access', () => {
  const parsed = parseHotmartWebhook({
    event: 'PURCHASE_WAITING_PAYMENT',
    data: {
      product: { id: 8575181 },
      buyer: { email: 'buyer@example.test' },
      purchase: { transaction: 'HP-PENDING-TEST' },
    },
  });

  expect(parsed?.approvedAt).toBeNull();
  expect(parsed?.mappedJourneyState).toBe('pagamento_pendente');
  expect(grantsDiagnosticAccess(parsed!.eventType)).toBe(false);
});

test('keeps cart abandonment separate from purchases even without a transaction', () => {
  const payload = {
    id: 'cart-event-1',
    event: 'PURCHASE_OUT_OF_SHOPPING_CART',
    creation_date: 1_632_411_406_874,
    data: {
      product: { id: 8575181, name: 'Bundle' },
      buyer: { email: ' Buyer@Example.Test ', name: 'Buyer', phone: '5511999999999' },
      offer: { code: 'offer-1' },
    },
  };
  expect(parseHotmartWebhook(payload)).toBeNull();
  expect(parseHotmartCartAbandonment(payload)).toMatchObject({
    eventId: 'cart-event-1', buyerEmail: 'buyer@example.test', productId: 8575181,
    productName: 'Bundle', offerCode: 'offer-1',
  });
});

test('classifies refund and bundle courses without inventing net proceeds', () => {
  const parsed = parseHotmartWebhook({
    id: 'refund-1',
    event: 'PURCHASE_REFUNDED',
    data: {
      product: {
        id: 8575181,
        name: 'Bundle',
        content: { products: [{ id: 8259553, name: 'Simulador' }, { id: 7956815, name: 'Diário de Bordo' }] },
      },
      buyer: { email: 'buyer@example.test' },
      purchase: { transaction: 'HP-REFUND-TEST', price: { value: 54.12 } },
    },
  });
  expect(parsed).toMatchObject({
    mappedJourneyState: 'reembolso',
    priceGross: 54.12,
    priceNet: null,
    includedProducts: [
      { productId: 8259553, productName: 'Simulador' },
      { productId: 7956815, productName: 'Diário de Bordo' },
    ],
  });
});
