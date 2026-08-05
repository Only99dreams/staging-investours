-- Table to log every Paystack transaction
create table if not exists public.paystack_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  reference text not null unique,
  plan_type text not null,
  amount_kobo integer not null,          -- amount in kobo (Paystack unit)
  amount_naira numeric generated always as (amount_kobo / 100.0) stored,
  status text not null default 'pending', -- pending | success | failed
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  paystack_response jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

alter table public.paystack_payments enable row level security;

-- Users can read their own payments
create policy "Users can view own payments"
  on public.paystack_payments for select
  using (auth.uid() = user_id);

-- Service role inserts (called from RPC)
create policy "Service role can insert payments"
  on public.paystack_payments for insert
  with check (true);

create policy "Service role can update payments"
  on public.paystack_payments for update
  using (true);

-- -------------------------------------------------------
-- RPC: activate_paystack_subscription
-- Called client-side after Paystack popup confirms success.
-- Logs the payment and upgrades the user's subscription.
-- -------------------------------------------------------
create or replace function public.activate_paystack_subscription(
  p_user_id uuid,
  p_reference text,
  p_plan_type text,
  p_amount_kobo integer,
  p_promo_code_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires_at timestamptz;
begin
  -- Calculate expiry based on plan
  v_expires_at := case p_plan_type
    when 'monthly'    then now() + interval '1 month'
    when 'quarterly'  then now() + interval '3 months'
    when 'biennial'   then now() + interval '6 months'
    when 'annual'     then now() + interval '1 year'
    when 'b2b_annual' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  -- Upsert payment record
  insert into public.paystack_payments
    (user_id, reference, plan_type, amount_kobo, status, promo_code_id, verified_at)
  values
    (p_user_id, p_reference, p_plan_type, p_amount_kobo, 'success', p_promo_code_id, now())
  on conflict (reference) do update
    set status = 'success', verified_at = now();

  -- Upgrade the user profile
  update public.profiles
  set
    user_tier = 'premium',
    subscription_type = p_plan_type,
    subscription_expires_at = v_expires_at,
    updated_at = now()
  where id = p_user_id;

  -- Record promo code usage if applicable
  if p_promo_code_id is not null then
    insert into public.promo_code_uses (promo_code_id, user_id, discount_applied)
    values (p_promo_code_id, p_user_id, 0)
    on conflict do nothing;
  end if;

  return jsonb_build_object('success', true, 'expires_at', v_expires_at);
end;
$$;
