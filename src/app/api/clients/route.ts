import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateBusinessHoursSLA } from '@/lib/sla';
import { normalizedClientIdentity } from '@/lib/normalize-client';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: clients, error } = await (supabase as any)
      .from('clients')
      .select('*, purchases(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enriquecer dados de clientes com o cálculo em tempo real do SLA em horas úteis e dados de compras
    const enrichedClients = ((clients || []) as any[]).map((client) => {
      const slaResult = calculateBusinessHoursSLA(client.created_at || new Date().toISOString(), 24);
      const purchase = Array.isArray(client.purchases) && client.purchases.length > 0 ? client.purchases[0] : null;

      return {
        ...client,
        product_name: purchase?.product_name || '7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico',
        price_gross: purchase?.price_gross ? Number(purchase.price_gross) : 197.00,
        price_net: purchase?.price_net ? Number(purchase.price_net) : 169.20,
        purchase_date: purchase?.purchase_date || client.created_at,
        sla_hours_left: slaResult.businessHoursRemaining,
        is_overdue: client.status_journey === 'compra' && slaResult.isOverdue,
      };
    });

    return NextResponse.json({ clients: enrichedClients });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, product_name } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Nome e E-mail são obrigatórios para o cadastro de contingência.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

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
