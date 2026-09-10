import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  const authorization = await requireAuth();
  if (authorization.response) return authorization.response;

  const { user, role } = authorization.context;
  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Operador CSF',
    surname: user.user_metadata?.surname || '',
    avatarUrl: user.user_metadata?.avatar_url || null,
    role,
  });
}
