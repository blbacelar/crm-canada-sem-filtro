import https from 'node:https';

const AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const SALES_URL = 'https://developers.hotmart.com/payments/api/v1/sales';

// Without transaction_status Hotmart returns only APPROVED and COMPLETE.
export const HOTMART_SALE_STATUSES = [
  'APPROVED', 'BLOCKED', 'CANCELLED', 'CHARGEBACK', 'COMPLETE',
  'EXPIRED', 'NO_FUNDS', 'OVERDUE', 'PARTIALLY_REFUNDED', 'PRE_ORDER',
  'PRINTED_BILLET', 'PROCESSING_TRANSACTION', 'PROTESTED', 'REFUNDED',
  'STARTED', 'UNDER_ANALISYS', 'WAITING_PAYMENT',
] as const;

export interface HotmartSale {
  buyer?: { name?: string; email?: string; ucode?: string };
  product?: { id?: number | string; name?: string };
  producer?: Record<string, unknown>;
  purchase?: {
    transaction?: string;
    status?: string;
    order_date?: number | string;
    approved_date?: number | string;
    price?: { value?: number; currency_code?: string; currency_value?: string };
    payment?: { method?: string; type?: string; installments_number?: number };
    offer?: { code?: string };
    hotmart_fee?: { total?: number; currency_code?: string };
    is_subscription?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface HotmartPage<T> {
  items?: T[];
  page_info?: { next_page_token?: string; total_results?: number };
}

function getJson(url: URL, accessToken: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    // Native HTTPS avoids the Next/Vercel fetch wrapper, which makes Hotmart's
    // sales endpoint return HTTP 400 even when the same request succeeds here.
    const request = https.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
      response.on('error', reject);
      response.on('end', () => {
        let body: unknown = null;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch {
          // The caller reports an invalid response without exposing its body.
        }
        resolve({ status: response.statusCode || 0, body });
      });
    });
    request.setTimeout(20000, () => request.destroy(new Error('timeout')));
    request.on('error', reject);
  });
}

export class HotmartApi {
  private constructor(private readonly accessToken: string) {}

  static async connect(): Promise<HotmartApi> {
    const clientId = process.env.HOTMART_CLIENT_ID;
    const clientSecret = process.env.HOTMART_CLIENT_SECRET;
    const basicToken = process.env.HOTMART_BASIC_TOKEN;
    if (!clientId || !clientSecret || !basicToken) {
      throw new Error('Credenciais OAuth da Hotmart não configuradas.');
    }

    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicToken.startsWith('Basic ') ? basicToken : `Basic ${basicToken}`,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Hotmart OAuth retornou HTTP ${response.status}.`);
    const body = await response.json() as { access_token?: string };
    if (!body.access_token) throw new Error('Hotmart OAuth não retornou access_token.');
    return new HotmartApi(body.access_token);
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<HotmartPage<T>> {
    const url = new URL(`${SALES_URL}/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { status, body } = await getJson(url, this.accessToken);
      if ((status === 429 || status >= 500) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
        continue;
      }
      if (status < 200 || status >= 300) {
        const errorBody = body && typeof body === 'object' ? body as Record<string, unknown> : null;
        const detail = [errorBody?.error_description, errorBody?.message, errorBody?.error]
          .filter((value): value is string => typeof value === 'string')
          .join(' | ');
        throw new Error(`Hotmart ${path} retornou HTTP ${status}${detail ? `: ${detail.slice(0, 240)}` : ''}.`);
      }
      const page = body as HotmartPage<T> | null;
      if (!Array.isArray(page?.items)) throw new Error(`Resposta inválida da Hotmart em ${path}.`);
      return page;
    }
    throw new Error(`Hotmart ${path} excedeu o limite de tentativas.`);
  }

  async *salesByStatus(
    status: string,
    range?: { startDate: Date; endDate: Date },
  ): AsyncGenerator<HotmartSale> {
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();
    do {
      const page = await this.get<HotmartSale>('history', {
        transaction_status: status,
        max_results: '100',
        ...(range ? {
          start_date: String(range.startDate.getTime()),
          end_date: String(range.endDate.getTime()),
        } : {}),
        ...(pageToken ? { page_token: pageToken } : {}),
      });
      for (const sale of page.items || []) yield sale;
      pageToken = page.page_info?.next_page_token;
      if (pageToken && seenTokens.has(pageToken)) {
        throw new Error(`Paginação repetida da Hotmart para ${status}.`);
      }
      if (pageToken) seenTokens.add(pageToken);
    } while (pageToken);
  }

  async saleByTransaction(transaction: string): Promise<HotmartSale | null> {
    const page = await this.get<HotmartSale>('history', { transaction, max_results: '1' });
    return page.items?.[0] || null;
  }

  async checkHistoryAccess(): Promise<void> {
    await this.get<HotmartSale>('history', {});
  }

  async saleDetail<T>(path: 'users' | 'commissions' | 'price/details', transaction: string): Promise<T | null> {
    const page = await this.get<T>(path, { transaction, max_results: '1' });
    return page.items?.[0] || null;
  }
}
