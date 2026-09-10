import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const authorization = await requireAuth(['admin', 'consultant', 'tech']);
  if (authorization.response) return authorization.response;

  const clientId = request.nextUrl.searchParams.get('client_id');
  if (!clientId) return NextResponse.json({ error: 'client_id é obrigatório.' }, { status: 400 });

  const { supabase, role, user } = authorization.context;
  let query = (supabase as any)
    .from('consultations')
    .select('*, profiles:consultant_id(name, email)')
    .eq('client_id', clientId)
    .order('consultation_date', { ascending: false });
  if (role === 'consultant') query = query.eq('consultant_id', user.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ consultations: data || [] });
}

export async function POST(request: NextRequest) {
  const authorization = await requireAuth(['admin', 'consultant']);
  if (authorization.response) return authorization.response;

  try {
    const { supabase, role, user } = authorization.context;
    const body = await request.json();
    const clientId = String(body.client_id || '').trim();
    const valueAmount = Number(body.value_amount);
    const requestedConsultantId = body.consultant_id ? String(body.consultant_id) : user.id;
    const consultationDate = body.consultation_date || new Date().toISOString();
    const status = String(body.status || 'completed');
    const validStatuses = ['scheduled', 'completed', 'cancelled'];

    if (!clientId || !Number.isFinite(valueAmount) || valueAmount <= 0) {
      return NextResponse.json({ error: 'Cliente e valor da consultoria maior que zero são obrigatórios.' }, { status: 400 });
    }
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status da consultoria inválido.' }, { status: 400 });
    }
    const parsedConsultationDate = new Date(consultationDate);
    if (Number.isNaN(parsedConsultationDate.getTime())) {
      return NextResponse.json({ error: 'Data da consultoria inválida.' }, { status: 400 });
    }
    if (role === 'consultant' && requestedConsultantId !== user.id) {
      return NextResponse.json({ error: 'O consultor só pode registrar a própria consulta.' }, { status: 403 });
    }
    if (role === 'consultant') {
      const { data: assignedClient, error: clientError } = await (supabase as any)
        .from('clients')
        .select('id')
        .eq('id', clientId)
        .eq('assigned_consultant_id', user.id)
        .maybeSingle();
      if (clientError) throw clientError;
      if (!assignedClient) return NextResponse.json({ error: 'Associe o cliente ao seu atendimento antes de registrar a consulta.' }, { status: 403 });
    }

    const { data: consultant, error: consultantError } = await (createAdminClient() as any)
      .from('profiles')
      .select('id')
      .eq('id', requestedConsultantId)
      .eq('role', 'consultant')
      .eq('status', 'active')
      .is('archived_at', null)
      .maybeSingle();
    if (consultantError) throw consultantError;
    if (!consultant) return NextResponse.json({ error: 'Consultor inválido ou inativo.' }, { status: 400 });

    const { data: commissionConfig, error: commissionConfigError } = await (supabase as any)
      .from('commissions_config')
      .select('commission_percentage, is_active')
      .eq('product_name', 'Consulta Individual')
      .maybeSingle();
    if (commissionConfigError) throw commissionConfigError;
    if (!commissionConfig?.is_active) {
      return NextResponse.json(
        { error: 'Ative a regra de retorno por consulta nas Configurações antes de registrar a consultoria.' },
        { status: 409 },
      );
    }
    const commissionPercentage = Number(commissionConfig.commission_percentage);
    if (!Number.isFinite(commissionPercentage) || commissionPercentage < 0 || commissionPercentage > 100) {
      return NextResponse.json({ error: 'O percentual de retorno configurado é inválido.' }, { status: 409 });
    }

    const { data, error } = await (supabase as any)
      .from('consultations')
      .insert({
        client_id: clientId,
        consultant_id: requestedConsultantId,
        consultation_date: parsedConsultationDate.toISOString(),
        value_amount: valueAmount,
        commission_percentage: commissionPercentage,
        status,
        notes: body.notes ? String(body.notes).slice(0, 2000) : null,
        created_by: user.id,
      })
      .select('*, profiles:consultant_id(name, email)')
      .single();
    if (error) throw error;
    return NextResponse.json({ consultation: data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Não foi possível registrar a consulta.' }, { status: 500 });
  }
}
