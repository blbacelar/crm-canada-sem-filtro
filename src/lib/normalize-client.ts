export function normalizeClientEmail(value: string) {
  return value.trim().toLowerCase();
}

export function formatPhoneWithDDI(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const cleaned = phone.trim();
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) return cleaned;

  const digits = cleaned.replace(/[^0-9]/g, '');
  if (!digits) return cleaned;

  if (digits.startsWith('55') && digits.length >= 12) {
    return `+${digits}`;
  }

  return `+55${digits}`;
}

export function normalizedClientIdentity(input: {
  name: string;
  email: string;
  phone?: string | null;
  document?: string | null;
  country?: string | null;
  zip_code?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  district?: string | null;
  number?: string | null;
  complement?: string | null;
  source?: string;
  status_journey?: string;
}) {
  return {
    name: input.name.trim(),
    email: normalizeClientEmail(input.email),
    ...(input.phone ? { phone: formatPhoneWithDDI(input.phone) } : {}),
    ...(input.document ? { document: input.document.trim() } : {}),
    ...(input.country ? { country: input.country.trim() } : {}),
    ...(input.zip_code ? { zip_code: input.zip_code.trim() } : {}),
    ...(input.city ? { city: input.city.trim() } : {}),
    ...(input.state ? { state: input.state.trim() } : {}),
    ...(input.address ? { address: input.address.trim() } : {}),
    ...(input.district ? { district: input.district.trim() } : {}),
    ...(input.number ? { number: input.number.trim() } : {}),
    ...(input.complement ? { complement: input.complement.trim() } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(input.status_journey ? { status_journey: input.status_journey } : {}),
    updated_at: new Date().toISOString(),
  };
}
