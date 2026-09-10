import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { normalizeClientEmail } from '@/lib/normalize-client';
import { isConsultationUnlocked } from '@/lib/sla';

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireAuth(['admin', 'consultant', 'tech']);
    if (authorization.response) return authorization.response;

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const clientId = searchParams.get('client_id');

    if (!email && !clientId) {
      return NextResponse.json(
        { error: 'Email do cliente ou client_id e obrigatório para consultar o diagnostico.' },
        { status: 400 }
      );
    }

    const { supabase } = authorization.context;

    // O e-mail sempre resolve primeiro no cadastro central. Nunca procuramos
    // identidade dentro do snapshot do formulário, que é imutável e pode não
    // conter os dados cadastrais.
    let resolvedClientId = clientId;
    if (email && !resolvedClientId) {
      const { data: client, error: clientError } = await (supabase as any)
        .from('clients')
        .select('id')
        .eq('email', normalizeClientEmail(email))
        .maybeSingle();
      if (clientError) throw clientError;
      resolvedClientId = client?.id || null;
    }

    if (!resolvedClientId) {
      return NextResponse.json({ diagnosticCase: null, diagnosticSubmission: null, answers: {}, submitted_at: null, status: 'pendente', consultationUnlocked: false });
    }

    const { data: cases, error: caseErr } = await (supabase as any)
      .from('diagnostic_cases')
      .select('*')
      .eq('client_id', resolvedClientId)
      .order('updated_at', { ascending: false });
    if (caseErr) throw caseErr;

    const caseIds = (cases || []).map((item: any) => item.id).filter(Boolean);
    const { data: submissions, error: subErr } = caseIds.length
      ? await (supabase as any)
        .from('diagnostic_submissions')
        .select('*')
        .in('case_id', caseIds)
        .order('submitted_at', { ascending: false })
        .limit(1)
      : { data: [], error: null };
    if (subErr) throw subErr;

    const diagnosticCase = cases && cases.length > 0 ? cases[0] : null;
    const diagnosticSubmission = submissions && submissions.length > 0 ? submissions[0] : null;

    const { data: purchase } = await (supabase as any)
      .from('purchases')
      .select('purchase_date')
      .eq('client_id', resolvedClientId)
      .order('purchase_date', { ascending: true })
      .limit(1)
      .maybeSingle();

    const consultationUnlocked = isConsultationUnlocked(
      purchase?.purchase_date,
      diagnosticSubmission?.submitted_at || diagnosticCase?.submitted_at,
    );

    return NextResponse.json({
      diagnosticCase,
      diagnosticSubmission,
      answers: diagnosticSubmission?.answers_snapshot || {},
      submitted_at: diagnosticSubmission?.submitted_at || diagnosticCase?.submitted_at || null,
      status: diagnosticCase?.status || (diagnosticSubmission ? 'submitted' : 'pendente'),
      consultationUnlocked,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
