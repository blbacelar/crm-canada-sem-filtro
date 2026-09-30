import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { grantsDiagnosticAccess, parseHotmartCartAbandonment, parseHotmartWebhook, HotmartWebhookPayload } from '@/lib/hotmart';
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

    const parsedCart = parseHotmartCartAbandonment(payload);
    const parsedEvent = parsedCart ? null : parseHotmartWebhook(payload);

    if (!parsedCart && !parsedEvent) {
      return NextResponse.json(
        { error: 'Payload de webhook inválido ou campos ausentes.' },
        { status: 400 }
      );
    }

    // Webhooks não possuem sessão de navegador. A escrita é feita no servidor
    // com a chave administrativa, que nunca é exposta ao cliente.
    supabase = createAdminClient();

    // 1. Gravar no Ledger de Eventos (events_log)
    const eventType = parsedCart ? 'PURCHASE_OUT_OF_SHOPPING_CART' : parsedEvent!.eventType;
    const transactionCode = parsedEvent?.transactionCode || null;
    const externalEventId = payload.id?.trim() || null;
    const { data: eventLog, error: logError } = await (supabase as any)
      .from('events_log')
      .insert({
        event_type: eventType,
        transaction_code: transactionCode,
        external_event_id: externalEventId,
        payload: payload as any,
        status_processing: 'pending',
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError?.code === '23505' && externalEventId) {
      const { data: existingLog, error: existingError } = await (supabase as any)
        .from('events_log')
        .select('id, status_processing')
        .eq('external_event_id', externalEventId)
        .single();
      if (existingError) throw existingError;
      if (existingLog.status_processing === 'processed' || existingLog.status_processing === 'ignored_duplicate') {
        return NextResponse.json({ received: true, status: 'ignored_duplicate' });
      }
      eventLogId = existingLog.id;
    } else if (logError) {
      console.error('Não foi possível gravar em events_log:', logError);
      return NextResponse.json({ error: 'Não foi possível registrar o evento.' }, { status: 503 });
    } else {
      eventLogId = eventLog?.id || null;
    }

    const updateEventStatus = async (status: string, errorMessage?: string) => {
      if (!eventLogId) return;
      const { error } = await (supabase as any)
        .from('events_log')
        .update({ status_processing: status, ...(errorMessage ? { error_message: errorMessage } : {}) })
        .eq('id', eventLogId);
      if (error) throw error;
    };

    // Legacy payloads without an event ID can only be deduplicated by transaction + type.
    if (!externalEventId && transactionCode) {
      const { data: existingEvents } = await (supabase as any)
        .from('events_log')
        .select('id')
        .eq('transaction_code', transactionCode)
        .eq('event_type', eventType)
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

    if (parsedCart) {
      const client = normalizedClientIdentity({
        name: parsedCart.buyerName,
        email: parsedCart.buyerEmail,
        phone: parsedCart.buyerPhone,
      });
      const { error: cartError } = await (supabase as any).rpc('record_hotmart_cart_abandonment', {
        p_client: client,
        p_cart: {
          event_id: parsedCart.eventId,
          product_id: parsedCart.productId,
          product_name: parsedCart.productName,
          offer_code: parsedCart.offerCode,
          occurred_at: parsedCart.occurredAt,
        },
      });
      if (cartError) throw cartError;
      await updateEventStatus('processed');
      return NextResponse.json({ received: true, status: 'processed' });
    }

    // 3. Criar ou Atualizar Cliente (deduplicação atômica por e-mail normalizado e criptografia PGP)
    if (parsedEvent!.buyerEmail) {
      try {
        const rawClientPayload = normalizedClientIdentity({
          name: parsedEvent!.buyerName,
          email: parsedEvent!.buyerEmail,
          phone: parsedEvent!.buyerPhone,
          document: parsedEvent!.buyerDocument,
          country: parsedEvent!.buyerCountry,
          zip_code: parsedEvent!.buyerZipCode,
          city: parsedEvent!.buyerCity,
          state: parsedEvent!.buyerState,
          address: parsedEvent!.buyerAddress,
          district: parsedEvent!.buyerDistrict,
          number: parsedEvent!.buyerNumber,
          complement: parsedEvent!.buyerComplement,
          source: 'hotmart',
          status_journey: parsedEvent!.mappedJourneyState,
        });

        const { data: existingClient, error: clientError } = await (supabase as any)
          .from('clients')
          .select('name, source, status_journey, phone, document, country, zip_code, city, state, address, district, number, complement')
          .eq('email', parsedEvent!.buyerEmail)
          .maybeSingle();
        if (clientError) throw clientError;
        const candidate = encryptClientRecord(rawClientPayload);
        const clientPayload = existingClient ? {
          ...candidate,
          name: existingClient.name || candidate.name,
          source: existingClient.source || candidate.source,
          status_journey: ['carrinho_abandonado', 'pagamento_pendente'].includes(existingClient.status_journey)
            ? parsedEvent!.mappedJourneyState : existingClient.status_journey,
          phone: existingClient.phone || candidate.phone,
          document: existingClient.document || candidate.document,
          country: existingClient.country || candidate.country,
          zip_code: existingClient.zip_code || candidate.zip_code,
          city: existingClient.city || candidate.city,
          state: existingClient.state || candidate.state,
          address: existingClient.address || candidate.address,
          district: existingClient.district || candidate.district,
          number: existingClient.number || candidate.number,
          complement: existingClient.complement || candidate.complement,
        } : candidate;

        const { data: existingPurchase, error: purchaseError } = await (supabase as any)
          .from('purchases')
          .select('price_gross, price_net')
          .eq('transaction_code', parsedEvent!.transactionCode)
          .maybeSingle();
        if (purchaseError) throw purchaseError;

        // Cliente, compra e permissão de diagnóstico são aplicados em uma
        // única transação PostgreSQL para evitar gravações parciais.
        const { error: processError } = await (supabase as any).rpc('process_hotmart_event', {
          p_client: clientPayload,
          p_purchase: {
            transaction_code: parsedEvent!.transactionCode,
            product_id: parsedEvent!.productId,
            product_name: parsedEvent!.productName,
            price_gross: parsedEvent!.priceGross ?? existingPurchase?.price_gross ?? null,
            price_net: existingPurchase?.price_net ?? parsedEvent!.priceNet,
            status_hotmart: parsedEvent!.eventType,
            purchase_date: parsedEvent!.purchaseDate,
            event_occurred_at: parsedEvent!.eventOccurredAt,
            approved_at: parsedEvent!.approvedAt,
          },
          p_allowed_email: parsedEvent!.productId !== null && grantsDiagnosticAccess(parsedEvent!.eventType)
            ? parsedEvent!.buyerEmail.toLowerCase().trim()
            : null,
        });
        if (processError) throw processError;
        if (parsedEvent!.includedProducts.length) {
          const { error: productsError } = await (supabase as any)
            .from('hotmart_purchase_products')
            .upsert(parsedEvent!.includedProducts.map((product) => ({
              transaction_code: parsedEvent!.transactionCode,
              product_id: product.productId,
              product_name: product.productName,
            })), { onConflict: 'transaction_code,product_id' });
          if (productsError) throw productsError;
        }
      } catch (dbErr) {
        throw dbErr;
      }
    }

    // Atualizar status do log no Ledger para 'processed'
    await updateEventStatus('processed');

    return NextResponse.json({
      received: true,
      status: 'processed',
      transaction: parsedEvent!.transactionCode,
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
