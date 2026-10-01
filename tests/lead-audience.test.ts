import assert from 'node:assert/strict';
import test from 'node:test';
import { audienceToCsv, buildAudience, filterAudience, type AudienceFilters } from '../src/lib/lead-audience';

const baseFilters: AudienceFilters = {
  search: '', consent: 'authorized', purchase: 'all', attendance: 'all', product: 'all', source: 'all',
};

test('groups different names under one normalized email and counts only real purchases', () => {
  const contacts = buildAudience([
    {
      id: 'a', name: 'Suian Souza', email: ' SUIAN@example.com ', source: 'masterclass', goal: 'work',
      created_at: '2026-09-01T10:00:00Z', marketing_consent: true,
      marketing_consent_at: '2026-09-01T10:00:00Z', marketing_consent_revoked_at: null,
      attendance_confirmed: false, product_name: 'Simulador',
    },
    {
      id: 'b', name: 'Suian Campos de Souza', email: 'suian@example.com', source: 'form', goal: 'study',
      created_at: '2026-09-10T10:00:00Z', marketing_consent: false,
      marketing_consent_at: null, marketing_consent_revoked_at: null,
      attendance_confirmed: true, product_name: null,
    },
  ], [{ id: 'client-1', name: 'Suian Souza', email: 'suian@example.com', source: 'hotmart', created_at: '2026-09-11T10:00:00Z' }], [
    { client_id: 'client-1', transaction_code: 'HP123', product_name: 'Diário de bordo', status_hotmart: 'PURCHASE_APPROVED', purchase_date: '2026-09-11T10:00:00Z' },
  ], [{ transaction_code: 'HP123', product_name: 'Simulador' }], []);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].email, 'suian@example.com');
  assert.equal(contacts[0].leadCount, 2);
  assert.equal(contacts[0].purchaseCount, 1);
  assert.deepEqual(contacts[0].purchasedProducts, ['Diário de bordo', 'Simulador']);
  assert.equal(contacts[0].attendanceConfirmed, true);
  assert.equal(contacts[0].marketingConsent, true);
});

test('revocation supersedes opt-in; new explicit opt-in restores it', () => {
  const lead = {
    id: 'a', name: 'Pessoa', email: 'pessoa@example.com', source: 'form', goal: null,
    created_at: '2026-09-01T10:00:00Z', marketing_consent: true,
    marketing_consent_at: '2026-09-01T10:00:00Z', marketing_consent_revoked_at: '2026-09-05T10:00:00Z',
    attendance_confirmed: false, product_name: null,
  };
  const revoked = buildAudience([lead], [], [], [], []);
  assert.equal(revoked[0].marketingConsent, false);
  assert.equal(filterAudience(revoked, baseFilters).length, 0);
  const optedInAgain = buildAudience([lead, {
    ...lead, id: 'b', created_at: '2026-09-10T10:00:00Z',
    marketing_consent_at: '2026-09-10T10:00:00Z', marketing_consent_revoked_at: null,
  }], [], [], [], []);
  assert.equal(optedInAgain[0].marketingConsent, true);
});

test('pending or refunded transactions do not create paid-course access', () => {
  const contacts = buildAudience([], [
    { id: 'pending', name: 'Pendente', email: 'pending@example.com', source: 'hotmart', created_at: '2026-09-01' },
    { id: 'refunded', name: 'Extornado', email: 'refunded@example.com', source: 'hotmart', created_at: '2026-09-01' },
  ], [
    { client_id: 'pending', transaction_code: 'HP1', product_name: 'Simulador', status_hotmart: 'PURCHASE_WAITING_PAYMENT', purchase_date: '2026-09-02' },
    { client_id: 'refunded', transaction_code: 'HP2', product_name: 'Diário', status_hotmart: 'PURCHASE_REFUNDED', purchase_date: '2026-09-02' },
  ], [], []);
  assert.equal(contacts.find((contact) => contact.email === 'pending@example.com')?.hasPending, true);
  assert.equal(contacts.find((contact) => contact.email === 'refunded@example.com')?.hasRefunded, true);
  assert.ok(contacts.every((contact) => !contact.hasPaid && contact.purchasedProducts.length === 0));
  assert.equal(filterAudience(contacts, { ...baseFilters, consent: 'all', purchase: 'paid' }).length, 0);
});

test('includes Calendly and quiz-only contacts without treating quiz data consent as marketing consent', () => {
  const contacts = buildAudience([], [], [], [], [],
    [{ name: 'Agendamento', email: 'agendamento@example.com', created_at: '2026-09-01' }],
    [{ email: 'quiz@example.com', source: 'masterclass_quiz', created_at: '2026-09-02' }]);
  assert.equal(contacts.length, 2);
  assert.ok(contacts.every((contact) => !contact.marketingConsent));
  assert.deepEqual(contacts.find((contact) => contact.email === 'agendamento@example.com')?.sources, ['calendly']);
  assert.equal(filterAudience(contacts, baseFilters).length, 0);
});

test('CSV escapes spreadsheet formulas and includes every filtered contact', () => {
  const contacts = buildAudience([{ id: 'a', name: '=HYPERLINK("evil")', email: 'safe@example.com',
    source: 'form', goal: null, created_at: '2026-09-01', marketing_consent: true,
    marketing_consent_at: '2026-09-01', marketing_consent_revoked_at: null,
    attendance_confirmed: false, product_name: null }], [], [], [], []);
  const csv = audienceToCsv(filterAudience(contacts, baseFilters));
  assert.match(csv, /^\uFEFF/);
  assert.match(csv, /"'=HYPERLINK\(""evil""\)"/);
  assert.match(csv, /safe@example\.com/);
});
