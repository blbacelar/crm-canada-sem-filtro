import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { syncHotmartSales } from '@/lib/hotmart-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
// Run the reconciliation closer to Hotmart's Brazilian API infrastructure.
export const preferredRegion = 'gru1';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const received = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret || ''}`;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  if (!secret || left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  try {
    const summary = await syncHotmartSales();
    return NextResponse.json({ synced: true, ...summary });
  } catch (error) {
    console.error('Falha na conciliação Hotmart:', error);
    return NextResponse.json({ error: 'A conciliação Hotmart falhou.' }, { status: 500 });
  }
}
