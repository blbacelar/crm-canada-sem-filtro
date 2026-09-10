'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, User, LogOut, Activity, Sliders, BarChart3, X, Save } from 'lucide-react';
import { UserRole } from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';
import { fetchCurrentUser } from '@/lib/client-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface HeaderProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
  userEmail?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function Header({
  currentRole = 'admin',
  onRoleChange,
  userEmail = 'admin@canadasemfiltro.com',
  searchQuery = '',
  onSearchChange,
}: HeaderProps) {
  const [activeRole, setActiveRole] = React.useState<UserRole>(currentRole);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [profileEditing, setProfileEditing] = React.useState(false);
  const [profileEmail, setProfileEmail] = React.useState(userEmail);
  const [profileName, setProfileName] = React.useState('');
  const [profileSurname, setProfileSurname] = React.useState('');
  const [profileError, setProfileError] = React.useState<string | null>(null);
  const [savingProfile, setSavingProfile] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setActiveRole(currentRole);
  }, [currentRole]);

  React.useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (!user) return;
      setProfileEmail(user.email || userEmail);
      setProfileName(user.name || '');
      setProfileSurname(user.surname || '');
    });
  }, [userEmail]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRoleSelect = (role: UserRole) => {
    setActiveRole(role);
    if (onRoleChange) {
      onRoleChange(role);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName, surname: profileSurname }),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setProfileError(null);
        setProfileEditing(false);
      } else {
        setProfileError(payload.error || 'Não foi possível salvar o perfil.');
      }
    } catch {
      setProfileError('Não foi possível conectar ao servidor para salvar o perfil.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-[104px] sm:min-h-[136px] flex items-center gap-6 py-2">
        {/* Brand Logo & Title */}
        <div className="flex min-w-0 shrink-0 items-center">
          <Link
            href="/"
            aria-label="Ir para o início — Canadá Sem Filtro"
            className="relative block h-16 w-[220px] overflow-hidden transition-transform hover:scale-105 sm:h-20 sm:w-[280px] lg:h-24 lg:w-[320px]"
          >
            <Image
              src="/logo.png"
              alt="Canadá Sem Filtro — Central de Atendimento CRM"
              fill
              sizes="(max-width: 639px) 220px, (max-width: 1023px) 280px, 320px"
              className="object-cover object-center"
              priority
            />
          </Link>
        </div>

        {/* Search Bar with Input Component */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
            <Input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              placeholder="Pesquisar cliente, e-mail ou transação... (Cmd + K)"
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  if (onSearchChange) onSearchChange('');
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10"
                title="Limpar pesquisa"
                aria-label="Limpar pesquisa"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="ml-auto flex items-center gap-3">
          {/* Analytics BI Button */}
          {['admin', 'marketing', 'tech'].includes(activeRole) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = '/analytics';
              }}
              className="gap-1.5 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 text-xs"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Analytics BI</span>
            </Button>
          )}

          {/* Webhook Status Indicator Badge */}
          <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1">
            <Activity className="w-3 h-3 animate-pulse" />
            <span className="hidden sm:inline">Hotmart OK</span>
          </Badge>

          {/* User Profile & Active Role Badge / Logout Button */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-label="Abrir menu do perfil"
                className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:text-blue-600 transition-colors"
                title={userEmail}
              >
                <span aria-hidden="true">
                  {([profileName, profileSurname].filter(Boolean).map((part) => part[0]).join('') || profileEmail?.[0] || 'U').slice(0, 2).toUpperCase()}
                </span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-11 z-50 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  <div className="border-b border-slate-200 px-3 pb-2 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        {([profileName, profileSurname].filter(Boolean).map((part) => part[0]).join('') || profileEmail?.[0] || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {[profileName, profileSurname].filter(Boolean).join(' ') || profileEmail?.split('@')[0] || 'Usuário autenticado'}
                        </p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{profileEmail}</p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {activeRole === 'admin' ? 'Administrador(a)' : activeRole === 'consultant' ? 'Consultor(a)' : activeRole === 'tech' ? 'Tecnologia' : 'Marketing'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setProfileEditing((editing) => !editing)} className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <User className="h-3.5 w-3.5" /> Editar perfil
                  </button>
                  {profileEditing && (
                    <div className="space-y-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
                      <input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Nome" className="h-8 w-full rounded-md border border-slate-300 bg-transparent px-2 text-xs dark:border-slate-700" />
                      <input value={profileSurname} onChange={(event) => setProfileSurname(event.target.value)} placeholder="Sobrenome" className="h-8 w-full rounded-md border border-slate-300 bg-transparent px-2 text-xs dark:border-slate-700" />
                      {profileError && <p className="text-[11px] text-red-600 dark:text-red-400">{profileError}</p>}
                      <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"><Save className="h-3.5 w-3.5" /> {savingProfile ? 'Salvando...' : 'Salvar perfil'}</button>
                    </div>
                  )}
                  {activeRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => { window.location.href = '/settings'; }}
                      className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Sliders className="h-3.5 w-3.5" />
                      Configurações da conta
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      await createClient().auth.signOut();
                      localStorage.removeItem('crm_user_role');
                      localStorage.removeItem('crm_user_email');
                      localStorage.removeItem('crm_user_name');
                      window.location.href = '/login';
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Encerrar sessão
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}
