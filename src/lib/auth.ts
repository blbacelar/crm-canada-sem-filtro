import { NextResponse } from 'next/server';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { UserRole } from '@/types/database.types';

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  role: UserRole;
}

async function withAuthTimeout<T>(promise: Promise<T>, timeoutMs = 8000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  const result = await Promise.race([promise, timeout]);
  if (timer) clearTimeout(timer);
  return result;
}

/**
 * Resolve authorization from the server-side profile table. Roles in
 * localStorage and user-editable user_metadata are never trusted here.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const userResult = await withAuthTimeout(supabase.auth.getUser());
  const { data: { user } = { user: null }, error: userError } = userResult || {};

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await (supabase as any)
    .from('profiles')
    .select('role, status, archived_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile?.role || profile.archived_at || profile.status === 'pending' || profile.status === 'disabled') return null;

  return {
    supabase,
    user,
    role: profile.role as UserRole,
  };
}

export async function requireAuth(roles?: UserRole[]) {
  const context = await getAuthContext();

  if (!context) {
    return {
      context: null,
      response: NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 }),
    } as const;
  }

  if (roles && !roles.includes(context.role)) {
    return {
      context: null,
      response: NextResponse.json({ error: 'Acesso negado para este perfil.' }, { status: 403 }),
    } as const;
  }

  return { context, response: null } as const;
}
