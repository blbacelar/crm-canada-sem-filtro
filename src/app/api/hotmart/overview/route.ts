import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const PAID = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_COMPLETED', 'APPROVED', 'COMPLETE'];
const REFUNDED = ['PURCHASE_REFUNDED', 'PURCHASE_PARTIALLY_REFUNDED', 'PURCHASE_CHARGEBACK'];
const PENDING = [
  'PURCHASE_WAITING_PAYMENT', 'PURCHASE_STARTED', 'PURCHASE_BILLET_PRINTED',
  'PURCHASE_PRINTED_BILLET', 'PURCHASE_PROCESSING_TRANSACTION', 'PURCHASE_UNDER_ANALISYS',
  'PURCHASE_PRE_ORDER',
];
const KINDS = ['paid', 'refunded', 'pending', 'other', 'cart'] as const;
type Kind = typeof KINDS[number];

export async function GET(request: NextRequest) {
  const authorization = await requireAuth(['admin', 'consultant', 'tech']);
  if (authorization.response) return authorization.response;
  const kind = request.nextUrl.searchParams.get('kind') || 'paid';
  if (!KINDS.includes(kind as Kind)) return NextResponse.json({ error: 'Filtro inválido.' }, { status: 400 });
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') || 50), 1), 100);
  const offset = Math.max(Number(request.nextUrl.searchParams.get('offset') || 0), 0);
  const db = createAdminClient() as any;

  const [paidCount, refundedCount, pendingCount, otherCount, cartsCountResult, syncResult] = await Promise.all([
    db.from('purchases').select('id', { count: 'exact', head: true }).in('status_hotmart', PAID),
    db.from('purchases').select('id', { count: 'exact', head: true }).in('status_hotmart', REFUNDED),
    db.from('purchases').select('id', { count: 'exact', head: true }).in('status_hotmart', PENDING),
    db.from('purchases').select('id', { count: 'exact', head: true }).not('status_hotmart', 'in', `(${[...PAID, ...REFUNDED, ...PENDING].join(',')})`),
    db.from('hotmart_cart_abandonments').select('event_id', { count: 'exact', head: true }),
    db.from('hotmart_sale_snapshots').select('synced_at').order('synced_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const summaryError = [paidCount, refundedCount, pendingCount, otherCount, cartsCountResult, syncResult].find((result) => result.error)?.error;
  if (summaryError) {
    console.error('Falha ao carregar resumo Hotmart:', summaryError);
    return NextResponse.json({ error: 'Não foi possível carregar o resumo Hotmart.' }, { status: 500 });
  }
  const counts = {
    paid: paidCount.count || 0,
    refunded: refundedCount.count || 0,
    pending: pendingCount.count || 0,
    other: otherCount.count || 0,
    cart: cartsCountResult.count || 0,
  };

  if (kind === 'cart') {
    const { data, count, error } = await db.from('hotmart_cart_abandonments')
      .select('event_id, client_id, product_id, product_name, offer_code, occurred_at, clients!inner(name,email)', { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return NextResponse.json({ error: 'Não foi possível carregar os carrinhos.' }, { status: 500 });
    return NextResponse.json({ counts, syncedAt: syncResult.data?.synced_at || null, total: count || 0, rows: data || [] });
  }

  let query = db.from('purchases')
    .select('transaction_code, client_id, product_id, product_name, status_hotmart, price_gross, currency_code, purchase_date, hotmart_synced_at, clients!inner(name,email)', { count: 'exact' });
  if (kind === 'other') query = query.not('status_hotmart', 'in', `(${[...PAID, ...REFUNDED, ...PENDING].join(',')})`);
  else query = query.in('status_hotmart', kind === 'paid' ? PAID : kind === 'refunded' ? REFUNDED : PENDING);
  const { data, count, error } = await query.order('purchase_date', { ascending: false }).range(offset, offset + limit - 1);
  if (error) {
    console.error('Falha ao carregar compras Hotmart:', error);
    return NextResponse.json({ error: 'Não foi possível carregar as compras.' }, { status: 500 });
  }
  const transactions = (data || []).map((purchase: any) => purchase.transaction_code);
  const { data: products, error: productsError } = transactions.length
    ? await db.from('hotmart_purchase_products').select('transaction_code, product_name').in('transaction_code', transactions)
    : { data: [], error: null };
  if (productsError) return NextResponse.json({ error: 'Não foi possível carregar os cursos.' }, { status: 500 });
  const includedProducts = new Map<string, string[]>();
  for (const product of products || []) {
    const names = includedProducts.get(product.transaction_code) || [];
    names.push(product.product_name);
    includedProducts.set(product.transaction_code, names);
  }
  return NextResponse.json({
    counts,
    syncedAt: syncResult.data?.synced_at || null,
    total: count || 0,
    rows: (data || []).map((purchase: any) => ({
      ...purchase,
      included_products: includedProducts.get(purchase.transaction_code) || [],
    })),
  });
}
