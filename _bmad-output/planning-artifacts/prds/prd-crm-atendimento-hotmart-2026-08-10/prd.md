---
title: Canadá Sem Filtro | Central de Atendimento
status: draft
created: 2026-08-10
updated: 2026-08-10
---

# PRD: Canadá Sem Filtro | Central de Atendimento
*Título de trabalho; confirmar antes do lançamento.*

## 0. Objetivo do documento

Este PRD orienta produto, design, arquitetura e desenvolvimento na criação de um CRM interno de atendimento para clientes da Canadá Sem Filtro. Ele transforma o [Product Brief](../briefs/brief-crm-atendimento-hotmart-2026-08-10/brief.md) e o [brainstorm intent](../../brainstorming/brainstorm-crm-hotmart-leads-comissoes-2026-08-10/brainstorm-intent.md) em jornadas, requisitos funcionais numerados, requisitos não funcionais e limites de MVP. O produto é tratado como uma aplicação web interna **[ASSUMPTION: confirmada pelo contexto do dashboard existente]**.

## 1. Visão

A Central de Atendimento será a fonte operacional confiável da jornada de cada cliente: compra, pagamentos, produto, status Hotmart, diagnóstico, acompanhamento, consultoria, conversas, responsáveis e comissões. O objetivo é que a equipe saiba rapidamente quem precisa de atenção e consiga redirecionar o caso sem perder contexto.

O primeiro release prioriza o núcleo Hotmart/CRM e a continuidade operacional. Calendly, WhatsApp, Instagram e agentes de IA serão fases posteriores, mas o modelo de dados, consentimento, logs e permissões devem ser preparados para essas extensões.

## 2. Usuários-alvo

### 2.1 Jobs to Be Done

- **Administradora:** acompanhar toda a operação, corrigir prioridades, gerenciar acessos e auditar alterações.
- **Consultora:** saber quais clientes precisam de atendimento, consultar o histórico, registrar interações e acompanhar diagnóstico, consultoria e comissão.
- **Marketing:** acompanhar compras, origem, conversão em consultoria e evolução da jornada.
- **TI:** monitorar integrações, eventos, falhas, reconciliações e segurança.

### 2.2 Não usuários no MVP

- Clientes finais não usarão o CRM diretamente; continuarão usando o diagnóstico e os canais de comunicação existentes.
- WhatsApp, Instagram, Calendly e agentes de IA não serão integrações operacionais do primeiro release.

### 2.3 Jornadas principais

- **UJ-1. Administradora importa o histórico.** A administradora seleciona o CSV da Hotmart, visualiza prévia, identifica duplicidades e confirma a importação. O sistema mostra resultados, conflitos e falhas sem sobrescrever dados silenciosamente.
- **UJ-2. Nova compra entra na fila.** Um evento Hotmart cria ou atualiza o Cliente, registra a Compra e o Status da compra, gera notificação interna e envia o e-mail configurado. O caso aparece na fila de atendimento com prazo configurável.
- **UJ-3. Consultora acompanha um cliente.** A consultora abre a fila, identifica o próximo caso prioritário, consulta produtos, pagamentos, diagnóstico e interações, registra o contato e atualiza o Estado da jornada. A administradora consegue ver se o caso ficou sem atividade.
- **UJ-4. Equipe continua após falha externa.** TI identifica um evento Hotmart não processado ou serviço indisponível nos logs. A equipe cadastra ou atualiza o Cliente manualmente, registra a origem e reconcilia o evento quando a integração retornar.
- **UJ-5. Equipe confere consultoria e comissão.** A consultora ou administradora registra a solicitação, o atendimento, o valor pago e a comissão; o sistema mantém histórico por Cliente, Produto, Consultora e período.
- **UJ-6. Calendly agenda uma consultoria (fase posterior).** Depois da janela de sete dias e da conclusão do Diagnóstico, o Calendly informa Consultora, data e hora. O CRM registra o Agendamento e atualiza a jornada.

## 3. Glossário

- **Cliente:** pessoa identificada por dados de contato e vinculada a uma ou mais Compras.
- **Compra:** transação de um Cliente em um Produto, com código, data, valor, moeda, status e eventos de origem.
- **Evento Hotmart:** notificação ou registro de mudança recebido da Hotmart; deve ser processado de forma idempotente.
- **Lead:** Cliente ou contato em uma etapa de atendimento comercial ou operacional.
- **Diagnóstico:** formulário preenchido pelo Cliente e analisado pela equipe.
- **Consultoria:** serviço solicitado pelo Cliente e atendido por uma Consultora.
- **Consultora:** membro da equipe responsável por atendimento, análise ou consultoria.
- **Estado da jornada:** etapa operacional do Cliente: compra, diagnóstico enviado, acompanhamento, consulta marcada, consulta concluída, cancelamento ou reembolso.
- **Interação:** registro de contato ou ação de atendimento, com autor, data, canal e resultado.
- **SLA de atendimento:** prazo configurável usado para alertar casos sem atividade.
- **Comissão:** valor devido a uma Consultora ou participante, vinculado à Compra/Consultoria e sujeito a conferência.

## 4. Funcionalidades

### 4.1 Clientes, compras e eventos Hotmart

**Descrição:** O sistema mantém um cadastro único de Cliente e seu histórico de Compras. Todos os eventos Hotmart alteram o status atual sem apagar o histórico anterior. A integração deve aceitar repetição, atraso e falha de entrega.

#### FR-1: Criar ou atualizar Cliente

O sistema deve criar ou atualizar um Cliente a partir de um Evento Hotmart ou entrada manual.

**Consequências testáveis:**
- O sistema não cria dois Clientes para a mesma identidade confirmada.
- O sistema registra a origem e a data da criação/atualização.
- Conflitos de identidade ficam pendentes para revisão, nunca são mesclados silenciosamente.

#### FR-2: Registrar Compra

O sistema deve registrar Produto, código da transação, data, status, moeda, valor bruto, valor líquido e dados de comissão quando fornecidos pela Hotmart.

#### FR-3: Processar todos os eventos

O sistema deve aceitar eventos de aprovação, alteração de status, cancelamento, reembolso, chargeback, renovação e recusa **[ASSUMPTION: catálogo final deve ser confirmado com a Hotmart]**.

#### FR-4: Idempotência

O sistema deve processar o mesmo Evento Hotmart mais de uma vez sem duplicar Cliente, Compra, pagamento, notificação ou alteração de jornada.

#### FR-5: Histórico de eventos

O sistema deve preservar payload mínimo, tipo, identificador externo, horário de recebimento, resultado do processamento e mensagem de erro de cada Evento Hotmart.

#### FR-6: Notificação de compra

Após processar uma nova Compra, o sistema deve criar uma notificação interna e enviar um e-mail usando um modelo configurável.

#### FR-7: Reprocessamento

Usuários autorizados devem poder reprocessar um Evento Hotmart com falha, mantendo a tentativa anterior e o novo resultado.

### 4.2 Jornada de atendimento e diagnóstico

**Descrição:** A equipe trabalha a partir de uma fila ordenada por prioridade e SLA. A jornada deve conectar o Cliente ao Diagnóstico, às Interações, à Consultoria e à Comissão.

#### FR-8: Estados da jornada

O sistema deve oferecer os Estados da jornada definidos no Glossário e registrar ator, data, motivo e origem de cada mudança automática ou manual.

#### FR-9: Fila de atendimento

O sistema deve listar clientes novos, em atendimento, sem atividade, com diagnóstico enviado, com consultoria marcada, concluídos, cancelados e reembolsados.

#### FR-10: Prioridade e atribuição

Usuários autorizados devem atribuir Cliente a uma Consultora, alterar prioridade e visualizar a responsável atual.

#### FR-11: Diagnóstico

O sistema deve mostrar se o Diagnóstico foi iniciado, enviado, analisado e entregue, vinculando a entrega ao Cliente e ao evento correspondente.

#### FR-12: Regra dos sete dias

O sistema deve impedir a entrega do resultado e a oferta de horários de Consultoria antes do sétimo dia após a Compra e antes da conclusão do Diagnóstico.

#### FR-13: Interações

Usuários autorizados devem registrar canal, data, autor, resumo, resultado e próximo passo de cada Interação.

#### FR-14: Consultoria e comissão

Usuários autorizados devem registrar solicitação, consultora, data, valor pago, status da Consultoria e Comissão, com histórico de alterações.

### 4.3 Dashboard, alertas e métricas

**Descrição:** O dashboard deve responder rapidamente quem precisa de atendimento e por quê, sem substituir o histórico detalhado.

#### FR-15: Indicadores principais

O dashboard deve exibir total de Clientes, Clientes em atendimento, Diagnósticos enviados, Consultorias marcadas e Clientes sem atividade dentro do SLA.

#### FR-16: SLA configurável

Administradores devem configurar o prazo para abertura/atividade do cadastro; o valor inicial é 24 horas **[ASSUMPTION: definir se conta horas corridas ou úteis]**.

#### FR-17: Escalonamento

Quando um Cliente exceder o SLA sem atividade, o sistema deve elevar a prioridade e notificar a Administradora.

#### FR-18: Métricas de jornada

O sistema deve calcular tempo até primeiro contato, tempo até envio do Diagnóstico, conversão em Consultoria e volume por Estado da jornada.

### 4.4 Importação e continuidade manual

**Descrição:** O primeiro release deve importar o CSV histórico e permitir continuidade quando terceiros falharem.

#### FR-19: Prévia de importação

O sistema deve mostrar colunas reconhecidas, linhas válidas, inválidas e possíveis duplicidades antes da confirmação.

#### FR-20: Importação histórica

O sistema deve importar o CSV disponível com nome, e-mail, telefone, status, dados de produto, compra e valores conforme o mapeamento aprovado.

#### FR-21: Entrada manual

Usuários autorizados devem criar e atualizar Cliente, Compra, Interação e Agendamento manualmente, informando a origem e o motivo.

#### FR-22: Reconciliação

O sistema deve permitir comparar registros manuais com Eventos Hotmart posteriores e resolver conflitos com histórico auditável.

### 4.5 Acesso, privacidade e auditoria

**Descrição:** Dados pessoais, financeiros e de atendimento devem ser acessíveis somente conforme role e função.

#### FR-23: Roles

O sistema deve suportar Administradora, Consultora, Marketing e TI, com matriz configurável de permissões **[ASSUMPTION: nomes finais das roles devem ser confirmados]**.

#### FR-24: Controle de dados sensíveis

O sistema deve restringir dados pessoais completos, dados financeiros, Diagnósticos, Interações e Comissões conforme a role.

#### FR-25: Auditoria

O sistema deve registrar leitura/alteração de dados sensíveis, mudanças manuais de Estado, prioridade, atribuição, valor e Comissão.

#### FR-26: Logs operacionais

O sistema deve registrar envio, status, erro e tentativa de e-mail, webhook, notificação e integração.

### 4.6 Calendly, canais e IA (roadmap)

#### FR-27: Calendly [NON-GOAL for MVP]

Em fase posterior, o sistema deve receber da API do Calendly a Consultora, data, hora e identificador do Agendamento, respeitando FR-12.

#### FR-28: WhatsApp e Instagram [NON-GOAL for MVP]

Em fase posterior, o sistema deve importar ou integrar conversas com consentimento, retenção e autoria preservados.

#### FR-29: Agentes de IA [NON-GOAL for MVP]

Em fase posterior, agentes de IA poderão responder dúvidas simples e encaminhar casos para a equipe, sem alterar decisões sensíveis sem supervisão humana.

## 5. Requisitos não funcionais

### 5.1 Segurança e privacidade

- Aplicar RLS e autorização no servidor para todo dado exposto.
- Nunca expor chaves de serviço no cliente.
- Armazenar somente dados necessários e documentar retenção antes das integrações de conversa.
- Proteger logs contra alteração por usuários operacionais.

### 5.2 Confiabilidade e integração

- Processar Eventos Hotmart de forma idempotente.
- Permitir retry com backoff, dead-letter/revisão manual e reconciliação.
- Exibir saúde e última execução de cada integração.
- Não perder uma operação porque uma integração externa está indisponível.

### 5.3 Desempenho e acessibilidade

- A fila e o dashboard devem carregar em tempo aceitável para o volume inicial **[ASSUMPTION: definir orçamento de latência após medir volume]**.
- O CRM web deve funcionar em desktop e telas menores usadas pela equipe.
- Formulários, tabelas, alertas e estados devem ser navegáveis por teclado e apresentar mensagens de erro compreensíveis.

### 5.4 Dependências de integração

- **Hotmart:** validar o header `X-HOTMART-HOTTOK`, registrar o identificador externo e projetar replay/reconciliação. A conta deve ser configurada para os produtos e eventos relevantes. Fontes: [Webhooks Hotmart](https://developers.hotmart.com/docs/en/tutorials/use-webhook-for-subscriptions/) e [Relatório de vendas](https://help.hotmart.com/pt-br/article/360060057712/como-funciona-o-relatorio-de-vendas/).
- **Calendly:** webhooks exigem plano compatível e escopos apropriados; reagendamentos devem correlacionar o cancelamento do convite antigo com a criação do novo. Fonte: [Calendly API](https://developer.calendly.com/getting-started).
- **WhatsApp:** a futura integração deve exigir opt-in, respeitar opt-out, usar templates aprovados fora da janela de 24 horas e oferecer escalonamento humano. Fontes: [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/) e [Business Messaging Policy](https://business.whatsapp.com/policy/).
- **Instagram:** a futura integração deve usar contas profissionais, respeitar permissões da Meta e correlacionar a identidade da plataforma com o Cliente sem presumir que o identificador seja o mesmo do CRM. Fonte: [Instagram API](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api).

## 6. Restrições e guardrails

- O sistema é interno e não será oferecido como CRM multiempresa no MVP.
- A fonte histórica inicial é o CSV da Hotmart, com 16 registros analisados.
- A integração Calendly fica depois do núcleo; WhatsApp, Instagram e IA ficam depois do Calendly.
- Estados e comissões alterados manualmente devem preservar motivo, autor e horário.
- Não definir regras de cálculo ou retenção sem validação com a operação e a política de privacidade.

## 7. Escopo do MVP

### 7.1 Dentro

- Importação histórica do CSV com prévia, deduplicação e relatório.
- Eventos Hotmart, cadastro de Cliente, Compras, Produtos, pagamentos e status.
- Jornada, fila, prioridade, atribuição, Diagnóstico, Interações, Consultoria e Comissão.
- Regra dos sete dias e conclusão do Diagnóstico.
- Dashboard e alertas configuráveis, incluindo o prazo inicial de 24 horas.
- Roles, RLS, auditoria, logs e reconciliação.
- Entrada manual e operação de contingência.

### 7.2 Fora do MVP

- Integração Calendly; será a próxima fase.
- Integrações nativas de WhatsApp e Instagram.
- Agentes de IA conversando com clientes.
- Produto multiempresa, aplicativo nativo e automações sem supervisão para decisões sensíveis.

## 8. Métricas de sucesso

### Primárias

- **SM-1:** percentual de Clientes com primeiro contato dentro do SLA definido. Valida FR-9, FR-16 e FR-17. **[TARGET: definir com a operação]**
- **SM-2:** percentual de Eventos Hotmart processados sem intervenção manual. Valida FR-3, FR-4 e FR-7. **[TARGET: definir após período de observação]**

### Secundárias

- **SM-3:** conversão de Clientes em Consultoria. Valida FR-14 e FR-18.
- **SM-4:** tempo mediano entre Compra e primeiro contato. Valida FR-13 e FR-18.
- **SM-5:** tempo mediano entre Compra e envio do Diagnóstico. Valida FR-11, FR-12 e FR-18.
- **SM-6:** percentual de Compras com pagamento e Comissão reconciliados. Valida FR-2, FR-14 e FR-22.

### Contramétricas

- **SM-C1:** número de Interações ou e-mails enviados sem contato real. Deve ser monitorado para evitar que a equipe otimize volume em vez de atendimento efetivo.
- **SM-C2:** incidentes de exposição ou acesso indevido a dados pessoais. Deve permanecer zero.

## 9. Perguntas abertas

1. Quais são os nomes e permissões finais das roles?
2. “Cadastro aberto” significa primeira visualização, primeiro contato registrado ou outra ação?
3. O SLA de 24 horas conta horas corridas ou úteis, e qual é o horário de atendimento?
4. Qual é o catálogo oficial de eventos Hotmart e quais estados cada evento pode alterar?
5. Como deduplicar registros por e-mail, telefone, transaction code e mudanças de e-mail?
6. Qual é a fórmula de Comissão por Produto/oferta e quem aprova correções?
7. Quais colunas do CSV entram no modelo definitivo e quais devem ser descartadas?
8. Como o cliente consente, consulta e solicita a retenção de conversas de WhatsApp/Instagram?
9. Qual volume esperado de Clientes, Eventos e Interações em 12 meses?
10. Qual prazo de implantação e quais pessoas aprovam o MVP?
11. Qual versão dos eventos Hotmart será habilitada e onde ficará o `HOTTOK` com segurança?
12. O plano Calendly disponível inclui webhooks e qual conta terá escopo de organização?
13. Qual conta Meta, WABA, número, opt-in e política de templates serão usados no WhatsApp?
14. Qual conta Instagram profissional e fluxo de permissões/App Review serão usados?

## 10. Índice de suposições

- §0: a primeira versão será uma aplicação web interna baseada no dashboard existente.
- FR-3: o catálogo citado de eventos Hotmart precisa ser confirmado.
- FR-16: o prazo inicial de 24 horas ainda precisa ser classificado como horas corridas ou úteis.
- FR-23: os nomes finais e a matriz de roles ainda precisam ser confirmados.
- NFR 5.3: o orçamento de latência precisa ser definido após medir o volume inicial.
- §5.4: a disponibilidade, os planos e as permissões das integrações externas ainda precisam ser confirmados.
