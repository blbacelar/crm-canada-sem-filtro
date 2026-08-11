---
title: Canadá Sem Filtro | Central de Atendimento - User Experience Specification
status: approved
created: 2026-08-10
updated: 2026-08-10
---

# EXPERIENCE.md: Canadá Sem Filtro | Central de Atendimento

## 1. Fundação & Arquitetura de Informação

A Central de Atendimento foi projetada para ser a tela de trabalho diária da equipe da Canadá Sem Filtro. A navegação é estruturada em torno de **1 Fila Principal** com filtros rápidos e **Painéis Laterais (Drawers)** para manter a consultora no mesmo contexto sem perder sua posição de rolagem ou filtro.

### Layout da Aplicação

```
+-----------------------------------------------------------------------------------+
| HEADER: Logo | Busca Global | Seletor de Role | Alternador de Tema (Sun/Moon) | Webhook Status |
+-----------------------------------------------------------------------------------+
| METRICS CARDS: [ Total: 1.420 ] [ Em Fila: 18 ] [ Diag. Pendentes: 5 ] [ SLA Overdue: 2! ] |
+-----------------------------------------------------------------------------------+
| FILTROS & BUSCA: [Pesquisar nome/e-mail/transação...] [Filtro Estado v] [Filtro Responsável v] |
+-----------------------------------------------------------------------------------+
| FILA DE ATENDIMENTO (DATA TABLE)                                                  |
| Status   | Cliente          | Produto         | SLA Restante | Responsável | Ações   |
| [Compra] | João Silva       | Combo 7 Aulas + E-book + Diagnóstico | 4h 12m úteis | Ana (Cons.) | [Ver >] |
| [OVERDUE]| Maria Santos     | Diagnóstico     | ESTOURADO!   | Sem atrib.  | [Atribuir] |
+-----------------------------------------------------------------------------------+
```

---

## 2. Visões Principais & Telas

### Tela 1: Fila de Atendimento (Home Operacional)
- **Objetivo:** Responder imediatamente "quem precisa de atendimento agora?".
- **Filtros Rápido de 1-Clique:** `Todos`, `Meus Atendimentos`, `Atrasados (SLA Estourado)`, `Aguardando Diagnóstico`, `Concluídos`.
- **Ordenação Padrão:** Clientes com SLA estourado no topo, seguidos por menor tempo restante de SLA.

### Tela 2: Drawer de Ficha do Cliente (Detalhes)
- **Acionamento:** Clique em qualquer linha da fila.
- **Painel Lateral Retrátil (Right Sheet):**
  - **Cabeçalho:** Nome, e-mail, telefone com botão de 1-clique para abrir WhatsApp Web (`https://wa.me/...`), Estado Atual (Dropdown de alteração).
  - **Aba 1: Jornada & Transações:** Histórico das compras Hotmart, valores bruto/líquido, código de transação e status Hotmart.
  - **Aba 2: Diagnóstico:** Status do preenchimento do formulário de diagnóstico e contador da **Regra dos 7 Dias** (exibe quantos dias faltam para a liberação dos resultados e agendamento de consulta).
  - **Aba 3: Registrar Interação:** Formulário rápido para adicionar nota (Canal: WhatsApp / E-mail / Ligação, Resumo do contato, Próxima Ação e Data).
  - **Aba 4: Comissões (Exclusivo Consultora/Admin):** Comissão gerada pela consultoria com status de pagamento.

### Tela 3: Modal de Contingência Manual (Inserção de Cliente/Compra)
- **Acionamento:** Botão `+ Novo Cliente Manual` ou `+ Registrar Compra Manual`.
- **Uso:** Inserção emergencial quando webhooks da Hotmart ou integrações externas falharem.
- **Campos:** Nome, E-mail, Telefone, Produto, Valor Pago, Data da Compra e Motivo da inserção manual.

### Tela 4: Tela de Gestão de Comissões (Exclusiva Admin)
- **Acionamento:** Menu Superior -> `Configurações` -> `Comissões`.
- **Uso:** Cadastro e alteração das porcentagens e valores fixos de comissão por produto/oferta para cada consultora.

---

## 3. Jornadas do Usuário (Key Flows)

### Flow 1: Atendimento de Novo Cliente Entrando na Fila
1. O evento da Hotmart entra via webhook e adiciona o cliente no topo da fila com status `compra` e SLA de 24h úteis rodando.
2. A **Consultora (Ana)** clica na linha do cliente para abrir o Drawer.
3. Ana clica no link rápido de WhatsApp, envia a mensagem e registra a interação: *"Primeiro contato realizado via WhatsApp. Cliente orientada sobre o formulário de diagnóstico."*
4. O sistema registra a interação, altera o estado da jornada para `acompanhamento` e **reseta/satisfaz o SLA do primeiro contato**.

### Flow 2: Resolução de Conflito de Duplicidade (Admin)
1. Cliente compra com e-mail `joao.novo@gmail.com`, mas o telefone bate com o cliente `João Silva (joao.antigo@gmail.com)`.
2. O sistema marca o registro com a tag `Alerta de Duplicidade`.
3. A **Administradora** clica na notificação de conflito, visualiza a tela de comparação (Lado a Lado: Cadastro Antigo vs Nova Compra) e decide: `Mesclar Compras no Mesmo Cliente` ou `Manter como Clientes Separados`.

---

## 4. Estados de Tela e Tratamento de Erros

- **Empty State (Fila Vazia):** Ilustração amigável com mensagem *"Nenhum cliente pendente na fila no momento. Bom trabalho!"*.
- **Offline / Falha de Integração:** Banner discreto no topo em vermelho/âmbar: *"Webhook Hotmart temporariamente indisponível. Utilize o botão '+ Inserir Manual' para registrar novos atendimentos."*.
- **SLA Alert Pulsante:** Animação CSS sutil de pulso suave (`glow pulse red`) em clientes cuja contagem de horas úteis ultrapassou 24h.

---

## 5. Acessibilidade & Atalhos de Teclado

- `Ctrl/Cmd + K`: Abre busca global por nome, e-mail ou código de transação Hotmart.
- `Esc`: Fecha o Drawer de detalhes ou modais abertos.
- `Tab` / `Shift + Tab`: Navegação completa por teclado em todas as tabelas e formulários.
- Contraste de cores validado conforme diretrizes WCAG AA (mínimo 4.5:1 para textos normais).
