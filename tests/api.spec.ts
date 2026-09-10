import { expect, test } from '@playwright/test';

const protectedEndpoints = [
  '/api/auth/me',
  '/api/clients?limit=10&offset=0&status=todos',
  '/api/settings',
  '/api/commissions',
  '/api/duplicates',
  '/api/operators',
  '/api/attendants',
  '/api/consultations?client_id=00000000-0000-0000-0000-000000000000',
  '/api/analytics',
  '/api/diagnostics?email=test@example.com',
];

test.describe('API authentication contract', () => {
  for (const endpoint of protectedEndpoints) {
    test(`rejects unauthenticated request: ${endpoint}`, async ({ request }) => {
      const response = await request.get(endpoint);

      expect(response.status()).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: 'Autenticação necessária.',
      });
    });
  }

  const protectedMutations = [
    ['post', '/api/clients', { name: 'Test', email: 'test@example.com' }],
    ['post', '/api/interactions', { client_id: '00000000-0000-0000-0000-000000000000', summary: 'Test' }],
    ['post', '/api/commissions', { product_name: 'Test' }],
    ['post', '/api/consultations', {
      client_id: '00000000-0000-0000-0000-000000000000',
      consultant_id: '00000000-0000-0000-0000-000000000000',
      value_amount: 250,
      status: 'scheduled',
    }],
    ['post', '/api/duplicates', { duplicate_id: '00000000-0000-0000-0000-000000000000', action: 'ignore' }],
    ['patch', '/api/settings', { targetHours: 24 }],
    ['post', '/api/whatsapp/history', { remoteJid: '5511999999999@s.whatsapp.net' }],
    ['post', '/api/whatsapp/send', { remoteJid: '5511999999999@s.whatsapp.net', message: 'Teste' }],
  ] as const;

  for (const [method, endpoint, data] of protectedMutations) {
    test(`rejects unauthenticated mutation: ${method.toUpperCase()} ${endpoint}`, async ({ request }) => {
      const response = method === 'patch'
        ? await request.patch(endpoint, { data })
        : await request.post(endpoint, { data });

      expect(response.status()).toBe(401);
      await expect(response.json()).resolves.toMatchObject({
        error: 'Autenticação necessária.',
      });
    });
  }
});

test('rejects a Hotmart webhook without HOTTOK', async ({ request }) => {
  const response = await request.post('/api/webhooks/hotmart', {
    data: { event: 'PURCHASE_APPROVED', data: {} },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: 'Não autorizado. Token HOTTOK inválido.',
  });
});

test('rejects an Evolution webhook with an invalid secret', async ({ request }) => {
  const response = await request.post('/api/webhooks/evolution', {
    headers: { 'x-crm-webhook-secret': 'invalid-secret' },
    data: { event: 'messages.upsert', instance: 'test', data: [] },
  });

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toMatchObject({
    error: 'Webhook Evolution não autorizado.',
  });
});
