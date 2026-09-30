'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Kind = 'paid' | 'refunded' | 'pending' | 'other' | 'cart';
type Row = {
  transaction_code?: string;
  event_id?: string;
  product_name: string;
  status_hotmart?: string;
  price_gross?: number | null;
  currency_code?: string | null;
  purchase_date?: string;
  occurred_at?: string;
  offer_code?: string | null;
  clients: { name: string; email: string };
  included_products?: string[];
};
type Report = {
  counts: Record<Kind, number>;
  syncedAt: string | null;
  total: number;
  rows: Row[];
};

const tabs: Array<{ kind: Kind; label: string }> = [
  { kind: 'paid', label: 'Comprou' },
  { kind: 'refunded', label: 'Reembolso/contestação' },
  { kind: 'pending', label: 'Pagamento pendente' },
  { kind: 'other', label: 'Outros status' },
  { kind: 'cart', label: 'Carrinho abandonado' },
];

const statusLabels: Record<string, string> = {
  PURCHASE_APPROVED: 'Pago', PURCHASE_COMPLETE: 'Pago', PURCHASE_COMPLETED: 'Pago',
  PURCHASE_REFUNDED: 'Reembolsado', PURCHASE_PARTIALLY_REFUNDED: 'Parcialmente reembolsado',
  PURCHASE_CHARGEBACK: 'Contestação', PURCHASE_CANCELED: 'Cancelado',
  PURCHASE_EXPIRED: 'Expirado', PURCHASE_WAITING_PAYMENT: 'Pagamento pendente',
  PURCHASE_STARTED: 'Compra iniciada', PURCHASE_BILLET_PRINTED: 'Boleto gerado',
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

export default function HotmartPage() {
  const [kind, setKind] = React.useState<Kind>('paid');
  const [page, setPage] = React.useState(0);
  const [report, setReport] = React.useState<Report | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [revision, setRevision] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/hotmart/overview?kind=${kind}&offset=${page * 50}&limit=50`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar a Hotmart.');
        return body as Report;
      })
      .then((body) => { if (active) { setReport(body); setError(null); } })
      .catch((cause) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, page, revision]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar ao CRM</Link>
          <h1 className="text-2xl font-bold">Histórico Hotmart</h1>
          <p className="mt-1 text-sm text-slate-500">Cada venda aparece pelo status atual da transação; abandono de carrinho é um evento separado, sem compra presumida.</p>
        </div>
        <Button variant="outline" onClick={() => setRevision((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar visão</Button>
      </div>

      <p className="text-xs text-slate-500">Última conciliação de vendas: {formatDate(report?.syncedAt || undefined)}. Carrinhos dependem do webhook de abandono habilitado na Hotmart.</p>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <Button key={tab.kind} size="sm" variant={kind === tab.kind ? 'default' : 'outline'} onClick={() => { setKind(tab.kind); setPage(0); }}>
            {tab.label} ({report?.counts?.[tab.kind] ?? '…'})
          </Button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {error ? <p role="alert" className="p-6 text-sm text-red-600">{error}</p> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Lead</TableHead><TableHead>Produto / cursos</TableHead><TableHead>Status</TableHead><TableHead>Valor</TableHead><TableHead>Data</TableHead><TableHead>Referência</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="py-8 text-center">Carregando…</TableCell></TableRow>
                : !report?.rows.length ? <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500">Nenhum registro nessa categoria.</TableCell></TableRow>
                  : report.rows.map((row) => (
                    <TableRow key={row.transaction_code || row.event_id}>
                      <TableCell><div className="font-semibold">{row.clients.name}</div><div className="text-xs text-slate-500">{row.clients.email}</div></TableCell>
                      <TableCell><div className="font-medium">{row.product_name}</div>{row.included_products?.length ? <div className="text-xs text-slate-500">Inclui: {row.included_products.join(', ')}</div> : null}</TableCell>
                      <TableCell>{row.status_hotmart
                        ? (statusLabels[row.status_hotmart] || row.status_hotmart.replace(/^PURCHASE_/, '').replaceAll('_', ' '))
                        : 'Carrinho abandonado'}</TableCell>
                      <TableCell>{row.price_gross == null ? '—' : `${row.currency_code || 'BRL'} ${Number(row.price_gross).toFixed(2)}`}</TableCell>
                      <TableCell>{formatDate(row.purchase_date || row.occurred_at)}</TableCell>
                      <TableCell className="font-mono text-xs">{row.transaction_code || row.offer_code || '—'}</TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{report ? `${Math.min(page * 50 + 1, report.total)}–${Math.min((page + 1) * 50, report.total)} de ${report.total}` : '—'}</span>
        <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((value) => value - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={loading || !report || (page + 1) * 50 >= report.total} onClick={() => setPage((value) => value + 1)}>Próxima</Button></div>
      </div>
    </main>
  );
}
