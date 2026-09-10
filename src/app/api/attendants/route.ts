import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Lista apenas atendentes ativos do CRM para associação de clientes. */
export async function GET() {
  const authorization = await requireAuth(['admin', 'consultant', 'tech']);
  if (authorization.response) return authorization.response;

  try {
    const supabase = createAdminClient();
    const { data, error } = await (supabase as any)
      .from('profiles')
      .select('id, name, email, role, status')
      .eq('role', 'consultant')
      .eq('status', 'active')
      .is('archived_at', null)
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ attendants: (data || []).map((attendant: any) => ({
      id: attendant.id,
      name: attendant.name || attendant.email?.split('@')[0] || 'Atendente',
      email: attendant.email,
      role: attendant.role,
    })) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Não foi possível carregar os atendentes.' }, { status: 502 });
  }
}
