'use client';

import * as React from 'react';
import Link from 'next/link';
import { Download, MailCheck, RefreshCw, Search } from 'lucide-react';
import { LeadWorkspaceShell } from '@/components/crm/lead-workspace-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchCurrentUser } from '@/lib/client-auth';
import { audienceToCsv, filterAudience, type AudienceContact, type AudienceFilters } from '@/lib/lead-audience';

const PAGE_SIZE = 20;

function humanDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR');
}

function purchaseLabel(contact: AudienceContact): string {
  const labels = [
    contact.hasPaid && 'Pago',
    contact.hasPending && 'Pendente',
    contact.hasRefunded && 'Reembolso',
    contact.hasAbandonedCart && 'Carrinho abandonado',
  ].filter(Boolean);
  return labels.length ? labels.join(' · ') : 'Sem compra registrada';
}

export default function LeadsPage() {
  const [userEmail, setUserEmail] = React.useState('');
  const [contacts, setContacts] = React.useState<AudienceContact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<AudienceFilters>({
    search: '', consent: 'authorized', purchase: 'all', attendance: 'all', product: 'all', source: 'all',
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/lead-audience', { cache: 'no-store' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os leads.');
      if (!Array.isArray(body.contacts)) throw new Error('A lista de leads veio incompleta.');
      setContacts(body.contacts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (!user) {
        window.location.assign('/login');
        return;
      }
      setUserEmail(user.email || '');
      if (user.role === 'admin' || user.role === 'marketing') void load();
      else setLoading(false);
    });
  }, [load]);

  const updateFilter = <K extends keyof AudienceFilters>(key: K, value: AudienceFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const filtered = React.useMemo(() => filterAudience(contacts, filters), [contacts, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const products = React.useMemo(() => [...new Set(contacts.flatMap((contact) => contact.purchasedProducts))].sort(), [contacts]);
  const sources = React.useMemo(() => [...new Set(contacts.flatMap((contact) => contact.sources))].sort(), [contacts]);
  const authorizedCount = contacts.filter((contact) => contact.marketingConsent).length;
  const paidCount = contacts.filter((contact) => contact.hasPaid).length;
  const attendanceCount = contacts.filter((contact) => contact.attendanceConfirmed).length;

  const exportCsv = () => {
    if (filters.consent !== 'authorized' || filtered.length === 0) return;
    const csv = audienceToCsv(filtered);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `leads-campanha-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <LeadWorkspaceShell userEmail={userEmail}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7d929d]">Base de relacionamento</p>
            <h1 className="mt-1 font-serif text-5xl font-normal tracking-tight text-[#1f2b32] sm:text-6xl">Leads</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Uma pessoa por e-mail. Compras vêm das transações registradas na Hotmart; inscrição na masterclass não é tratada como compra.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </Button>
            <Button size="sm" onClick={exportCsv} disabled={loading || filters.consent !== 'authorized' || filtered.length === 0} className="gap-2">
              <Download className="h-4 w-4" /> Exportar {filtered.length} e-mails em CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Contatos únicos</p><p className="mt-1 text-3xl font-semibold">{contacts.length}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Consentimento registrado</p><p className="mt-1 text-3xl font-semibold text-emerald-700">{authorizedCount}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-slate-500">Compra paga · Presença confirmada</p><p className="mt-1 text-3xl font-semibold">{paidCount} <span className="text-base font-normal text-slate-400">· {attendanceCount}</span></p></CardContent></Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-5 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Segmentar contatos</h2>
              <Link href="/" className="text-xs font-medium text-red-600 hover:underline">Voltar ao atendimento</Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2"><span className="mb-1 block text-xs font-medium">Buscar nome ou e-mail</span>
                <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Nome, e-mail ou produto" className="pl-9" />
                </div>
              </label>
              <label><span className="mb-1 block text-xs font-medium">Consentimento</span>
                <Select value={filters.consent} onValueChange={(value) => updateFilter('consent', value as AudienceFilters['consent'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="authorized">Autorizado</SelectItem><SelectItem value="not_authorized">Não autorizado</SelectItem><SelectItem value="all">Todos</SelectItem>
                </SelectContent></Select>
              </label>
              <label><span className="mb-1 block text-xs font-medium">Compra</span>
                <Select value={filters.purchase} onValueChange={(value) => updateFilter('purchase', value as AudienceFilters['purchase'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="all">Todas</SelectItem><SelectItem value="paid">Paga</SelectItem><SelectItem value="pending">Pagamento pendente</SelectItem><SelectItem value="refunded">Reembolso</SelectItem><SelectItem value="no_purchase">Sem compra</SelectItem><SelectItem value="cart">Carrinho abandonado</SelectItem>
                </SelectContent></Select>
              </label>
              <label><span className="mb-1 block text-xs font-medium">Masterclass</span>
                <Select value={filters.attendance} onValueChange={(value) => updateFilter('attendance', value as AudienceFilters['attendance'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="all">Todas</SelectItem><SelectItem value="confirmed">Presença confirmada</SelectItem><SelectItem value="not_confirmed">Não confirmada</SelectItem>
                </SelectContent></Select>
              </label>
              <label><span className="mb-1 block text-xs font-medium">Produto comprado</span>
                <Select value={filters.product} onValueChange={(value) => updateFilter('product', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="all">Todos</SelectItem>{products.map((product) => <SelectItem key={product} value={product}>{product}</SelectItem>)}
                </SelectContent></Select>
              </label>
              <label><span className="mb-1 block text-xs font-medium">Origem</span>
                <Select value={filters.source} onValueChange={(value) => updateFilter('source', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                  <SelectItem value="all">Todas</SelectItem>{sources.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}
                </SelectContent></Select>
              </label>
            </div>
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <MailCheck className="h-4 w-4 text-emerald-600" /> O CSV de campanha fica disponível somente com o filtro “Autorizado” e inclui todos os {filtered.length} resultados, mesmo em outras páginas.
            </p>
          </div>
          {error && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">{error}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Contato</TableHead><TableHead>Compra Hotmart</TableHead><TableHead>Produtos comprados</TableHead>
                <TableHead>Masterclass</TableHead><TableHead>Consentimento</TableHead><TableHead>Origem</TableHead><TableHead>Última atividade</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {loading ? <TableRow><TableCell colSpan={7} className="py-10 text-center">Carregando leads…</TableCell></TableRow>
                  : visible.length === 0 ? <TableRow><TableCell colSpan={7} className="py-10 text-center text-slate-500">Nenhum contato encontrado com estes filtros.</TableCell></TableRow>
                    : visible.map((contact) => <TableRow key={contact.email}>
                      <TableCell className="min-w-52"><div className="font-medium">{contact.name}</div><div className="text-xs text-slate-500">{contact.email}</div>{contact.leadCount > 1 && <div className="text-[11px] text-slate-400">{contact.leadCount} registros agrupados</div>}</TableCell>
                      <TableCell className="min-w-40 text-xs">{purchaseLabel(contact)}</TableCell>
                      <TableCell className="min-w-48 text-xs">{contact.purchasedProducts.length ? contact.purchasedProducts.join(' · ') : '—'}</TableCell>
                      <TableCell className="text-xs">{contact.attendanceConfirmed ? 'Confirmada' : 'Não confirmada'}</TableCell>
                      <TableCell className="text-xs">{contact.marketingConsent ? 'Autorizado' : 'Não autorizado'}</TableCell>
                      <TableCell className="text-xs">{contact.sources.join(', ') || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{humanDate(contact.latestActivityAt)}</TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 text-xs text-slate-500 dark:border-slate-800">
            <span>{filtered.length} contatos encontrados · Página {page} de {pages}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</Button></div>
          </div>
        </Card>
      </div>
    </LeadWorkspaceShell>
  );
}
