import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildAudience,
  type AudienceContact,
  type SourceCart,
  type SourceClient,
  type SourceCrmLead,
  type SourceLead,
  type SourcePurchase,
  type SourcePurchaseProduct,
  type SourceQuizResponse,
} from '@/lib/lead-audience';

const PAGE_SIZE = 500;
const MAX_ROWS_PER_TABLE = 20000;

async function fetchAllRows<T>(
  table: string,
  columns: string,
  orderBy: string,
): Promise<T[]> {
  const db = createAdminClient() as any;
  const rows: T[] = [];
  for (let offset = 0; offset < MAX_ROWS_PER_TABLE; offset += PAGE_SIZE) {
    const { data, error } = await db.from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Falha ao consultar ${table}: ${error.message}`);
    rows.push(...((data || []) as T[]));
    if ((data || []).length < PAGE_SIZE) return rows;
  }
  throw new Error(`A tabela ${table} excede o limite seguro de leitura; a exportação não pode ser parcial.`);
}

export async function loadLeadAudience(): Promise<AudienceContact[]> {
  const [leads, clients, purchases, products, carts, crmLeads, quizResponses] = await Promise.all([
    fetchAllRows<SourceLead>('canada_sem_filtro_leads',
      'id,name,email,source,goal,created_at,marketing_consent,marketing_consent_at,marketing_consent_revoked_at,attendance_confirmed,product_name', 'id'),
    fetchAllRows<SourceClient>('clients', 'id,name,email,source,created_at', 'id'),
    fetchAllRows<SourcePurchase>('purchases',
      'client_id,transaction_code,product_name,status_hotmart,purchase_date', 'id'),
    fetchAllRows<SourcePurchaseProduct>('hotmart_purchase_products',
      'transaction_code,product_name', 'transaction_code'),
    fetchAllRows<SourceCart>('hotmart_cart_abandonments',
      'client_id,occurred_at', 'event_id'),
    fetchAllRows<SourceCrmLead>('crm_leads', 'name,email,created_at', 'id'),
    fetchAllRows<SourceQuizResponse>('masterclass_quiz_responses',
      'email,source,created_at', 'id'),
  ]);
  return buildAudience(leads, clients, purchases, products, carts, crmLeads, quizResponses);
}
