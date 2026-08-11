# 🚀 Canadá Sem Filtro — Central de Atendimento CRM & Gestão Hotmart

[![Next.js](https://img.shields.io/badge/Next.js-14.2.35-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)]()

O **CRM Canadá Sem Filtro** é uma plataforma completa de gestão de leads, atendimento ao cliente, acompanhamento da jornada de diagnóstico e controle de comissões, projetada especificamente para o produto **`7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico`**.

---

## 📸 Principais Funcionalidades

- ⚡ **Receptor de Webhooks Hotmart 2.0:** Recepção em tempo real de eventos de compra (`PURCHASE_APPROVED`, `PURCHASE_COMPLETE`, `PURCHASE_CANCELED`, `PURCHASE_REFUNDED`), com validação do token `HOTTOK` e ledger de auditoria (`events_log`).
- ⏱️ **Motor de SLA de 24h Úteis:** Algoritmo que calcula o tempo limite de atendimento considerando apenas o expediente comercial (segunda a sexta, 09h às 18h), pausando automaticamente em finais de semana e madrugadas.
- 📋 **Ficha Completa do Comprador:** Armazenamento e exibição de todos os 12 campos de cadastro do comprador Hotmart (Nome, E-mail, Telefone/WhatsApp, CPF/Documento, CEP, Cidade, Estado, Logradouro, Bairro, Número e Complemento).
- 🩺 **Painel de Diagnóstico em Tempo Real:** Leitura e vinculação instantânea dos formulários preenchidos pelo cliente (`diagnostic_submissions` / `diagnostic_cases`) com visualização de resumo dentro do Drawer de atendimento.
- ⚙️ **Painel Administrativo de Comissões (`/settings`):** Configuração de porcentagens de comissão por produto exclusiva para o perfil `admin` e central de reconciliação de duplicidades por CPF ou Telefone.
- 📊 **Dashboard de Analytics BI (`/analytics`):** Métricas consolidadas do funil da jornada, faturamento bruto/líquido, taxa de cumprimento de SLA e modo de visualização preservando PII para o perfil `marketing`.
- 🔢 **Paginação Dinâmica de Alta Performance:** Tabela de clientes com controles de 10, 20, 50 ou 100 itens por página e fatiamento instantâneo em memória.

---

## 🛠️ Tecnologias Utilizadas

- **Framework Web:** [Next.js 14](https://nextjs.org/) (App Router & Server Actions)
- **Linguagem:** [TypeScript](https://www.typescriptlang.org/)
- **Estilização & UI:** Vanilla CSS, [Tailwind CSS](https://tailwindcss.com/), componentes [shadcn/ui](https://ui.shadcn.com/) (Radix UI) e ícones [Lucide React](https://lucide.dev/)
- **Banco de Dados & Realtime:** [Supabase](https://supabase.com/) PostgreSQL (`amkrasedammnrlzbciue.supabase.co`), Supabase SSR Client & WebSocket Realtime
- **Conectividade:** Driver PostgreSQL (`pg`) para automações e migrações

---

## 📁 Estrutura de Arquivos

```
crm-canada-sem-filtro/
├── src/
│   ├── app/
│   │   ├── analytics/             # Dashboard de BI e Métricas de Conversão
│   │   ├── api/
│   │   │   ├── analytics/         # API de cálculo de indicadores de BI
│   │   │   ├── clients/           # API de listagem e cadastro manual de clientes
│   │   │   ├── commissions/       # API de regras de comissão (exclusiva Admin)
│   │   │   ├── diagnostics/       # API de leitura de casos e submissões de diagnóstico
│   │   │   ├── duplicates/        # API de detecção e mescla de duplicidades
│   │   │   ├── interactions/      # API de registro de contatos e baixa de SLA
│   │   │   └── webhooks/hotmart/  # Receptor de Webhooks Hotmart 2.0
│   │   ├── login/                 # Tela de Autenticação
│   │   ├── settings/              # Painel Dedicado de Configurações Administrativas
│   │   ├── layout.tsx             # Layout raiz com ThemeProvider
│   │   └── page.tsx               # Fila Operacional Principal do CRM
│   ├── components/
│   │   ├── header.tsx             # Cabeçalho com Seletor de Role e Navegação
│   │   ├── theme-provider.tsx     # Suporte a Dark/Light Mode
│   │   └── ui/                    # Componentes shadcn/ui (Button, Card, Dialog, Table, Tabs...)
│   ├── lib/
│   │   ├── hotmart.ts             # Parser de payloads Hotmart Webhook
│   │   ├── sla.ts                 # Motor de cálculo de SLA em Horas Úteis
│   │   └── supabase/              # Clientes Supabase SSR (browser e server)
│   └── types/
│       └── database.types.ts      # Tipagem TypeScript do banco de dados
├── public/                        # Ativos estáticos e logotipos
├── .env.local                     # Variáveis de ambiente (Supabase URL & Keys)
└── README.md
```

---

## 🚀 Como Executar Localmente

### 1. Clonar o Repositório

```bash
git clone https://github.com/blbacelar/crm-canada-sem-filtro.git
cd crm-canada-sem-filtro
```

### 2. Instalar Dependências

```bash
npm install
```

### 3. Configurar Variáveis de Ambiente (`.env.local`)

Crie o arquivo `.env.local` na raiz do projeto com as credenciais do Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=https://amkrasedammnrlzbciue.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-aqui
HOTMART_HOTTOK=seu-hottok-de-seguranca-aqui
```

### 4. Iniciar o Servidor de Desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

### 5. Validar o Build de Produção

```bash
npm run build
```

---

## 📡 Configuração do Webhook Hotmart em Produção

Para conectar a Hotmart ao CRM em tempo real:

1. Acesse o **Hotmart Developer Central** (Ferramentas > Webhook).
2. Cadastre o novo endpoint de Webhook apontando para:
   ```
   https://seu-dominio.com/api/webhooks/hotmart
   ```
3. Selecione os seguintes eventos de envio:
   - `PURCHASE_APPROVED` (Compra Aprovada)
   - `PURCHASE_COMPLETE` (Compra Concluída)
   - `PURCHASE_CANCELED` (Compra Cancelada)
   - `PURCHASE_REFUNDED` (Compra Reembolsada)
4. Cole o token de verificação `HOTTOK` fornecido pela Hotmart na variável de ambiente `HOTMART_HOTTOK`.

---

## 📄 Licença

Este projeto é de propriedade exclusiva de **O Canadá Sem Filtro**. Todos os direitos reservados.
