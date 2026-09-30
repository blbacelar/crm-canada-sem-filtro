import assert from 'node:assert/strict';
import { test } from 'node:test';

import { clientMatchesFilters, loadClientsForExport, mapApiClient } from '../src/components/crm/client-list';
import { leadsToCsv } from '../src/components/crm/leads-csv';

test('CSV includes the table columns and escapes spreadsheet formulas and quotes', () => {
  const client = mapApiClient({
    id: 'lead-1',
    name: '=Devair "Júnior",\nCosta',
    email: 'devair@example.com',
    product_name: 'Simulador + Diário de Bordo',
    status_journey: 'compra',
    sla_hours_left: 12,
    consultation_booked: true,
    assigned_consultant_name: 'Bruno',
  });

  const csv = leadsToCsv([client]);

  assert.match(csv, /^\uFEFF"Estado da jornada","Cliente","E-mail"/u);
  assert.ok(csv.includes('"\'=Devair ""Júnior"",\nCosta"'));
  assert.ok(csv.includes('"Compra Efetuada"'));
  assert.ok(csv.includes('"12h úteis restantes","Marcada","Bruno"'));
  assert.ok(csv.endsWith('\r\n'));
});

test('export fetches every page and preserves the active filters', async () => {
  const requests: string[] = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    id: `lead-${index}`,
    name: `Devair ${index}`,
    email: `devair-${index}@example.com`,
    status_journey: 'compra',
    is_overdue: index !== 0,
  }));
  const fetchPage: typeof fetch = async (input) => {
    const url = String(input);
    requests.push(url);
    const offset = Number(new URL(url, 'https://crm.example.test').searchParams.get('offset'));
    return new Response(JSON.stringify({
      clients: offset === 0 ? firstPage : [{ id: 'lead-100', name: 'Devair 100', status_journey: 'compra', is_overdue: true }],
      total: 101,
    }), { headers: { 'Content-Type': 'application/json' } });
  };

  const clients = await loadClientsForExport('overdue', 'Devair', fetchPage);

  assert.equal(clients.length, 100);
  assert.equal(requests.length, 2);
  assert.match(requests[0], /limit=100&offset=0&status=overdue&search=Devair/u);
  assert.match(requests[1], /limit=100&offset=100&status=overdue&search=Devair/u);
  assert.ok(clientMatchesFilters(clients[0], 'overdue', 'Devair'));
  assert.equal(clientMatchesFilters(clients[0], 'pagamento_pendente', 'Devair'), false);
});

test('export rejects a failed page rather than downloading incomplete data', async () => {
  const fetchPage: typeof fetch = async () => new Response(JSON.stringify({ error: 'Sessão expirada.' }), { status: 401 });

  await assert.rejects(loadClientsForExport('todos', '', fetchPage), /Sessão expirada/u);
});
