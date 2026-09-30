import { MockClient, JOURNEY_LABELS } from './types';

const headers = [
  'Estado da jornada',
  'Cliente',
  'E-mail',
  'Produto',
  'SLA restante',
  'Consultoria',
  'Responsável',
];

function slaLabel(client: MockClient): string {
  if (['carrinho_abandonado', 'pagamento_pendente'].includes(client.status_journey)) return 'Não se aplica';
  if (client.status_journey !== 'compra') return 'Cumprido';
  if (client.is_overdue) return 'ESTOURADO!';
  return `${client.sla_hours_left}h úteis restantes`;
}

function consultationLabel(client: MockClient): string {
  if (client.consultation_status === 'completed') return 'Realizada';
  return client.consultation_booked ? 'Marcada' : 'Não marcada';
}

function csvCell(value: string): string {
  const safe = /^\s*[=+\-@]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function leadsToCsv(clients: MockClient[]): string {
  const rows = clients.map((client) => [
    JOURNEY_LABELS[client.status_journey]?.label || client.status_journey,
    client.name,
    client.email,
    client.product,
    slaLabel(client),
    consultationLabel(client),
    client.assigned_consultant,
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
