import { expect, test } from '@playwright/test';

test.describe('Hotmart webhook contract', () => {
  test.beforeAll(() => {
    if (!process.env.HOTMART_HOTTOK) {
      throw new Error('Webhook tests require HOTMART_HOTTOK in the test environment.');
    }
  });

  test('rejects an invalid token before parsing the payload', async ({ request }) => {
    const response = await request.post('/api/webhooks/hotmart', {
      headers: { 'x-hotmart-hottok': 'invalid-test-token' },
      data: { event: 'INVALID', data: {} },
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Não autorizado. Token HOTTOK inválido.',
    });
  });

  test('validates the payload after accepting the configured token', async ({ request }) => {
    const response = await request.post('/api/webhooks/hotmart', {
      headers: { 'x-hotmart-hottok': process.env.HOTMART_HOTTOK! },
      data: { event: 'INVALID', data: {} },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Payload de webhook inválido ou campos ausentes.',
    });
  });
});
