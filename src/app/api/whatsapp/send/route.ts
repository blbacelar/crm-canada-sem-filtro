import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const authorization = await requireAuth(['admin', 'consultant', 'tech']);
  if (authorization.response) return authorization.response;

  const webhookUrl = process.env.N8N_WHATSAPP_SEND_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json({ error: 'O serviço de mensagens está temporariamente indisponível.' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const remoteJid = String(body.remoteJid || body.remote_jid || '').trim();
    const message = String(body.message || body.text || '').trim();
    if (!/^\d+@s\.whatsapp\.net$/.test(remoteJid)) {
      return NextResponse.json({ error: 'remoteJid inválido. Use o formato 5511999999999@s.whatsapp.net.' }, { status: 400 });
    }
    if (!message || message.length > 4000) {
      return NextResponse.json({ error: 'A mensagem deve ter entre 1 e 4.000 caracteres.' }, { status: 400 });
    }

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    const n8nSecret = process.env.N8N_WHATSAPP_WEBHOOK_SECRET || process.env.N8N_WHATSAPP_HISTORY_WEBHOOK_SECRET;
    if (n8nSecret) headers.Authorization = `Bearer ${n8nSecret}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response: Response;
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          remoteJid,
          phone: remoteJid,
          message,
          text: message,
          clientId: body.clientId || body.client_id || null,
          requestedBy: authorization.context.user.id,
        }),
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timeout);
    }

    const responseText = await response.text();
    let responseBody: any = null;
    try {
      responseBody = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseBody = responseText || null;
    }
    if (!response.ok) {
      const webhookNotActive = response.status === 404 && responseBody?.message?.toLowerCase?.().includes('webhook');
      console.error('Resposta não-2xx do webhook de envio:', {
        status: response.status,
        body: responseBody,
      });
      return NextResponse.json({
        error: webhookNotActive
          ? 'O canal de mensagens ainda não está disponível. Tente novamente em instantes.'
          : 'Não foi possível enviar esta mensagem.',
      }, { status: 502 });
    }

    return NextResponse.json({ remoteJid, message, result: responseBody });
  } catch (error: any) {
    const message = error?.name === 'AbortError'
      ? 'O envio da mensagem demorou mais do que o esperado.'
      : 'Não foi possível enviar esta mensagem.';
    console.error('Erro ao enviar WhatsApp via n8n:', error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
