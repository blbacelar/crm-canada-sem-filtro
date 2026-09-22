import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { grantsDiagnosticAccess, parseHotmartWebhook, HotmartWebhookPayload } from '@/lib/hotmart';
import { normalizedClientIdentity } from '@/lib/normalize-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptClientRecord } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  let eventLogId: string | null = null;
  let supabase: ReturnType<typeof createAdminClient> | null = null;

  try {
    const payload: HotmartWebhookPayload = await request.json();

    // Ler HOTTOK do cabeçalho da requisição ou do corpo do JSON enviado pela Hotmart
    const hottokHeader = request.headers.get('x-hotmart-hottok') || request.headers.get('hottok');
    const hottokBody = (payload as any)?.hottok || (payload as any)?.secret;
    const receivedHottok = hottokHeader || hottokBody;

    const expectedHottok = process.env.HOTMART_HOTTOK;

    if (!expectedHottok) {
      console.error('HOTMART_HOTTOK não configurado; webhook recusado por segurança.');
      return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 500 });
    }

    const expected = Buffer.from(expectedHottok);
    const received = Buffer.from(receivedHottok || '');
    const validToken = expected.length === received.length && crypto.timingSafeEqual(expected, received);
    if (!validToken) {
      return NextResponse.json(
        { error: 'Não autorizado. Token HOTTOK inválido.' },
        { status: 401 }
      );
    }

    const parsedEvent = parseHotmartWebhook(payload);

    if (!parsedEvent) {
      return NextResponse.json(
        { error: 'Payload de webhook inválido ou campos ausentes.' },
        { status: 400 }
      );
    }

    // Webhooks não possuem sessão de navegador. A escrita é feita no servidor
    // com a chave administrativa, que nunca é exposta ao cliente.
    supabase = createAdminClient();

    // 1. Gravar no Ledger de Eventos (events_log)
    const { data: eventLog, error: logError } = await (supabase as any)
      .from('events_log')
      .insert({
        event_type: parsedEvent.eventType,
        transaction_code: parsedEvent.transactionCode,
        payload: payload as any,
        status_processing: 'pending',
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error('Não foi possível gravar em events_log:', logError);
      return NextResponse.json({ error: 'Não foi possível registrar o evento.' }, { status: 503 });
    }
    eventLogId = eventLog?.id || null;

    const updateEventStatus = async (status: string, errorMessage?: string) => {
      if (!eventLogId) return;
      const { error } = await (supabase as any)
        .from('events_log')
        .update({ status_processing: status, ...(errorMessage ? { error_message: errorMessage } : {}) })
        .eq('id', eventLogId);
      if (error) throw error;
    };

    // 2. Trava de Idempotência: Checar se transação + evento já foram processados
    if (parsedEvent.transactionCode) {
      const { data: existingEvents } = await (supabase as any)
        .from('events_log')
        .select('id')
        .eq('transaction_code', parsedEvent.transactionCode)
        .eq('event_type', parsedEvent.eventType)
        .eq('status_processing', 'processed');

      if (existingEvents && existingEvents.length > 0) {
        await updateEventStatus('ignored_duplicate');

        return NextResponse.json({
          received: true,
          status: 'ignored_duplicate',
          message: 'Evento duplicado ignorado com sucesso.',
        });
      }
    }

    // 3. Criar ou Atualizar Cliente (deduplicação atômica por e-mail normalizado e criptografia PGP)
    if (parsedEvent.buyerEmail) {
      try {
        const rawClientPayload = normalizedClientIdentity({
          name: parsedEvent.buyerName,
          email: parsedEvent.buyerEmail,
          phone: parsedEvent.buyerPhone,
          document: parsedEvent.buyerDocument,
          country: parsedEvent.buyerCountry,
          zip_code: parsedEvent.buyerZipCode,
          city: parsedEvent.buyerCity,
          state: parsedEvent.buyerState,
          address: parsedEvent.buyerAddress,
          district: parsedEvent.buyerDistrict,
          number: parsedEvent.buyerNumber,
          complement: parsedEvent.buyerComplement,
          source: 'hotmart',
          status_journey: parsedEvent.mappedJourneyState,
        });

        const clientPayload = encryptClientRecord(rawClientPayload);

        // Cliente, compra e permissão de diagnóstico são aplicados em uma
        // única transação PostgreSQL para evitar gravações parciais.
        const { error: processError } = await (supabase as any).rpc('process_hotmart_event', {
          p_client: clientPayload,
          p_purchase: {
            transaction_code: parsedEvent.transactionCode,
            product_id: parsedEvent.productId,
            product_name: parsedEvent.productName,
            price_gross: parsedEvent.priceGross,
            price_net: parsedEvent.priceNet,
            status_hotmart: parsedEvent.eventType,
            purchase_date: parsedEvent.purchaseDate,
            event_occurred_at: parsedEvent.eventOccurredAt,
            approved_at: parsedEvent.approvedAt,
          },
          p_allowed_email: parsedEvent.productId !== null && grantsDiagnosticAccess(parsedEvent.eventType)
            ? parsedEvent.buyerEmail.toLowerCase().trim()
            : null,
        });
        if (processError) throw processError;
      } catch (dbErr) {
        throw dbErr;
      }
    }

    // Atualizar status do log no Ledger para 'processed'
    await updateEventStatus('processed');

    return NextResponse.json({
      received: true,
      status: 'processed',
      transaction: parsedEvent.transactionCode,
      clientEmail: parsedEvent.buyerEmail,
    });
  } catch (err: any) {
    console.error('Erro no processamento do webhook Hotmart:', err);
    if (supabase && eventLogId) {
      const { error: statusError } = await (supabase as any)
        .from('events_log')
        .update({ status_processing: 'error', error_message: err.message || 'Erro de processamento' })
        .eq('id', eventLogId);
      if (statusError) console.error('Falha ao marcar webhook como erro:', statusError);
    }
    return NextResponse.json({
      received: true,
      status: 'error',
      message: 'Erro no processamento do webhook.',
    }, { status: 500 });
  }
}
