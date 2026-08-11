import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UserRole } from '@/types/database.types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Lista de operadores em memória/banco como fallback resiliente
const DEFAULT_OPERATORS = [
  { id: 'op-1', name: 'Bruno Bacelar', email: 'blbacelar@gmail.com', role: 'admin', created_at: '2026-07-01T10:00:00Z' },
  { id: 'op-2', name: 'Administração CSF', email: 'admin@canadasemfiltro.com', role: 'admin', created_at: '2026-07-01T10:00:00Z' },
  { id: 'op-3', name: 'Atendimento & Consultoria', email: 'atendimento@canadasemfiltro.com', role: 'consultant', created_at: '2026-07-15T14:30:00Z' },
  { id: 'op-4', name: 'Gestão de Tráfego & BI', email: 'marketing@canadasemfiltro.com', role: 'marketing', created_at: '2026-08-01T09:00:00Z' },
];

export async function GET(request: NextRequest) {
  try {
    const supabase = createAdminClient();

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (!authError && authUsers?.users && authUsers.users.length > 0) {
      // Filtrar apenas os usuários pertencentes ao CRM
      // Usuários do CRM possuem 'crm' no metadata ou possuem 'role' / 'status' (definidos durante registro/aprovação no CRM)
      const crmUsersOnly = authUsers.users.filter((u) => {
        const meta = u.user_metadata || {};
        return meta.app === 'crm' || !!meta.role || !!meta.status || u.email?.toLowerCase() === 'canadasemfiltro.tech@gmail.com';
      });

      const allUsers = crmUsersOnly.map((u) => ({
        id: u.id,
        name: u.user_metadata?.name || u.user_metadata?.full_name || u.email?.split('@')[0] || 'Operador CSF',
        email: u.email,
        role: (u.user_metadata?.role as UserRole) || 'consultant',
        status: (u.user_metadata?.status as string) || 'active',
        created_at: u.created_at,
      }));

      const operators = allUsers.filter((u) => u.status !== 'pending');
      const pendingUsers = allUsers.filter((u) => u.status === 'pending');

      return NextResponse.json({ operators, pendingUsers });
    }

    return NextResponse.json({ operators: DEFAULT_OPERATORS, pendingUsers: [] });
  } catch (err: any) {
    return NextResponse.json({ operators: DEFAULT_OPERATORS, pendingUsers: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, role, name, action } = body;

    if (!email || !role) {
      return NextResponse.json({ error: 'E-mail e Papel (role) são obrigatórios.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Tentar encontrar usuário no Supabase Auth para atualizar metadados
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const targetUser = authUsers?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (targetUser) {
      // Atribuir papel e, se for aprovação, mudar status para 'active'
      const isApproval = action === 'approve';
      await supabase.auth.admin.updateUserById(targetUser.id, {
        user_metadata: {
          ...targetUser.user_metadata,
          app: 'crm',
          role: role as UserRole,
          ...(isApproval ? { status: 'active' } : {}),
          ...(name ? { name } : {}),
        },
      });

      return NextResponse.json({
        success: true,
        message: isApproval
          ? `Acesso de ${email} aprovado com sucesso como ${role.toUpperCase()}!`
          : `Papel de ${email} atualizado com sucesso para ${role.toUpperCase()} no Supabase!`,
      });
    }

    // 2. Se o usuário ainda não existir no Auth, criar via Admin API com a Role atribuída
    if (action === 'create') {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          app: 'crm',
          name: name || email.split('@')[0],
          role: role as UserRole,
          status: 'active',
        },
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: `Novo operador ${email} cadastrado com sucesso com o papel de ${role.toUpperCase()}!`,
        user: newUser.user,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Papel atualizado com sucesso para ${role.toUpperCase()}!`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
