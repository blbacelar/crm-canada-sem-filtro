'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Compass,
  User,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserRole } from '@/types/database.types';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<'login' | 'register'>('login');

  // Form States
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [showLoginPassword, setShowLoginPassword] = React.useState(false);
  // Status & Error
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [pendingApproval, setPendingApproval] = React.useState(false);
  const [forgotPassword, setForgotPassword] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState('');
  const [resetSent, setResetSent] = React.useState(false);

  const supabase = createClient();

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetError) {
        setError(resetError.message || 'Erro ao enviar e-mail de recuperação.');
      } else {
        setResetSent(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Tentar autenticação no Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setError('E-mail ou senha incorretos. Verifique suas credenciais.');
        return;
      }

      if (data?.user) {
        const userStatus = data.user.user_metadata?.status;
        const userMetadataRole = (data.user.user_metadata?.role as UserRole) || 'consultant';

        // Bloquear acesso se status ainda for 'pending'
        if (userStatus === 'pending') {
          // Sign out immediately — access denied until admin approves
          await supabase.auth.signOut();
          setPendingApproval(true);
          return;
        }

        localStorage.setItem('crm_user_email', data.user.email || email.trim());
        localStorage.setItem('crm_user_role', userMetadataRole);
        localStorage.setItem('crm_user_name', data.user.user_metadata?.name || '');

        setSuccess('Login efetuado com sucesso! Redirecionando...');
        setTimeout(() => router.push('/'), 600);
      }
    } catch (err: any) {
      setError(err.message || 'Falha ao autenticar no servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Por favor, informe seu nome completo.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      setLoading(false);
      return;
    }

    try {
      // Criar usuário com status=pending — acesso liberado apenas após aprovação do Admin
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
            role: 'consultant',        // papel padrão, admin pode alterar depois
            status: 'pending',         // BLOQUEADO até aprovação administrativa
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message || 'Erro ao cadastrar novo operador no Supabase.');
        return;
      }

      // NÃO redirecionar — mostrar tela de aguardo de aprovação
      setSuccess(
        `Solicitação enviada com sucesso, ${name}! Sua conta está aguardando aprovação de um Administrador. Você receberá acesso assim que for aprovado.`
      );
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro ao criar a conta.');
    } finally {
      setLoading(false);
    }
  };

  // Tela de Acesso Pendente — usuário autenticado mas ainda não aprovado pelo Admin
  if (pendingApproval) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <Card className="w-full max-w-md p-4 shadow-2xl border-amber-500/30 bg-white/95 dark:bg-slate-900/95 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border-2 border-amber-500/30 mx-auto flex items-center justify-center">
            <Clock className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Aguardando Aprovação</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sua conta foi criada com sucesso, mas o acesso ao CRM está <strong>pendente de aprovação</strong> por um Administrador.
          </p>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
            <p className="font-semibold">O que acontece agora?</p>
            <p className="mt-1">Um Administrador irá revisar seu cadastro no painel de configurações e liberar seu acesso com o papel correto.</p>
          </div>
          <button
            onClick={() => setPendingApproval(false)}
            className="text-xs text-slate-400 hover:text-slate-600 underline transition-colors"
          >
            Voltar ao Login
          </button>
        </Card>
      </div>
    );
  }

  // Tela de Recuperação de Senha
  if (forgotPassword) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors relative overflow-hidden">
        <div className="absolute top-4 right-4 z-10"><ThemeToggle /></div>
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <Card className="w-full max-w-md p-4 shadow-2xl border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-xl bg-red-600 mx-auto flex items-center justify-center shadow-lg shadow-red-600/30 mb-3">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-50">Recuperar Senha</CardTitle>
            <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
              Informe seu e-mail e enviaremos um link para criar uma nova senha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {resetSent ? (
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">E-mail enviado com sucesso!</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verifique a caixa de entrada de <strong>{resetEmail}</strong> e siga as instruções para redefinir sua senha.
                </p>
                <button
                  onClick={() => { setForgotPassword(false); setResetSent(false); setError(''); }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold underline transition-colors"
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    E-mail Cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type="email"
                      required
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="seu.email@canadasemfiltro.com"
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading} className="w-full gap-2 group">
                  {loading ? <span>Enviando...</span> : <><span>Enviar Link de Recuperação</span><ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" /></>}
                </Button>
                <button
                  type="button"
                  onClick={() => { setForgotPassword(false); setError(''); }}
                  className="w-full text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors"
                >
                  Cancelar — Voltar ao Login
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors relative overflow-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Decorative gradient glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-500/10 dark:bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="w-full max-w-lg p-2 shadow-2xl relative z-10 border-slate-200 dark:border-slate-800 backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
        <CardHeader className="text-center pb-2">
          <div className="w-12 h-12 rounded-xl bg-red-600 mx-auto flex items-center justify-center text-white text-2xl shadow-lg shadow-red-600/30 mb-3">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Canadá Sem Filtro
          </CardTitle>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Central Operacional de Atendimento & Gestão CRM
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'login' | 'register')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login" className="text-xs font-semibold">
                Entrar no CRM
              </TabsTrigger>
              <TabsTrigger value="register" className="text-xs font-semibold">
                Novo Usuário
              </TabsTrigger>
            </TabsList>

            {/* Mensagem de Erro */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Mensagem de Sucesso */}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* ABAS DE LOGIN */}
            <TabsContent value="login" className="m-0 space-y-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    E-mail de Acesso
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu.email@canadasemfiltro.com"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotPassword(true); setResetEmail(email); setError(''); setSuccess(''); }}
                      className="text-[11px] text-red-500 hover:text-red-700 dark:hover:text-red-400 font-medium transition-colors"
                    >
                      Esqueceu sua senha?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type={showLoginPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10"
                      tabIndex={-1}
                      aria-label={showLoginPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading} className="w-full gap-2 group mt-2">
                  {loading ? (
                    <span>Autenticando...</span>
                  ) : (
                    <>
                      <span>Entrar no CRM</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ABAS DE REGISTRO / NOVO USUÁRIO */}
            <TabsContent value="register" className="m-0 space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Nome Completo do Operador
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Vanessa de Souza"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    E-mail Corporativo
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="novo.usuario@canadasemfiltro.com"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Senha de Acesso
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Crie uma senha (mínimo 6 caracteres)"
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
                    Confirmar Senha
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha criada acima"
                      className={`pl-9 pr-10 ${
                        confirmPassword && password !== confirmPassword
                          ? 'border-red-500 focus-visible:ring-red-500'
                          : confirmPassword && password === confirmPassword
                          ? 'border-emerald-500 focus-visible:ring-emerald-500'
                          : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors z-10"
                      tabIndex={-1}
                      aria-label={showConfirmPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {/* Feedback visual de validação em tempo real */}
                  {confirmPassword && (
                    <p className={`mt-1 text-[11px] font-medium flex items-center gap-1 ${
                      password === confirmPassword ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {password === confirmPassword ? (
                        <><CheckCircle2 className="w-3 h-3" /> Senhas coincidem</>
                      ) : (
                        <><AlertCircle className="w-3 h-3" /> Senhas não coincidem</>
                      )}
                    </p>
                  )}
                </div>

                {/* Nota de Segurança RBAC — Pending Approval */}
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-medium flex items-start gap-2">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Novas contas ficam <strong>pendentes de aprovação</strong>. Um Administrador irá revisar e liberar seu acesso com o papel correto antes de você conseguir entrar no CRM.
                  </span>
                </div>

                <Button type="submit" disabled={loading} className="w-full gap-2 group mt-2 bg-red-600 hover:bg-red-700 text-white">
                  {loading ? (
                    <span>Registrando...</span>
                  ) : (
                    <>
                      <span>Criar Conta de Operador</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Security Badge */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Autenticação protegida por Supabase Auth & PIPEDA</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
