import { JourneyState } from '@/types/database.types';
import { MockClient } from './types';

export function mapApiClient(c: any): MockClient {
  return {
    id: c.id,
    name: c.name || 'Cliente Sem Nome',
    email: c.email || '',
    phone: c.phone || 'Não informado',
    document: c.document,
    country: c.country,
    zip_code: c.zip_code,
    city: c.city,
    state: c.state,
    address: c.address,
    district: c.district,
    number: c.number,
    complement: c.complement,
    product: c.product_name || '7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico',
    purchases: Array.isArray(c.purchases) ? c.purchases : [],
    cart_abandonments: Array.isArray(c.cart_abandonments) ? c.cart_abandonments : [],
    status_journey: (c.status_journey || c.effective_status_journey || 'compra') as JourneyState,
    sla_hours_left: typeof c.sla_hours_left === 'number' ? c.sla_hours_left : 24,
    is_overdue: !!c.is_overdue,
    assigned_consultant_id: c.assigned_consultant_id || null,
    assigned_consultant: c.assigned_consultant_name || (c.assigned_consultant_id ? 'Atendente Designado' : 'Pendente'),
    purchase_date: c.purchase_date || c.created_at || new Date().toISOString(),
    access_expires_at: c.access_expires_at || null,
    price_gross: typeof c.price_gross === 'number' ? c.price_gross : null,
    price_net: typeof c.price_net === 'number' ? c.price_net : null,
    diagnostic_status: c.diagnostic_status || (c.status_journey === 'compra' ? 'pendente' : 'enviado'),
    days_since_purchase: c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    consultation_booked: Boolean(c.consultation_booked),
    consultation_status: c.consultation_status || null,
    consultation_date: c.consultation_date || null,
    consultation_value: typeof c.consultation_value === 'number' ? c.consultation_value : null,
    consultation_commission_percentage: typeof c.consultation_commission_percentage === 'number' ? c.consultation_commission_percentage : null,
    consultation_company_return_amount: typeof c.consultation_company_return_amount === 'number' ? c.consultation_company_return_amount : null,
    consultation_consultant_name: c.consultation_consultant_name || null,
  };
}

export function clientMatchesFilters(client: MockClient, statusFilter: string, searchQuery: string): boolean {
  const query = searchQuery.toLowerCase();
  const matchesSearch = [client.name, client.email, client.product]
    .some((value) => value.toLowerCase().includes(query))
    || client.purchases.some((purchase) => purchase.transaction_code.toLowerCase().includes(query));

  if (statusFilter === 'overdue') return matchesSearch && client.is_overdue;
  if (statusFilter !== 'todos') return matchesSearch && client.status_journey === statusFilter;
  return matchesSearch;
}

export async function loadClientsForExport(
  statusFilter: string,
  searchQuery: string,
  fetchPage: typeof fetch = fetch,
): Promise<MockClient[]> {
  const exportedClients: MockClient[] = [];
  const limit = 100;
  let offset = 0;
  let total = 0;

  do {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      status: statusFilter,
    });
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    const response = await fetchPage(`/api/clients?${params.toString()}`, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Não foi possível exportar os leads.');
    if (!Array.isArray(body.clients)) throw new Error('A lista de leads veio incompleta.');

    exportedClients.push(...body.clients.map(mapApiClient).filter((client: MockClient) =>
      clientMatchesFilters(client, statusFilter, searchQuery)));
    offset += body.clients.length;
    total = Number(body.total) || 0;
    if (body.clients.length === 0) break;
  } while (offset < total);

  return exportedClients;
}
