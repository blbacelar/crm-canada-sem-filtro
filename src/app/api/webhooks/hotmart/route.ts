import { NextRequest, NextResponse } from 'next/server';
import { grantsDiagnosticAccess, parseHotmartWebhook, HotmartWebhookPayload } from '@/lib/hotmart';
import { normalizedClientIdentity } from '@/lib/normalize-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptClientRecord } from '@/lib/crypto';

export async function POST(request: NextRequest) {
  try {
    const payload: HotmartWebhookPayload = await request.json();

    // Ler HOTTOK do cabeçalho da requisição ou do corpo do JSON enviado pela Hotmart
    const hottokHeader = request.headers.get('x-hotmart-hottok') || request.headers.get('hottok');
    const hottokBody = (payload as any)?.hottok || (payload as any)?.secret;
    const receivedHottok = hottokHeader || hottokBody;

    const expectedHottok = process.env.HOTMART_HOTTOK;

    // Em produção com HOTMART_HOTTOK configurado, validar o token se enviado
    if (expectedHottok && receivedHottok && receivedHottok !== expectedHottok) {
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

        const { data: client } = await (supabase as any)
          .from('clients')
          .upsert(clientPayload, { onConflict: 'email' })
          .select('id')
          .single();

        if (client) {
          const clientId = (client as any).id;

          // 4. Gravar Transação na Tabela purchases
          await (supabase as any).from('purchases').upsert({
            client_id: clientId,
            transaction_code: parsedEvent.transactionCode,
            product_name: parsedEvent.productName,
            price_gross: parsedEvent.priceGross,
            price_net: parsedEvent.priceNet,
            status_hotmart: parsedEvent.eventType,
            purchase_date: parsedEvent.purchaseDate,
          }, { onConflict: 'transaction_code' });
        }

        // A permissão do diagnóstico é um efeito idempotente da compra aprovada.
        if (grantsDiagnosticAccess(parsedEvent.eventType)) {
          await (supabase as any)
            .from('allowed_emails')
            .upsert(
              { email: parsedEvent.buyerEmail.toLowerCase().trim() },
              { onConflict: 'email', ignoreDuplicates: true },
            );
        }
      } catch (dbErr) {
        console.warn('Aviso no upsert de cliente/compra no webhook:', dbErr);
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
    return NextResponse.json({
      received: true,
      status: 'error_fallback',
      message: err.message || 'Erro contornado',
    });
  }
}
