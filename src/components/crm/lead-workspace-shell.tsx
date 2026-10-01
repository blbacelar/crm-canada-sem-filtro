'use client';

import * as React from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const navigation = [
  { number: '01', label: 'Visão geral', href: '/' },
  { number: '02', label: 'Leads', href: '/leads' },
  { number: '03', label: 'Compras', href: '/hotmart' },
  { number: '04', label: 'Indicadores', href: '/analytics' },
  { number: '05', label: 'Configurações', href: '/settings' },
];

export function LeadWorkspaceShell({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const [signingOut, setSigningOut] = React.useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await createClient().auth.signOut();
    } finally {
      window.location.assign('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f7f8] text-[#23313a] lg:flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Ir para o conteúdo</a>
      <aside className="border-b border-[#d4e0e4] bg-[#f8fbfc] lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-48 lg:shrink-0 lg:flex-col lg:border-b-0 lg:border-r">
        <div className="border-b border-[#d4e0e4] px-5 py-6">
          <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#c23b5b]">CRM exclusivo</span>
          <strong className="mt-1 block font-serif text-lg font-normal leading-tight text-[#26313a]">Canadá Sem Filtro</strong>
          <span className="mt-2 block text-[9px] font-semibold uppercase tracking-[0.18em] text-[#69808b]">Central de relacionamento</span>
        </div>
        <nav aria-label="Principal" className="flex gap-1 overflow-x-auto p-3 lg:mt-5 lg:flex-col">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} aria-current={item.href === '/leads' ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${item.href === '/leads'
                ? 'bg-[#23242d] text-white shadow-sm' : 'text-[#5f7480] hover:bg-[#e8eff2] hover:text-[#27343c]'}`}>
              <span className="text-[9px] font-bold opacity-70">{item.number}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden border-t border-[#d4e0e4] px-5 py-5 text-[10px] text-[#637985] lg:block">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#2b8a68]" />Ambiente protegido
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[#d4e0e4] bg-[#edf4f6] px-5 py-3 sm:px-8">
          <div><span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#81949d]">Operação Canadá Sem Filtro</span>
            <strong className="text-xs font-semibold text-[#364852]">Leads · comunicações · clientes</strong></div>
          <div className="flex items-center gap-3 text-xs text-[#637985]">
            <span className="hidden max-w-48 truncate sm:inline" title={userEmail}>{userEmail}</span>
            <button type="button" onClick={signOut} disabled={signingOut} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-[#dfe9ed] disabled:opacity-50">
              <LogOut className="h-3.5 w-3.5" /> Sair
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-8"
          style={{ backgroundImage: 'linear-gradient(#dfe9ec55 1px, transparent 1px), linear-gradient(90deg, #dfe9ec55 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          <div className="mx-auto max-w-[1340px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
