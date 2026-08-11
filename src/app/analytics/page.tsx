'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  PieChart,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { UserRole } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function AnalyticsPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<UserRole>('admin');
  const [loading, setLoading] = React.useState<boolean>(true);
  const [analytics, setAnalytics] = React.useState<any>(null);

  const fetchAnalytics = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics');
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json);
      }
    } catch (err) {
      console.error('Erro ao carregar analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const summary = analytics?.summary || {
    totalClients: 0,
    totalPurchases: 0,
    totalGrossRevenue: 0,
    totalNetRevenue: 0,
    slaComplianceRate: 0,
    conversionRate: 0,
  };

  const funnel = analytics?.funnel || {
    compra: 0,
    diagnostico_enviado: 0,
    acompanhamento: 0,
    consulta_marcada: 0,
    consulta_concluida: 0,
    cancelamento: 0,
    reembolso: 0,
  };

  const totalClients = summary.totalClients || 1;

  const funnelSteps = [
    { key: 'compra', label: 'Compra Efetuada (Aguardando Diagnóstico)', count: funnel.compra, color: 'bg-blue-500' },
    { key: 'diagnostico_enviado', label: 'Diagnóstico Enviado (Análise Pendente)', count: funnel.diagnostico_enviado, color: 'bg-purple-500' },
    { key: 'acompanhamento', label: 'Em Acompanhamento / Contato', count: funnel.acompanhamento, color: 'bg-amber-500' },
    { key: 'consulta_marcada', label: 'Consulta Agendada (Calendly)', count: funnel.consulta_marcada, color: 'bg-cyan-500' },
    { key: 'consulta_concluida', label: 'Consulta Realizada com Sucesso', count: funnel.consulta_concluida, color: 'bg-emerald-500' },
    { key: 'cancelamento', label: 'Cancelados', count: funnel.cancelamento, color: 'bg-slate-400' },
    { key: 'reembolso', label: 'Reembolsados', count: funnel.reembolso, color: 'bg-pink-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors">
      <Header currentRole={role} onRoleChange={setRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/')}
              className="gap-1 text-slate-600 dark:text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar ao CRM</span>
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-red-600 dark:text-red-500" />
                <span>Dashboard de Analytics BI & Performance</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visão consolidada do funil de vendas, taxa de SLA e receitas financeiras da Hotmart.
              </p>
            </div>
          </div>

          {role === 'marketing' && (
            <Badge variant="outline" className="bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 gap-1.5 py-1 px-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Modo Marketing BI (Sem PII)</span>
            </Badge>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total de Clientes
                </span>
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-50">
                {loading ? '...' : summary.totalClients}
              </div>
              <p className="text-xs text-slate-500 mt-1">Registrados no banco oficial</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Taxa SLA Cumprido
                </span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {loading ? '...' : `${summary.slaComplianceRate}%`}
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                Atendimentos dentro das 24h úteis
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Faturamento Bruto
                </span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-50">
                {loading ? '...' : `R$ ${summary.totalGrossRevenue.toFixed(2)}`}
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1 font-medium">
                Líquido: R$ {summary.totalNetRevenue.toFixed(2)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Taxa de Conversão
                </span>
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {loading ? '...' : `${summary.conversionRate}%`}
              </div>
              <p className="text-xs text-slate-500 mt-1">Conversão para Consulta Agendada</p>
            </CardContent>
          </Card>
        </div>

        {/* Funnel Progress Section */}
        <Card className="p-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChart className="w-5 h-5 text-red-500" /> Funil da Jornada do Cliente (Etapas de Atendimento)
            </CardTitle>
            <CardDescription className="text-xs">
              Acompanhamento da movimentação dos clientes desde a compra da Hotmart até a realização da consulta.
            </CardDescription>
          </CardHeader>

          <div className="space-y-4 pt-2">
            {funnelSteps.map((step) => {
              const percentage = Math.round((step.count / totalClients) * 100);
              return (
                <div key={step.key} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-medium">
                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{step.label}</span>
                    <span className="text-slate-500">
                      {step.count} cliente(s) ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${step.color} transition-all duration-500 rounded-full`}
                      style={{ width: `${Math.max(4, percentage)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </main>
    </div>
  );
}
