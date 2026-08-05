-- Add missing subscription_expires_at column to profiles
alter table public.profiles
  add column if not exists subscription_expires_at timestamptz;

-- Replace RPC now that the column exists
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
  v_expires_at := case p_plan_type
    when 'monthly'    then now() + interval '1 month'
    when 'quarterly'  then now() + interval '3 months'
    when 'biennial'   then now() + interval '6 months'
    when 'annual'     then now() + interval '1 year'
    when 'b2b_annual' then now() + interval '1 year'
    else now() + interval '1 month'
  end;

  insert into public.paystack_payments
    (user_id, reference, plan_type, amount_kobo, status, promo_code_id, verified_at)
  values
    (p_user_id, p_reference, p_plan_type, p_amount_kobo, 'success', p_promo_code_id, now())
  on conflict (reference) do update
    set status = 'success', verified_at = now();

  update public.profiles
  set
    user_tier = 'premium',
    subscription_type = p_plan_type,
    subscription_expires_at = v_expires_at,
    updated_at = now()
  where id = p_user_id;

  if p_promo_code_id is not null then
    insert into public.promo_code_uses (promo_code_id, user_id, discount_applied)
    values (p_promo_code_id, p_user_id, 0)
    on conflict do nothing;
  end if;

  return jsonb_build_object('success', true, 'expires_at', v_expires_at);
end;
$$;
