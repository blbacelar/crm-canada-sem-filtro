import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const authorization = await requireAuth();
    if (authorization.response) return authorization.response;
    const { supabase, user, role } = authorization.context;

    // 1. Buscar configurações de comissão
    const { data: configs, error: configError } = await (supabase as any)
      .from('commissions_config')
      .select('*')
      .eq('product_name', 'Consulta Individual')
      .order('product_name', { ascending: true });
    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    // 2. Buscar extrato de comissões calculadas
    let logsQuery = (supabase as any)
      .from('commissions_log')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });
    if (role === 'consultant') logsQuery = logsQuery.eq('consultant_id', user.id);
    const { data: logs, error: logError } = await logsQuery;
    if (logError) {
      console.error('Não foi possível carregar o extrato legado de comissões:', logError.message);
    }

    return NextResponse.json({
      configs: configs || [],
      logs: logs || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireAuth(['admin']);
    if (authorization.response) return authorization.response;

    const body = await request.json();
    const { product_name, commission_percentage, is_active } = body;

    if (product_name !== 'Consulta Individual' || commission_percentage === undefined) {
      return NextResponse.json(
        { error: 'A configuração deve ser para Consulta Individual.' },
        { status: 400 }
      );
    }
    const percentage = Number(commission_percentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return NextResponse.json({ error: 'A porcentagem deve estar entre 0 e 100.' }, { status: 400 });
    }

    const { supabase } = authorization.context;

    const { data: updatedConfig, error } = await (supabase as any)
      .from('commissions_config')
      .upsert({
        product_name,
        commission_percentage: percentage,
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_name' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ config: updatedConfig }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
