import { expect, test } from '@playwright/test';
import { buildRecoveryLink } from '../src/lib/password-recovery';

test('recovery emails point directly to this CRM, with the token in the fragment', () => {
  const link = new URL(buildRecoveryLink('one-time-token'));
  expect(link.origin).toBe('https://crm-canada-sem-filtro.vercel.app');
  expect(link.pathname).toBe('/login');
  expect(link.searchParams.get('recovery')).toBe('1');
  expect(new URLSearchParams(link.hash.slice(1)).get('token_hash')).toBe('one-time-token');
  expect(link.search).not.toContain('one-time-token');
});

test.describe('[@smoke] login and session journey', () => {
  test('opens the new operator registration tab', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Novo Usuário' }).click();

    await expect(page.getByRole('tab', { name: 'Novo Usuário' })).toHaveAttribute('data-state', 'active');
    await expect(page.getByText('Criar Conta de Operador')).toBeVisible();
  });

  test('shows a useful error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('invalid-test-user@example.com');
    await page.locator('input[type="password"]').fill('invalid-password');
    await page.getByRole('button', { name: 'Entrar no CRM' }).click();

    await expect(page.getByText('E-mail ou senha incorretos. Verifique suas credenciais.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('rejects an expired recovery link and offers a new request', async ({ page }) => {
    await page.route('**/auth/v1/verify', async (route) => {
      await route.fulfill({ status: 403, contentType: 'application/json', body: '{"code":"otp_expired","msg":"Token has expired"}' });
    });
    await page.goto('/login?recovery=1#token_hash=expired-token&type=recovery');

    await expect(page.getByText('Este link expirou ou já foi usado.')).toBeVisible();
    await expect(page).toHaveURL(/\/login\?recovery=1$/);
    await page.getByRole('button', { name: 'Solicitar novo link' }).click();
    await expect(page.getByText('Recuperar Senha')).toBeVisible();
  });

  test('lets a verified recovery session set a new password', async ({ page }) => {
    const user = {
      id: '00000000-0000-4000-8000-000000000001',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'recovery-test@example.com',
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
    };
    await page.route('**/auth/v1/verify', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        access_token: 'test-access-token', refresh_token: 'test-refresh-token',
        token_type: 'bearer', expires_in: 3600, user,
      }) });
    });
    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) });
    });
    await page.route('**/auth/v1/logout', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    await page.goto('/login?recovery=1#token_hash=valid-token&type=recovery');

    await expect(page.getByRole('heading', { name: 'Redefinir senha do CRM' })).toBeVisible();
    await expect(page.getByLabel('Nova senha', { exact: true })).toBeVisible();
    await page.getByLabel('Nova senha', { exact: true }).fill('New-strong-password-2026');
    await page.getByLabel('Confirmar nova senha').fill('New-strong-password-2026');
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();

    await expect(page.getByText('Senha redefinida. Entre no CRM com a nova senha.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('[@auth] authenticated session journey', () => {
  test.beforeAll(() => {
    if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
      throw new Error(
        'Authenticated E2E tests require E2E_TEST_EMAIL and E2E_TEST_PASSWORD for a dedicated non-production test user.'
      );
    }
  });

  test('logs in, loads CRM data, and signs out', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(process.env.E2E_TEST_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Entrar no CRM' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Base real sincronizada do Supabase')).toBeVisible();
    await expect(page.getByText('FILA OPERACIONAL DE ATENDIMENTO')).toBeVisible();

    const meResponse = await page.request.get('/api/auth/me');
    expect(meResponse.status()).toBe(200);
    const currentUser = await meResponse.json();
    expect(currentUser.email).toBe(process.env.E2E_TEST_EMAIL);

    const clientsResponse = await page.request.get('/api/clients?limit=1&offset=0&status=todos');
    expect(clientsResponse.status()).toBe(200);

    const operatorsResponse = await page.request.get('/api/operators');
    const settingsResponse = await page.request.get('/api/settings');
    if (currentUser.role === 'admin') {
      expect(operatorsResponse.status()).toBe(200);
      expect(settingsResponse.status()).toBe(200);
    } else {
      expect(operatorsResponse.status()).toBe(403);
      expect(settingsResponse.status()).toBe(200);
    }

    await page.getByRole('button', { name: 'Abrir menu do perfil' }).click();
    await page.getByRole('button', { name: 'Encerrar sessão' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
