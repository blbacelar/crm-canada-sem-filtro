import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

const DEFAULT_SLA = {
  targetHours: 24,
  businessStart: '09:00',
  businessEnd: '18:00',
  weekdays: [1, 2, 3, 4, 5],
  holidays: [],
};

export async function GET() {
  const authorization = await requireAuth();
  if (authorization.response) return authorization.response;

  const { data, error } = await (authorization.context.supabase as any)
    .from('crm_settings')
    .select('value')
    .eq('key', 'sla')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sla: { ...DEFAULT_SLA, ...(data?.value || {}) } });
}

export async function PATCH(request: NextRequest) {
  const authorization = await requireAuth(['admin']);
  if (authorization.response) return authorization.response;

  const body = await request.json();
  const targetHours = Number(body.targetHours);
  const businessStart = String(body.businessStart || DEFAULT_SLA.businessStart);
  const businessEnd = String(body.businessEnd || DEFAULT_SLA.businessEnd);
  const weekdays = Array.isArray(body.weekdays) ? body.weekdays.map(Number).filter((day: number) => day >= 0 && day <= 6) : DEFAULT_SLA.weekdays;
  const holidays = Array.isArray(body.holidays) ? body.holidays.filter((day: unknown) => typeof day === 'string') : DEFAULT_SLA.holidays;

  if (!Number.isFinite(targetHours) || targetHours <= 0 || targetHours > 168) {
    return NextResponse.json({ error: 'Meta de SLA inválida.' }, { status: 400 });
  }

  const sla = { targetHours, businessStart, businessEnd, weekdays, holidays };
  const { error } = await (authorization.context.supabase as any)
    .from('crm_settings')
    .upsert({ key: 'sla', value: sla, updated_by: authorization.context.user.id, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sla });
}
