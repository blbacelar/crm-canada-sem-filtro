import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth';
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
    const authorization = await requireAuth(['admin']);
    if (authorization.response) return authorization.response;

    const supabase = createAdminClient();

    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    const { data: profiles, error: profilesError } = await (supabase as any).from('profiles').select('id, role, status, archived_at, name, email');
    if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 502 });
    const { data: customerRows, error: customersError } = await (supabase as any).from('clients').select('email');
    if (customersError) return NextResponse.json({ error: customersError.message }, { status: 502 });
    const customerEmails = new Set(
      (customerRows || []).map((client: any) => String(client.email || '').trim().toLowerCase()).filter(Boolean)
    );
    const archivedProfileIds = new Set((profiles || []).filter((profile: any) => profile.archived_at).map((profile: any) => profile.id));
    const profilesById = new Map<string, any>((profiles || [])
      .filter((profile: any) => !profile.archived_at)
      .map((profile: any) => [profile.id, profile] as [string, any]));

    if (!authError && authUsers?.users && authUsers.users.length > 0) {
      // Clientes compradores podem ter uma conta Auth, mas nunca aparecem como operadores.
      const crmUsersOnly = authUsers.users.filter((u) => {
        const email = u.email?.trim().toLowerCase();
        return !archivedProfileIds.has(u.id) && (!email || !customerEmails.has(email));
      });

      const allUsers = crmUsersOnly.map((u) => ({
        id: u.id,
        name: profilesById.get(u.id)?.name || u.user_metadata?.name || u.email?.split('@')[0] || 'Operador CSF',
        email: u.email,
        role: (profilesById.get(u.id)?.role as UserRole) || (u.app_metadata?.role as UserRole) || 'consultant',
        status: profilesById.get(u.id)?.status || u.app_metadata?.status || 'active',
        created_at: u.created_at,
      }));

      const operators = allUsers.filter((u) => u.status !== 'pending');
      const pendingUsers = allUsers.filter((u) => u.status === 'pending');

      return NextResponse.json({ operators, pendingUsers });
    }

    return NextResponse.json({ operators: [], pendingUsers: [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Não foi possível carregar os operadores.' }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireAuth(['admin']);
    if (authorization.response) return authorization.response;

    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const role = body.role as UserRole;
    const name = String(body.name || '').trim();
    const action = body.action;
    const validRoles: UserRole[] = ['admin', 'consultant', 'marketing', 'tech'];

    if (!email || (action !== 'archive' && !role) || (role && !validRoles.includes(role))) {
      return NextResponse.json({ error: 'E-mail e Papel (role) são obrigatórios.' }, { status: 400 });
    }
    if (action === 'update_name' && name.length < 2) {
      return NextResponse.json({ error: 'Informe um nome válido para o operador.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const targetUser = authUsers?.users?.find((u) => u.email?.toLowerCase() === email.trim().toLowerCase());

    if (action === 'archive') {
      if (!targetUser) {
        return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
      }

      const { error: archiveError } = await (supabase as any)
        .from('profiles')
        .update({ archived_at: new Date().toISOString(), status: 'disabled', updated_at: new Date().toISOString() })
        .eq('id', targetUser.id);
      if (archiveError) return NextResponse.json({ error: archiveError.message }, { status: 500 });

      await supabase.auth.admin.updateUserById(targetUser.id, {
        app_metadata: { ...targetUser.app_metadata, archived: true, status: 'disabled' },
      });

      return NextResponse.json({ success: true, message: `${email} foi arquivado e não aparecerá mais no CRM.` });
    }

    const { data: customer } = await (supabase as any)
      .from('clients')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle();
    if (customer) {
      return NextResponse.json(
        { error: 'Este e-mail pertence a um cliente comprador e não pode ser cadastrado como operador do CRM.' },
        { status: 409 }
      );
    }

    // 1. Tentar encontrar usuário no Supabase Auth para atualizar metadados
    if (targetUser) {
      const { data: targetProfile } = await (supabase as any)
        .from('profiles')
        .select('status, name, archived_at')
        .eq('id', targetUser.id)
        .maybeSingle();
      // Atribuir papel e, se for aprovação, mudar status para 'active'
      const activateUser = action === 'approve' || action === 'create';
      const { error: authUpdateError } = await supabase.auth.admin.updateUserById(targetUser.id, {
        ...(activateUser ? { email_confirm: true } : {}),
        user_metadata: {
          ...targetUser.user_metadata,
          ...(activateUser ? { status: 'active' } : {}),
          ...(name ? { name } : {}),
        },
        app_metadata: {
          ...targetUser.app_metadata,
          app: 'crm',
          role: role as UserRole,
          ...(activateUser ? { status: 'active', archived: false } : {}),
        },
      });
      if (authUpdateError) return NextResponse.json({ error: authUpdateError.message }, { status: 400 });

      const { error: profileError } = await (supabase as any).from('profiles').upsert({
        id: targetUser.id,
        email: targetUser.email,
        name: name || targetProfile?.name || targetUser.email?.split('@')[0] || 'Operador CSF',
        role,
        status: activateUser
          ? 'active'
          : (targetProfile?.status || targetUser.app_metadata?.status || 'active'),
        archived_at: activateUser ? null : targetProfile?.archived_at || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

      return NextResponse.json({
        success: true,
        message: action === 'approve'
          ? `Acesso de ${email} aprovado com sucesso como ${role.toUpperCase()}!`
          : action === 'update_name'
          ? `Nome de ${email} atualizado com sucesso.`
          : `Operador ${email} salvo com sucesso como ${role.toUpperCase()}!`,
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
        },
        app_metadata: {
          app: 'crm',
          role: role as UserRole,
          status: 'active',
        },
      });

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }

      const { error: profileError } = await (supabase as any).from('profiles').upsert({
        id: newUser.user.id,
        email: email,
        name: name || email.split('@')[0],
        role,
        status: 'active',
      }, { onConflict: 'id' });
      if (profileError) {
        await supabase.auth.admin.deleteUser(newUser.user.id);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
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
