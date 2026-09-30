import { JourneyState } from '@/types/database.types';

export interface MockClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  document?: string;
  country?: string;
  zip_code?: string;
  city?: string;
  state?: string;
  address?: string;
  district?: string;
  number?: string;
  complement?: string;
  product: string;
  purchases: Array<{
    id: string;
    transaction_code: string;
    product_name: string;
    status_hotmart: string;
    price_gross: number | null;
    purchase_date: string;
    payment_method?: string | null;
    installments?: number | null;
    currency_code?: string | null;
    offer_code?: string | null;
    is_subscription?: boolean | null;
    hotmart_fee?: number | null;
    hotmart_synced_at?: string | null;
    included_products?: Array<{ product_id: number; product_name: string }>;
  }>;
  cart_abandonments: Array<{
    event_id: string;
    product_name: string;
    offer_code: string | null;
    occurred_at: string;
  }>;
  status_journey: JourneyState;
  sla_hours_left: number;
  is_overdue: boolean;
  assigned_consultant: string;
  assigned_consultant_id?: string | null;
  purchase_date: string;
  access_expires_at?: string | null;
  price_gross: number | null;
  price_net: number | null;
  diagnostic_status: 'pendente' | 'enviado' | 'analisado';
  days_since_purchase: number;
  consultation_booked: boolean;
  consultation_status?: 'scheduled' | 'completed' | null;
  consultation_date?: string | null;
  consultation_value?: number | null;
  consultation_commission_percentage?: number | null;
  consultation_company_return_amount?: number | null;
  consultation_consultant_name?: string | null;
}

export const JOURNEY_LABELS: Record<JourneyState, { label: string; bg: string; text: string }> = {
  compra: { label: 'Compra Efetuada', bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  carrinho_abandonado: { label: 'Carrinho abandonado', bg: 'bg-orange-500/15', text: 'text-orange-600 dark:text-orange-400' },
  pagamento_pendente: { label: 'Pagamento pendente', bg: 'bg-yellow-500/15', text: 'text-yellow-700 dark:text-yellow-400' },
  diagnostico_enviado: { label: 'Diagnóstico Enviado', bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400' },
  acompanhamento: { label: 'Acompanhamento', bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400' },
  consulta_marcada: { label: 'Consulta Marcada', bg: 'bg-cyan-500/15', text: 'text-cyan-600 dark:text-cyan-400' },
  consulta_concluida: { label: 'Consulta Concluída', bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400' },
  cancelamento: { label: 'Cancelamento', bg: 'bg-slate-500/15', text: 'text-slate-600 dark:text-slate-400' },
  reembolso: { label: 'Reembolso', bg: 'bg-pink-500/15', text: 'text-pink-600 dark:text-pink-400' },
};
