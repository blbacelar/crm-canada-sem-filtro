import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateBusinessHoursSLA, isConsultationUnlocked } from '@/lib/sla';
import { normalizedClientIdentity, formatPhoneWithDDI } from '@/lib/normalize-client';
import { decryptClientRecord } from '@/lib/crypto';
import { JourneyState } from '@/types/database.types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireAuth();
    if (authorization.response) return authorization.response;
    const { supabase, role } = authorization.context;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 100);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
    const status = searchParams.get('status');
    const search = searchParams.get('search')?.trim().replace(/[%,()]/g, '');
    let purchaseClientIds: string[] = [];
    if (search && /^(HP|MANUAL-|TX-)/i.test(search)) {
      const { data: matchingPurchases, error: purchaseSearchError } = await (supabase as any)
        .from('purchases')
        .select('client_id')
        .ilike('transaction_code', `%${search}%`)
        .limit(100);
      if (purchaseSearchError) {
        return NextResponse.json({ error: purchaseSearchError.message }, { status: 500 });
      }
      purchaseClientIds = [...new Set((matchingPurchases || []).map((purchase: any) => purchase.client_id).filter(Boolean))] as string[];
    }

    const slaSettingQuery = (supabase as any)
      .from('crm_settings')
      .select('value')
      .eq('key', 'sla')
      .maybeSingle();

    let clientsQuery = (supabase as any)
      .from('clients')
      .select('*, purchases(*)', { count: 'exact' });
    if (status && status !== 'todos' && status !== 'overdue') clientsQuery = clientsQuery.eq('status_journey', status);
    if (search) {
      const transactionFilter = purchaseClientIds.length ? `,id.in.(${purchaseClientIds.join(',')})` : '';
      clientsQuery = clientsQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%${transactionFilter}`);
    }

    const clientsQueryResult = clientsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const [{ data: slaSetting }, { data: clients, error, count }] = await Promise.all([
      slaSettingQuery,
      clientsQueryResult,
    ]);

    const slaConfig = slaSetting?.value || {};
    const slaTargetHours = Number(slaConfig.targetHours) || 24;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // O envio do diagnóstico é registrado nas tabelas do formulário e pode
    // ocorrer antes de clients.status_journey ser atualizado. Resolva o status
    // efetivo a partir do envio mais recente para não mostrar "não enviado"
    // quando há uma submissão real.
    const clientIds = ((clients || []) as any[]).map((client) => client.id).filter(Boolean);
    const privateDb = createAdminClient() as any;
    const visiblePurchases = ((clients || []) as any[]).flatMap((client) => client.purchases || []);
    const transactions = [...new Set(visiblePurchases.map((purchase: any) => purchase.transaction_code).filter(Boolean))] as string[];
    const canSeeHistory = role !== 'marketing';
    const [cartResult, productsResult] = await Promise.all([
      canSeeHistory && clientIds.length
        ? privateDb.from('hotmart_cart_abandonments')
          .select('event_id, client_id, product_name, offer_code, occurred_at')
          .in('client_id', clientIds)
          .order('occurred_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      canSeeHistory && transactions.length
        ? privateDb.from('hotmart_purchase_products')
          .select('transaction_code, product_id, product_name')
          .in('transaction_code', transactions)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (cartResult.error || productsResult.error) {
      console.error('Falha ao carregar histórico Hotmart:', cartResult.error || productsResult.error);
      return NextResponse.json({ error: 'Não foi possível carregar o histórico Hotmart.' }, { status: 500 });
    }
    const cartsByClient = new Map<string, any[]>();
    for (const cart of cartResult.data || []) {
      const entries = cartsByClient.get(cart.client_id) || [];
      entries.push(cart);
      cartsByClient.set(cart.client_id, entries);
    }
    const productsByTransaction = new Map<string, any[]>();
    for (const product of productsResult.data || []) {
      const entries = productsByTransaction.get(product.transaction_code) || [];
      entries.push(product);
      productsByTransaction.set(product.transaction_code, entries);
    }
    const { data: diagnosticCases, error: diagnosticCasesError } = clientIds.length
      ? await (supabase as any)
        .from('diagnostic_cases')
        .select('id, client_id, status, submitted_at, updated_at')
        .in('client_id', clientIds)
      : { data: [], error: null };
    if (diagnosticCasesError) {
      console.error('Não foi possível sincronizar o status dos diagnósticos:', diagnosticCasesError.message);
    }
    const caseIds = (diagnosticCases || []).map((item: any) => item.id).filter(Boolean);
    const { data: diagnosticSubmissions, error: diagnosticSubmissionsError } = caseIds.length
      ? await (supabase as any)
        .from('diagnostic_submissions')
        .select('case_id, submitted_at')
        .in('case_id', caseIds)
        .order('submitted_at', { ascending: false })
      : { data: [], error: null };
    if (diagnosticSubmissionsError) {
      console.error('Não foi possível consultar os envios de diagnóstico:', diagnosticSubmissionsError.message);
    }
    const caseById = new Map<string, any>((diagnosticCases || []).map((item: any) => [item.id, item] as [string, any]));
    const latestSubmissionByClient = new Map<string, string>();
    for (const submission of diagnosticSubmissions || []) {
      const diagnosticCase = caseById.get(submission.case_id);
      if (!diagnosticCase?.client_id || latestSubmissionByClient.has(diagnosticCase.client_id)) continue;
      latestSubmissionByClient.set(diagnosticCase.client_id, submission.submitted_at);
    }

    let consultations: any[] = [];
    if (clientIds.length && (role === 'admin' || role === 'consultant')) {
      const { data: consultationRows, error: consultationsError } = await (supabase as any)
        .from('consultations')
        .select('client_id, consultant_id, consultation_date, value_amount, commission_percentage, company_return_amount, status')
        .in('client_id', clientIds)
        .order('consultation_date', { ascending: false });
      if (consultationsError) {
        console.error('Não foi possível carregar o controle de consultorias:', consultationsError.message);
      } else {
        consultations = consultationRows || [];
      }
    }
    const latestConsultationByClient = new Map<string, any>();
    for (const consultation of consultations) {
      if (consultation.status === 'cancelled' || latestConsultationByClient.has(consultation.client_id)) continue;
      latestConsultationByClient.set(consultation.client_id, consultation);
    }

    const assignedIds = [...new Set([
      ...((clients || []) as any[]).map((client) => client.assigned_consultant_id).filter(Boolean),
      ...consultations.map((consultation) => consultation.consultant_id).filter(Boolean),
    ])];
    const { data: attendantProfiles } = assignedIds.length
      ? await (createAdminClient() as any).from('profiles').select('id, name, email').in('id', assignedIds)
      : { data: [] };
    const attendantById = new Map<string, any>((attendantProfiles || []).map((profile: any) => [profile.id, profile] as [string, any]));

    const [inServiceSummary, diagnosticsSummary, overdueSummary] = await Promise.all([
      (supabase as any)
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .in('status_journey', ['compra', 'diagnostico_enviado', 'acompanhamento']),
      (supabase as any)
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('status_journey', 'diagnostico_enviado'),
      (supabase as any)
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('status_journey', 'compra')
        .eq('is_overdue', true),
    ]);

    // Enriquecer e descriptografar dados de clientes para exibição autorizada no CRM
    const enrichedClients = ((clients || []) as any[]).map((rawClient) => {
      const client = decryptClientRecord(rawClient);
      const diagnosticSubmittedAt = latestSubmissionByClient.get(client.id);
      const effectiveStatusJourney = diagnosticSubmittedAt && client.status_journey === 'compra'
        ? 'diagnostico_enviado'
        : client.status_journey;
      const slaResult = calculateBusinessHoursSLA(
        client.created_at || new Date().toISOString(),
        slaTargetHours,
        new Date(),
        slaConfig,
      );
      const purchases = Array.isArray(client.purchases)
        ? [...client.purchases].sort((left: any, right: any) =>
          (right.purchase_date || right.created_at || '').localeCompare(left.purchase_date || left.created_at || ''))
        : [];
      const purchase = purchases[0] || null;
      const cartAbandonments = cartsByClient.get(client.id) || [];
      const latestConsultation = latestConsultationByClient.get(client.id);

      const fullRecord = {
        ...client,
        status_journey: effectiveStatusJourney,
        diagnostic_status: diagnosticSubmittedAt ? 'enviado' : (client.status_journey === 'compra' ? 'pendente' : 'enviado'),
        diagnostic_submitted_at: diagnosticSubmittedAt || null,
        assigned_consultant_name: client.assigned_consultant_id
          ? (attendantById.get(client.assigned_consultant_id)?.name || attendantById.get(client.assigned_consultant_id)?.email || 'Atendente')
          : null,
        phone: formatPhoneWithDDI(client.phone),
        purchases: purchases.map((item: any) => ({
          id: item.id,
          transaction_code: item.transaction_code,
          product_name: item.product_name,
          status_hotmart: item.status_hotmart,
          price_gross: item.price_gross === null ? null : Number(item.price_gross),
          purchase_date: item.purchase_date,
          payment_method: item.payment_method || null,
          installments: item.installments || null,
          currency_code: item.currency_code || null,
          offer_code: item.offer_code || null,
          is_subscription: item.is_subscription ?? null,
          hotmart_fee: item.hotmart_fee === null || item.hotmart_fee === undefined ? null : Number(item.hotmart_fee),
          hotmart_synced_at: item.hotmart_synced_at || null,
          included_products: (productsByTransaction.get(item.transaction_code) || []).map((product: any) => ({
            product_id: product.product_id,
            product_name: product.product_name,
          })),
        })),
        cart_abandonments: cartAbandonments.map((cart: any) => ({
          event_id: cart.event_id,
          product_name: cart.product_name,
          offer_code: cart.offer_code,
          occurred_at: cart.occurred_at,
        })),
        product_name: purchase?.product_name || cartAbandonments[0]?.product_name || 'Produto não informado',
        price_gross: purchase?.price_gross === null || purchase?.price_gross === undefined ? null : Number(purchase.price_gross),
        price_net: purchase?.price_net === null || purchase?.price_net === undefined ? null : Number(purchase.price_net),
        purchase_date: purchase?.purchase_date || client.created_at,
        sla_hours_left: slaResult.businessHoursRemaining,
        is_overdue: client.status_journey === 'compra' && slaResult.isOverdue,
        consultation_booked: Boolean(latestConsultation),
        consultation_status: latestConsultation?.status || null,
        consultation_date: latestConsultation?.consultation_date || null,
        consultation_value: latestConsultation ? Number(latestConsultation.value_amount) : null,
        consultation_commission_percentage: latestConsultation ? Number(latestConsultation.commission_percentage) : null,
        consultation_company_return_amount: latestConsultation ? Number(latestConsultation.company_return_amount) : null,
        consultation_consultant_name: latestConsultation?.consultant_id
          ? (attendantById.get(latestConsultation.consultant_id)?.name || attendantById.get(latestConsultation.consultant_id)?.email || 'Consultor')
          : null,
      };

      if (role === 'marketing') {
        return {
          id: fullRecord.id,
          source: fullRecord.source,
          status_journey: fullRecord.status_journey,
          is_overdue: fullRecord.is_overdue,
          created_at: fullRecord.created_at,
          updated_at: fullRecord.updated_at,
          product_name: fullRecord.product_name,
          price_gross: fullRecord.price_gross,
          price_net: fullRecord.price_net,
          purchase_date: fullRecord.purchase_date,
          sla_hours_left: fullRecord.sla_hours_left,
        };
      }

      return fullRecord;
    });

    return NextResponse.json({
      clients: enrichedClients,
      total: count || 0,
      limit,
      offset,
      summary: {
        inService: inServiceSummary.count || 0,
        diagnostics: diagnosticsSummary.count || 0,
        overdue: overdueSummary.count || 0,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireAuth(['admin', 'consultant', 'tech']);
    if (authorization.response) return authorization.response;

    const body = await request.json();
    const { name, email, phone, product_name } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Nome e E-mail são obrigatórios para o cadastro de contingência.' },
        { status: 400 }
      );
    }

    const { supabase } = authorization.context;

    const { data: newClient, error: clientError } = await (supabase as any)
      .from('clients')
      .upsert(normalizedClientIdentity({
        name,
        email,
        phone: phone || null,
        source: 'manual',
        status_journey: 'compra',
      }), { onConflict: 'email' })
      .select()
      .single();

    if (clientError) {
      return NextResponse.json({ error: clientError.message }, { status: 500 });
    }

    // Gravar transação manual inicial em purchases
    if (product_name) {
      const { error: purchaseError } = await (supabase as any).from('purchases').upsert({
        client_id: (newClient as any).id,
        transaction_code: `MANUAL-${Date.now()}`,
        product_name,
        price_gross: 0,
        price_net: 0,
        status_hotmart: 'MANUAL_ENTRY',
        purchase_date: new Date().toISOString(),
      }, { onConflict: 'transaction_code' });
      if (purchaseError) {
        return NextResponse.json({ error: purchaseError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ client: newClient }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await requireAuth(['admin', 'consultant', 'tech']);
    if (authorization.response) return authorization.response;

    const { client_id, status_journey, assigned_consultant_id } = await request.json() as {
      client_id?: string;
      status_journey?: JourneyState;
      assigned_consultant_id?: string | null;
    };
    const validStates: JourneyState[] = [
      'compra', 'carrinho_abandonado', 'pagamento_pendente', 'diagnostico_enviado', 'acompanhamento', 'consulta_marcada',
      'consulta_concluida', 'cancelamento', 'reembolso',
    ];
    if (!client_id || (status_journey && !validStates.includes(status_journey))) {
      return NextResponse.json({ error: 'Cliente e dados de atualização válidos são obrigatórios.' }, { status: 400 });
    }

    const { supabase } = authorization.context;
    if (assigned_consultant_id !== undefined) {
      if (authorization.context.role !== 'admin') {
        return NextResponse.json({ error: 'Somente administradores podem associar atendentes.' }, { status: 403 });
      }
      if (assigned_consultant_id) {
        const { data: attendant, error: attendantError } = await (createAdminClient() as any)
          .from('profiles')
          .select('id')
          .eq('id', assigned_consultant_id)
          .eq('role', 'consultant')
          .eq('status', 'active')
          .is('archived_at', null)
          .maybeSingle();
        if (attendantError) return NextResponse.json({ error: attendantError.message }, { status: 500 });
        if (!attendant) return NextResponse.json({ error: 'Atendente inválido ou inativo.' }, { status: 400 });
      }
    }
    if (status_journey === 'consulta_marcada' || status_journey === 'consulta_concluida') {
      const { data: purchase } = await (supabase as any)
        .from('purchases')
        .select('purchase_date')
        .eq('client_id', client_id)
        .order('purchase_date', { ascending: true })
        .limit(1)
        .maybeSingle();
      const { data: diagnosticCases } = await (supabase as any)
        .from('diagnostic_cases')
        .select('id')
        .eq('client_id', client_id)
        .order('updated_at', { ascending: false });
      const caseIds = (diagnosticCases || []).map((item: any) => item.id).filter(Boolean);
      const { data: diagnosticSubmissions } = caseIds.length
        ? await (supabase as any)
          .from('diagnostic_submissions')
          .select('submitted_at')
          .in('case_id', caseIds)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        : { data: null };

      if (!isConsultationUnlocked(purchase?.purchase_date, diagnosticSubmissions?.submitted_at)) {
        return NextResponse.json({ error: 'A consultoria só pode ser liberada após 7 dias e o envio do diagnóstico.' }, { status: 409 });
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status_journey) {
      updates.status_journey = status_journey;
      updates.is_overdue = false;
    }
    if (assigned_consultant_id !== undefined) updates.assigned_consultant_id = assigned_consultant_id || null;

    const { data: client, error } = await (supabase as any)
      .from('clients')
      .update(updates)
      .eq('id', client_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ client });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
