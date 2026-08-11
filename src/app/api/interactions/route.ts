import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, consultant_id, channel, summary, next_action } = body;

    if (!client_id || !summary) {
      return NextResponse.json(
        { error: 'ID do cliente e resumo da interação são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Gravar Interação na Tabela interactions
    const { data: newInteraction, error: interactionError } = await (supabase as any)
      .from('interactions')
      .insert({
        client_id,
        consultant_id: consultant_id || 'system-consultant',
        channel: channel || 'whatsapp',
        summary,
        next_action: next_action || null,
      })
      .select()
      .single();

    if (interactionError) {
      return NextResponse.json({ error: interactionError.message }, { status: 500 });
    }

    // 2. Atualizar estado do cliente para 'acompanhamento' e desativar a flag is_overdue
    await (supabase as any)
      .from('clients')
      .update({
        status_journey: 'acompanhamento',
        is_overdue: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client_id);

    return NextResponse.json({ interaction: newInteraction }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
