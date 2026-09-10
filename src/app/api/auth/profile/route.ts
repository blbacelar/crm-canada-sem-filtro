import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function PATCH(request: NextRequest) {
  const authorization = await requireAuth();
  if (authorization.response) return authorization.response;

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 80);
  const surname = String(body.surname || '').trim().slice(0, 80);
  if (!name) return NextResponse.json({ error: 'O nome é obrigatório.' }, { status: 400 });

  const { avatar_url: _avatarUrl, avatar: _avatar, picture: _picture, ...existingMetadata } = authorization.context.user.user_metadata || {};
  const metadata = {
      ...existingMetadata,
      name,
      surname,
      avatar_url: null,
    };
  const { data, error } = await authorization.context.supabase.auth.updateUser({ data: metadata });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await (authorization.context.supabase as any)
    .from('profiles')
    .update({ name: [name, surname].filter(Boolean).join(' '), updated_at: new Date().toISOString() })
    .eq('id', authorization.context.user.id);

  return NextResponse.json({
    name,
    surname,
    avatarUrl: null,
  });
}
