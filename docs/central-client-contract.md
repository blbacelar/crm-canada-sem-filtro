# Contrato de cadastro centralizado

O CRM e o App de Diagnóstico usam o mesmo projeto Supabase e a tabela `public.clients` como cadastro único de negócio.

## Regra de identidade

`email` é a chave de negócio: sempre deve ser gravado como `LOWER(TRIM(email))`. O banco mantém uma restrição única para impedir duas pessoas com o mesmo e-mail normalizado.

## Campos canônicos

`name` e `email` são obrigatórios. O cadastro também pode conter `phone`, `document`, `country`, `zip_code`, `city`, `state`, `address`, `district`, `number`, `complement` e `status_journey`.

## Escritas

- Webhooks Hotmart usam `upsert(..., { onConflict: 'email' })` e atualizam o estado da jornada e os dados presentes no evento.
- Eventos de compra aprovada também inserem o e-mail normalizado em `public.allowed_emails` com conflito ignorado (`ON CONFLICT (email) DO NOTHING`) para liberar o diagnóstico de forma idempotente.
- O cadastro manual usa o mesmo `upsert`; não há fluxo paralelo de `select` seguido de `insert`.
- A submissão do diagnóstico atualiza o mesmo registro central antes de registrar a submissão do caso.
- Compras usam `transaction_code` como chave idempotente.

O `SUPABASE_SERVICE_ROLE_KEY` fica restrito ao servidor para processar webhooks; nunca é enviado ao navegador.
