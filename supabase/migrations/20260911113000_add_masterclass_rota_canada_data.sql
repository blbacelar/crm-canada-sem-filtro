begin;
-- Bring the historical Masterclass lead table up to the schema used by the
-- Rota Canadá landing page.  This is deliberately additive so existing CRM
-- data remains intact.
alter table public.canada_sem_filtro_leads
  alter column checkout_url drop not null,
  alter column whatsapp_country_code drop not null,
  alter column whatsapp_country drop not null,
  alter column whatsapp_national_number drop not null,
  alter column whatsapp drop not null,
  add column if not exists goal text not null default 'undecided',
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_version text,
  add column if not exists marketing_consent_text text,
  add column if not exists confirmation_email_status text not null default 'not_sent',
  add column if not exists confirmation_email_id text,
  add column if not exists confirmation_email_attempted_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz,
  add column if not exists confirmation_email_last_error text,
  add column if not exists confirmation_email_delivery_status text not null default 'unknown',
  add column if not exists confirmation_email_delivery_updated_at timestamptz,
  add column if not exists confirmation_email_opened_at timestamptz,
  add column if not exists confirmation_email_clicked_at timestamptz,
  add column if not exists marketing_consent_revoked_at timestamptz,
  add column if not exists marketing_consent_revocation_source text,
  add column if not exists automation_message_status text,
  add column if not exists attendance_confirmed boolean not null default false,
  add column if not exists attendance_confirmed_at timestamptz;
alter table public.canada_sem_filtro_leads
  drop constraint if exists canada_sem_filtro_leads_payment_provider_check,
  add constraint canada_sem_filtro_leads_payment_provider_check
    check (payment_provider in ('hotmart', 'stripe', 'free')),
  drop constraint if exists canada_sem_filtro_leads_payment_status_check,
  add constraint canada_sem_filtro_leads_payment_status_check
    check (payment_status in ('checkout_started', 'pending', 'paid', 'registered', 'canceled', 'refunded', 'chargeback', 'expired', 'protest')),
  drop constraint if exists canada_sem_filtro_leads_goal_check,
  add constraint canada_sem_filtro_leads_goal_check
    check (goal in ('work', 'study', 'permanent_residence', 'undecided')),
  drop constraint if exists canada_sem_filtro_leads_marketing_consent_evidence_check,
  add constraint canada_sem_filtro_leads_marketing_consent_evidence_check
    check (
      marketing_consent = false
      or (
        marketing_consent_at is not null
        and char_length(trim(marketing_consent_version)) > 0
        and char_length(trim(marketing_consent_text)) > 0
      )
    ),
  drop constraint if exists canada_sem_filtro_leads_confirmation_email_status_check,
  add constraint canada_sem_filtro_leads_confirmation_email_status_check
    check (confirmation_email_status in ('not_applicable', 'not_sent', 'sending', 'sent', 'failed')),
  drop constraint if exists canada_sem_filtro_leads_email_delivery_status_check,
  add constraint canada_sem_filtro_leads_email_delivery_status_check
    check (confirmation_email_delivery_status in ('unknown', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed')),
  drop constraint if exists canada_sem_filtro_leads_automation_message_status_check,
  add constraint canada_sem_filtro_leads_automation_message_status_check
    check (automation_message_status is null or automation_message_status in ('pending', 'processing', 'sent', 'failed')),
  drop constraint if exists canada_sem_filtro_leads_attendance_confirmation_check,
  add constraint canada_sem_filtro_leads_attendance_confirmation_check
    check (attendance_confirmed_at is null or attendance_confirmed = true),
  drop constraint if exists canada_sem_filtro_leads_consent_revocation_check,
  add constraint canada_sem_filtro_leads_consent_revocation_check
    check (
      (marketing_consent_revoked_at is null and marketing_consent_revocation_source is null)
      or (
        not marketing_consent
        and marketing_consent_revoked_at is not null
        and marketing_consent_revocation_source in ('email_unsubscribe', 'administrator', 'resend_complaint', 'system')
      )
    ),
  drop constraint if exists canada_sem_filtro_leads_whatsapp_completeness_check,
  add constraint canada_sem_filtro_leads_whatsapp_completeness_check
    check (num_nonnulls(whatsapp, whatsapp_country, whatsapp_country_code, whatsapp_national_number) in (0, 4));
alter table public.canada_sem_filtro_leads enable row level security;
revoke all privileges on table public.canada_sem_filtro_leads from anon, authenticated;
grant select, insert, update on table public.canada_sem_filtro_leads to service_role;
create index if not exists canada_sem_filtro_leads_automation_message_status_idx
  on public.canada_sem_filtro_leads (automation_message_status, created_at asc)
  where automation_message_status is not null;
create index if not exists canada_sem_filtro_leads_confirmation_email_status_idx
  on public.canada_sem_filtro_leads (confirmation_email_status, created_at desc);
create index if not exists canada_sem_filtro_leads_email_delivery_status_idx
  on public.canada_sem_filtro_leads (confirmation_email_delivery_status, created_at desc);
create index if not exists canada_sem_filtro_leads_attendance_confirmed_idx
  on public.canada_sem_filtro_leads (attendance_confirmed, created_at desc);
create table if not exists public.masterclass_quiz_responses (
  id bigint generated always as identity primary key,
  email text not null unique check (email = lower(trim(email)) and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'),
  whatsapp_country_code text not null check (whatsapp_country_code in ('+1', '+55', '+351', '+353', '+44', '+34', '+39', '+49', '+33', '+52', '+54', '+56', '+57', '+51')),
  whatsapp_country text not null check (whatsapp_country in ('CA', 'US', 'BR', 'PT', 'IE', 'GB', 'ES', 'IT', 'DE', 'FR', 'MX', 'AR', 'CL', 'CO', 'PE')),
  whatsapp_national_number text not null check (char_length(regexp_replace(whatsapp_national_number, '\\D', '', 'g')) between 9 and 11),
  whatsapp text not null check (char_length(regexp_replace(whatsapp, '\\D', '', 'g')) between 10 and 15),
  project_stage text not null check (project_stage in ('idea', 'researching', 'strategy_with_doubts', 'executing', 'process_in_progress', 'in_canada')),
  likely_path text not null check (likely_path in ('permanent_residence', 'study', 'work', 'entrepreneurship', 'family_reunification', 'unknown', 'multiple')),
  program_awareness text not null check (program_awareness in ('verified', 'options_uncertain', 'programs_unknown_eligibility', 'none')),
  plan_b_readiness text not null check (plan_b_readiness in ('yes', 'idea_not_validated', 'no', 'never_considered')),
  estimated_budget text not null check (estimated_budget in ('under_30k', '30k_60k', '60k_100k', '100k_200k', 'over_200k', 'unknown')),
  budget_planning text not null check (budget_planning in ('detailed', 'some_calculations', 'approximate', 'none')),
  canada_fit_clarity text not null check (canada_fit_clarity in ('yes', 'somewhat', 'mostly_emotional', 'still_discovering')),
  areas_to_understand text[] not null check (cardinality(areas_to_understand) between 1 and 11 and areas_to_understand <@ array['immigration_strategy', 'career', 'language', 'money', 'where_to_live', 'studies', 'family', 'timelines', 'documentation', 'plan_b', 'logical_sequence']::text[]),
  current_statement text not null check (current_statement in ('dont_know_first_step', 'information_without_plan', 'plan_not_validated', 'organize_execution', 'in_progress_avoid_errors')),
  data_consent boolean not null check (data_consent = true),
  data_consent_at timestamptz not null,
  data_consent_version text not null check (char_length(trim(data_consent_version)) > 0),
  data_consent_text text not null check (char_length(trim(data_consent_text)) > 0),
  source text not null default 'masterclass_quiz_2027',
  page_path text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  final_question text check (final_question is null or char_length(trim(final_question)) between 1 and 500),
  age smallint check (age is null or age between 18 and 100),
  masterclass_expectation text check (masterclass_expectation is null or char_length(trim(masterclass_expectation)) between 1 and 500)
);
alter table public.masterclass_quiz_responses enable row level security;
revoke all privileges on table public.masterclass_quiz_responses from public, anon, authenticated, service_role;
revoke all privileges on sequence public.masterclass_quiz_responses_id_seq from public, anon, authenticated, service_role;
grant select, insert, update on table public.masterclass_quiz_responses to service_role;
grant usage, select on sequence public.masterclass_quiz_responses_id_seq to service_role;
create index if not exists masterclass_quiz_responses_created_at_idx on public.masterclass_quiz_responses (created_at desc);
create table if not exists public.quiz_submission_rate_limits (
  client_key text primary key check (client_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);
alter table public.quiz_submission_rate_limits enable row level security;
revoke all privileges on table public.quiz_submission_rate_limits from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.quiz_submission_rate_limits to service_role;
create index if not exists quiz_submission_rate_limits_updated_at_idx on public.quiz_submission_rate_limits (updated_at);
create or replace function public.consume_quiz_submission_rate_limit(
  p_client_key text,
  p_limit integer default 15,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare current_count integer;
begin
  if p_client_key !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 100 or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;
  delete from public.quiz_submission_rate_limits where updated_at < now() - interval '24 hours';
  insert into public.quiz_submission_rate_limits as current_window (client_key, window_started_at, request_count, updated_at)
  values (p_client_key, now(), 1, now())
  on conflict (client_key) do update set
    window_started_at = case when current_window.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else current_window.window_started_at end,
    request_count = case when current_window.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else least(current_window.request_count + 1, p_limit + 1) end,
    updated_at = now()
  returning request_count into current_count;
  return current_count <= p_limit;
end;
$$;
revoke all on function public.consume_quiz_submission_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_quiz_submission_rate_limit(text, integer, integer) to service_role;
create table if not exists public.attendance_confirmation_rate_limits (
  client_key text primary key check (client_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  updated_at timestamptz not null default now()
);
alter table public.attendance_confirmation_rate_limits enable row level security;
revoke all privileges on table public.attendance_confirmation_rate_limits from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.attendance_confirmation_rate_limits to service_role;
create index if not exists attendance_confirmation_rate_limits_updated_at_idx on public.attendance_confirmation_rate_limits (updated_at);
create or replace function public.consume_attendance_confirmation_rate_limit(
  p_client_key text,
  p_limit integer default 10,
  p_window_seconds integer default 600
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare current_count integer;
begin
  if p_client_key !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 100 or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;
  delete from public.attendance_confirmation_rate_limits where updated_at < now() - interval '24 hours';
  insert into public.attendance_confirmation_rate_limits as current_window (client_key, window_started_at, request_count, updated_at)
  values (p_client_key, now(), 1, now())
  on conflict (client_key) do update set
    window_started_at = case when current_window.window_started_at <= now() - make_interval(secs => p_window_seconds) then now() else current_window.window_started_at end,
    request_count = case when current_window.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1 else least(current_window.request_count + 1, p_limit + 1) end,
    updated_at = now()
  returning request_count into current_count;
  return current_count <= p_limit;
end;
$$;
revoke all on function public.consume_attendance_confirmation_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_attendance_confirmation_rate_limit(text, integer, integer) to service_role;
create or replace function public.confirm_masterclass_attendance(p_email text, p_whatsapp text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare confirmed_rows integer;
begin
  update public.canada_sem_filtro_leads
  set attendance_confirmed = true, attendance_confirmed_at = coalesce(attendance_confirmed_at, now())
  where email = lower(trim(p_email)) and whatsapp = p_whatsapp and payment_status in ('registered', 'paid');
  get diagnostics confirmed_rows = row_count;
  return confirmed_rows > 0;
end;
$$;
revoke all on function public.confirm_masterclass_attendance(text, text) from public, anon, authenticated;
grant execute on function public.confirm_masterclass_attendance(text, text) to service_role;
commit;
