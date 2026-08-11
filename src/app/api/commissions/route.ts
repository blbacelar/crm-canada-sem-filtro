import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Buscar configurações de comissão
    const { data: configs, error: configError } = await (supabase as any)
      .from('commissions_config')
      .select('*')
      .order('product_name', { ascending: true });

    // 2. Buscar extrato de comissões calculadas
    const { data: logs, error: logError } = await (supabase as any)
      .from('commissions_log')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });

    // Regras padrão se a tabela estiver vazia
    const defaultConfigs = [
      {
        id: 'cfg-1',
        product_name: '7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico',
        commission_percentage: 10.0,
        is_active: true,
      },
      {
        id: 'cfg-2',
        product_name: 'Diagnóstico Migratório',
        commission_percentage: 15.0,
        is_active: true,
      },
      {
        id: 'cfg-3',
        product_name: 'Consultoria Individual',
        commission_percentage: 12.0,
        is_active: true,
      },
    ];

    return NextResponse.json({
      configs: configs && configs.length > 0 ? configs : defaultConfigs,
      logs: logs || [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_name, commission_percentage, is_active, user_role } = body;

    // Verificar se o usuário possui papel de Admin
    if (user_role && user_role !== 'admin') {
      return NextResponse.json(
        { error: 'Acesso negado. Apenas usuários Administradores podem alterar configurações de comissão.' },
        { status: 403 }
      );
    }

    if (!product_name || commission_percentage === undefined) {
      return NextResponse.json(
        { error: 'Nome do produto e porcentagem de comissão são obrigatórios.' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: updatedConfig, error } = await (supabase as any)
      .from('commissions_config')
      .upsert({
        product_name,
        commission_percentage: Number(commission_percentage),
        is_active: is_active ?? true,
        updated_at: new Date().toISOString(),
      })
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
