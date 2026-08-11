import { NextRequest, NextResponse } from 'next/server';
import { grantsDiagnosticAccess, parseHotmartWebhook, HotmartWebhookPayload } from '@/lib/hotmart';
import { normalizedClientIdentity } from '@/lib/normalize-client';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const hottokHeader = request.headers.get('x-hotmart-hottok') || request.headers.get('hottok');
    const expectedHottok = process.env.HOTMART_HOTTOK;

    // Em produção com HOTMART_HOTTOK configurado, validar o token
    if (expectedHottok && hottokHeader !== expectedHottok) {
      return NextResponse.json(
        { error: 'Não autorizado. Token HOTTOK inválido.' },
        { status: 401 }
      );
    }

    const payload: HotmartWebhookPayload = await request.json();
    const parsedEvent = parseHotmartWebhook(payload);

    if (!parsedEvent) {
      return NextResponse.json(
        { error: 'Payload de webhook inválido ou campos ausentes.' },
        { status: 400 }
      );
    }

    // Webhooks não possuem sessão de navegador. A escrita é feita no servidor
    // com a chave administrativa, que nunca é exposta ao cliente.
    const supabase = createAdminClient();

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
      console.warn('Alerta: Não foi possível gravar em events_log, continuando processamento em memória:', logError);
    }

    // 2. Trava de Idempotência: Checar se transação + evento já foram processados
    if (parsedEvent.transactionCode) {
      const { data: existingEvents } = await (supabase as any)
        .from('events_log')
        .select('id')
        .eq('transaction_code', parsedEvent.transactionCode)
        .eq('event_type', parsedEvent.eventType)
        .eq('status_processing', 'processed');

      if (existingEvents && existingEvents.length > 0) {
        if (eventLog?.id) {
          await (supabase as any)
            .from('events_log')
            .update({ status_processing: 'ignored_duplicate' })
            .eq('id', eventLog.id);
        }

        return NextResponse.json({
          received: true,
          status: 'ignored_duplicate',
          message: 'Evento duplicado ignorado com sucesso.',
        });
      }
    }

    // 3. Criar ou Atualizar Cliente (deduplicação atômica por e-mail normalizado)
    if (parsedEvent.buyerEmail) {
      const clientPayload = normalizedClientIdentity({
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
      const { data: client, error: clientError } = await (supabase as any)
        .from('clients')
        .upsert(clientPayload, { onConflict: 'email' })
        .select('id')
        .single();

      if (clientError || !client) {
        throw new Error(`Erro ao atualizar registro do cliente: ${clientError?.message}`);
      }
      const clientId = (client as any).id;

      // 4. Gravar Transação na Tabela purchases
      const { error: purchaseError } = await (supabase as any).from('purchases').upsert({
        client_id: clientId,
        transaction_code: parsedEvent.transactionCode,
        product_name: parsedEvent.productName,
        price_gross: parsedEvent.priceGross,
        price_net: parsedEvent.priceNet,
        status_hotmart: parsedEvent.eventType,
        purchase_date: parsedEvent.purchaseDate,
      }, { onConflict: 'transaction_code' });
      if (purchaseError) throw purchaseError;

      // A permissão do diagnóstico é um efeito idempotente da compra aprovada.
      // O conflito é deliberadamente ignorado para não alterar cadastros
      // existentes (inclusive registros desativados por reembolso).
      if (grantsDiagnosticAccess(parsedEvent.eventType)) {
        const { error: permissionError } = await (supabase as any)
          .from('allowed_emails')
          .upsert(
            { email: parsedEvent.buyerEmail.toLowerCase().trim() },
            { onConflict: 'email', ignoreDuplicates: true },
          );
        if (permissionError) throw permissionError;
      }
    }

    // Atualizar status do log no Ledger para 'processed'
    if (eventLog?.id) {
      await (supabase as any)
        .from('events_log')
        .update({ status_processing: 'processed' })
        .eq('id', eventLog.id);
    }

    return NextResponse.json({
      received: true,
      status: 'processed',
      transaction: parsedEvent.transactionCode,
      clientEmail: parsedEvent.buyerEmail,
    });
  } catch (err: any) {
    console.error('Erro no processamento do webhook Hotmart:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno ao processar webhook' },
      { status: 500 }
    );
  }
}
