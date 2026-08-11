---
title: Canadá Sem Filtro | Central de Atendimento - Visual Identity Specification
status: approved
created: 2026-08-10
updated: 2026-08-10
colors:
  background: "#0F172A" # Slate 900
  surface: "#1E293B" # Slate 800
  surface_elevated: "#334155" # Slate 700
  border: "#334155" # Slate 700
  text_primary: "#F8FAFC" # Slate 50
  text_secondary: "#94A3B8" # Slate 400
  brand_red: "#EF4444" # Red 500 (Canadá Accent)
  brand_indigo: "#6366F1" # Indigo 500
  status_purchase: "#3B82F6" # Blue 500
  status_diagnostic: "#8B5CF6" # Purple 500
  status_followup: "#F59E0B" # Amber 500
  status_scheduled: "#06B6D4" # Cyan 500
  status_completed: "#10B981" # Emerald 500
  status_canceled: "#64748B" # Slate 500
  status_refunded: "#EC4899" # Pink 500
  sla_warning: "#F59E0B" # Amber 500
  sla_overdue: "#EF4444" # Red 500
typography:
  font_family: "'Inter', system-ui, -apple-system, sans-serif"
  size_heading_xl: "24px"
  size_heading_lg: "20px"
  size_body: "14px"
  size_caption: "12px"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# DESIGN.md: Canadá Sem Filtro | Central de Atendimento

## 1. Brand & Style

A Central de Atendimento possui suporte nativo a **Dois Temas (Dark Mode e Light Mode)** com alternador de tema na barra superior.
- **Dark Mode (Padrão Operacional):** Estilo Slate escuro com alto contraste, ideal para uso continuado pelas consultoras.
- **Light Mode:** Estilo limpo e luminoso com fundos acinzentados suaves e contraste adaptado para ambientes iluminados.
- **Canadá Accent:** Toque discreto do vermelho canadense (`#EF4444` / `#DC2626`) para destaques e alertas de SLA em ambos os temas.

---

## 2. Colors & Temas (Dark & Light Mode)

### Dark Mode (Slate Dark)
- **Background Principal:** `#0F172A` (Slate 900)
- **Cards e Painéis:** `#1E293B` (Slate 800)
- **Bordas e Divisores:** `#334155` (Slate 700)
- **Texto Principal:** `#F8FAFC` (Slate 50)
- **Texto Secundário:** `#94A3B8` (Slate 400)

### Light Mode (Clean Light)
- **Background Principal:** `#F8FAFC` (Slate 50)
- **Cards e Painéis:** `#FFFFFF` (Branco Puro)
- **Bordas e Divisores:** `#E2E8F0` (Slate 200)
- **Texto Principal:** `#0F172A` (Slate 900)
- **Texto Secundário:** `#64748B` (Slate 500)

### Badges de Estado da Jornada (Adaptáveis a Ambos os Temas)
- **Compra Efetuada:** `#3B82F6` (Azul) - Dark: `rgba(59, 130, 246, 0.15)` | Light: `rgba(59, 130, 246, 0.10)`
- **Diagnóstico Enviado:** `#8B5CF6` (Roxo) - Dark: `rgba(139, 92, 246, 0.15)` | Light: `rgba(139, 92, 246, 0.10)`
- **Acompanhamento:** `#F59E0B` (Âmbar) - Dark: `rgba(245, 158, 11, 0.15)` | Light: `rgba(245, 158, 11, 0.10)`
- **Consulta Marcada:** `#06B6D4` (Ciano) - Dark: `rgba(6, 182, 212, 0.15)` | Light: `rgba(6, 182, 212, 0.10)`
- **Consulta Concluída:** `#10B981` (Esmeralda) - Dark: `rgba(16, 185, 129, 0.15)` | Light: `rgba(16, 185, 129, 0.10)`
- **Cancelamento:** `#64748B` (Cinza Slate) - Dark: `rgba(100, 116, 139, 0.15)` | Light: `rgba(100, 116, 139, 0.10)`
- **Reembolso:** `#EC4899` (Rosa/Vinho) - Dark: `rgba(236, 72, 153, 0.15)` | Light: `rgba(236, 72, 153, 0.10)`

---

## 3. Typography

- **Fonte:** Inter (Google Fonts)
- **Pesos:**
  - Regular (400): Textos de apoio, e-mails, notas de interações.
  - Medium (500): Rótulos de formulários, colunas de tabelas.
  - SemiBold (600): Nomes de clientes, títulos de seções.
  - Bold (700): Métricas numéricas principais e títulos de páginas.

---

## 4. Components & UI Kit

### Metric Cards (Dashboard Top Bar)
Cards elevados (`#1E293B`) com bordas `border-slate-700`, cantos arredondados `rounded-lg` (12px), com ícone ilustrativo no canto superior direito e valor em fonte destaque (28px Bold).
*Se houver estouro de SLA (> 0 casos), o card de SLA exibe uma borda brilhante em vermelho (`#EF4444`) com um indicador pulsante.*

### Data Table (Fila de Atendimento)
- **Cabeçalho:** Fundo `#1E293B`, texto uppercase em 12px Slate 400.
- **Linha:** Hover com transição suave para `#334155/50`. Linhas com SLA estourado apresentam uma borda lateral esquerda em vermelho (`border-l-4 border-l-red-500`).
- **Ações Rápidas:** Botão de ícone no final da linha para abrir o **Drawer de Detalhes do Cliente** (`Shift + Click` ou clique direto).

### Drawer de Detalhes do Cliente (Painel Lateral Retrátil)
- Desliza da direita para a esquerda (largura 540px em desktop).
- Fundo `#1E293B` com efeito backdrop blur no restante da tela.
- Contém abas: **Perfil & Compras**, **Diagnóstico**, **Histórico de Interações**, **Comissões**.

---

## 5. Do's and Don'ts

- **DO:** Usar badges coloridas e legíveis com contraste mínimo 4.5:1.
- **DO:** Destacar visualmente clientes sem atendimento dentro do SLA de 24h úteis.
- **DON'T:** Usar cores brilhantes em excesso fora de badges e alertas de SLA para não cansar a vista da equipe.
- **DON'T:** Ocultar informações financeiras/comissões para Administradores ou misturá-las na visão do Marketing.
