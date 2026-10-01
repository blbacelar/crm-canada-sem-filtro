import { expect, test } from '@playwright/test';

test('lead audience API rejects unauthenticated requests', async ({ request }) => {
  const response = await request.get('/api/lead-audience');
  expect(response.status()).toBe(401);
});

test('admin can filter official leads and download the complete consented audience', async ({ page }) => {
  test.skip(process.env.E2E_RUN_LIVE_AUTH !== '1' || !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    'Opt-in live authentication test requires a dedicated account with current credentials');

  await page.goto('/login');
  await page.locator('input[type="email"]').fill(process.env.E2E_TEST_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.E2E_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Entrar no CRM' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Leads e CSV' }).click();
  await expect(page).toHaveURL(/\/leads$/);
  await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();

  const response = await page.request.get('/api/lead-audience');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.contacts.length).toBeGreaterThan(0);
  expect(body.contacts.every((contact: { email: string }) => contact.email.includes('@'))).toBe(true);

  const exportButton = page.getByRole('button', { name: /Exportar \d+ e-mails em CSV/ });
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^leads-campanha-\d{4}-\d{2}-\d{2}\.csv$/);

  await page.getByText('Autorizado', { exact: true }).first().click();
  await page.getByRole('option', { name: 'Todos' }).click();
  await expect(exportButton).toBeDisabled();
});
