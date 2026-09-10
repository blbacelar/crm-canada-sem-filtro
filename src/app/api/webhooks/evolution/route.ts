import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function constantTimeMatch(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function messageText(message: any) {
  return message?.conversation
    || message?.extendedTextMessage?.text
    || message?.imageMessage?.caption
    || message?.videoMessage?.caption
    || message?.documentMessage?.caption
    || null;
}

function phoneDigits(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

function eventMessages(payload: any) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.messages)) return payload.messages;
  if (payload?.data) return [payload.data];
  return [];
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.EVOLUTION_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: 'EVOLUTION_WEBHOOK_SECRET não configurado.' }, { status: 500 });
  }

  const receivedSecret = request.headers.get('x-crm-webhook-secret')
    || request.headers.get('x-evolution-webhook-secret')
    || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    || '';
  if (!constantTimeMatch(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: 'Webhook Evolution não autorizado.' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const event = String(payload?.event || payload?.type || '').toLowerCase();
    const instanceName = String(payload?.instance || payload?.instanceName || payload?.data?.instance || '').trim();
    const messages = eventMessages(payload);

    if (!instanceName || !messages.length) {
      return NextResponse.json({ received: true, status: 'ignored', reason: 'Evento sem mensagens.' });
    }

    const supabase = createAdminClient();
    const { data: clients, error: clientsError } = await (supabase as any)
      .from('clients')
      .select('id, phone')
      .not('phone', 'is', null);
    if (clientsError) throw clientsError;

    let stored = 0;
    for (const item of messages) {
      const key = item?.key || item?.message?.key || {};
      const messageId = String(key.id || '').trim();
      const remoteJid = String(key.remoteJid || item?.remoteJid || '').trim();
      if (!messageId || !remoteJid) continue;

      const remoteDigits = phoneDigits(remoteJid.split('@')[0]);
      const matchedClient = (clients || []).find((client: any) => {
        const clientDigits = phoneDigits(client.phone);
        return clientDigits && remoteDigits && (clientDigits === remoteDigits || clientDigits.endsWith(remoteDigits) || remoteDigits.endsWith(clientDigits));
      });
      const message = item?.message || item;
      const timestamp = Number(item?.messageTimestamp || item?.timestamp || 0);
      const messageTimestamp = timestamp > 0
        ? new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp).toISOString()
        : new Date().toISOString();
      const contactName = item?.pushName || item?.verifiedBizName || null;

      const { data: conversation, error: conversationError } = await (supabase as any)
        .from('whatsapp_conversations')
        .upsert({
          instance_name: instanceName,
          remote_jid: remoteJid,
          client_id: matchedClient?.id || null,
          contact_name: contactName,
          last_message_at: messageTimestamp,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'instance_name,remote_jid' })
        .select('id')
        .single();
      if (conversationError) throw conversationError;

      const { error: messageError } = await (supabase as any)
        .from('whatsapp_messages')
        .upsert({
          conversation_id: conversation.id,
          instance_name: instanceName,
          message_id: messageId,
          remote_jid: remoteJid,
          client_id: matchedClient?.id || null,
          from_me: Boolean(key.fromMe || item?.fromMe),
          message_type: String(item?.messageType || Object.keys(message || {})[0] || 'unknown'),
          text_content: messageText(message),
          status: item?.status || null,
          message_timestamp: messageTimestamp,
          payload: item,
        }, { onConflict: 'instance_name,message_id' });
      if (messageError) throw messageError;
      stored += 1;
    }

    return NextResponse.json({ received: true, status: 'processed', event, stored });
  } catch (error: any) {
    console.error('Erro ao processar webhook da Evolution API:', error);
    return NextResponse.json({ received: true, status: 'error', message: 'Erro ao processar evento da Evolution API.' }, { status: 500 });
  }
}
