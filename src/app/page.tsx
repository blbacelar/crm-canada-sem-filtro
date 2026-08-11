'use client';

import * as React from 'react';
import { Header } from '@/components/header';
import {
  Users,
  Clock,
  FileCheck,
  AlertTriangle,
  Plus,
  Filter,
  ExternalLink,
  MessageSquare,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Shield,
} from 'lucide-react';
import { UserRole, JourneyState } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Mock de dados para demonstração da Fila Operacional
interface MockClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  document?: string;
  country?: string;
  zip_code?: string;
  city?: string;
  state?: string;
  address?: string;
  district?: string;
  number?: string;
  complement?: string;
  product: string;
  status_journey: JourneyState;
  sla_hours_left: number;
  is_overdue: boolean;
  assigned_consultant: string;
  purchase_date: string;
  price_gross: number;
  price_net: number;
  diagnostic_status: 'pendente' | 'enviado' | 'analisado';
  days_since_purchase: number;
  commission_amount: number;
}

const JOURNEY_LABELS: Record<JourneyState, { label: string; bg: string; text: string }> = {
  compra: { label: 'Compra Efetuada', bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
  diagnostico_enviado: { label: 'Diagnóstico Enviado', bg: 'bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400' },
  acompanhamento: { label: 'Acompanhamento', bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400' },
  consulta_marcada: { label: 'Consulta Marcada', bg: 'bg-cyan-500/15', text: 'text-cyan-600 dark:text-cyan-400' },
  consulta_concluida: { label: 'Consulta Concluída', bg: 'bg-emerald-500/15', text: 'text-emerald-600 dark:text-emerald-400' },
  cancelamento: { label: 'Cancelamento', bg: 'bg-slate-500/15', text: 'text-slate-600 dark:text-slate-400' },
  reembolso: { label: 'Reembolso', bg: 'bg-pink-500/15', text: 'text-pink-600 dark:text-pink-400' },
};

export default function HomePage() {
  const [role, setRole] = React.useState<UserRole>('admin');
  const [clients, setClients] = React.useState<MockClient[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<MockClient | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('todos');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [showManualModal, setShowManualModal] = React.useState<boolean>(false);
  const [showCommissionModal, setShowCommissionModal] = React.useState<boolean>(false);
  const [showDuplicateModal, setShowDuplicateModal] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);

  // Commission & Duplicates state
  const [commissionRules, setCommissionRules] = React.useState<any[]>([]);
  const [pendingDuplicates, setPendingDuplicates] = React.useState<any[]>([]);
  const [selectedDuplicate, setSelectedDuplicate] = React.useState<any>(null);

  // Diagnostic Realtime State
  const [diagnosticDetails, setDiagnosticDetails] = React.useState<any>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = React.useState<boolean>(false);

  // Form states
  const [interactionChannel, setInteractionChannel] = React.useState<'whatsapp' | 'email' | 'call'>('whatsapp');
  const [interactionSummary, setInteractionSummary] = React.useState('');
  const [manualName, setManualName] = React.useState('');
  const [manualEmail, setManualEmail] = React.useState('');
  const [manualPhone, setManualPhone] = React.useState('');
  const [manualProduct, setManualProduct] = React.useState('7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico');

  // Buscar duplicidades e regras de comissão para Admin
  const fetchAdminData = React.useCallback(async () => {
    try {
      const [commRes, dupRes] = await Promise.all([
        fetch('/api/commissions'),
        fetch('/api/duplicates'),
      ]);

      if (commRes.ok) {
        const json = await commRes.json();
        setCommissionRules(json.configs || []);
      }
      if (dupRes.ok) {
        const json = await dupRes.json();
        setPendingDuplicates(json.duplicates || []);
      }
    } catch (err) {
      console.error('Erro ao buscar dados admin:', err);
    }
  }, []);

  React.useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  // Carregar lista de clientes do banco oficial Supabase via API
  const fetchClientsFromApi = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/clients');
      if (res.ok) {
        const json = await res.json();
        const rawList = json.clients || [];
        const apiClients: MockClient[] = rawList.map((c: any) => ({
          id: c.id,
          name: c.name || 'Cliente Sem Nome',
          email: c.email || '',
          phone: c.phone || 'Não informado',
          document: c.document,
          country: c.country,
          zip_code: c.zip_code,
          city: c.city,
          state: c.state,
          address: c.address,
          district: c.district,
          number: c.number,
          complement: c.complement,
          product: '7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico',
          status_journey: (c.status_journey || 'compra') as JourneyState,
          sla_hours_left: typeof c.sla_hours_left === 'number' ? c.sla_hours_left : 24,
          is_overdue: !!c.is_overdue,
          assigned_consultant: c.assigned_consultant_id ? 'Consultora Designada' : 'Pendente',
          purchase_date: c.created_at || new Date().toISOString(),
          price_gross: 490.0,
          price_net: 441.0,
          diagnostic_status: c.status_journey === 'compra' ? 'pendente' : 'enviado',
          days_since_purchase: c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          commission_amount: 44.1,
        }));
        setClients(apiClients);
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchClientsFromApi();
  }, [fetchClientsFromApi]);

  // Carregar respostas de Diagnóstico em Tempo Real quando um cliente é selecionado
  React.useEffect(() => {
    if (!selectedClient || !selectedClient.email) return;

    async function loadDiagnostic() {
      setLoadingDiagnostic(true);
      try {
        const res = await fetch(`/api/diagnostics?email=${encodeURIComponent(selectedClient?.email || '')}`);
        if (res.ok) {
          const json = await res.json();
          setDiagnosticDetails(json);
        }
      } catch (err) {
        console.error('Erro ao carregar diagnóstico:', err);
      } finally {
        setLoadingDiagnostic(false);
      }
    }

    loadDiagnostic();
  }, [selectedClient]);

  const overdueCount = clients.filter((c) => c.is_overdue).length;

  // Paginacao Dinamica
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(10);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchQuery, pageSize]);

  const filteredClients = clients.filter((client) => {
    if (!client) return false;
    const name = client.name || '';
    const email = client.email || '';
    const product = client.product || '';
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'overdue') return matchesSearch && client.is_overdue;
    if (statusFilter !== 'todos') return matchesSearch && client.status_journey === statusFilter;
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredClients.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredClients.length);
  const paginatedClients = filteredClients.slice(startIndex, startIndex + pageSize);

  const handleStateChange = (clientId: string, newState: JourneyState) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status_journey: newState, is_overdue: false } : c))
    );
    if (selectedClient && selectedClient.id === clientId) {
      setSelectedClient((prev) => (prev ? { ...prev, status_journey: newState, is_overdue: false } : null));
    }
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !interactionSummary) return;

    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: selectedClient.id,
          channel: interactionChannel,
          summary: interactionSummary,
        }),
      });

      if (res.ok) {
        setInteractionSummary('');
        handleStateChange(selectedClient.id, 'acompanhamento');
        fetchClientsFromApi();
      }
    } catch (err) {
      console.error('Erro ao registrar interação:', err);
    }
  };

  const handleCreateManualClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName || !manualEmail) return;

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: manualName,
          email: manualEmail,
          phone: manualPhone,
          product_name: manualProduct,
        }),
      });

      if (res.ok) {
        setShowManualModal(false);
        setManualName('');
        setManualEmail('');
        setManualPhone('');
        fetchClientsFromApi();
      }
    } catch (err) {
      console.error('Erro ao criar cliente manual:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors">
      <Header currentRole={role} onRoleChange={setRole} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Metric Cards Banner using shadcn Card Component */}
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
                1.420
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Base sincronizada da Hotmart
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Em Atendimento
                </span>
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-50">
                18
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Fila operacional ativa
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Diagnósticos Enviados
                </span>
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                  <FileCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-50">
                5
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                Aguardando análise da equipe
              </p>
            </CardContent>
          </Card>

          <Card
            className={
              overdueCount > 0
                ? 'border-red-500 dark:border-red-500 overdue-pulse'
                : ''
            }
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  SLA Estourado (24h úteis)
                </span>
                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-red-600 dark:text-red-500">
                {overdueCount}
              </div>
              <p className="text-xs text-red-500 mt-1 font-medium">
                {overdueCount > 0 ? 'Ação necessária imediata!' : 'Nenhum atraso'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Action Controls & Filters using shadcn Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Quick Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <Button
              variant={statusFilter === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('todos')}
            >
              Todos ({clients.length})
            </Button>
            <Button
              variant={statusFilter === 'overdue' ? 'default' : 'destructive'}
              size="sm"
              onClick={() => setStatusFilter('overdue')}
              className="gap-1"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Atrasados ({overdueCount})</span>
            </Button>
            <Button
              variant={statusFilter === 'compra' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('compra')}
            >
              Novas Compras
            </Button>
            <Button
              variant={statusFilter === 'diagnostico_enviado' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('diagnostico_enviado')}
            >
              Diagnósticos
            </Button>
          </div>

          {/* Contingência Manual & Admin Controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {role === 'admin' && (
              <>
                {pendingDuplicates.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDuplicateModal(true)}
                    className="gap-1.5 animate-pulse"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{pendingDuplicates.length} Duplicidades</span>
                  </Button>
                )}
              </>
            )}

            <Button
              onClick={() => setShowManualModal(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Cliente Manual</span>
            </Button>
          </div>
        </div>

        {/* Fila de Atendimento Data Table using shadcn Table Component */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Filter className="w-4 h-4 text-red-500" />
              <span>Fila Operacional de Atendimento</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              SLA padrão: 24h úteis
            </span>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estado da Jornada</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>SLA Restante</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-500 text-xs font-medium">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedClients.map((client) => {
                  const labelInfo = JOURNEY_LABELS[client.status_journey];
                  return (
                    <TableRow
                      key={client.id}
                      onClick={() => setSelectedClient(client)}
                      className={client.is_overdue ? 'border-l-4 border-l-red-500 bg-red-500/5' : ''}
                    >
                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full font-semibold text-[11px] inline-flex items-center gap-1 ${labelInfo.bg} ${labelInfo.text}`}>
                          {labelInfo.label}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                        <div>{client.name}</div>
                        <div className="text-[11px] text-slate-400">{client.email}</div>
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300">
                        {client.product}
                      </TableCell>
                      <TableCell>
                        {client.is_overdue ? (
                          <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> ESTOURADO!
                          </span>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-400 font-medium">
                            {client.sla_hours_left}h úteis restantes
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-600 dark:text-slate-300 font-medium">
                        {client.assigned_consultant}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="secondary" size="sm" className="gap-1">
                          <span>Ver Ficha</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Barra Dinâmica de Paginação */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Itens por página:</span>
              <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                <SelectTrigger className="h-8 w-20 text-xs font-semibold">
                  <SelectValue placeholder="10" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-slate-500 dark:text-slate-400">
                Exibindo <strong>{filteredClients.length === 0 ? 0 : startIndex + 1}</strong> - <strong>{endIndex}</strong> de <strong>{filteredClients.length}</strong> clientes
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </Button>
              <span className="text-slate-600 dark:text-slate-300 font-bold px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="gap-1"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </main>

      {/* Drawer de Detalhes do Cliente usando shadcn Sheet Component */}
      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent side="right" className="p-0 flex flex-col sm:max-w-xl">
          {selectedClient && (
            <>
              {/* Sheet Header */}
              <SheetHeader className="p-6 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-red-500 uppercase tracking-wider">
                  Ficha Operacional do Cliente
                </span>
                <SheetTitle className="text-xl font-bold">
                  {selectedClient.name}
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedClient.email} • {selectedClient.phone}
                </SheetDescription>
              </SheetHeader>

              {/* State Selector with Radix/shadcn Select Component */}
              <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Alterar Estado da Jornada:
                </span>
                <Select
                  value={selectedClient.status_journey}
                  onValueChange={(val) => handleStateChange(selectedClient.id, val as JourneyState)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs font-semibold">
                    <SelectValue placeholder="Selecione Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra Efetuada</SelectItem>
                    <SelectItem value="diagnostico_enviado">Diagnóstico Enviado</SelectItem>
                    <SelectItem value="acompanhamento">Acompanhamento</SelectItem>
                    <SelectItem value="consulta_marcada">Consulta Marcada</SelectItem>
                    <SelectItem value="consulta_concluida">Consulta Concluída</SelectItem>
                    <SelectItem value="cancelamento">Cancelamento</SelectItem>
                    <SelectItem value="reembolso">Reembolso</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tabs using shadcn Tabs Component */}
              <Tabs defaultValue="perfil" className="flex-1 flex flex-col px-6">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="perfil">Perfil & Compras</TabsTrigger>
                  <TabsTrigger value="diagnostico">Diagnóstico & 7 Dias</TabsTrigger>
                  <TabsTrigger value="interacao">Registrar Contato</TabsTrigger>
                  {(role === 'admin' || role === 'consultant') && (
                    <TabsTrigger value="comissao">Comissão</TabsTrigger>
                  )}
                </TabsList>

                <div className="flex-1 overflow-y-auto pt-4 pb-6">
                  <TabsContent value="perfil" className="space-y-4 m-0">
                    <Card className="p-4 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-2">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Detalhes da Transação Hotmart
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-slate-400">Produto:</span>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedClient.product}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Valor Líquido:</span>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            R$ {selectedClient.price_net.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Data da Compra:</span>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {new Date(selectedClient.purchase_date).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Consultora Atribuída:</span>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {selectedClient.assigned_consultant}
                          </p>
                        </div>
                      </div>
                    </Card>

                    {/* Card de Endereço e Cadastro Completo (Hotmart Buyer Data) */}
                    <Card className="p-4 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3">
                      <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5" /> Endereço & Cadastro do Comprador (Hotmart)
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400">CPF / Documento:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClient.document || 'Não informado'}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">País:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClient.country || 'Brasil'}</p>
                        </div>
                        <div>
                          <span className="text-slate-400">Cidade / UF:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {selectedClient.city ? `${selectedClient.city} - ${selectedClient.state}` : 'Não informado'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">CEP / Zip Code:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClient.zip_code || 'Não informado'}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">Logradouro / Endereço:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {selectedClient.address ? `${selectedClient.address}, Nº ${selectedClient.number || 'S/N'}${selectedClient.complement ? ` (${selectedClient.complement})` : ''}` : 'Não informado'}
                          </p>
                        </div>
                        {selectedClient.district && (
                          <div className="col-span-2">
                            <span className="text-slate-400">Bairro / District:</span>
                            <p className="font-medium text-slate-900 dark:text-slate-100">{selectedClient.district}</p>
                          </div>
                        )}
                      </div>
                    </Card>

                    {/* Direct WhatsApp Action Button */}
                    <Button
                      variant="emerald"
                      className="w-full gap-2 shadow-md shadow-emerald-600/20"
                      onClick={() => {
                        window.open(`https://wa.me/${selectedClient.phone.replace(/[^0-9]/g, '')}`, '_blank');
                      }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Iniciar Conversa no WhatsApp Web</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </TabsContent>

                  <TabsContent value="diagnostico" className="space-y-4 text-xs m-0">
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 space-y-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4" /> Status do Diagnóstico: {diagnosticDetails?.status ? String(diagnosticDetails.status).toUpperCase() : selectedClient.diagnostic_status.toUpperCase()}
                      </span>
                      <p className="text-[11px] opacity-90">
                        {loadingDiagnostic ? (
                          'Carregando dados do diagnóstico no Supabase...'
                        ) : diagnosticDetails?.diagnosticSubmission ? (
                          `Diagnóstico enviado em ${new Date(diagnosticDetails.submitted_at).toLocaleDateString('pt-BR')} via formulário oficial.`
                        ) : (
                          'O diagnóstico é preenchido pelo cliente após a confirmação da compra.'
                        )}
                      </p>
                    </div>

                    {/* Exibir Respostas Reais do Diagnóstico quando disponíveis */}
                    {diagnosticDetails?.answers && Object.keys(diagnosticDetails.answers).length > 0 && (
                      <Card className="p-4 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-2">
                        <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                          <FileCheck className="w-3.5 h-3.5" /> Resumo das Respostas do Cliente
                        </h3>
                        <div className="space-y-2 text-xs max-h-48 overflow-y-auto pr-1">
                          {Object.entries(diagnosticDetails.answers).map(([key, val]: [string, any]) => (
                            <div key={key} className="border-b border-slate-200 dark:border-slate-800/60 pb-1.5">
                              <span className="text-slate-400 font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </Card>
                    )}

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 space-y-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Regra dos 7 Dias Pós-Compra (Garantia Hotmart)
                      </span>
                      <p className="text-[11px]">
                        {selectedClient.days_since_purchase >= 7 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Janela de 7 dias concluída ({selectedClient.days_since_purchase} dias passados). Agendamento liberado!
                          </span>
                        ) : (
                          <span>
                            Faltam <strong>{Math.max(0, 7 - selectedClient.days_since_purchase)} dias</strong> para liberar os resultados e o link de agendamento do Calendly.
                          </span>
                        )}
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="interacao" className="m-0">
                    <form onSubmit={handleAddInteraction} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Canal de Contato
                        </label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={interactionChannel === 'whatsapp' ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setInteractionChannel('whatsapp')}
                          >
                            WhatsApp
                          </Button>
                          <Button
                            type="button"
                            variant={interactionChannel === 'email' ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setInteractionChannel('email')}
                          >
                            E-mail
                          </Button>
                          <Button
                            type="button"
                            variant={interactionChannel === 'call' ? 'default' : 'outline'}
                            className="flex-1"
                            onClick={() => setInteractionChannel('call')}
                          >
                            Ligação
                          </Button>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                          Resumo da Interação
                        </label>
                        <Textarea
                          required
                          rows={4}
                          value={interactionSummary}
                          onChange={(e) => setInteractionSummary(e.target.value)}
                          placeholder="Descreva o que foi conversado ou orientação prestada ao cliente..."
                        />
                      </div>

                      <Button type="submit" className="w-full font-semibold">
                        Registrar Interação & Resetar SLA
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="comissao" className="m-0">
                    <Card className="p-4 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-500">Comissão Prevista:</span>
                        <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                          R$ {selectedClient.commission_amount.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Calculada automaticamente (10% do valor líquido) para a consultora {selectedClient.assigned_consultant}.
                      </p>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Contingência Manual Dialog usando shadcn Dialog Component */}
      <Dialog open={showManualModal} onOpenChange={setShowManualModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente Manual (Contingência)</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateManualClient} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold mb-1">Nome Completo *</label>
              <Input
                type="text"
                required
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Nome do cliente"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">E-mail *</label>
              <Input
                type="email"
                required
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Telefone (WhatsApp)</label>
              <Input
                type="text"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="+55 11 98765-4321"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Produto Hotmart</label>
              <Select value={manualProduct} onValueChange={setManualProduct}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione Produto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico">7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico</SelectItem>
                  <SelectItem value="Diagnóstico Migratório">Diagnóstico Migratório</SelectItem>
                  <SelectItem value="Consultoria Individual">Consultoria Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setShowManualModal(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cadastrar Cliente</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Gestão de Comissões (Exclusivo Admin) */}
      <Dialog open={showCommissionModal} onOpenChange={setShowCommissionModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <Shield className="w-5 h-5" /> Regras & Taxas de Comissão (Painel Admin)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Gerencie a porcentagem de comissão repassada às consultoras para cada produto cadastrado.
            </p>

            <div className="space-y-3">
              {commissionRules.map((rule: any, idx: number) => (
                <div
                  key={rule.id || idx}
                  className="p-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-bold text-slate-900 dark:text-slate-100">{rule.product_name}</p>
                    <span className="text-[11px] text-slate-400">Status: {rule.is_active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.5"
                      defaultValue={rule.commission_percentage}
                      className="w-20 h-8 text-right font-bold text-xs"
                      onBlur={async (e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          await fetch('/api/commissions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              product_name: rule.product_name,
                              commission_percentage: val,
                              user_role: role,
                            }),
                          });
                          fetchAdminData();
                        }
                      }}
                    />
                    <span className="font-bold text-slate-500">%</span>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => setShowCommissionModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Reconciliação de Duplicidades Pendentes */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" /> Reconciliação de Duplicidades Pendentes
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Os registros abaixo possuem o mesmo CPF ou Telefone em e-mails diferentes. Escolha a ação para manter a fila limpa.
            </p>

            <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
              {pendingDuplicates.map((dup: any, idx: number) => (
                <Card key={idx} className="p-4 border-red-500/20 bg-red-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" /> {dup.reason}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{dup.match_key}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    {dup.clients.map((c: any, i: number) => (
                      <div key={c.id || i} className="space-y-1">
                        <Badge variant="outline" className="text-[10px]">
                          {i === 0 ? 'Registro 1 (Mais antigo)' : 'Registro 2 (Recente)'}
                        </Badge>
                        <p className="font-bold text-slate-900 dark:text-slate-100">{c.name}</p>
                        <p className="text-[11px] text-slate-500">{c.email}</p>
                        <p className="text-[11px] text-slate-400">{c.phone || 'Sem telefone'}</p>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 justify-end pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await fetch('/api/duplicates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            primary_client_id: dup.clients[0].id,
                            secondary_client_id: dup.clients[1].id,
                            action: 'dismiss',
                            user_role: role,
                          }),
                        });
                        fetchAdminData();
                      }}
                    >
                      Manter Separados
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        await fetch('/api/duplicates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            primary_client_id: dup.clients[0].id,
                            secondary_client_id: dup.clients[1].id,
                            action: 'merge',
                            user_role: role,
                          }),
                        });
                        fetchAdminData();
                        fetchClientsFromApi();
                      }}
                    >
                      Mesclar Histórico de Vendas
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDuplicateModal(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
