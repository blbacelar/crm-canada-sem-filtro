'use client';

import * as React from 'react';
import { CalendarCheck, CircleDollarSign, UserRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserRole } from '@/types/database.types';

type ConsultationStatus = 'scheduled' | 'completed' | 'cancelled';

interface Attendant {
  id: string;
  name: string;
  email: string;
}

interface Consultation {
  id: string;
  consultant_id: string;
  consultation_date: string;
  value_amount: number;
  commission_percentage: number;
  company_return_amount: number;
  status: ConsultationStatus;
  notes?: string | null;
  profiles?: { name?: string | null; email?: string | null } | null;
}

interface ConsultationControlProps {
  clientId: string;
  role: UserRole;
  assignedConsultantId?: string | null;
  attendants: Attendant[];
  onSaved?: () => void;
}

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function localDateTimeNow() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function statusLabel(status: ConsultationStatus) {
  if (status === 'completed') return 'Realizada';
  if (status === 'cancelled') return 'Cancelada';
  return 'Marcada';
}

export function ConsultationControl({
  clientId,
  role,
  assignedConsultantId,
  attendants,
  onSaved,
}: ConsultationControlProps) {
  const [consultations, setConsultations] = React.useState<Consultation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [marked, setMarked] = React.useState(false);
  const [status, setStatus] = React.useState<'scheduled' | 'completed'>('scheduled');
  const [consultantId, setConsultantId] = React.useState(assignedConsultantId || '');
  const [consultationDate, setConsultationDate] = React.useState(localDateTimeNow);
  const [value, setValue] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [percentage, setPercentage] = React.useState(10);
  const [commissionActive, setCommissionActive] = React.useState(true);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [consultationsResponse, commissionResponse] = await Promise.all([
        fetch(`/api/consultations?client_id=${encodeURIComponent(clientId)}`, { cache: 'no-store' }),
        fetch('/api/commissions', { cache: 'no-store' }),
      ]);
      const consultationsPayload = await consultationsResponse.json().catch(() => ({}));
      const commissionPayload = await commissionResponse.json().catch(() => ({}));
      if (!consultationsResponse.ok) throw new Error(consultationsPayload.error || 'Não foi possível carregar as consultorias.');
      if (!commissionResponse.ok) throw new Error(commissionPayload.error || 'Não foi possível carregar o percentual de comissão.');

      const records = (consultationsPayload.consultations || []) as Consultation[];
      const activeRecords = records.filter((item) => item.status !== 'cancelled');
      const rule = (commissionPayload.configs || []).find((item: any) => item.product_name === 'Consulta Individual');
      setConsultations(records);
      setMarked(activeRecords.length > 0);
      setPercentage(Number(rule?.commission_percentage) || 0);
      setCommissionActive(Boolean(rule?.is_active));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar o controle de consultoria.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    setConsultantId(assignedConsultantId || '');
  }, [assignedConsultantId, clientId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeConsultationExists = consultations.some((item) => item.status !== 'cancelled');
  const numericValue = Number(value);
  const returnAmount = Number.isFinite(numericValue) ? numericValue * percentage / 100 : 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          consultant_id: role === 'admin' ? consultantId : undefined,
          consultation_date: new Date(consultationDate).toISOString(),
          value_amount: numericValue,
          status,
          notes: notes.trim() || undefined,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar a consultoria.');

      setConsultations((previous) => [payload.consultation, ...previous]);
      setMarked(true);
      setValue('');
      setNotes('');
      setConsultationDate(localDateTimeNow());
      setSuccess(status === 'completed' ? 'Consultoria realizada registrada.' : 'Consultoria marcada com sucesso.');
      onSaved?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível salvar a consultoria.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-4 text-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Controle de consultoria</h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Registre a marcação, o responsável, o valor e o retorno para o Canadá Sem Filtro.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <input
            type="checkbox"
            checked={marked}
            disabled={loading || activeConsultationExists}
            onChange={(event) => setMarked(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 accent-emerald-600"
          />
          Lead marcou consultoria
        </label>
      </div>

      {loading ? (
        <div className="h-28 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
      ) : marked ? (
        <form onSubmit={handleSubmit} className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">Situação</label>
              <Select value={status} onValueChange={(value) => setStatus(value as 'scheduled' | 'completed')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Consulta marcada</SelectItem>
                  <SelectItem value="completed">Consultoria realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">Data e horário</label>
              <Input type="datetime-local" required value={consultationDate} onChange={(event) => setConsultationDate(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">Responsável pela consultoria</label>
              {role === 'admin' ? (
                <Select value={consultantId} onValueChange={setConsultantId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o responsável" /></SelectTrigger>
                  <SelectContent>
                    {attendants.map((attendant) => (
                      <SelectItem key={attendant.id} value={attendant.id}>{attendant.name || attendant.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900">
                  <UserRound className="h-4 w-4" /> Você
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">Valor da consultoria (R$)</label>
              <Input type="number" min="0.01" step="0.01" required value={value} onChange={(event) => setValue(event.target.value)} placeholder="Ex.: 250,00" />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-semibold text-slate-600 dark:text-slate-300">Observação (opcional)</label>
            <Textarea rows={3} maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Contexto útil sobre a consultoria." />
          </div>

          <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 sm:grid-cols-2 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100">
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-70">Percentual configurado</span>
              <strong className="text-base">{percentage.toLocaleString('pt-BR')}%</strong>
            </div>
            <div>
              <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-70">
                {status === 'completed' ? 'Retorno para o Canadá Sem Filtro' : 'Retorno previsto para o Canadá Sem Filtro'}
              </span>
              <strong className="text-base">{currency.format(returnAmount)}</strong>
            </div>
          </div>

          {!commissionActive && <p className="text-red-600">A regra de comissão está desativada nas Configurações.</p>}
          {success && <p role="status" className="text-emerald-600">{success}</p>}
          <Button type="submit" disabled={saving || !commissionActive || numericValue <= 0 || (role === 'admin' && !consultantId)} className="w-full gap-2">
            <CalendarCheck className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar controle de consultoria'}
          </Button>
        </form>
      ) : (
        <p className="rounded-lg bg-white p-3 text-slate-500 dark:bg-slate-900">Marque a opção acima quando o lead agendar uma consultoria.</p>
      )}

      {error && <p role="alert" className="text-red-600">{error}</p>}

      <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <h4 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
          <CircleDollarSign className="h-4 w-4 text-emerald-600" /> Histórico de consultorias
        </h4>
        {consultations.length === 0 ? (
          <p className="text-slate-400">Nenhuma consultoria registrada.</p>
        ) : consultations.map((consultation) => (
          <div key={consultation.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{statusLabel(consultation.status)}</Badge>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {consultation.profiles?.name || consultation.profiles?.email || 'Consultor'}
                </span>
              </div>
              <span className="text-slate-500">{new Date(consultation.consultation_date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>
            <div className="mt-2 grid gap-1 text-slate-600 sm:grid-cols-2 dark:text-slate-300">
              <span>Valor: <strong>{currency.format(Number(consultation.value_amount))}</strong></span>
              <span>{consultation.status === 'completed' ? 'Retorno' : 'Retorno previsto'}: <strong>{currency.format(Number(consultation.company_return_amount))}</strong> ({Number(consultation.commission_percentage).toLocaleString('pt-BR')}%)</span>
            </div>
            {consultation.notes && <p className="mt-2 whitespace-pre-wrap text-slate-500">{consultation.notes}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
