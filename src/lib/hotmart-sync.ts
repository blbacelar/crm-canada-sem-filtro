import { createAdminClient } from '@/lib/supabase/admin';
import { encryptClientRecord } from '@/lib/crypto';
import { normalizedClientIdentity } from '@/lib/normalize-client';
import { HotmartApi, HotmartSale, HOTMART_SALE_STATUSES } from '@/lib/hotmart-api';

interface HotmartParticipant {
  role?: string;
  user?: {
    name?: string;
    email?: string;
    cellphone?: string;
    phone?: string;
    documents?: Array<{ value?: string; type?: string }>;
    address?: Record<string, string>;
  };
}

interface HotmartParticipants {
  transaction?: string;
  users?: HotmartParticipant[];
}

interface HotmartCommissions {
  transaction?: string;
  commissions?: Array<{
    source?: string;
    commission?: { value?: number; currency_value?: string; currency_code?: string };
  }>;
}

interface HotmartPriceDetails {
  transaction?: string;
  [key: string]: unknown;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hotmartDate(value: number | string | undefined): string | null {
  if (value === undefined || value === '') return null;
  const numeric = Number(value);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 1_000_000_000_000 ? numeric * 1000 : numeric)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function eventForStatus(status: string): string {
  if (status === 'PRINTED_BILLET') return 'PURCHASE_BILLET_PRINTED';
  if (status === 'CANCELLED') return 'PURCHASE_CANCELED';
  return `PURCHASE_${status}`;
}

function producerNet(commissions: HotmartCommissions | null, currency: string | undefined): number | null {
  const producer = commissions?.commissions?.filter((item) => item.source === 'PRODUCER') || [];
  if (!producer.length) return null;
  const amounts = producer.map((item) => item.commission);
  if (amounts.some((amount) => !Number.isFinite(amount?.value)
    || (currency && (amount?.currency_code || amount?.currency_value) !== currency))) return null;
  return amounts.reduce((total, amount) => total + Number(amount?.value), 0);
}

export interface HotmartSyncSummary {
  seen: number;
  updated: number;
  unchanged: number;
  skipped: number;
  windowsScanned: number;
  backfillBefore: string | null;
}

export async function syncHotmartSales(options: { dryRun?: boolean } = {}): Promise<HotmartSyncSummary> {
  const api = await HotmartApi.connect();
  const db = createAdminClient() as any;
  const summary: HotmartSyncSummary = {
    seen: 0, updated: 0, unchanged: 0, skipped: 0, windowsScanned: 0, backfillBefore: null,
  };
  const seenTransactions = new Set<string>();

  const processSale = async (sale: HotmartSale) => {
      const status = sale.purchase?.status || '';
      const transaction = sale.purchase?.transaction?.trim();
      const email = sale.buyer?.email?.trim().toLowerCase();
      if (!transaction || !email) {
        summary.skipped += 1;
        return;
      }
      if (seenTransactions.has(transaction)) return;
      seenTransactions.add(transaction);
      summary.seen += 1;

      const { data: snapshot, error: snapshotError } = await db
        .from('hotmart_sale_snapshots')
        .select('history, synced_at')
        .eq('transaction_code', transaction)
        .maybeSingle();
      if (snapshotError) throw snapshotError;
      const snapshotAge = snapshot?.synced_at ? Date.now() - Date.parse(snapshot.synced_at) : Infinity;
      if (snapshot && stableStringify(snapshot.history) === stableStringify(sale)
        && snapshotAge < 7 * 24 * 60 * 60 * 1000) {
        summary.unchanged += 1;
        return;
      }

      const [participants, commissions, priceDetails] = await Promise.all([
        api.saleDetail<HotmartParticipants>('users', transaction),
        api.saleDetail<HotmartCommissions>('commissions', transaction),
        api.saleDetail<HotmartPriceDetails>('price/details', transaction),
      ]);
      const buyer = participants?.users?.find((item) => item.role === 'BUYER')?.user;
      const address = buyer?.address || {};
      const candidate = encryptClientRecord(normalizedClientIdentity({
        name: (buyer?.name || sale.buyer?.name || 'Cliente Hotmart').trim().length >= 2
          ? (buyer?.name || sale.buyer?.name || 'Cliente Hotmart')
          : 'Cliente Hotmart',
        email,
        phone: buyer?.cellphone || buyer?.phone,
        document: buyer?.documents?.find((document) => document.value)?.value,
        country: address.country,
        zip_code: address.zip_code,
        city: address.city,
        state: address.state,
        address: address.address,
        number: address.number,
        complement: address.complement,
        source: 'hotmart',
        status_journey: ['REFUNDED', 'CHARGEBACK', 'PARTIALLY_REFUNDED'].includes(status)
          ? 'reembolso'
          : ['CANCELLED', 'EXPIRED'].includes(status) ? 'cancelamento' : 'compra',
      }));
      const { data: existing, error: existingError } = await db
        .from('clients')
        .select('name, source, status_journey, phone, document, country, zip_code, city, state, address, district, number, complement')
        .eq('email', email)
        .maybeSingle();
      if (existingError) throw existingError;
      // Reconciliation must not reset a consultant's journey, manual source, or
      // more complete customer profile merely because a sale was refreshed.
      const client = existing
        ? {
          ...candidate,
          name: existing.name || candidate.name,
          source: existing.source || candidate.source,
          status_journey: existing.status_journey || candidate.status_journey,
          phone: existing.phone || candidate.phone,
          document: existing.document || candidate.document,
          country: existing.country || candidate.country,
          zip_code: existing.zip_code || candidate.zip_code,
          city: existing.city || candidate.city,
          state: existing.state || candidate.state,
          address: existing.address || candidate.address,
          district: existing.district || address.neighborhood || null,
          number: existing.number || candidate.number,
          complement: existing.complement || candidate.complement,
        }
        : { ...candidate, district: address.neighborhood || null };

      const now = new Date().toISOString();
      const price = sale.purchase?.price;
      const productId = Number(sale.product?.id);
      const gross = Number(price?.value);
      if (!options.dryRun) {
        const { error: syncError } = await db.rpc('sync_hotmart_sale', {
          p_client: client,
          p_purchase: {
            transaction_code: transaction,
            product_id: Number.isSafeInteger(productId) && productId > 0 ? productId : null,
            product_name: sale.product?.name || 'Produto Hotmart',
            price_gross: Number.isFinite(gross) ? gross : null,
            price_net: producerNet(commissions, price?.currency_code || price?.currency_value),
            status_hotmart: eventForStatus(sale.purchase?.status || status),
            purchase_date: hotmartDate(sale.purchase?.order_date) || now,
            event_occurred_at: now,
            approved_at: hotmartDate(sale.purchase?.approved_date),
          },
          p_snapshot: {
            history: sale,
            participants,
            commissions,
            price_details: priceDetails,
          },
        });
        if (syncError) throw new Error(`Falha ao conciliar compra ${transaction}: ${syncError.message}`);
      }
      summary.updated += 1;
  };

  const scanRange = async (startDate: Date, endDate: Date) => {
    for (const status of HOTMART_SALE_STATUSES) {
      try {
        for await (const sale of api.salesByStatus(status, { startDate, endDate })) {
          await processSale(sale);
        }
      } catch (error) {
        let bareHistory = '';
        if (status === 'APPROVED' && error instanceof Error && error.message.includes('Hotmart history retornou HTTP 400')) {
          try {
            await api.checkHistoryAccess();
            bareHistory = '; consulta sem filtros: HTTP 200';
          } catch (probeError) {
            bareHistory = `; consulta sem filtros: ${probeError instanceof Error ? probeError.message : 'erro desconhecido'}`;
          }
        }
        throw new Error(`Consulta Hotmart ${status} ${startDate.toISOString()}–${endDate.toISOString()}: ${error instanceof Error ? error.message : 'Erro desconhecido'}${bareHistory}`);
      }
    }
    summary.windowsScanned += 1;
  };

  const day = 24 * 60 * 60 * 1000;
  const windowMs = 29 * day;
  const now = new Date();
  const recentStart = new Date(now.getTime() - 90 * day);
  for (let start = recentStart.getTime(); start < now.getTime(); start += windowMs) {
    await scanRange(new Date(start), new Date(Math.min(start + windowMs, now.getTime())));
  }

  const { data: state, error: stateError } = await db
    .from('hotmart_sync_state')
    .select('backfill_before')
    .eq('key', 'sales')
    .single();
  if (stateError) throw stateError;
  const earliest = new Date('2010-01-01T00:00:00.000Z').getTime();
  let cursor = new Date(state.backfill_before).getTime();
  for (let index = 0; index < 6 && cursor > earliest; index += 1) {
    const start = Math.max(earliest, cursor - windowMs);
    await scanRange(new Date(start), new Date(cursor));
    if (!options.dryRun) {
      const { error: cursorError } = await db.from('hotmart_sync_state')
        .update({ backfill_before: new Date(start).toISOString(), updated_at: new Date().toISOString() })
        .eq('key', 'sales');
      if (cursorError) throw cursorError;
    }
    cursor = start;
  }
  summary.backfillBefore = new Date(cursor).toISOString();

  // Keep reconciling older purchases after the historical cursor has passed
  // them, including refunds made long after the original sale.
  const { data: olderPurchases, error: olderError } = await db.from('purchases')
    .select('transaction_code')
    .lt('purchase_date', recentStart.toISOString())
    .lt('hotmart_synced_at', new Date(now.getTime() - 7 * day).toISOString())
    .order('hotmart_synced_at', { ascending: true })
    .limit(20);
  if (olderError) throw olderError;
  for (const purchase of olderPurchases || []) {
    const sale = await api.saleByTransaction(purchase.transaction_code);
    if (sale) await processSale(sale);
  }

  return summary;
}
