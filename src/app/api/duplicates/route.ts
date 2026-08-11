import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: clients, error } = await (supabase as any)
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allClients = clients || [];
    const duplicatesMap = new Map<string, any[]>();

    // Agrupar por documento (CPF) ou telefone
    allClients.forEach((client: any) => {
      const keyDoc = client.document ? `doc:${client.document.replace(/[^0-9a-zA-Z]/g, '')}` : null;
      const keyPhone = client.phone && client.phone !== 'Não informado' ? `phone:${client.phone.replace(/[^0-9]/g, '')}` : null;

      if (keyDoc) {
        if (!duplicatesMap.has(keyDoc)) duplicatesMap.set(keyDoc, []);
        duplicatesMap.get(keyDoc)?.push(client);
      } else if (keyPhone) {
        if (!duplicatesMap.has(keyPhone)) duplicatesMap.set(keyPhone, []);
        duplicatesMap.get(keyPhone)?.push(client);
      }
    });

    const pendingDuplicates: any[] = [];
    duplicatesMap.forEach((group, key) => {
      if (group.length > 1) {
        // Verificar se os e-mails são diferentes
        const emails = new Set(group.map((c) => c.email.toLowerCase()));
        if (emails.size > 1) {
          pendingDuplicates.push({
            match_key: key,
            clients: group,
            reason: key.startsWith('doc:') ? 'Documento/CPF duplicado' : 'Telefone/WhatsApp duplicado',
          });
        }
      }
    });

    return NextResponse.json({ duplicates: pendingDuplicates });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { primary_client_id, secondary_client_id, action, user_role } = body;

    if (user_role && user_role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem reconciliar duplicidades.' },
        { status: 403 }
      );
    }

    if (!primary_client_id || !secondary_client_id) {
      return NextResponse.json(
        { error: 'IDs do cliente principal e secundário são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (action === 'merge') {
      // Mover compras do cliente secundário para o cliente principal
      await (supabase as any)
        .from('purchases')
        .update({ client_id: primary_client_id })
        .eq('client_id', secondary_client_id);

      // Mover interações
      await (supabase as any)
        .from('interactions')
        .update({ client_id: primary_client_id })
        .eq('client_id', secondary_client_id);

      // Remover cliente secundário
      await (supabase as any)
        .from('clients')
        .delete()
        .eq('id', secondary_client_id);

      return NextResponse.json({ success: true, message: 'Registros mesclados com sucesso.' });
    }

    return NextResponse.json({ success: true, message: 'Duplicidade desconsiderada.' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
