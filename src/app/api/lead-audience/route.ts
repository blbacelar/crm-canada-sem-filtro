import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { loadLeadAudience } from '@/lib/lead-audience-repository';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const authorization = await requireAuth(['admin', 'marketing']);
  if (authorization.response) return authorization.response;
  try {
    const contacts = await loadLeadAudience();
    return NextResponse.json({ contacts }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    console.error('Falha ao montar a base de leads para campanha:', error);
    return NextResponse.json({ error: 'Não foi possível carregar a base de leads completa.' }, { status: 500 });
  }
}
