# Intenção do produto

Construir um CRM de atendimento que sincronize compradores da Hotmart, importe o histórico disponível e mantenha a jornada completa do cliente: compra, diagnóstico, acompanhamento, consulta, cancelamento ou reembolso. O sistema deve permitir controlar leads, responsáveis, valores e comissões, dando segurança de que cada cliente foi acompanhado e que pagamentos, datas e comissões permanecem rastreáveis. Não é apenas um painel de vendas; é o histórico operacional do atendimento.

## Usuários e papéis

- **Admin:** acesso total.
- **Demais funções da equipe:** acesso ajustado conforme a função; o fluxo citado envolve advogadas que analisam diagnósticos e consultoras responsáveis por consultas.
- O CRM terá múltiplas roles. A matriz exata de permissões ainda precisa ser validada.

## Jornada central

1. Uma compra/evento da Hotmart cria ou atualiza o cadastro do cliente, refletindo seu status atual na plataforma, e libera o acesso ao diagnóstico.
2. O cliente preenche e envia seu perfil/diagnóstico; as advogadas analisam o material.
3. O resultado do diagnóstico só pode ser recebido sete dias após a compra.
4. O cliente pode solicitar consultoria manualmente por WhatsApp ou e-mail. O Calendly agenda a consulta e fornece, via API, a consultora, a data e a hora; as datas oferecidas devem ser a partir de sete dias após a compra.
5. A equipe acompanha o cliente até consulta marcada e concluída, ou até cancelamento/reembolso.

Estados oficiais: **compra**, **diagnóstico enviado**, **acompanhamento**, **consulta marcada**, **consulta concluída**, **cancelamento** e **reembolso**. Eventos da Hotmart podem alterá-los automaticamente, e a equipe também pode alterá-los manualmente.

## MVP e sequência de fases

Embora todos os candidatos tenham sido considerados prioritários, a entrega será sequenciada:

1. **Núcleo Hotmart/CRM:** sincronização de eventos e compradores; importação histórica (quando necessária); cadastro e status atuais; fila de atendimento; diagnóstico; responsável; valores, pagamentos, datas e comissões; estados da jornada; roles/permissões; logs; alertas de SLA; dashboard; e operação manual de contingência.
2. **Calendly:** integração de agendamento, consultora, data e hora via API, respeitando a janela de sete dias.
3. **WhatsApp e Instagram:** centralização ou importação do histórico de conversas.
4. **Agentes de IA:** visão de um ano para resolver dúvidas simples quando necessário, após o modelo de cliente, atendimento, comunicação e consentimento estar estável.

Se as integrações externas estiverem indisponíveis, o fluxo deve continuar com inserção manual de clientes usando dados da Hotmart, colagem de conversas do WhatsApp e registro manual de agendamentos.

## Integrações

- **Hotmart (primeira prioridade):** webhook/eventos e CSV histórico. O CSV analisado tem 16 registros e mais de 60 colunas, incluindo status e data da transação, produto/oferta, valores bruto/líquido, comissões, nome, e-mail, país, telefone e endereço.
- **Calendly:** API para dados do agendamento; entrega posterior ao núcleo.
- **WhatsApp e e-mail:** solicitação manual de consultoria no início; futura importação/integração de conversas e serviços de comunicação.
- **Instagram:** futura integração para histórico centralizado.
- Cada integração deve permitir diagnóstico rápido de falhas e manter logs de envio e status para eventos, agendamentos e mensagens.

## Dados, privacidade e auditoria

- A exposição de dados pessoais é o principal risco. O CRM lidará, entre outros, com nome, endereço, telefone, e-mail, país, dados de compra e histórico de atendimento.
- Aplicar acesso por role, com acesso total do admin e permissões ajustadas às funções.
- Preservar rastreabilidade de eventos Hotmart, pagamentos, datas, valores, comissões, agendamentos, mensagens e interações ao longo do tempo, incluindo quais consultoras conversaram com cada cliente.
- Manter logs de envio e status de eventos, agendamentos e mensagens.
- Tratar como riscos de controle: duplicidades, comissões incorretas, eventos de compra/cancelamento perdidos e marcar atendimento sem contato real.
- Preservar os dados essenciais sem depender de uma ferramenta específica. Integrações futuras também dependem de um modelo estável de consentimento.

## Automação e alertas

- Notificar imediatamente cada nova compra no CRM e por e-mail configurável.
- Se o cadastro não for aberto no prazo configurável (inicialmente 24 horas), enviar nova notificação, avisar a administradora e elevar a prioridade do cadastro.
- Permitir identificar no painel clientes sem atividade dentro do prazo configurado.
- Usar o ledger de eventos Hotmart, a fila de atendimento e os alertas de SLA como uma proteção única contra clientes esquecidos.
- Registrar estados automáticos e manuais e os respectivos envios/status para facilitar diagnóstico de indisponibilidades.

## Métricas e visão do painel

- Total de clientes.
- Clientes em atendimento.
- Diagnósticos enviados.
- Consultorias marcadas.
- Conversão em consultoria.
- Tempo até o primeiro contato.
- **Hipótese a validar:** tempo entre a compra e o envio do diagnóstico.
- Clientes sem atividade dentro do prazo configurado.

## Perguntas abertas para validação

- Qual é a matriz de roles e permissões para cada função da equipe?
- O que define exatamente “cadastro aberto”, “primeiro contato” e “contato real” para os controles e o SLA de 24 horas?
- Quais eventos e estados da Hotmart devem ser cobertos, e como tratar eventos perdidos, repetidos ou conflitantes?
- Qual regra de identificação/mesclagem evita duplicidades entre Hotmart, CSV e entradas manuais?
- Quais são as regras de cálculo e conferência de valores e comissões por produto/oferta?
- A importação histórica usará todas as colunas disponíveis ou somente o mínimo (nome, e-mail, telefone e status da compra)?
- Como deve ser aplicada e auditada a regra de que o resultado e as datas do Calendly só ficam disponíveis sete dias após a compra?
- Quais canais de comunicação serão integrados primeiro, quais dados/conversas devem ser retidos e como será obtido o consentimento?
- Como a equipe será avisada e reconciliará dados após uma falha de webhook, API ou serviço de comunicação?
- Quais critérios definem a conversão em consultoria e os prazos dos indicadores do painel?
