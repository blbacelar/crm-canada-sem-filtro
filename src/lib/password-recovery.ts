const PRODUCTION_CRM_ORIGIN = 'https://crm-canada-sem-filtro.vercel.app';

export function buildRecoveryLink(tokenHash: string, origin = PRODUCTION_CRM_ORIGIN) {
  const url = new URL('/login?recovery=1', origin);
  url.hash = new URLSearchParams({ token_hash: tokenHash, type: 'recovery' }).toString();
  return url.toString();
}
