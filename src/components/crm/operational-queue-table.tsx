'use client';

import { AlertTriangle, ChevronLeft, ChevronRight, CheckCircle2, Filter } from 'lucide-react';
import { MockClient, JOURNEY_LABELS } from '@/components/crm/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface OperationalQueueTableProps {
  clients: MockClient[];
  loading: boolean;
  totalClientCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSelectClient: (client: MockClient) => void;
}

export function OperationalQueueTable({
  clients,
  loading,
  totalClientCount,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onSelectClient,
}: OperationalQueueTableProps) {
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalClientCount);

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <Filter className="w-4 h-4 text-red-500" />
          <span>Fila Operacional de Atendimento</span>
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">SLA padrão: 24h úteis</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Estado da Jornada</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Produto</TableHead>
            <TableHead>SLA Restante</TableHead>
            <TableHead>Consultoria</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead className="text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={`loading-${index}`}>
                {Array.from({ length: 7 }).map((__, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <div className="h-4 w-full max-w-[180px] animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : clients.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-8 text-slate-500 text-xs font-medium">
                Nenhum cliente encontrado com os filtros selecionados.
              </TableCell>
            </TableRow>
          ) : clients.map((client) => {
            const labelInfo = JOURNEY_LABELS[client.status_journey];
            return (
              <TableRow
                key={client.id}
                onClick={() => onSelectClient(client)}
                className={client.is_overdue ? 'border-l-4 border-l-red-500 bg-red-500/5' : ''}
              >
                <TableCell>
                  <span className={`px-2.5 py-1 rounded-full font-semibold text-[11px] inline-flex items-center justify-center text-center gap-1 ${labelInfo.bg} ${labelInfo.text}`}>
                    {labelInfo.label}
                  </span>
                </TableCell>
                <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                  <div>{client.name}</div>
                  <div className="text-[11px] text-slate-400">{client.email}</div>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300">{client.product}</TableCell>
                <TableCell>
                  {client.status_journey !== 'compra' ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Cumprido
                    </span>
                  ) : client.is_overdue ? (
                    <span className="font-bold text-red-600 dark:text-red-400 text-xs inline-flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> ESTOURADO!
                    </span>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">{client.sla_hours_left}h úteis restantes</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={client.consultation_booked}
                      readOnly
                      tabIndex={-1}
                      aria-label={client.consultation_booked ? 'Consultoria marcada' : 'Consultoria não marcada'}
                      className="h-4 w-4 rounded border-slate-300 accent-emerald-600 pointer-events-none"
                    />
                    {client.consultation_status === 'completed'
                      ? 'Realizada'
                      : client.consultation_booked
                        ? 'Marcada'
                        : 'Não marcada'}
                  </span>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300 font-medium">{client.assigned_consultant}</TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" size="sm" className="gap-1">
                    <span>Ver Ficha</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Itens por página:</span>
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-20 text-xs font-semibold"><SelectValue placeholder="10" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-slate-500 dark:text-slate-400">
            Exibindo <strong>{totalClientCount === 0 ? 0 : startIndex + 1}</strong> - <strong>{endIndex}</strong> de <strong>{totalClientCount}</strong> clientes
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => onPageChange(Math.max(currentPage - 1, 1))} className="gap-1">
            <ChevronLeft className="w-4 h-4" /><span>Anterior</span>
          </Button>
          <span className="text-slate-600 dark:text-slate-300 font-bold px-2">Página {currentPage} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))} className="gap-1">
            <span>Próximo</span><ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
