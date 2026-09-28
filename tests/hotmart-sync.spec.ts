import { test, expect } from '@playwright/test';
import { HotmartApi } from '../src/lib/hotmart-api';

test('Hotmart API uses explicit status filters and follows all pages', async () => {
  const originalFetch = global.fetch;
  const originalId = process.env.HOTMART_CLIENT_ID;
  const originalSecret = process.env.HOTMART_CLIENT_SECRET;
  const originalBasic = process.env.HOTMART_BASIC_TOKEN;
  const requestedUrls: URL[] = [];

  try {
    process.env.HOTMART_CLIENT_ID = 'test-id';
    process.env.HOTMART_CLIENT_SECRET = 'test-secret';
    process.env.HOTMART_BASIC_TOKEN = 'test-basic';
    global.fetch = async (input) => {
      const url = new URL(String(input));
      requestedUrls.push(url);
      if (url.pathname === '/security/oauth/token') {
        return Response.json({ access_token: 'test-access-token' });
      }
      const secondPage = url.searchParams.has('page_token');
      return Response.json({
        items: [{ purchase: { transaction: secondPage ? 'HP2' : 'HP1', status: 'EXPIRED' } }],
        page_info: secondPage ? {} : { next_page_token: 'next-page' },
      });
    };

    const api = await HotmartApi.connect();
    const sales = [];
    for await (const sale of api.salesByStatus('EXPIRED', {
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: new Date('2026-07-30T00:00:00.000Z'),
    })) sales.push(sale);

    expect(sales.map((sale) => sale.purchase?.transaction)).toEqual(['HP1', 'HP2']);
    expect(requestedUrls.filter((url) => url.pathname.endsWith('/sales/history'))).toHaveLength(2);
    expect(requestedUrls[1].searchParams.get('transaction_status')).toBe('EXPIRED');
    expect(requestedUrls[1].searchParams.get('start_date')).toBe(String(Date.parse('2026-07-01T00:00:00.000Z')));
    expect(requestedUrls[1].searchParams.get('end_date')).toBe(String(Date.parse('2026-07-30T00:00:00.000Z')));
    expect(requestedUrls[2].searchParams.get('page_token')).toBe('next-page');
  } finally {
    global.fetch = originalFetch;
    if (originalId === undefined) delete process.env.HOTMART_CLIENT_ID;
    else process.env.HOTMART_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.HOTMART_CLIENT_SECRET;
    else process.env.HOTMART_CLIENT_SECRET = originalSecret;
    if (originalBasic === undefined) delete process.env.HOTMART_BASIC_TOKEN;
    else process.env.HOTMART_BASIC_TOKEN = originalBasic;
  }
});
