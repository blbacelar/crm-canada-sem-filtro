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
  Users,
  Crown,
  Briefcase,
  BarChart2,
  UserPlus,
} from 'lucide-react';
import { UserRole } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function SettingsPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<UserRole>('admin');
  const [loading, setLoading] = React.useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = React.useState<boolean>(false);
  const [successMessage, setSuccessMessage] = React.useState<string>('');

  // States
  const [commissionRules, setCommissionRules] = React.useState<any[]>([]);
  const [newProductName, setNewProductName] = React.useState<string>('');
  const [newCommissionPercentage, setNewCommissionPercentage] = React.useState<string>('10.0');

  // RBAC Operators Management State
  const [operators, setOperators] = React.useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = React.useState<any[]>([]);
  const [newOpName, setNewOpName] = React.useState<string>('');
  const [newOpEmail, setNewOpEmail] = React.useState<string>('');
  const [newOpRole, setNewOpRole] = React.useState<UserRole>('consultant');
  const [submittingOp, setSubmittingOp] = React.useState<boolean>(false);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [pendingApprovalRoles, setPendingApprovalRoles] = React.useState<Record<string, UserRole>>({});

  // SLA States
  const [businessStartHour, setBusinessStartHour] = React.useState<string>('09:00');
  const [businessEndHour, setBusinessEndHour] = React.useState<string>('18:00');
  const [targetSlaHours, setTargetSlaHours] = React.useState<string>('24');

  React.useEffect(() => {
    const storedRole = localStorage.getItem('crm_user_role') as UserRole;
    if (storedRole) setRole(storedRole);
  }, []);

  const fetchSettings = React.useCallback(async () => {
    try {
      setLoading(true);
      const [commRes, opRes] = await Promise.all([
        fetch('/api/commissions'),
        fetch('/api/operators'),
      ]);

      if (commRes.ok) {
        const json = await commRes.json();
        setCommissionRules(json.configs || []);
      }

      if (opRes.ok) {
        const json = await opRes.json();
        setOperators(json.operators || []);
        setPendingUsers(json.pendingUsers || []);
        // Inicializar roles para aprovacao com 'consultant' como padrão
        const initialRoles: Record<string, UserRole> = {};
        (json.pendingUsers || []).forEach((u: any) => { initialRoles[u.email] = 'consultant'; });
        setPendingApprovalRoles(initialRoles);
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
        setSuccessMessage('Comissões atualizadas com sucesso!');
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

  // Aprovar usuario pendente com papel escolhido pelo Admin
  const handleApproveUser = async (email: string) => {
    const selectedRole = pendingApprovalRoles[email] || 'consultant';
    try {
      setApprovingId(email);
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role: selectedRole,
          action: 'approve',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setSavedSuccess(true);
        setSuccessMessage(json.message || `Acesso de ${email} aprovado!`);
        setTimeout(() => setSavedSuccess(false), 3000);
        fetchSettings();
      }
    } catch (err) {
      console.error('Erro ao aprovar usuario:', err);
    } finally {
      setApprovingId(null);
    }
  };

  // Alteração de Papel pelo Administrador
  const handleOperatorRoleChange = async (targetEmail: string, targetRole: UserRole) => {
    try {
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          role: targetRole,
          action: 'update_role',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setSavedSuccess(true);
        setSuccessMessage(json.message || `Papel de ${targetEmail} atualizado com sucesso!`);
        setTimeout(() => setSavedSuccess(false), 3000);

        // Se o email editado for o meu proprio email logado, atualizar local storage
        const myEmail = localStorage.getItem('crm_user_email');
        if (myEmail && myEmail.toLowerCase() === targetEmail.toLowerCase()) {
          localStorage.setItem('crm_user_role', targetRole);
          setRole(targetRole);
        }

        fetchSettings();
      }
    } catch (err) {
      console.error('Erro ao atualizar papel do operador:', err);
    }
  };

  // Cadastro de Novo Operador pelo Administrador com Atribuição de Papel
  const handleAddOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOpEmail || !newOpName) return;

    try {
      setSubmittingOp(true);
      const res = await fetch('/api/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newOpName,
          email: newOpEmail,
          role: newOpRole,
          action: 'create',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setSavedSuccess(true);
        setSuccessMessage(json.message || `Operador ${newOpName} adicionado com sucesso!`);
        setTimeout(() => setSavedSuccess(false), 3000);

        setNewOpName('');
        setNewOpEmail('');
        setNewOpRole('consultant');
        fetchSettings();
      }
    } catch (err) {
      console.error('Erro ao cadastrar operador:', err);
    } finally {
      setSubmittingOp(false);
    }
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
                Gerencie permissões de operadores (RBAC), regras de comissão e integrações do CRM.
              </p>
            </div>
          </div>

          {savedSuccess && (
            <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1 px-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{successMessage || 'Configurações salvas!'}</span>
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
                Você está navegando com o perfil <strong>{role.toUpperCase()}</strong>. Alterações de papéis de operadores são restritas a Administradores.
              </p>
            </div>
          </div>
        )}

        {/* Tabs for Dedicated Settings */}
        <Tabs defaultValue="operadores" className="space-y-6">
          <TabsList className="w-full justify-start border-b border-slate-200 dark:border-slate-800 rounded-none bg-transparent p-0 gap-6">
            <TabsTrigger
              value="operadores"
              className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent rounded-none px-1 pb-3 text-xs font-bold gap-2"
            >
              <Users className="w-4 h-4 text-red-500" />
              <span>Gestão de Operadores & Papéis (RBAC)</span>
            </TabsTrigger>
            <TabsTrigger
              value="comissoes"
              className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent rounded-none px-1 pb-3 text-xs font-bold gap-2"
            >
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <span>Regras de Comissões por Produto</span>
            </TabsTrigger>
            <TabsTrigger
              value="sla"
              className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent rounded-none px-1 pb-3 text-xs font-bold gap-2"
            >
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Horário Comercial & SLAs</span>
            </TabsTrigger>
            <TabsTrigger
              value="hotmart"
              className="data-[state=active]:border-b-2 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent rounded-none px-1 pb-3 text-xs font-bold gap-2"
            >
              <Activity className="w-4 h-4 text-amber-500" />
              <span>Integração Hotmart & Webhooks</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: GESTÃO DE OPERADORES & PAPÉIS (RBAC) */}
          <TabsContent value="operadores" className="space-y-6 m-0">

            {/* Fila de Aprovação — Usuários Pendentes */}
            {pendingUsers.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/5">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <Users className="w-4 h-4" />
                    <span>Aguardando Aprovação</span>
                    <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {pendingUsers.length}
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-600/80 dark:text-amber-400/80">
                    Esses usuários criaram conta mas ainda <strong>não têm acesso ao CRM</strong>. Aprove e atribua o papel correto.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pendingUsers.map((u: any) => (
                    <div
                      key={u.id || u.email}
                      className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{u.name}</p>
                        <p className="text-slate-500 dark:text-slate-400">{u.email}</p>
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                          ⏳ Pendente de Aprovação
                        </Badge>
                      </div>

                      {role === 'admin' ? (
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <Select
                            value={pendingApprovalRoles[u.email] || 'consultant'}
                            onValueChange={(val) =>
                              setPendingApprovalRoles((prev) => ({ ...prev, [u.email]: val as UserRole }))
                            }
                          >
                            <SelectTrigger className="w-[170px] h-8 text-xs font-semibold border-amber-500/30">
                              <SelectValue placeholder="Atribuir Papel" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">👑 Administradora</SelectItem>
                              <SelectItem value="consultant">💼 Consultora</SelectItem>
                              <SelectItem value="marketing">📊 Marketing</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            disabled={approvingId === u.email}
                            onClick={() => handleApproveUser(u.email)}
                            className="bg-amber-500 hover:bg-amber-600 text-white text-xs gap-1.5 h-8 px-3"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {approvingId === u.email ? 'Aprovando...' : 'Aprovar Acesso'}
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-slate-400 text-[10px]">Apenas Admin pode aprovar</Badge>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Form de Cadastro de Operador com Atribuição de Papel pelo Admin */}
            {role === 'admin' && (
              <Card className="border-red-500/20 bg-red-500/5">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    <UserPlus className="w-4 h-4 text-red-500" /> Cadastrar Novo Operador & Atribuir Papel
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Exclusivo para Administradores. Cadastre um novo operador no CRM e atribua a permissão desejada.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleAddOperator} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Nome do Operador
                      </label>
                      <Input
                        type="text"
                        required
                        placeholder="Ex: Amanda Silva"
                        value={newOpName}
                        onChange={(e) => setNewOpName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        E-mail Corporativo
                      </label>
                      <Input
                        type="email"
                        required
                        placeholder="amanda@canadasemfiltro.com"
                        value={newOpEmail}
                        onChange={(e) => setNewOpEmail(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Papel Atribuído (Role)
                      </label>
                      <Select value={newOpRole} onValueChange={(val) => setNewOpRole(val as UserRole)}>
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue placeholder="Selecione o papel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">👑 Administradora (Acesso Total)</SelectItem>
                          <SelectItem value="consultant">💼 Consultora (Atendimento)</SelectItem>
                          <SelectItem value="marketing">📊 Marketing (Métricas BI)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="submit" disabled={submittingOp} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                      <UserPlus className="w-4 h-4" />
                      <span>{submittingOp ? 'Salvando...' : 'Atribuir Papel & Salvar'}</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Tabela de Operadores Cadastrados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-purple-500" /> Operadores da Equipe & Permissões Ativas
                </CardTitle>
                <CardDescription className="text-xs">
                  Lista de operadores registrados. Administradores podem alterar os papéis dos operadores a qualquer momento.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {operators.map((op: any, idx: number) => (
                  <div
                    key={op.id || idx}
                    className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{op.name}</p>
                        <Badge
                          variant="outline"
                          className={
                            op.role === 'admin'
                              ? 'bg-red-500/10 text-red-600 border-red-500/20'
                              : op.role === 'consultant'
                              ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                              : 'bg-purple-500/10 text-purple-600 border-purple-500/20'
                          }
                        >
                          {op.role === 'admin' ? '👑 Administradora' : op.role === 'consultant' ? '💼 Consultora' : '📊 Marketing'}
                        </Badge>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">{op.email}</p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="flex items-center gap-2">
                        <label className="text-slate-500 font-medium">Alterar Papel:</label>
                        <Select
                          value={op.role}
                          disabled={role !== 'admin'}
                          onValueChange={(newRole) => handleOperatorRoleChange(op.email, newRole as UserRole)}
                        >
                          <SelectTrigger className="w-[180px] h-8 text-xs font-semibold">
                            <SelectValue placeholder="Papel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">👑 Administradora</SelectItem>
                            <SelectItem value="consultant">💼 Consultora</SelectItem>
                            <SelectItem value="marketing">📊 Marketing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 2: COMISSÕES */}
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
                            onBlur={(e) => handleUpdateCommission(rule.product_name, parseFloat(e.target.value), rule.is_active)}
                            className="w-20 h-8 text-xs font-bold text-right"
                          />
                          <span className="font-bold text-slate-700 dark:text-slate-300">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: SLA */}
          <TabsContent value="sla" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" /> Parâmetros do Motor de SLA (24 Horas Úteis)
                </CardTitle>
                <CardDescription className="text-xs">
                  O SLA pausa automaticamente fora do horário comercial, finais de semana e feriados nacionais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Início da Janela Útil</label>
                    <Input value={businessStartHour} onChange={(e) => setBusinessStartHour(e.target.value)} disabled={role !== 'admin'} />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Término da Janela Útil</label>
                    <Input value={businessEndHour} onChange={(e) => setBusinessEndHour(e.target.value)} disabled={role !== 'admin'} />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-semibold mb-1">Meta de Atendimento (Horas Úteis)</label>
                    <Input value={targetSlaHours} onChange={(e) => setTargetSlaHours(e.target.value)} disabled={role !== 'admin'} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: HOTMART */}
          <TabsContent value="hotmart" className="space-y-6 m-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" /> Webhook da Hotmart & Endpoint
                </CardTitle>
                <CardDescription className="text-xs">
                  URL para recepção de eventos de vendas e diagnósticos em tempo real.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>https://crm-canada-sem-filtro.vercel.app/api/webhooks/hotmart</span>
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">Ativo HTTP 200</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
