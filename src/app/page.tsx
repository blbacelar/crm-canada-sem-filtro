'use client';

import * as React from 'react';
import { Header } from '@/components/header';
import {
  FileCheck,
  AlertTriangle,
  Filter,
  MessageSquare,
  DollarSign,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Shield,
  Eye,
  EyeOff,
  Copy,
  Check,
  UserRound,
  RefreshCw,
} from 'lucide-react';
import { UserRole, JourneyState } from '@/types/database.types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  DialogDescription,
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
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { MockClient } from '@/components/crm/types';
import { OperationalSummary } from '@/components/crm/operational-summary';
import { OperationalQueueTable } from '@/components/crm/operational-queue-table';
import { ConsultationControl } from '@/components/crm/consultation-control';
import { fetchCurrentUser } from '@/lib/client-auth';

function normalizeWhatsappHistory(history: any) {
  if (!history) return [];
  if (history.totalMessages === 0 || (Array.isArray(history.history) && history.history.length === 0) || history.history?.totalMessages === 0 || (Array.isArray(history.history?.history) && history.history.history.length === 0)) return [];
  if (Array.isArray(history) && history.length === 1 && (history[0]?.totalMessages === 0 || (Array.isArray(history[0]?.history) && history[0].history.length === 0))) return [];
  const candidates = [
    history?.data,
    history?.data?.messages,
    history?.response?.messages?.records,
    history?.messages,
    history?.history,
    history,
  ];
  const source = candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0) || [];
  return source.map((item: any, index: number) => {
    const key = item?.key || {};
    const message = item?.message || item;
    const timestamp = Number(item?.messageTimestamp || item?.timestamp || item?.createdAt || 0);
    const date = timestamp
      ? new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp)
      : (item?.created_at ? new Date(item.created_at) : null);
    return {
      id: String(key.id || item?.id || `message-${index}`),
      fromMe: Boolean(key.fromMe ?? item?.fromMe ?? item?.from_me),
      sender: item?.pushName || item?.senderName || item?.sender || (Boolean(key.fromMe ?? item?.fromMe) ? 'CRM' : 'Cliente'),
      text: message?.conversation
        || message?.extendedTextMessage?.text
        || message?.text
        || message?.body
        || message?.caption
        || null,
      type: item?.messageType || item?.type || Object.keys(message || {})[0] || 'Mensagem',
      date: date && !Number.isNaN(date.getTime()) ? date : null,
      raw: item,
    };
  }).sort((left: any, right: any) => (left.date?.getTime() || 0) - (right.date?.getTime() || 0));
}

const diagnosticStatusLabels: Record<string, string> = {
  CLIENT_DRAFT: 'RASCUNHO DO CLIENTE',
  DRAFT: 'RASCUNHO',
  SUBMITTED: 'ENVIADO',
  APPROVED: 'APROVADO',
  REJECTED: 'REPROVADO',
  PENDING: 'PENDENTE',
  NOT_SENT: 'NÃO ENVIADO',
  NOT_STARTED: 'NÃO INICIADO',
};

const diagnosticAnswerLabels: Record<string, string> = {
  age: 'Idade',
  overstay: 'Permaneceu além do prazo',
  city_size: 'Tamanho da cidade',
  city_size_preference: 'Preferência de tamanho da cidade',
  french_test: 'Teste de francês',
  english_test: 'Teste de inglês',
  english_level: 'Nível de inglês',
  french_level: 'Nível de francês',
  family: 'Família',
  profession: 'Profissão',
  education: 'Escolaridade',
};

const diagnosticValueLabels: Record<string, string> = {
  yes: 'Sim',
  no: 'Não',
  true: 'Sim',
  false: 'Não',
  small: 'Pequena',
  medium: 'Média',
  large: 'Grande',
};

function translateDiagnosticStatus(status: unknown) {
  const normalized = String(status || '').trim().toUpperCase();
  return diagnosticStatusLabels[normalized] || normalized.replace(/_/g, ' ') || 'NÃO INFORMADO';
}

function translateDiagnosticAnswer(key: string, value: unknown) {
  const label = diagnosticAnswerLabels[key.toLowerCase()] || key.replace(/_/g, ' ');
  if (typeof value !== 'string') return { label, value };
  const translatedValue = diagnosticValueLabels[value.trim().toLowerCase()] || value;
  return { label, value: translatedValue };
}

// Mock de dados para demonstração da Fila Operacional
export default function HomePage() {
  const [role, setRole] = React.useState<UserRole>('consultant');
  const [userEmail, setUserEmail] = React.useState<string>('');
  const [authReady, setAuthReady] = React.useState(false);
  const [clients, setClients] = React.useState<MockClient[]>([]);
  const [attendants, setAttendants] = React.useState<Array<{ id: string; name: string; email: string }>>([]);

  React.useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (!user) return;
      setRole(user.role as UserRole);
      setUserEmail(user.email || '');
      setAuthReady(true);
    });
  }, []);

  React.useEffect(() => {
    if (!authReady) return;
    fetch('/api/attendants', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((json) => setAttendants(json?.attendants || []))
      .catch((error) => console.error('Erro ao carregar atendentes:', error));
  }, [authReady]);
  const [selectedClient, setSelectedClient] = React.useState<MockClient | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<string>('todos');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [showManualModal, setShowManualModal] = React.useState<boolean>(false);
  const [showCommissionModal, setShowCommissionModal] = React.useState<boolean>(false);
  const [showDuplicateModal, setShowDuplicateModal] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState<number>(1);
  const [pageSize, setPageSize] = React.useState<number>(10);
  const [totalClientCount, setTotalClientCount] = React.useState<number>(0);
  const [summaryCounts, setSummaryCounts] = React.useState({ inService: 0, diagnostics: 0, overdue: 0 });

  // Commission & Duplicates state
  const [commissionRules, setCommissionRules] = React.useState<any[]>([]);
  const [pendingDuplicates, setPendingDuplicates] = React.useState<any[]>([]);
  const [selectedDuplicate, setSelectedDuplicate] = React.useState<any>(null);

  // Diagnostic Realtime State
  const [diagnosticDetails, setDiagnosticDetails] = React.useState<any>(null);
  const [loadingDiagnostic, setLoadingDiagnostic] = React.useState<boolean>(false);
  const [whatsappHistory, setWhatsappHistory] = React.useState<any>(null);
  const [loadingWhatsappHistory, setLoadingWhatsappHistory] = React.useState(false);
  const [whatsappHistoryError, setWhatsappHistoryError] = React.useState<string | null>(null);
  const [showWhatsappHistoryModal, setShowWhatsappHistoryModal] = React.useState(false);

  // Form states
  const [interactionChannel, setInteractionChannel] = React.useState<'whatsapp' | 'email' | 'call'>('whatsapp');
  const [interactionSummary, setInteractionSummary] = React.useState('');
  const [manualName, setManualName] = React.useState('');
  const [manualEmail, setManualEmail] = React.useState('');
  const [manualPhone, setManualPhone] = React.useState('');
  const [manualProduct, setManualProduct] = React.useState('7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico');
  const [revealSensitiveData, setRevealSensitiveData] = React.useState(false);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
    if (role !== 'admin') return;
    fetchAdminData();
  }, [role, fetchAdminData]);

  // Carregar lista de clientes do banco oficial Supabase via API
  const fetchClientsFromApi = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        limit: String(pageSize),
        offset: String((currentPage - 1) * pageSize),
        status: statusFilter,
      });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/clients?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(json.error || 'Não foi possível carregar os clientes.');
        return;
      }

      setLoadError(null);
      const rawList = json.clients || [];
        setTotalClientCount(Number(json.total) || rawList.length);
        setSummaryCounts(json.summary || {
          inService: rawList.filter((client: any) => ['compra', 'diagnostico_enviado', 'acompanhamento'].includes(client.status_journey)).length,
          diagnostics: rawList.filter((client: any) => client.status_journey === 'diagnostico_enviado').length,
          overdue: rawList.filter((client: any) => client.is_overdue).length,
        });
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
          product: c.product_name || '7 Vídeo Aulas + E-book + Diário de Bordo + Diagnóstico',
          status_journey: (c.status_journey || c.effective_status_journey || 'compra') as JourneyState,
          sla_hours_left: typeof c.sla_hours_left === 'number' ? c.sla_hours_left : 24,
          is_overdue: !!c.is_overdue,
          assigned_consultant_id: c.assigned_consultant_id || null,
          assigned_consultant: c.assigned_consultant_name || (c.assigned_consultant_id ? 'Atendente Designado' : 'Pendente'),
          purchase_date: c.purchase_date || c.created_at || new Date().toISOString(),
          price_gross: typeof c.price_gross === 'number' ? c.price_gross : 197.0,
          price_net: typeof c.price_net === 'number' ? c.price_net : 169.20,
          diagnostic_status: c.diagnostic_status || (c.status_journey === 'compra' ? 'pendente' : 'enviado'),
          days_since_purchase: c.created_at ? Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          consultation_booked: Boolean(c.consultation_booked),
          consultation_status: c.consultation_status || null,
          consultation_date: c.consultation_date || null,
          consultation_value: typeof c.consultation_value === 'number' ? c.consultation_value : null,
          consultation_commission_percentage: typeof c.consultation_commission_percentage === 'number' ? c.consultation_commission_percentage : null,
          consultation_company_return_amount: typeof c.consultation_company_return_amount === 'number' ? c.consultation_company_return_amount : null,
          consultation_consultant_name: c.consultation_consultant_name || null,
      }));
      setClients(apiClients);
      // Atualizar o cliente atualmente aberto no drawer com os dados mais recentes do Supabase
      setSelectedClient((prev) => {
        if (!prev) return null;
        const updated = apiClients.find((c) => c.id === prev.id || c.email.toLowerCase() === prev.email.toLowerCase());
        return updated || prev;
      });
    } catch (err) {
      console.error('Erro ao carregar clientes:', err);
      setLoadError('Não foi possível conectar ao serviço de clientes.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, statusFilter]);

  React.useEffect(() => {
    if (!authReady) return;
    fetchClientsFromApi();
  }, [authReady, fetchClientsFromApi]);

  React.useEffect(() => {
    const supabase = createSupabaseClient();
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let channel: any = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      channel = supabase
        .channel('crm-client-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
          void fetchClientsFromApi();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => {
          void fetchClientsFromApi();
        });

      channel.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = undefined;
          return;
        }
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') && !reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            const failedChannel = channel;
            channel = null;
            if (failedChannel) {
              void supabase.removeChannel(failedChannel).finally(connect);
            } else {
              connect();
            }
          }, 1500);
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchClientsFromApi]);

  React.useEffect(() => {
    if (!selectedClient) {
      setWhatsappHistory(null);
      setWhatsappHistoryError(null);
      return;
    }
    setWhatsappHistory(null);
    setWhatsappHistoryError(null);
  }, [selectedClient?.id]);

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

  const totalPages = Math.ceil(totalClientCount / pageSize) || 1;
  const paginatedClients = filteredClients;

  const handleStateChange = async (clientId: string, newState: JourneyState) => {
    const response = await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, status_journey: newState }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error(payload.error || 'Não foi possível alterar o estado da jornada.');
      return;
    }

    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, status_journey: newState, is_overdue: false } : c))
    );
    if (selectedClient && selectedClient.id === clientId) {
      setSelectedClient((prev) => (prev ? { ...prev, status_journey: newState, is_overdue: false } : null));
    }
  };

  const handleAttendantChange = async (clientId: string, attendantId: string) => {
    const assigned_consultant_id = attendantId === 'unassigned' ? null : attendantId;
    const response = await fetch('/api/clients', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, assigned_consultant_id }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      console.error(payload.error || 'Não foi possível associar o atendente.');
      return;
    }
    const attendant = attendants.find((item) => item.id === assigned_consultant_id);
    const assigned_consultant = attendant?.name || (assigned_consultant_id ? 'Atendente Designado' : 'Pendente');
    setClients((prev) => prev.map((client) => client.id === clientId
      ? { ...client, assigned_consultant_id, assigned_consultant }
      : client));
    setSelectedClient((prev) => prev?.id === clientId ? { ...prev, assigned_consultant_id, assigned_consultant } : prev);
  };

  const handleFetchWhatsappHistory = async (openModal = true) => {
    if (!selectedClient?.phone) return;
    const digits = selectedClient.phone.replace(/\D/g, '');
    if (!digits) {
      setWhatsappHistoryError('Este cliente não possui um telefone válido.');
      return;
    }
    const remoteJid = `${digits}@s.whatsapp.net`;
    setLoadingWhatsappHistory(true);
    setWhatsappHistoryError(null);
    try {
      const response = await fetch('/api/whatsapp/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remoteJid }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setWhatsappHistoryError(payload.error || 'Não foi possível buscar o histórico desta conversa.');
        return;
      }
      setWhatsappHistory(payload.history);
      if (openModal) setShowWhatsappHistoryModal(true);
    } catch (error) {
      console.error('Erro ao buscar histórico WhatsApp:', error);
      setWhatsappHistoryError('Não foi possível conectar ao serviço de histórico.');
    } finally {
      setLoadingWhatsappHistory(false);
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

  const whatsappMessages = React.useMemo(() => normalizeWhatsappHistory(whatsappHistory), [whatsappHistory]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 transition-colors">
      <Header
        currentRole={role}
        userEmail={userEmail}
        onRoleChange={setRole}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {loadError && (
          <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
            <CardContent className="flex items-start gap-3 p-4 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Não foi possível carregar os dados</p>
                <p className="mt-1">{loadError}</p>
                <p className="mt-2 text-xs opacity-80">Confirme a sessão ativa e se a migration de segurança foi executada no projeto Supabase.</p>
              </div>
            </CardContent>
          </Card>
        )}
        <OperationalSummary
          clients={clients}
          totalClientCount={totalClientCount}
          inServiceCount={summaryCounts.inService}
          diagnosticsCount={summaryCounts.diagnostics}
          loading={loading}
          overdueCount={summaryCounts.overdue}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          role={role}
          pendingDuplicatesCount={pendingDuplicates.length}
          onOpenDuplicates={() => setShowDuplicateModal(true)}
          onOpenManualClient={() => setShowManualModal(true)}
        />

        <OperationalQueueTable
          clients={paginatedClients}
          loading={loading}
          totalClientCount={totalClientCount}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          onSelectClient={setSelectedClient}
        />
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
                <SheetDescription className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mt-1">
                  {/* Email Box com Copiar */}
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-medium">
                    <span>{selectedClient.email}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedClient.email, 'email')}
                      className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                      title="Copiar E-mail"
                      aria-label="Copiar E-mail"
                    >
                      {copiedField === 'email' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500 animate-in fade-in" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </span>

                  {/* Phone Box com Copiar */}
                  {selectedClient.phone && (
                    <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 font-medium">
                      <span>{selectedClient.phone}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(selectedClient.phone, 'phone')}
                        className="p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 transition-colors"
                        title="Copiar Telefone"
                        aria-label="Copiar Telefone"
                      >
                        {copiedField === 'phone' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500 animate-in fade-in" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </span>
                  )}
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
                  <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
                  <TabsTrigger value="interacao">Registrar Contato</TabsTrigger>
                  {(role === 'admin' || role === 'consultant') && (
                    <TabsTrigger value="comissao">Consultoria</TabsTrigger>
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
                          <span className="text-slate-400">Atendente responsável:</span>
                          {role === 'admin' ? (
                            <Select
                              value={selectedClient.assigned_consultant_id || 'unassigned'}
                              onValueChange={(value) => handleAttendantChange(selectedClient.id, value)}
                            >
                              <SelectTrigger className="mt-1 h-8 text-xs font-semibold">
                                <SelectValue placeholder="Selecionar atendente" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Sem atendente</SelectItem>
                                {attendants.map((attendant) => (
                                  <SelectItem key={attendant.id} value={attendant.id}>
                                    {attendant.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <UserRound className="w-3.5 h-3.5" /> {selectedClient.assigned_consultant}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* Card de Endereço e Cadastro Completo (Hotmart Buyer Data) */}
                    <Card className="p-4 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Filter className="w-3.5 h-3.5" /> Endereço & Cadastro do Comprador (Hotmart)
                        </h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRevealSensitiveData(!revealSensitiveData)}
                          className="h-7 px-2.5 text-xs border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 font-medium transition-all"
                          title={revealSensitiveData ? "Ocultar Dados PII" : "Revelar Dados Sensíveis (PIPEDA)"}
                        >
                          {revealSensitiveData ? (
                            <>
                              <EyeOff className="w-3.5 h-3.5 text-red-500" />
                              <span>Ocultar PII</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3.5 h-3.5 text-blue-500" />
                              <span>Revelar Dados</span>
                            </>
                          )}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-400">CPF / Documento:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {revealSensitiveData
                              ? selectedClient.document || 'Não informado'
                              : selectedClient.document
                              ? '•••••••••••'
                              : 'Não informado'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">País:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {revealSensitiveData
                              ? selectedClient.country || 'Brasil'
                              : selectedClient.country
                              ? '••••••••'
                              : 'Brasil'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">Cidade / UF:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {revealSensitiveData
                              ? selectedClient.city
                                ? `${selectedClient.city} - ${selectedClient.state}`
                                : 'Não informado'
                              : selectedClient.city
                              ? '••••••••••••'
                              : 'Não informado'}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-400">CEP / Zip Code:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {revealSensitiveData
                              ? selectedClient.zip_code || 'Não informado'
                              : selectedClient.zip_code
                              ? '••••••••'
                              : 'Não informado'}
                          </p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-400">Logradouro / Endereço:</span>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {revealSensitiveData
                              ? selectedClient.address
                                ? `${selectedClient.address}, Nº ${selectedClient.number || 'S/N'}${selectedClient.complement ? ` (${selectedClient.complement})` : ''}`
                                : 'Não informado'
                              : selectedClient.address
                              ? '••••••••••••••••••••••••••••••••'
                              : 'Não informado'}
                          </p>
                        </div>
                        {selectedClient.district && (
                          <div className="col-span-2">
                            <span className="text-slate-400">Bairro:</span>
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {revealSensitiveData
                                ? selectedClient.district
                                : '••••••••••••'}
                            </p>
                          </div>
                        )}
                      </div>
                    </Card>

                  </TabsContent>

                  <TabsContent value="whatsapp" className="m-0 flex min-h-[520px] flex-col gap-3">
                    <Card className="flex min-h-[520px] flex-col overflow-hidden border-emerald-500/20">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-emerald-500/5 p-4 dark:border-slate-800">
                        <div>
                          <h3 className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                            <MessageSquare className="h-4 w-4" /> Conversa pelo WhatsApp
                          </h3>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Histórico e mensagens deste cliente.
                          </p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => void handleFetchWhatsappHistory(false)} disabled={loadingWhatsappHistory || !selectedClient.phone} className="gap-1.5">
                          <RefreshCw className={`h-3.5 w-3.5 ${loadingWhatsappHistory ? 'animate-spin' : ''}`} />
                          Atualizar
                        </Button>
                      </div>
                      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-100/70 p-4 dark:bg-slate-950">
                        {whatsappHistoryError && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-600">{whatsappHistoryError}</p>}
                        {whatsappHistory === null && !whatsappHistoryError ? (
                          <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
                            <MessageSquare className="h-8 w-8 text-slate-300" />
                            <span>Busque o histórico para iniciar a conversa.</span>
                            <Button type="button" size="sm" onClick={() => void handleFetchWhatsappHistory(false)} disabled={loadingWhatsappHistory || !selectedClient.phone}>
                              {loadingWhatsappHistory ? 'Buscando...' : 'Buscar histórico'}
                            </Button>
                          </div>
                        ) : whatsappMessages.length === 0 && !whatsappHistoryError ? (
                          <div className="flex h-full min-h-64 items-center justify-center text-center text-sm text-slate-500">Não há histórico de chat para este cliente.</div>
                        ) : whatsappMessages.map((message: any) => (
                          <div key={message.id} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm ${message.fromMe ? 'rounded-br-sm bg-emerald-600 text-white' : 'rounded-bl-sm border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'}`}>
                              <div className={`mb-1 flex items-center justify-between gap-3 text-[10px] ${message.fromMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                                <span className="font-semibold">{message.sender}</span>
                                <span>{message.date ? message.date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data não informada'}</span>
                              </div>
                              <p className="whitespace-pre-wrap break-words text-sm">{message.text || `[${message.type}]`}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-200 bg-white p-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                        O WhatsApp está disponível apenas para consulta do histórico nesta etapa.
                      </div>
                    </Card>
                  </TabsContent>

                  <TabsContent value="diagnostico" className="space-y-4 text-xs m-0">
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 space-y-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <FileCheck className="w-4 h-4" /> Status do Diagnóstico: {translateDiagnosticStatus(diagnosticDetails?.status || selectedClient.diagnostic_status)}
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
                          {Object.entries(diagnosticDetails.answers).map(([key, val]: [string, any]) => {
                            const translated = translateDiagnosticAnswer(key, val);
                            return (
                              <div key={key} className="border-b border-slate-200 dark:border-slate-800/60 pb-1.5">
                                <span className="text-slate-400 font-medium">{translated.label}:</span>
                                <p className="font-medium text-slate-900 dark:text-slate-100">
                                  {typeof translated.value === 'object' ? JSON.stringify(translated.value) : String(translated.value)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    )}

                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-300 space-y-1">
                      <span className="font-bold flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" /> Regra dos 7 Dias Pós-Compra (Garantia Hotmart)
                      </span>
                      <p className="text-[11px]">
                        {diagnosticDetails?.consultationUnlocked ? (
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
                    <ConsultationControl
                      clientId={selectedClient.id}
                      role={role}
                      assignedConsultantId={selectedClient.assigned_consultant_id}
                      attendants={attendants}
                      onSaved={() => void fetchClientsFromApi()}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={showWhatsappHistoryModal} onOpenChange={setShowWhatsappHistoryModal}>
        <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 py-4 pr-16 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-emerald-500" /> Histórico de conversa
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {selectedClient?.name} · {selectedClient?.phone || 'Telefone não informado'}
                </DialogDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleFetchWhatsappHistory()} disabled={loadingWhatsappHistory} className="gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingWhatsappHistory ? 'animate-spin' : ''}`} /> Atualizar
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-slate-100/70 dark:bg-slate-950 p-5 space-y-3">
            {whatsappMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                <span>Não há histórico de chat para este cliente.</span>
              </div>
            ) : whatsappMessages.map((message: any) => (
              <div key={message.id} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 shadow-sm ${message.fromMe ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-sm border border-slate-200 dark:border-slate-700'}`}>
                  <div className={`flex items-center justify-between gap-4 text-[10px] mb-1 ${message.fromMe ? 'text-emerald-100' : 'text-slate-400'}`}>
                    <span className="font-semibold">{message.sender}</span>
                    <span>{message.date ? message.date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Data não informada'}</span>
                  </div>
                  {message.text ? (
                    <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{message.type}</p>
                      <details className="text-[10px] opacity-80">
                        <summary className="cursor-pointer">Ver dados da mensagem</summary>
                        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap">{JSON.stringify(message.raw, null, 2)}</pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
              Gerencie o percentual do valor das consultorias destinado ao Canadá Sem Filtro.
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
