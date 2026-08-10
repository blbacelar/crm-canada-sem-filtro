---
title: Canadá Sem Filtro | Central de Atendimento
status: draft
created: 2026-08-10
updated: 2026-08-10
---

# Product Brief: Canadá Sem Filtro | Central de Atendimento

## Resumo executivo

**Canadá Sem Filtro | Central de Atendimento** é um sistema interno para acompanhar a jornada completa dos clientes que compram produtos da Canadá Sem Filtro. O produto começa pela sincronização com a Hotmart e evolui para um histórico operacional único: compra, pagamentos, status, diagnóstico, acompanhamento, consultoria, comunicações, responsáveis e comissões.

O problema central não é apenas saber quem comprou. É garantir que cada cliente seja atendido no devido tempo, sem eventos perdidos, sem duplicidades e sem deixar informações espalhadas entre Hotmart, e-mail, WhatsApp, Calendly e planilhas. O CRM deve dar à equipe uma fila clara de trabalho, alertas de prazo e rastreabilidade suficiente para confiar nos dados.

O sistema será usado inicialmente por quatro pessoas — duas consultoras, marketing e TI — com acesso baseado em roles. A administradora terá acesso total; as demais permissões serão ajustadas conforme a função.

## Decisões pendentes

- matriz detalhada de roles e permissões;
- definição objetiva de “cadastro aberto”, “primeiro contato” e “contato real”;
- catálogo completo de eventos Hotmart e política para eventos repetidos, conflitantes ou perdidos;
- regra de identificação e mesclagem entre Hotmart, CSV e cadastro manual;
- cálculo e conferência de valores e comissões por produto/oferta;
- campos históricos obrigatórios além do mínimo nome, e-mail, telefone e status;
- definição de consentimento, retenção e escopo para conversas de WhatsApp/Instagram;
- critérios exatos dos indicadores e do prazo de atendimento.

## O problema

Hoje, `public.allowed_emails` controla acesso e alguns dados básicos, mas não representa a jornada comercial e de atendimento. O histórico mais completo está na Hotmart, incluindo nome, contato, endereço, produto, valores, status e dados de comissão. Ainda não existem estruturas próprias para leads, acompanhamento, consultoria, responsável, valor pago ou comissão.

Sem uma visão centralizada, a equipe pode perder eventos de compra ou cancelamento, deixar clientes sem contato, duplicar cadastros, calcular comissões incorretamente ou não conseguir provar quando uma mensagem, agendamento ou entrega aconteceu. A exposição de dados pessoais é o risco mais grave.

## A solução e seus diferenciais

Um CRM de atendimento com:

- importação do CSV histórico da Hotmart e sincronização contínua de todos os eventos;
- cadastro único de cliente, produtos, compras, pagamentos, valores, status e histórico;
- fila de atendimento com prioridade, responsável, acompanhamento e estados da jornada;
- registro do diagnóstico, envio do resultado, consultoria, comissão e interações;
- dashboard para identificar rapidamente clientes sem atividade ou atendimento pendente;
- notificações configuráveis para novas compras e descumprimento de prazo;
- logs de eventos, envios, status, falhas e alterações manuais;
- operação manual de contingência quando uma integração externa estiver indisponível.

O produto é orientado à continuidade do atendimento, não apenas ao registro da venda. O ledger de eventos da Hotmart, a fila de atendimento e os alertas de SLA formam uma única proteção contra clientes esquecidos. O fallback manual mantém a operação funcionando quando Hotmart, Calendly, WhatsApp ou e-mail falharem.

O diferencial pretendido é preservar o contexto completo do cliente ao longo do tempo: quais produtos comprou, quanto pagou, quais diagnósticos recebeu, quais consultoras conversaram com ele e quais comissões resultaram dessas interações.

## Para quem serve

- **Consultoras:** precisam saber quem atender, em que etapa o cliente está, o que já foi enviado e quais valores/comissões estão associados.
- **Marketing:** precisa acompanhar origem, compras, conversão em consultoria e o desempenho da jornada.
- **TI:** precisa monitorar integrações, eventos, logs, falhas e reconciliações.
- **Administradora:** precisa de visão total, controle de permissões, prioridades e auditoria.

O cliente final não acessa o CRM diretamente; ele interage com o diagnóstico, os canais de comunicação e, posteriormente, o agendamento.

## Critérios de sucesso

Nos primeiros 3–6 meses, o produto será considerado bem-sucedido quando:

- os clientes novos forem recebidos e atualizados corretamente a partir dos eventos da Hotmart;
- a equipe conseguir identificar e redirecionar rapidamente qualquer cliente sem atendimento;
- o tempo até o primeiro contato e a conversão em consultoria forem mensuráveis;
- diagnósticos enviados, consultorias marcadas, pagamentos e comissões tiverem histórico auditável;
- falhas de integração puderem ser detectadas e reconciliadas sem perda silenciosa de eventos;
- permissões impedirem acesso indevido a dados pessoais e financeiros.

## Escopo e fases

### Primeira entrega: núcleo Hotmart/CRM

- importação dos 16 registros históricos do CSV disponível, com estratégia de deduplicação;
- webhook/eventos Hotmart para compras, alterações de status, cancelamentos e reembolsos;
- cadastro de cliente, produto, compra, pagamento, status, lead, responsável, diagnóstico e comissão;
- estados automáticos e manuais da jornada;
- dashboard, fila de atendimento, prioridade e alertas configuráveis, incluindo o prazo inicial de 24 horas;
- roles e permissões para administradora, consultoras, marketing e TI;
- logs de eventos, mensagens, envios, status e falhas;
- fallback manual para cadastro, conversas e agendamentos;
- **regra dos sete dias:** o cliente precisa concluir o diagnóstico; o resultado e os horários de consultoria só podem ser disponibilizados a partir do sétimo dia após a compra.

### Evolução e fases posteriores

1. **Calendly:** consultora, data e hora via API, com bloqueio da janela anterior a sete dias.
2. **WhatsApp e Instagram:** importação ou integração do histórico de conversas, com consentimento e retenção definidos.
3. **Agentes de IA:** respostas para dúvidas simples, depois que o modelo de cliente, atendimento, comunicação e consentimento estiver estável.

Em dois ou três anos, a Central de Atendimento será a fonte operacional confiável da relação com cada cliente: dados comerciais, diagnósticos, consultas, pagamentos, conversas, responsáveis e comissões no mesmo histórico. As integrações deverão ser observáveis e substituíveis, e a equipe poderá usar automações e IA sem perder controle humano, consentimento, privacidade ou auditoria.
