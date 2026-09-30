import { expect, test } from '@playwright/test';

test('shows Hotmart sales and separate cart categories to an authorized operator', async ({ page }) => {
  test.skip(!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD, 'Requires a dedicated test operator.');
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(process.env.E2E_TEST_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar no CRM' }).click();
  await expect(page).toHaveURL(/\/$/);

  const me = await (await page.request.get('/api/auth/me')).json();
  test.skip(me.role === 'marketing', 'Marketing role cannot access customer purchase identities.');

  await page.getByRole('link', { name: 'Hotmart' }).click();
  await expect(page.getByRole('heading', { name: 'Histórico Hotmart' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Comprou/ })).toBeVisible();

  const sales = await page.request.get('/api/hotmart/overview?kind=paid');
  expect(sales.status()).toBe(200);
  const report = await sales.json();
  expect(report.counts).toEqual(expect.objectContaining({
    paid: expect.any(Number), refunded: expect.any(Number), cart: expect.any(Number),
  }));
  expect(report.rows.every((row: { transaction_code?: string }) => Boolean(row.transaction_code))).toBe(true);
  expect(report.rows.every((row: { clients?: { name?: string; email?: string } }) =>
    Boolean(row.clients?.name && row.clients?.email))).toBe(true);

  await page.getByRole('button', { name: /Carrinho abandonado/ }).click();
  const carts = await page.request.get('/api/hotmart/overview?kind=cart');
  expect(carts.status()).toBe(200);
  const cartReport = await carts.json();
  expect(cartReport.rows.every((row: { event_id?: string }) => Boolean(row.event_id))).toBe(true);
});
