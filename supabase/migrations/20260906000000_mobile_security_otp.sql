-- Mobile account-security OTP storage. OTP values are hashed and never readable by clients.
create table if not exists public.security_otps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null check (purpose in ('delete_account')),
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists security_otps_user_purpose_idx
  on public.security_otps(user_id, purpose, created_at desc);

alter table public.security_otps enable row level security;
revoke all on public.security_otps from anon, authenticated;
