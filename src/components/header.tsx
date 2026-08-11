'use client';

import * as React from 'react';
import { Search, Shield, User, LogOut, Activity, Compass, Sliders, BarChart3 } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserRole } from '@/types/database.types';
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
}

export function Header({
  currentRole = 'admin',
  onRoleChange,
  userEmail = 'admin@canadasemfiltro.com',
}: HeaderProps) {
  const [activeRole, setActiveRole] = React.useState<UserRole>(currentRole);

  const handleRoleSelect = (role: UserRole) => {
    setActiveRole(role);
    if (onRoleChange) {
      onRoleChange(role);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold shadow-md shadow-red-600/20">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-slate-50 leading-tight">
              Canadá Sem Filtro
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Central de Atendimento CRM
            </p>
          </div>
        </div>

        {/* Search Bar with Input Component */}
        <div className="flex-1 max-w-md hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
            <Input
              type="text"
              placeholder="Pesquisar cliente, e-mail ou transação... (Cmd + K)"
              className="pl-9"
            />
          </div>
        </div>

        {/* Right Action Tools */}
        <div className="flex items-center gap-3">
          {/* Role Simulator using shadcn Select Component */}
          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-xs">
            <Shield className="w-3.5 h-3.5 text-red-500" />
            <span className="text-slate-500 dark:text-slate-400 font-medium">Role:</span>
            <Select value={activeRole} onValueChange={(val) => handleRoleSelect(val as UserRole)}>
              <SelectTrigger className="h-7 w-[140px] bg-transparent border-0 shadow-none focus:ring-0 p-0 text-xs font-semibold">
                <SelectValue placeholder="Selecione Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administradora</SelectItem>
                <SelectItem value="consultant">Consultora</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="tech">TI / Suporte</SelectItem>
              </SelectContent>
            </Select>
          </div>

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

          {/* Admin Settings Button */}
          {activeRole === 'admin' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.location.href = '/settings';
              }}
              className="gap-1.5 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 text-xs"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Configurações</span>
            </Button>
          )}

          {/* Webhook Status Indicator Badge */}
          <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 gap-1.5 py-1">
            <Activity className="w-3 h-3 animate-pulse" />
            <span className="hidden sm:inline">Hotmart OK</span>
          </Badge>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Profile / Logout Button */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <div
              className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-300 dark:border-slate-700"
              title={userEmail}
            >
              <User className="w-4 h-4" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                window.location.href = '/login';
              }}
              title="Encerrar Sessão"
            >
              <LogOut className="w-4 h-4 text-slate-400 hover:text-red-500" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
