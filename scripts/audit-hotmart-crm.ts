/** Read-only reconciliation of the Hotmart Sales API and the AMK CRM tables. */
import { readFileSync } from 'node:fs';

import { createClient } from '@supabase/supabase-js';

import { HotmartApi, HOTMART_SALE_STATUSES, type HotmartSale } from '../src/lib/hotmart-api';

const credentialsFile = process.argv.find((arg) => arg.startsWith('--credentials-file='))?.split('=')[1];
if (credentialsFile) {
  const credentials = Object.fromEntries(readFileSync(credentialsFile, 'utf8')
    .split(/\r?\n/).filter(Boolean).map((line) => {
      const separator = line.indexOf(':');
      return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    }));
  process.env.HOTMART_CLIENT_ID = credentials['Client ID'];
  process.env.HOTMART_CLIENT_SECRET = credentials['Client Secret'];
  process.env.HOTMART_BASIC_TOKEN = credentials['Client Token'];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase AMK credentials are required.');
if (new URL(supabaseUrl).hostname !== 'amkrasedammnrlzbciue.supabase.co') {
  throw new Error('Refusing to audit a Supabase project other than AMK.');
}

const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
const startArgument = process.argv.find((arg) => arg.startsWith('--start='))?.split('=')[1] ?? '2026-01-01';
const start = new Date(`${startArgument}T00:00:00.000Z`);
if (Number.isNaN(start.getTime())) throw new Error('Invalid --start date.');

function hotmartStatus(status: string): string {
  if (status === 'PRINTED_BILLET') return 'PURCHASE_BILLET_PRINTED';
  if (status === 'CANCELLED') return 'PURCHASE_CANCELED';
  return `PURCHASE_${status}`;
}

function crmStatus(status: string): string | null {
  const values: Record<string, string> = {
    APPROVED: 'paid', COMPLETE: 'paid', REFUNDED: 'refunded', PARTIALLY_REFUNDED: 'refunded',
    CHARGEBACK: 'chargeback', CANCELLED: 'canceled', EXPIRED: 'expired', OVERDUE: 'expired',
    STARTED: 'checkout_started', PRE_ORDER: 'checkout_started', PROTESTED: 'protest',
    BLOCKED: 'pending', NO_FUNDS: 'pending', PRINTED_BILLET: 'pending',
    PROCESSING_TRANSACTION: 'pending', UNDER_ANALISYS: 'pending', WAITING_PAYMENT: 'pending',
  };
  return values[status] ?? null;
}

async function main() {
  const [purchasesResult, leadsResult, snapshotsResult, clientsResult] = await Promise.all([
    db.from('purchases').select('transaction_code,client_id,purchase_date,price_gross,status_hotmart,product_id,product_name,currency_code,hotmart_synced_at').limit(1000),
    db.from('canada_sem_filtro_leads').select('email,payment_provider,payment_transaction_id,payment_amount,payment_currency,payment_status,product_id,product_name').eq('payment_provider', 'hotmart').limit(1000),
    db.from('hotmart_sale_snapshots').select('transaction_code').limit(1000),
    db.from('clients').select('id,email').limit(1000),
  ]);
  if (purchasesResult.error || leadsResult.error || snapshotsResult.error || clientsResult.error) {
    throw purchasesResult.error || leadsResult.error || snapshotsResult.error || clientsResult.error;
  }
  if ([purchasesResult.data, leadsResult.data, snapshotsResult.data, clientsResult.data]
    .some((rows) => (rows?.length ?? 0) >= 1000)) {
    throw new Error('A table reached the 1000-row audit limit; paginate before claiming complete coverage.');
  }
  const purchases = new Map((purchasesResult.data ?? []).map((row) => [row.transaction_code, row]));
  const leads = new Map((leadsResult.data ?? []).filter((row) => row.payment_transaction_id)
    .map((row) => [row.payment_transaction_id, row]));
  const snapshots = new Set((snapshotsResult.data ?? []).map((row) => row.transaction_code));
  const clients = new Map((clientsResult.data ?? []).map((row) => [row.id, row.email]));
  const api = await HotmartApi.connect();
  const sales = new Map<string, HotmartSale>();
  const byStatus: Record<string, number> = {};
  let earliestOrderDate: number | null = null;
  let latestOrderDate: number | null = null;

  const end = Date.now();
  const windowMilliseconds = 29 * 24 * 60 * 60 * 1000;
  let windowsScanned = 0;
  for (let windowStart = start.getTime(); windowStart <= end; windowStart += windowMilliseconds) {
    const windowEnd = Math.min(windowStart + windowMilliseconds - 1, end);
    for (const status of HOTMART_SALE_STATUSES) {
      for await (const sale of api.salesByStatus(status, { startDate: new Date(windowStart), endDate: new Date(windowEnd) })) {
        byStatus[status] = (byStatus[status] ?? 0) + 1;
        const transaction = sale.purchase?.transaction?.trim();
        if (transaction) sales.set(transaction, sale);
        const orderDate = Number(sale.purchase?.order_date);
        if (Number.isFinite(orderDate) && orderDate > 0) {
          const millis = orderDate < 1_000_000_000_000 ? orderDate * 1000 : orderDate;
          earliestOrderDate = Math.min(earliestOrderDate ?? millis, millis);
          latestOrderDate = Math.max(latestOrderDate ?? millis, millis);
        }
      }
    }
    windowsScanned += 1;
  }

  const apiMissingFromLegacy: string[] = [];
  const legacyMissingFromApi: string[] = [];
  const apiMissingFromCrm: string[] = [];
  const mismatches: Array<Record<string, unknown>> = [];
  for (const [transaction, sale] of sales) {
    const legacy = purchases.get(transaction);
    const crm = leads.get(transaction);
    if (!legacy) apiMissingFromLegacy.push(transaction);
    if (!crm) apiMissingFromCrm.push(transaction);
    if (!legacy || !crm) continue;
    const expectedAmount = sale.purchase?.price?.value ?? null;
    const expectedCurrency = sale.purchase?.price?.currency_code ?? sale.purchase?.price?.currency_value ?? null;
    const expectedStatus = hotmartStatus(sale.purchase?.status ?? '');
    const expectedProductId = String(sale.product?.id ?? '');
    const differences: string[] = [];
    if (legacy.price_gross !== expectedAmount) differences.push('legacy_amount');
    if (legacy.currency_code !== expectedCurrency) differences.push('legacy_currency');
    if (legacy.status_hotmart !== expectedStatus) differences.push('legacy_status');
    if (String(legacy.product_id ?? '') !== expectedProductId) differences.push('legacy_product_id');
    if (legacy.product_name !== sale.product?.name) differences.push('legacy_product_name');
    if (crm.payment_amount !== expectedAmount) differences.push('crm_amount');
    if (crm.payment_currency !== expectedCurrency) differences.push('crm_currency');
    if (crm.payment_status !== crmStatus(sale.purchase?.status ?? '')) differences.push('crm_status');
    if (crm.product_id !== expectedProductId) differences.push('crm_product_id');
    if (crm.product_name !== sale.product?.name) differences.push('crm_product_name');
    const apiEmail = sale.buyer?.email?.trim().toLowerCase();
    if (apiEmail && clients.get(legacy.client_id)?.trim().toLowerCase() !== apiEmail) {
      differences.push('legacy_buyer_email');
    }
    if (apiEmail && crm.email?.trim().toLowerCase() !== apiEmail) {
      differences.push('crm_buyer_email');
    }
    if (differences.length) mismatches.push({ transaction, differences,
      api: { amount: expectedAmount, currency: expectedCurrency, status: sale.purchase?.status, productId: expectedProductId },
      legacy: { amount: legacy.price_gross, currency: legacy.currency_code, status: legacy.status_hotmart, productId: legacy.product_id },
      crm: { amount: crm.payment_amount, currency: crm.payment_currency, status: crm.payment_status, productId: crm.product_id } });
  }
  for (const [transaction, purchase] of purchases) {
    if (Date.parse(purchase.purchase_date) >= start.getTime() && !sales.has(transaction)) {
      legacyMissingFromApi.push(transaction);
    }
  }
  const withoutTransaction = (leadsResult.data ?? []).filter((row) => !row.payment_transaction_id)
    .reduce<Record<string, number>>((counts, row) => {
      counts[row.payment_status] = (counts[row.payment_status] ?? 0) + 1;
      return counts;
    }, {});
  console.log(JSON.stringify({ auditedAt: new Date().toISOString(), source: 'Hotmart Sales History API',
    api: { start: start.toISOString(), end: new Date(end).toISOString(), windowsScanned,
      transactions: sales.size, byStatus, earliestOrderDate: earliestOrderDate === null ? null : new Date(earliestOrderDate).toISOString(), latestOrderDate: latestOrderDate === null ? null : new Date(latestOrderDate).toISOString() },
    database: { legacyPurchases: purchases.size, crmHotmartTransactions: leads.size,
      crmHotmartRowsWithoutTransaction: withoutTransaction, snapshots: snapshots.size },
    apiMissingFromLegacy, apiMissingFromCrm, legacyMissingFromApi, mismatches }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Hotmart audit failed.');
  process.exitCode = 1;
});
