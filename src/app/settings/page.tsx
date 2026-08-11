'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/header';
import {
  Shield,
  DollarSign,
  Clock,
  Activity,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Sliders,
} from 'lucide-react';
import { UserRole } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function SettingsPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<UserRole>('admin');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = React.useState<boolean>(false);

  // States
  const [commissionRules, setCommissionRules] = React.useState<any[]>([]);
  const [newProductName, setNewProductName] = React.useState<string>('');
  const [newCommissionPercentage, setNewCommissionPercentage] = React.useState<string>('10.0');

  const [businessStartHour, setBusinessStartHour] = React.useState<string>('09:00');
  const [businessEndHour, setBusinessEndHour] = React.useState<string>('18:00');
  const [targetSlaHours, setTargetSlaHours] = React.useState<string>('24');

  const fetchSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/commissions');
      if (res.ok) {
        const json = await res.json();
        setCommissionRules(json.configs || []);
      }
    } catch (err) {
      console.error('Erro ao carregar configurações:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleUpdateCommission = async (productName: string, percentage: number, isActive: boolean = true) => {
    try {
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: productName,
          commission_percentage: percentage,
          is_active: isActive,
          user_role: role,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
        fetchSettings();
      }
    } catch (err) {
      console.error('Erro ao atualizar comissão:', err);
    }
  };

  const handleAddCommissionRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName || !newCommissionPercentage) return;

    await handleUpdateCommission(newProductName, parseFloat(newCommissionPercentage), true);
    setNewProductName('');
    setNewCommissionPercentage('10.0');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors">
      <Header currentRole={role} onRoleChange={setRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Navigation Bar */}
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
                <Sliders className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>Painel de Configurações Administrativas</span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gerencie regras de comissões, jornada, parâmetros de SLA e integrações operacionais.
              </p>
            </div>
          </div>

          {savedSuccess && (
            <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1 px-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Configurações salvas com sucesso!</span>
            </Badge>
          )}
        </div>

        {/* Access Denial Banner for Non-Admins */}
        {role !== 'admin' && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-bold">Modo de Visualização Limitado</p>
              <p className="opacity-90">
                Você está navegando com o perfil <strong>{role.toUpperCase()}</strong>. Alterações nesta página são restritas a usuários Administradores.
              </p>
            </div>
          </div>
        )}

        {/* Tabs for Dedicated Settings */}
        <Tabs defaultValue="comissoes" className="space-y-6">
          <TabsList className="w-full justify-start border-b border-slate-200 dark:border-slate-800 rounded-none bg-transparent p-0 gap-6">
            <TabsTrigger
              value="comissoes"
              className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent rounded-none px-1 pb-3 text-xs font-bold gap-2"
            >
              <DollarSign className="w-4 h-4" />
              <span>Regras de Comissões por Produto</span>
            </TabsTrigger>
            <TabsTrigger
              value="sla"
              className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent rounded-none px-1 pb-3 text-xs font-bold gap-2"
            >
              <Clock className="w-4 h-4" />
              <span>Horário Comercial & SLAs</span>
            </TabsTrigger>
            <TabsTrigger
              value="hotmart"
              className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent rounded-none px-1 pb-3 text-xs font-bold gap-2"
            >
              <Activity className="w-4 h-4" />
              <span>Integração Hotmart & Webhooks</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: COMISSÕES */}
          <TabsContent value="comissoes" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" /> Tabela de Comissões por Produto
                </CardTitle>
                <CardDescription className="text-xs">
                  Defina a porcentagem de comissão atribuída automaticamente às consultoras para cada venda efetuada na Hotmart.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {commissionRules.map((rule: any, idx: number) => (
                    <div
                      key={rule.id || idx}
                      className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{rule.product_name}</p>
                        <div className="flex items-center gap-2 text-slate-400">
                          <span>Status:</span>
                          <Badge variant="outline" className={rule.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-400'}>
                            {rule.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="flex items-center gap-2">
                          <label className="text-slate-500 font-medium">Comissão:</label>
                          <Input
                            type="number"
                            step="0.5"
                            disabled={role !== 'admin'}
                            defaultValue={rule.commission_percentage}
                            className="w-24 h-9 text-right font-bold text-sm"
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                handleUpdateCommission(rule.product_name, val, rule.is_active);
                              }
                            }}
                          />
                          <span className="font-bold text-slate-500">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Form para Adicionar Novo Produto */}
                {role === 'admin' && (
                  <form onSubmit={handleAddCommissionRule} className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-3 mt-6">
                    <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> Cadastrar Nova Regra de Comissão por Produto
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block font-semibold mb-1">Nome exato do Produto (como na Hotmart)</label>
                        <Input
                          type="text"
                          required
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="Ex: Consultoria de Vistos Canadá"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold mb-1">Porcentagem de Comissão (%)</label>
                        <Input
                          type="number"
                          step="0.5"
                          required
                          value={newCommissionPercentage}
                          onChange={(e) => setNewCommissionPercentage(e.target.value)}
                          placeholder="10.0"
                        />
                      </div>
                    </div>
                    <Button type="submit" size="sm" className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
                      <Save className="w-4 h-4" />
                      <span>Salvar Nova Regra de Comissão</span>
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: HORÁRIO COMERCIAL & SLA */}
          <TabsContent value="sla" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" /> Configuração do Expediente & SLA de Horas Úteis
                </CardTitle>
                <CardDescription className="text-xs">
                  O SLA de 24h úteis só consome o tempo durante o horário de funcionamento comercial da equipe. Finais de semana e madrugadas são pausados automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-semibold mb-1">Início do Expediente (Seg a Sex)</label>
                    <Input
                      type="time"
                      value={businessStartHour}
                      disabled={role !== 'admin'}
                      onChange={(e) => setBusinessStartHour(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Fim do Expediente (Seg a Sex)</label>
                    <Input
                      type="time"
                      value={businessEndHour}
                      disabled={role !== 'admin'}
                      onChange={(e) => setBusinessEndHour(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Meta de SLA de Atendimento (Horas Úteis)</label>
                    <Input
                      type="number"
                      value={targetSlaHours}
                      disabled={role !== 'admin'}
                      onChange={(e) => setTargetSlaHours(e.target.value)}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Resumo da Regra Atual de SLA:</span>
                  <p className="text-[11px] text-slate-500">
                    O tempo de atendimento é contado de <strong>Segunda a Sexta-feira, das {businessStartHour} às {businessEndHour}</strong> (9 horas úteis por dia de trabalho). Compras efetuadas às 17h de Sexta-feira só atingirão o limite de 24h úteis na Terça-feira seguinte.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: INTEGRACAO HOTMART */}
          <TabsContent value="hotmart" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500" /> Receptor de Webhooks & Segurança Hotmart
                </CardTitle>
                <CardDescription className="text-xs">
                  Status de saúde da integração do webhook 2.0.0 da Hotmart com o ledger de eventos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">URL Endpoint do Webhook:</span>
                    <code className="bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded font-mono text-[11px]">
                      /api/webhooks/hotmart
                    </code>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Token de Segurança (HOTTOK):</span>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                      Configurado (.env.local)
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Trava de Idempotência:</span>
                    <span className="font-semibold text-emerald-600">Ativa (events_log deduplication)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
