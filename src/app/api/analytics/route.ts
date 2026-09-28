import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateBusinessHoursSLA } from '@/lib/sla';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireAuth(['admin', 'marketing', 'tech']);
    if (authorization.response) return authorization.response;
    const supabase = createAdminClient();
    const { data: slaSetting } = await (supabase as any)
      .from('crm_settings')
      .select('value')
      .eq('key', 'sla')
      .maybeSingle();
    const slaConfig = slaSetting?.value || {};
    const slaTargetHours = Number(slaConfig.targetHours) || 24;

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
      const sla = calculateBusinessHoursSLA(
        c.created_at || new Date().toISOString(),
        slaTargetHours,
        new Date(),
        slaConfig,
      );
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
    const paidStatuses = new Set(['APPROVED', 'COMPLETE', 'PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_COMPLETED']);
    const paidPurchases = allPurchases.filter((purchase: any) => paidStatuses.has(purchase.status_hotmart));
    const brlPurchases = paidPurchases.filter((purchase: any) => !purchase.currency_code || purchase.currency_code === 'BRL');
    const totalGrossRevenue = brlPurchases.reduce((acc: number, purchase: any) => acc + (Number(purchase.price_gross) || 0), 0);
    const totalNetRevenue = brlPurchases.reduce((acc: number, purchase: any) => acc + (Number(purchase.price_net) || 0), 0);
    const unknownNetPurchases = brlPurchases.filter((purchase: any) => purchase.price_net === null).length;
    const foreignCurrencyPurchases = paidPurchases.length - brlPurchases.length;

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
        unknownNetPurchases,
        foreignCurrencyPurchases,
        slaComplianceRate,
        conversionRate,
      },
      funnel: funnelCounts,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
