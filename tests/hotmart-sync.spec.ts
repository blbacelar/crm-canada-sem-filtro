import { test, expect } from '@playwright/test';
import { EventEmitter } from 'node:events';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import { Readable } from 'node:stream';
import { HotmartApi } from '../src/lib/hotmart-api';

test('Hotmart API uses explicit status filters and follows all pages', async () => {
  const originalFetch = global.fetch;
  const originalGet = https.get;
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
      expect(url.pathname).toBe('/security/oauth/token');
      return Response.json({ access_token: 'test-access-token' });
    };
    https.get = ((input: string | URL, options: RequestOptions, callback?: (response: IncomingMessage) => void) => {
      const url = new URL(String(input));
      requestedUrls.push(url);
      expect((options as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer test-access-token');
      const secondPage = url.searchParams.has('page_token');
      const body = JSON.stringify({
        items: [{ purchase: { transaction: secondPage ? 'HP2' : 'HP1', status: 'EXPIRED' } }],
        page_info: secondPage ? {} : { next_page_token: 'next-page' },
      });
      const request = Object.assign(new EventEmitter(), {
        setTimeout: () => request,
        destroy: () => request,
      });
      queueMicrotask(() => {
        const response = Object.assign(Readable.from([body]), { statusCode: 200 });
        callback?.(response as unknown as IncomingMessage);
      });
      return request;
    }) as unknown as typeof https.get;

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
    https.get = originalGet;
    if (originalId === undefined) delete process.env.HOTMART_CLIENT_ID;
    else process.env.HOTMART_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.HOTMART_CLIENT_SECRET;
    else process.env.HOTMART_CLIENT_SECRET = originalSecret;
    if (originalBasic === undefined) delete process.env.HOTMART_BASIC_TOKEN;
    else process.env.HOTMART_BASIC_TOKEN = originalBasic;
  }
});
