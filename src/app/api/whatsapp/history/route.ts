import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const authorization = await requireAuth(['admin', 'consultant', 'tech']);
  if (authorization.response) return authorization.response;

  const webhookUrl = process.env.N8N_WHATSAPP_HISTORY_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: 'O serviço de histórico de conversas está temporariamente indisponível.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const remoteJid = String(body.remoteJid || body.remote_jid || '').trim();
    if (!/^\d+@s\.whatsapp\.net$/.test(remoteJid)) {
      return NextResponse.json({ error: 'remoteJid inválido. Use o formato 5511999999999@s.whatsapp.net.' }, { status: 400 });
    }

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const n8nSecret = process.env.N8N_WHATSAPP_HISTORY_WEBHOOK_SECRET;
    if (n8nSecret) headers.Authorization = `Bearer ${n8nSecret}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ remoteJid, phone: remoteJid }),
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseBody = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json({ error: 'Não foi possível consultar o histórico desta conversa.' }, { status: 502 });
    }

    return NextResponse.json({ remoteJid, history: responseBody });
  } catch (error: any) {
    const message = error?.name === 'AbortError'
      ? 'A consulta do histórico demorou mais do que o esperado.'
      : 'Não foi possível consultar o histórico desta conversa.';
    console.error('Erro ao consultar histórico WhatsApp via n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
