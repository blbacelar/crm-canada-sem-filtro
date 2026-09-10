'use client';

import { AlertCircle, AlertTriangle, Clock, FileCheck, Plus, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { UserRole } from '@/types/database.types';
import { MockClient } from '@/components/crm/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface OperationalSummaryProps {
  clients: MockClient[];
  totalClientCount: number;
  inServiceCount: number;
  diagnosticsCount: number;
  loading: boolean;
  overdueCount: number;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  role: UserRole;
  pendingDuplicatesCount: number;
  onOpenDuplicates: () => void;
  onOpenManualClient: () => void;
}

export function OperationalSummary({
  clients,
  totalClientCount,
  inServiceCount,
  diagnosticsCount,
  loading,
  overdueCount,
  statusFilter,
  onStatusFilterChange,
  role,
  pendingDuplicatesCount,
  onOpenDuplicates,
  onOpenManualClient,
}: OperationalSummaryProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total de Clientes"
          value={loading ? '...' : totalClientCount}
          description="Base real sincronizada do Supabase"
          icon={<Users className="w-5 h-5" />}
          iconClassName="bg-blue-500/10 text-blue-500"
        />
        <MetricCard
          label="Em Atendimento"
          value={loading ? '...' : inServiceCount}
          description="Fila operacional ativa"
          descriptionClassName="text-amber-600 dark:text-amber-400"
          icon={<Clock className="w-5 h-5" />}
          iconClassName="bg-amber-500/10 text-amber-500"
        />
        <MetricCard
          label="Diagnósticos Enviados"
          value={loading ? '...' : diagnosticsCount}
          description="Aguardando análise da equipe"
          descriptionClassName="text-purple-600 dark:text-purple-400"
          icon={<FileCheck className="w-5 h-5" />}
          iconClassName="bg-purple-500/10 text-purple-500"
        />
        <MetricCard
          label="SLA Estourado (24h úteis)"
          value={overdueCount}
          description={overdueCount > 0 ? 'Ação necessária imediata!' : 'Nenhum atraso'}
          descriptionClassName="text-red-500 font-medium"
          valueClassName="text-red-600 dark:text-red-500"
          icon={<AlertTriangle className="w-5 h-5" />}
          iconClassName="bg-red-500/10 text-red-500"
          className={overdueCount > 0 ? 'border-red-500 dark:border-red-500 overdue-pulse' : ''}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <Button variant={statusFilter === 'todos' ? 'default' : 'outline'} size="sm" onClick={() => onStatusFilterChange('todos')}>
            Todos ({totalClientCount})
          </Button>
          <Button variant={statusFilter === 'overdue' ? 'default' : 'destructive'} size="sm" onClick={() => onStatusFilterChange('overdue')} className="gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Atrasados</span>
          </Button>
          <Button variant={statusFilter === 'compra' ? 'default' : 'outline'} size="sm" onClick={() => onStatusFilterChange('compra')}>
            Novas Compras
          </Button>
          <Button variant={statusFilter === 'diagnostico_enviado' ? 'default' : 'outline'} size="sm" onClick={() => onStatusFilterChange('diagnostico_enviado')}>
            Diagnósticos
          </Button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {role === 'admin' && pendingDuplicatesCount > 0 && (
            <Button variant="destructive" size="sm" onClick={onOpenDuplicates} className="gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{pendingDuplicatesCount} Duplicidades</span>
            </Button>
          )}
          <Button onClick={onOpenManualClient} className="gap-1.5">
            <Plus className="w-4 h-4" />
            <span>Novo Cliente Manual</span>
          </Button>
        </div>
      </div>
    </>
  );
}

function MetricCard({
  label,
  value,
  description,
  descriptionClassName = 'text-slate-500 dark:text-slate-400',
  valueClassName = 'text-slate-900 dark:text-slate-50',
  icon,
  iconClassName,
  className,
}: {
  label: string;
  value: ReactNode;
  description: string;
  descriptionClassName?: string;
  valueClassName?: string;
  icon: ReactNode;
  iconClassName: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
          <div className={`p-2 rounded-lg ${iconClassName}`}>{icon}</div>
        </div>
        <div className={`mt-3 text-2xl font-bold ${valueClassName}`}>{value}</div>
        <p className={`text-xs mt-1 ${descriptionClassName}`}>{description}</p>
      </CardContent>
    </Card>
  );
}
