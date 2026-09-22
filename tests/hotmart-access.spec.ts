import { expect, test } from '@playwright/test';
import { grantsDiagnosticAccess, parseHotmartWebhook } from '../src/lib/hotmart';

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
    event: 'PURCHASE_OUT_OF_SHOPPING_CART',
    data: {
      product: { id: 8575181 },
      buyer: { email: 'buyer@example.test' },
      purchase: { transaction: 'HP-PENDING-TEST' },
    },
  });

  expect(parsed?.approvedAt).toBeNull();
  expect(grantsDiagnosticAccess(parsed!.eventType)).toBe(false);
});
