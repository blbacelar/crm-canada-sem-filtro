---
title: Canadá Sem Filtro | Central de Atendimento - Epics and User Stories
status: approved
created: 2026-08-10
updated: 2026-08-10
---

# EPICS AND USER STORIES: Canadá Sem Filtro | Central de Atendimento

## Visão Geral do Backlog

Este documento traduz o [PRD aprovado](../../prds/prd-crm-atendimento-hotmart-2026-08-10/prd.md), a [Arquitetura Técnica](../../architecture/architecture-crm-atendimento-hotmart-2026-08-10/ARCHITECTURE-SPINE.md) e a [Especificação de UX](../../ux/ux-crm-atendimento-hotmart-2026-08-10/EXPERIENCE.md) em épicos e histórias de usuário orientadas a desenvolvimento.

---

## 🎯 Épico 1: Fundação, Autenticação e Controle de Acesso (RLS)

**Objetivo:** Configurar o projeto Next.js + Supabase com a tabela de perfis (`profiles`) e aplicar Row Level Security (RLS) garantindo a separação dos 4 papéis (`admin`, `consultant`, `marketing`, `tech`).

### Story 1.1: Configuração do Projeto Supabase & Tipos TypeScript
- **Como** Desenvolvedor,
- **Quero** inicializar a estrutura do banco de dados no Supabase e gerar a tipagem `database.types.ts`,
- **Para que** todas as queries da aplicação sejam fortemente tipadas.
- **Critérios de Aceite:**
  - Tabela `profiles` criada com relacionamento 1:1 para `auth.users`.
  - Enum de roles (`admin`, `consultant`, `marketing`, `tech`).
  - Arquivo `database.types.ts` gerado no projeto.

### Story 1.2: Implementação de RLS e Autorização no Servidor
- **Como** Engenheiro de Segurança,
- **Quero** configurar as políticas de RLS no PostgreSQL para cada tabela de domínio,
- **Para que** dados sensíveis (PII, diagnósticos, comissões) só sejam acessíveis conforme o perfil do usuário logado.
- **Critérios de Aceite:**
  - `admin`: Leitura e escrita irrestritas.
  - `consultant`: Leitura e escrita restritas a clientes atribuídos e comissões próprias.
  - `marketing`: Leitura restrita a views de BI agregadas.
  - `tech`: Acesso exclusivo à auditoria e logs de webhooks.

### Story 1.3: Autenticação Supabase Auth, Tela de Login & Middleware SSR
- **Como** Membro da Equipe (Administradora, Consultora, Marketing ou TI),
- **Quero** fazer login seguro com e-mail e senha utilizando Supabase Auth e ter minha sessão mantida por cookies seguros,
- **Para que** eu acesse o CRM de acordo com o meu perfil sem expor a aplicação a acessos não autorizados.
- **Critérios de Aceite:**
  - Tela de Login dedicada em `/login` estilizada no tema Dark Mode do `DESIGN.md`.
  - Autenticação nativa via `@supabase/ssr` com cookies HTTP-only.
  - `middleware.ts` protegendo todas as rotas privadas sob `/`, redirecionando visitantes não autenticados para `/login`.
  - Trigger automático `on_auth_user_created()` vinculando a nova conta em `auth.users` ao perfil em `public.profiles`.
  - Botão e fluxo de Logout limpando cookies e encerrando a sessão no Supabase.

---

## ⚡ Épico 2: Webhooks Hotmart & Idempotência de Eventos

**Objetivo:** Criar o receptor de webhooks da Hotmart, garantindo auditoria em ledger e proteção contra compras duplicadas ou eventos perdidos.

### Story 2.1: Endpoint de Webhook `/api/webhooks/hotmart` & Ledger (`events_log`)
- **Como** Sistema CRM,
- **Quero** receber webhooks da Hotmart e gravá-los na tabela `events_log`,
- **Para que** nenhum evento de compra ou cancelamento seja perdido.
- **Critérios de Aceite:**
  - Validação do cabeçalho `X-HOTMART-HOTTOK`.
  - Gravação imediata do payload bruto em `events_log` com status `pending`.
  - Retorno HTTP 200 rápido para a Hotmart.

### Story 2.2: Processador Idempotente de Compras e Cancelamentos
- **Como** Sistema CRM,
- **Quero** processar eventos de `PURCHASE_APPROVED`, `CANCELLED`, `REFUNDED` e `CHARGEBACK`,
- **Para que** o cadastro do cliente e suas compras sejam atualizados sem duplicidades.
- **Critérios de Aceite:**
  - Checagem por `transaction_code` + `event_type`.
  - Eventos repetidos marcados como `ignored_duplicate`.
  - Criação ou atualização do registro na tabela `clients` e `purchases`.

---

## 📋 Épico 3: Fila de Atendimento & Motor de SLA em Horas Úteis

**Objetivo:** Desenvolver a tela principal da Fila de Atendimento com contagem inteligente de SLA em horas úteis.

### Story 3.1: Tabela da Fila de Atendimento com Badges de Estado & Suporte a Temas (Dark/Light)
- **Como** Consultora ou Administradora,
- **Quero** visualizar a lista de clientes ordenada por prioridade e SLA restante, podendo alternar entre Dark Mode e Light Mode,
- **Para que** eu saiba exatamente quem precisa de atendimento com o maior conforto visual no meu ambiente de trabalho.
- **Critérios de Aceite:**
  - Tabela responsiva com suporte a **Dark Mode** e **Light Mode** conforme especificado no `DESIGN.md`.
  - Alternador de tema (Sol/Lua) na barra superior com persistência em `localStorage` (via `next-themes` ou CSS variables).
  - Badges coloridas com opacidade adaptada para ambos os temas.
  - Filtros rápidos por estado, responsável e busca global por nome/e-mail (`Cmd + K`).

### Story 3.2: Motor de Cálculo de SLA de 24h Úteis
- **Como** Administradora,
- **Quero** que o prazo de 24 horas para o primeiro contato seja calculado exclusivamente em horas úteis (seg-sex 9h-18h),
- **Para que** atendimentos atrasados durante fins de semana não gerem falsos alertas.
- **Critérios de Aceite:**
  - Função utilitária `calculate_business_hours`.
  - Clientes que excederem 24h úteis sem contato real recebem a flag `is_overdue = true` e destaque visual pulsante em vermelho.

---

## 👤 Épico 4: Detalhes do Cliente, Diagnóstico e Registro de Interações

**Objetivo:** Permitir que as consultoras abram a ficha completa do cliente em um painel lateral retrátil (Drawer) para atendimento.

### Story 4.1: Drawer Retrátil da Ficha do Cliente
- **Como** Consultora,
- **Quero** clicar em um cliente na fila e abrir um painel lateral sem perder o contexto da tabela,
- **Para que** eu possa ver dados de contato, histórico de compras e link direto para o WhatsApp Web.
- **Critérios de Aceite:**
  - Painel lateral retrátil (`Right Sheet`) de 540px.
  - Link de 1-clique para WhatsApp Web (`https://wa.me/...`).
  - Dropdown para alteração manual de Estado da jornada.

### Story 4.2: Validação do Diagnóstico e Regra dos 7 Dias
- **Como** Consultora,
- **Quero** acompanhar o preenchimento do formulário de diagnóstico e visualizar a contagem regressiva dos 7 dias,
- **Para que** os resultados e a marcação da consulta não sejam liberados antes do prazo legal pós-compra.
- **Critérios de Aceite:**
  - Status do diagnóstico (`pendente`, `enviado`, `analisado`).
  - Bloqueio visual e alerta do prazo de 7 dias pós-compra.

### Story 4.3: Registro de Interações & Baixa de SLA
- **Como** Consultora,
- **Quero** registrar notas de atendimento (WhatsApp, e-mail, ligação),
- **Para que** o histórico de conversa fique auditável e o SLA de primeiro contato seja satisfeito.
- **Critérios de Aceite:**
  - Form com campo de canal, resumo, resultado e próxima ação.
  - Atualização automática do SLA e satisfação do prazo de primeiro contato.

---

## ⚙️ Épico 5: Configuração de Comissões, Deduplicação e Contingência Manual

**Objetivo:** Fornecer à Administradora telas exclusivas para parametrização de comissões, tratamento de duplicidades e entrada manual de emergência.

### Story 5.1: Painel de Configuração de Comissões (Exclusivo Admin)
- **Como** Administradora,
- **Quero** definir taxas e valores de comissão por produto e consultora em uma tela de configuração,
- **Para que** os valores devidos por atendimento sejam calculados automaticamente.
- **Critérios de Aceite:**
  - Acesso restrito via RLS e Middleware para a role `admin`.
  - Tabela editável de regras por produto/oferta.

### Story 5.2: Tela de Conciliação e Alertas de Duplicidade
- **Como** Administradora,
- **Quero** revisar clientes com possíveis duplicidades (e-mails diferentes mas telefones/dados idênticos),
- **Para que** eu possa mesclar registros sem perder o histórico de compras.
- **Critérios de Aceite:**
  - Alerta de duplicidade na fila do Admin.
  - Interface de comparação lado a lado com opção de `Mesclar` ou `Manter Separados`.

### Story 5.3: Form de Contingência Manual de Clientes e Compras
- **Como** Equipe de Atendimento,
- **Quero** cadastrar manualmente um cliente ou compra quando a Hotmart estiver indisponível,
- **Para que** a operação continue sem interrupções.
- **Critérios de Aceite:**
  - Modal de inserção manual registrando o autor, motivo e data original.

---

## 📊 Épico 6: Dashboard Geral de Métricas & BI

**Objetivo:** Exibir os indicadores estratégicos de atendimento e conversão no topo da aplicação.

### Story 6.1: Metric Cards do Dashboard (Tempo Real)
- **Como** Administradora e Marketing,
- **Quero** visualizar os cartões de métricas no topo da página (Total Clientes, Em Atendimento, Diagnósticos Enviados, SLA Estourado),
- **Para que** eu acompanhe a saúde da operação em tempo real.
- **Critérios de Aceite:**
  - Cards no estilo visual do `DESIGN.md`.
  - Atualização via Supabase Realtime ou polling inteligente.
