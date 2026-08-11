import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Resend } from 'resend';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'E-mail é obrigatório.' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Gerar link de reset via Supabase Admin API
    const { data, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://crm-canada-sem-filtro.vercel.app'}/login`,
      },
    });

    if (linkError || !data?.properties?.action_link) {
      console.error('Erro ao gerar link de recuperação:', linkError);
      // Retornar sucesso mesmo se usuário não existir (segurança — não vazar se email está cadastrado)
      return NextResponse.json({ success: true });
    }

    const resetLink = data.properties.action_link;

    // Enviar e-mail via Resend com template HTML premium
    const { error: sendError } = await resend.emails.send({
      from: 'Canadá Sem Filtro CRM <noreply@canadasemfiltro.com>',
      to: [email.trim()],
      subject: '🔑 Recuperação de Senha — Canadá Sem Filtro CRM',
      html: buildResetEmailHtml(resetLink, email.trim()),
    });

    if (sendError) {
      console.error('Erro ao enviar e-mail via Resend:', sendError);
      return NextResponse.json({ error: 'Falha ao enviar o e-mail. Tente novamente.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Erro inesperado:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function buildResetEmailHtml(resetLink: string, email: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recuperação de Senha — Canadá Sem Filtro CRM</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;border:1px solid #334155;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%);">
              <div style="width:52px;height:52px;background:rgba(255,255,255,0.15);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
                <span style="font-size:26px;">🧭</span>
              </div>
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Canadá Sem Filtro</h1>
              <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:12px;">Central Operacional de Atendimento &amp; Gestão CRM</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:18px;font-weight:700;">Redefinição de Senha</h2>
              <p style="margin:0 0 20px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Recebemos uma solicitação para redefinir a senha da conta associada a <strong style="color:#e2e8f0;">${email}</strong>.
              </p>
              <p style="margin:0 0 28px;color:#94a3b8;font-size:14px;line-height:1.6;">
                Clique no botão abaixo para criar uma nova senha. Este link é válido por <strong style="color:#e2e8f0;">1 hora</strong>.
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${resetLink}" style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#ffffff;text-decoration:none;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.2px;box-shadow:0 4px 14px rgba(220,38,38,0.4);">
                      🔑 Redefinir Minha Senha
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback link -->
              <p style="margin:24px 0 0;color:#64748b;font-size:11px;text-align:center;line-height:1.6;">
                Se o botão não funcionar, copie e cole este link no navegador:<br/>
                <a href="${resetLink}" style="color:#ef4444;word-break:break-all;font-size:10px;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <!-- Warning -->
          <tr>
            <td style="padding:0 40px 28px;">
              <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:16px;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                  ⚠️ Se você <strong style="color:#94a3b8;">não</strong> solicitou esta redefinição, ignore este e-mail. Sua senha permanece inalterada e sua conta está segura.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;text-align:center;border-top:1px solid #334155;">
              <p style="margin:0;color:#475569;font-size:11px;">
                © 2026 Canadá Sem Filtro · CRM Operacional · Protegido por PIPEDA
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
