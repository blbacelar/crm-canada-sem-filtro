import { expect, test } from '@playwright/test';

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
