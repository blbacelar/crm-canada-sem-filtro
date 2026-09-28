begin;
alter table public.allowed_emails enable row level security;
drop policy if exists "Allow all for anon and authenticated"
  on public.allowed_emails;
revoke all on table public.allowed_emails from anon, authenticated;
revoke all on sequence public.allowed_emails_id_seq from anon, authenticated;
revoke all on function public.is_email_allowed(text) from public;
grant execute on function public.is_email_allowed(text) to anon, authenticated;
commit;
