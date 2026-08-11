import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateBusinessHoursSLA } from '@/lib/sla';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Buscar todos os clientes
    const { data: clients, error: clientErr } = await (supabase as any)
      .from('clients')
      .select('*');

    if (clientErr) {
      return NextResponse.json({ error: clientErr.message }, { status: 500 });
    }

    // 2. Buscar todas as compras da Hotmart
    const { data: purchases, error: purchaseErr } = await (supabase as any)
      .from('purchases')
      .select('*');

    const allClients = clients || [];
    const allPurchases = purchases || [];

    // Funil da Jornada
    const funnelCounts = {
      compra: 0,
      diagnostico_enviado: 0,
      acompanhamento: 0,
      consulta_marcada: 0,
      consulta_concluida: 0,
      cancelamento: 0,
      reembolso: 0,
    };

    let totalSlaCompliant = 0;
    let totalSlaEvaluated = 0;

    allClients.forEach((c: any) => {
      const state = c.status_journey as keyof typeof funnelCounts;
      if (funnelCounts[state] !== undefined) {
        funnelCounts[state]++;
      }

      // Calcular SLA
      const sla = calculateBusinessHoursSLA(c.created_at || new Date().toISOString(), 24);
      if (c.status_journey === 'compra') {
        totalSlaEvaluated++;
        if (!sla.isOverdue) {
          totalSlaCompliant++;
        }
      } else {
        totalSlaEvaluated++;
        totalSlaCompliant++;
      }
    });

    const slaComplianceRate = totalSlaEvaluated > 0
      ? Math.round((totalSlaCompliant / totalSlaEvaluated) * 100)
      : 100;

    // Métricas Financeiras
    const totalGrossRevenue = allPurchases.reduce((acc: number, p: any) => acc + (Number(p.price_gross) || 0), 0);
    const totalNetRevenue = allPurchases.reduce((acc: number, p: any) => acc + (Number(p.price_net) || 0), 0);

    // Taxa de Conversão da Consulta (Marcada ou Concluída)
    const convertedCount = funnelCounts.consulta_marcada + funnelCounts.consulta_concluida;
    const totalClientsCount = allClients.length;
    const conversionRate = totalClientsCount > 0
      ? Math.round((convertedCount / totalClientsCount) * 100)
      : 0;

    return NextResponse.json({
      summary: {
        totalClients: totalClientsCount,
        totalPurchases: allPurchases.length,
        totalGrossRevenue,
        totalNetRevenue,
        slaComplianceRate,
        conversionRate,
      },
      funnel: funnelCounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
