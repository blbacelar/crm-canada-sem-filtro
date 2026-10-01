export interface SourceLead {
  id: string;
  name: string | null;
  email: string | null;
  source: string | null;
  goal: string | null;
  created_at: string;
  marketing_consent: boolean | null;
  marketing_consent_at: string | null;
  marketing_consent_revoked_at: string | null;
  attendance_confirmed: boolean | null;
  product_name: string | null;
}

export interface SourceClient {
  id: string;
  name: string | null;
  email: string | null;
  source: string | null;
  created_at: string;
}

export interface SourcePurchase {
  client_id: string;
  transaction_code: string;
  product_name: string | null;
  status_hotmart: string | null;
  purchase_date: string | null;
}

export interface SourcePurchaseProduct {
  transaction_code: string;
  product_name: string;
}

export interface SourceCart {
  client_id: string | null;
  occurred_at: string;
}

export interface SourceCrmLead {
  name: string | null;
  email: string | null;
  created_at: string;
}

export interface SourceQuizResponse {
  email: string | null;
  source: string | null;
  created_at: string;
}

export interface AudienceContact {
  email: string;
  name: string;
  sources: string[];
  goal: string | null;
  interestedProducts: string[];
  purchasedProducts: string[];
  purchaseStatuses: string[];
  purchaseCount: number;
  hasPaid: boolean;
  hasPending: boolean;
  hasRefunded: boolean;
  hasAbandonedCart: boolean;
  attendanceConfirmed: boolean;
  marketingConsent: boolean;
  latestActivityAt: string;
  leadCount: number;
}

export interface AudienceFilters {
  search: string;
  consent: 'authorized' | 'not_authorized' | 'all';
  purchase: 'all' | 'paid' | 'pending' | 'refunded' | 'no_purchase' | 'cart';
  attendance: 'all' | 'confirmed' | 'not_confirmed';
  product: string;
  source: string;
}

const PAID = new Set(['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'PURCHASE_COMPLETED', 'APPROVED', 'COMPLETE']);
const PENDING = new Set([
  'PURCHASE_WAITING_PAYMENT', 'PURCHASE_STARTED', 'PURCHASE_BILLET_PRINTED',
  'PURCHASE_PRINTED_BILLET', 'PURCHASE_PROCESSING_TRANSACTION', 'PURCHASE_UNDER_ANALISYS',
  'PURCHASE_PRE_ORDER',
]);
const REFUNDED = new Set(['PURCHASE_REFUNDED', 'PURCHASE_PARTIALLY_REFUNDED', 'PURCHASE_CHARGEBACK']);

function emailKey(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function later(left: string, right: string): string {
  return left > right ? left : right;
}

export function buildAudience(
  leads: SourceLead[],
  clients: SourceClient[],
  purchases: SourcePurchase[],
  purchaseProducts: SourcePurchaseProduct[],
  carts: SourceCart[],
  crmLeads: SourceCrmLead[] = [],
  quizResponses: SourceQuizResponse[] = [],
): AudienceContact[] {
  type MutableContact = AudienceContact & {
    consentAt: string;
    revokedAt: string;
    nameAt: string;
    goalAt: string;
    sourceSet: Set<string>;
    interestSet: Set<string>;
    productSet: Set<string>;
    statusSet: Set<string>;
    transactionSet: Set<string>;
  };
  const byEmail = new Map<string, MutableContact>();
  const clientEmails = new Map<string, string>();
  const includedProducts = new Map<string, Set<string>>();

  const getContact = (email: string | null): MutableContact | null => {
    const key = emailKey(email);
    if (!key) return null;
    let contact = byEmail.get(key);
    if (!contact) {
      contact = {
        email: key, name: '', sources: [], goal: null, interestedProducts: [], purchasedProducts: [],
        purchaseStatuses: [], purchaseCount: 0, hasPaid: false, hasPending: false, hasRefunded: false,
        hasAbandonedCart: false, attendanceConfirmed: false, marketingConsent: false,
        latestActivityAt: '', leadCount: 0, consentAt: '', revokedAt: '', nameAt: '', goalAt: '',
        sourceSet: new Set(), interestSet: new Set(), productSet: new Set(), statusSet: new Set(),
        transactionSet: new Set(),
      };
      byEmail.set(key, contact);
    }
    return contact;
  };

  for (const product of purchaseProducts) {
    if (!product.transaction_code || !product.product_name?.trim()) continue;
    const names = includedProducts.get(product.transaction_code) || new Set<string>();
    names.add(product.product_name.trim());
    includedProducts.set(product.transaction_code, names);
  }

  for (const lead of leads) {
    const contact = getContact(lead.email);
    if (!contact) continue;
    contact.leadCount += 1;
    contact.latestActivityAt = later(contact.latestActivityAt, lead.created_at || '');
    if (lead.name?.trim() && lead.created_at >= contact.nameAt) {
      contact.name = lead.name.trim();
      contact.nameAt = lead.created_at;
    }
    if (lead.source?.trim()) contact.sourceSet.add(lead.source.trim());
    if (lead.product_name?.trim()) contact.interestSet.add(lead.product_name.trim());
    if (lead.goal?.trim() && lead.created_at >= contact.goalAt) {
      contact.goal = lead.goal.trim();
      contact.goalAt = lead.created_at;
    }
    contact.attendanceConfirmed ||= Boolean(lead.attendance_confirmed);
    if (lead.marketing_consent) contact.consentAt = later(contact.consentAt, lead.marketing_consent_at || lead.created_at);
    if (lead.marketing_consent_revoked_at) contact.revokedAt = later(contact.revokedAt, lead.marketing_consent_revoked_at);
  }

  for (const lead of crmLeads) {
    const contact = getContact(lead.email);
    if (!contact) continue;
    contact.leadCount += 1;
    contact.latestActivityAt = later(contact.latestActivityAt, lead.created_at || '');
    contact.sourceSet.add('calendly');
    if (lead.name?.trim() && lead.created_at >= contact.nameAt) {
      contact.name = lead.name.trim();
      contact.nameAt = lead.created_at;
    }
  }

  for (const response of quizResponses) {
    const contact = getContact(response.email);
    if (!contact) continue;
    contact.leadCount += 1;
    contact.latestActivityAt = later(contact.latestActivityAt, response.created_at || '');
    contact.sourceSet.add(response.source?.trim() || 'quiz_masterclass');
    // Quiz data-processing consent is not marketing consent.
  }

  for (const client of clients) {
    const contact = getContact(client.email);
    if (!contact) continue;
    clientEmails.set(client.id, contact.email);
    contact.latestActivityAt = later(contact.latestActivityAt, client.created_at || '');
    if (client.name?.trim() && client.created_at >= contact.nameAt) {
      contact.name = client.name.trim();
      contact.nameAt = client.created_at;
    }
    if (client.source?.trim()) contact.sourceSet.add(client.source.trim());
  }

  for (const purchase of purchases) {
    const contact = byEmail.get(clientEmails.get(purchase.client_id) || '');
    if (!contact) continue;
    contact.latestActivityAt = later(contact.latestActivityAt, purchase.purchase_date || '');
    const transaction = purchase.transaction_code.trim();
    if (transaction) contact.transactionSet.add(transaction);
    const status = (purchase.status_hotmart || '').toUpperCase();
    if (status) contact.statusSet.add(status);
    if (PAID.has(status)) contact.hasPaid = true;
    if (PENDING.has(status)) contact.hasPending = true;
    if (REFUNDED.has(status)) contact.hasRefunded = true;
    // A pending or refunded transaction must not be presented as an owned course.
    if (PAID.has(status)) {
      if (purchase.product_name?.trim()) contact.productSet.add(purchase.product_name.trim());
      for (const name of includedProducts.get(transaction) || []) contact.productSet.add(name);
    }
  }

  for (const cart of carts) {
    const contact = byEmail.get(clientEmails.get(cart.client_id || '') || '');
    if (!contact) continue;
    contact.hasAbandonedCart = true;
    contact.latestActivityAt = later(contact.latestActivityAt, cart.occurred_at || '');
  }

  return [...byEmail.values()].map((contact) => ({
    email: contact.email,
    name: contact.name || contact.email.split('@')[0],
    sources: [...contact.sourceSet].sort(),
    goal: contact.goal,
    interestedProducts: [...contact.interestSet].sort(),
    purchasedProducts: [...contact.productSet].sort(),
    purchaseStatuses: [...contact.statusSet].sort(),
    purchaseCount: contact.transactionSet.size,
    hasPaid: contact.hasPaid,
    hasPending: contact.hasPending,
    hasRefunded: contact.hasRefunded,
    hasAbandonedCart: contact.hasAbandonedCart,
    attendanceConfirmed: contact.attendanceConfirmed,
    marketingConsent: Boolean(contact.consentAt && contact.consentAt > contact.revokedAt),
    latestActivityAt: contact.latestActivityAt,
    leadCount: contact.leadCount,
  })).sort((left, right) => right.latestActivityAt.localeCompare(left.latestActivityAt));
}

export function filterAudience(contacts: AudienceContact[], filters: AudienceFilters): AudienceContact[] {
  const search = filters.search.trim().toLowerCase();
  return contacts.filter((contact) => {
    if (filters.consent === 'authorized' && !contact.marketingConsent) return false;
    if (filters.consent === 'not_authorized' && contact.marketingConsent) return false;
    if (filters.purchase === 'paid' && !contact.hasPaid) return false;
    if (filters.purchase === 'pending' && !contact.hasPending) return false;
    if (filters.purchase === 'refunded' && !contact.hasRefunded) return false;
    if (filters.purchase === 'no_purchase' && contact.purchaseCount > 0) return false;
    if (filters.purchase === 'cart' && !contact.hasAbandonedCart) return false;
    if (filters.attendance === 'confirmed' && !contact.attendanceConfirmed) return false;
    if (filters.attendance === 'not_confirmed' && contact.attendanceConfirmed) return false;
    if (filters.product !== 'all' && !contact.purchasedProducts.includes(filters.product)) return false;
    if (filters.source !== 'all' && !contact.sources.includes(filters.source)) return false;
    if (search && ![contact.name, contact.email, ...contact.purchasedProducts, ...contact.interestedProducts]
      .some((value) => value.toLowerCase().includes(search))) return false;
    return true;
  });
}

function csvCell(value: string): string {
  const safe = /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function audienceToCsv(contacts: AudienceContact[]): string {
  const rows = [
    ['Nome', 'E-mail', 'Consentimento para marketing', 'Presença confirmada', 'Compra paga',
      'Pagamento pendente', 'Reembolso', 'Carrinho abandonado', 'Produtos comprados',
      'Produtos de interesse', 'Origem', 'Objetivo', 'Última atividade'],
    ...contacts.map((contact) => [
      contact.name, contact.email, contact.marketingConsent ? 'Sim' : 'Não',
      contact.attendanceConfirmed ? 'Sim' : 'Não', contact.hasPaid ? 'Sim' : 'Não',
      contact.hasPending ? 'Sim' : 'Não', contact.hasRefunded ? 'Sim' : 'Não',
      contact.hasAbandonedCart ? 'Sim' : 'Não', contact.purchasedProducts.join('; '),
      contact.interestedProducts.join('; '), contact.sources.join('; '), contact.goal || '',
      contact.latestActivityAt,
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
