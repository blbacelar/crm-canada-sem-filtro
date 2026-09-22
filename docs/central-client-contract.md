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

## Acesso anual do produto Hotmart 8575181

O webhook existente `POST /api/webhooks/hotmart` recebe os eventos da configuração
"CRM - Canada Sem Filtro" da Hotmart, que está marcada para todos os produtos.
Para o produto `8575181`, uma compra aprovada registra o ID do produto e a
transação em `public.purchases` e define `access_expires_at` como a data de
aprovação acrescida de um ano civil. A data também aparece em `public.clients`
e `public.allowed_emails` para consulta no CRM e no controle de acesso.

Reembolso, cancelamento, chargeback ou expiração da transação retiram a
concessão daquela compra. Se houver outra compra válida do mesmo produto, o
vencimento mais recente continua valendo. Eventos de outros produtos não criam
um vencimento anual. Eventos sem ID de produto são registrados, mas a nova
versão do webhook não os usa para conceder acesso.

`public.is_email_allowed` aplica o vencimento para o Diário de Bordo. As
políticas de `journals` e das tabelas de Aurora usam a mesma função, inclusive
para sessões que já estavam abertas. Acessos manuais existentes continuam sem
vencimento; um bloqueio manual (`source = 'manual'`, `active = false`) prevalece.

Na implantação, publicar o código do webhook antes de configurar novos eventos
do produto na Hotmart. Aplicar a migração de acesso anual antes da primeira
compra que precise da regra. Verificar no painel da Hotmart que a configuração
existente inclui compra aprovada e eventos de reembolso/cancelamento.
