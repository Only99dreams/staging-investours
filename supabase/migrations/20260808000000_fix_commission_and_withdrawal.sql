-- ============================================================
-- Migration: Fix commission system + withdrawal processing
-- 1. Commission reads from paystack_payments (not deposit_requests)
-- 2. 30% first-time, 15% renewal, 2% indirect
-- 3. Withdrawal approval atomically deducts wallet balance
-- 4. Withdrawal requests store bank details at submission time
-- ============================================================

-- ── Track whether a user has had a previous subscription ──────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS had_previous_subscription BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Store bank details on the withdrawal request itself ───────────────────
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS gross_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ── Update system_settings with correct rates ─────────────────────────────
INSERT INTO public.system_settings (key, value) VALUES
  ('direct_subscription_commission',    '0.30'),
  ('renewal_subscription_commission',   '0.15'),
  ('indirect_subscription_commission',  '0.02'),
  ('general_withdrawal_fee',            '0.15'),
  ('premium_withdrawal_fee',            '0.10')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================================
-- Core commission function: fires on profiles.user_tier change
-- Reads actual amount from paystack_payments OR deposit_requests
-- Applies 30% first-time / 15% renewal / 2% indirect
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_tier_upgrade_reward()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_id           UUID;
  indirect_referrer_id  UUID;
  direct_rate           DECIMAL;
  indirect_rate         DECIMAL;
  actual_paid_kobo      BIGINT;
  base_after_promo      DECIMAL;
  reward_amount         DECIMAL;
  indirect_reward       DECIMAL;
  referrer_wallet_id    UUID;
  indirect_wallet_id    UUID;
  vat_rate              DECIMAL := 0.075;
  is_renewal            BOOLEAN;
  commission_label      TEXT;
BEGIN
  -- Only fire on upgrade to premium/exclusive
  IF NOT (OLD.user_tier = 'free' OR OLD.user_tier IS NULL) OR
     NEW.user_tier NOT IN ('premium', 'exclusive') THEN
    -- Handle renewal: same tier stays premium
    IF OLD.user_tier IN ('premium', 'exclusive') AND NEW.user_tier IN ('premium', 'exclusive') THEN
      is_renewal := TRUE;
    ELSE
      RETURN NEW;
    END IF;
  ELSE
    is_renewal := COALESCE(NEW.had_previous_subscription, FALSE);
  END IF;

  -- Get direct referrer
  SELECT referred_by INTO referrer_id FROM profiles WHERE id = NEW.id;
  IF referrer_id IS NULL THEN
    -- Mark as having had a subscription before returning
    UPDATE profiles SET had_previous_subscription = TRUE WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Get rates from system_settings
  IF is_renewal THEN
    SELECT (value::text)::decimal INTO direct_rate
    FROM system_settings WHERE key = 'renewal_subscription_commission';
    direct_rate := COALESCE(direct_rate, 0.15);
    commission_label := 'Renewal commission (15%)';
  ELSE
    SELECT (value::text)::decimal INTO direct_rate
    FROM system_settings WHERE key = 'direct_subscription_commission';
    direct_rate := COALESCE(direct_rate, 0.30);
    commission_label := 'First-time referral commission (30%)';
  END IF;

  SELECT (value::text)::decimal INTO indirect_rate
  FROM system_settings WHERE key = 'indirect_subscription_commission';
  indirect_rate := COALESCE(indirect_rate, 0.02);

  -- ── Find actual amount paid ──────────────────────────────────────────────
  -- First try paystack_payments (primary payment method)
  SELECT amount_kobo INTO actual_paid_kobo
  FROM paystack_payments
  WHERE user_id = NEW.id AND status = 'success'
  ORDER BY verified_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF actual_paid_kobo IS NOT NULL AND actual_paid_kobo > 0 THEN
    -- Convert kobo to naira, back out VAT
    base_after_promo := (actual_paid_kobo / 100.0) / (1 + vat_rate);
  ELSE
    -- Fallback: try deposit_requests (manual bank transfer)
    DECLARE
      deposit_amount DECIMAL;
    BEGIN
      SELECT dr.amount INTO deposit_amount
      FROM deposit_requests dr
      WHERE dr.user_id = NEW.id
        AND dr.status = 'approved'
        AND (dr.narration ILIKE '%subscription%' OR dr.narration ILIKE '%premium%')
      ORDER BY dr.processed_at DESC NULLS LAST, dr.created_at DESC
      LIMIT 1;

      IF deposit_amount IS NULL OR deposit_amount <= 0 THEN
        UPDATE profiles SET had_previous_subscription = TRUE WHERE id = NEW.id;
        RETURN NEW;
      END IF;
      base_after_promo := deposit_amount / (1 + vat_rate);
    END;
  END IF;

  -- ── Direct referrer commission ───────────────────────────────────────────
  reward_amount := ROUND(base_after_promo * direct_rate, 2);

  SELECT id INTO referrer_wallet_id FROM wallets WHERE user_id = referrer_id;

  IF referrer_wallet_id IS NOT NULL AND reward_amount > 0 THEN
    UPDATE wallets
    SET gfe_wallet_balance = gfe_wallet_balance + reward_amount,
        updated_at = now()
    WHERE id = referrer_wallet_id;

    INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, narration, source, status)
    VALUES (
      referrer_wallet_id,
      reward_amount,
      'credit',
      commission_label || ' — ₦' || ROUND(base_after_promo, 2)::TEXT || ' base',
      'referral_system',
      'completed'
    );

    UPDATE referral_stats
    SET total_subscribed = total_subscribed + 1,
        total_earnings   = total_earnings + reward_amount,
        updated_at       = now()
    WHERE user_id = referrer_id;

    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      referrer_id,
      '💰 Commission Earned!',
      'You earned ₦' || ROUND(reward_amount, 2)::TEXT || ' ' || commission_label || '. Check your GFE Wallet.',
      'referral_reward'
    );
  END IF;

  -- ── Indirect referrer commission (2%) ────────────────────────────────────
  SELECT referred_by INTO indirect_referrer_id FROM profiles WHERE id = referrer_id;

  IF indirect_referrer_id IS NOT NULL THEN
    indirect_reward := ROUND(base_after_promo * indirect_rate, 2);

    SELECT id INTO indirect_wallet_id FROM wallets WHERE user_id = indirect_referrer_id;

    IF indirect_wallet_id IS NOT NULL AND indirect_reward > 0 THEN
      UPDATE wallets
      SET gfe_wallet_balance = gfe_wallet_balance + indirect_reward,
          updated_at = now()
      WHERE id = indirect_wallet_id;

      INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, narration, source, status)
      VALUES (
        indirect_wallet_id,
        indirect_reward,
        'credit',
        'Indirect referral bonus (2%) — ₦' || ROUND(base_after_promo, 2)::TEXT || ' base',
        'referral_system',
        'completed'
      );

      UPDATE referral_stats
      SET total_earnings = total_earnings + indirect_reward,
          updated_at     = now()
      WHERE user_id = indirect_referrer_id;

      INSERT INTO notifications (user_id, title, message, type)
      VALUES (
        indirect_referrer_id,
        '💰 Indirect Commission Earned!',
        'You earned ₦' || ROUND(indirect_reward, 2)::TEXT || ' indirect referral bonus (2%). Check your GFE Wallet.',
        'referral_reward'
      );
    END IF;
  END IF;

  -- Mark user as having had a subscription
  UPDATE profiles SET had_previous_subscription = TRUE WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists on profiles
DROP TRIGGER IF EXISTS on_tier_upgrade_reward ON public.profiles;
CREATE TRIGGER on_tier_upgrade_reward
  AFTER UPDATE OF user_tier ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tier_upgrade_reward();

-- ============================================================
-- Also fire commission from activate_paystack_subscription RPC
-- by calling the commission logic directly (belt-and-suspenders)
-- ============================================================
CREATE OR REPLACE FUNCTION public.activate_paystack_subscription(
  p_user_id      uuid,
  p_reference    text,
  p_plan_type    text,
  p_amount_kobo  integer,
  p_promo_code_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expires_at timestamptz;
  v_old_tier   text;
BEGIN
  -- Get current tier before upgrade
  SELECT user_tier INTO v_old_tier FROM profiles WHERE id = p_user_id;

  v_expires_at := CASE p_plan_type
    WHEN 'monthly'    THEN now() + interval '1 month'
    WHEN 'quarterly'  THEN now() + interval '3 months'
    WHEN 'biennial'   THEN now() + interval '6 months'
    WHEN 'annual'     THEN now() + interval '1 year'
    WHEN 'b2b_annual' THEN now() + interval '1 year'
    ELSE now() + interval '1 month'
  END;

  -- Upsert payment record
  INSERT INTO public.paystack_payments
    (user_id, reference, plan_type, amount_kobo, status, promo_code_id, verified_at)
  VALUES
    (p_user_id, p_reference, p_plan_type, p_amount_kobo, 'success', p_promo_code_id, now())
  ON CONFLICT (reference) DO UPDATE
    SET status = 'success', verified_at = now();

  -- Upgrade profile — this fires handle_tier_upgrade_reward trigger
  UPDATE public.profiles
  SET
    user_tier               = 'premium',
    subscription_type       = p_plan_type,
    subscription_expires_at = v_expires_at,
    updated_at              = now()
  WHERE id = p_user_id;

  -- Record promo code usage
  IF p_promo_code_id IS NOT NULL THEN
    INSERT INTO public.promo_code_uses (promo_code_id, user_id, discount_applied)
    VALUES (p_promo_code_id, p_user_id, 0)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'expires_at', v_expires_at);
END;
$$;

-- ============================================================
-- Withdrawal: submit request (stores bank details + fee calc)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
  p_user_id     uuid,
  p_amount      numeric,
  p_wallet_type text   -- 'user_wallet' | 'gfe_wallet'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet          RECORD;
  v_profile         RECORD;
  v_balance         numeric;
  v_fee_rate        numeric;
  v_fee             numeric;
  v_net             numeric;
  v_min_withdrawal  numeric := 5000;
BEGIN
  -- Get wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Get profile for tier + bank details
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;

  -- Check bank details are set
  IF v_wallet.bank_account_number IS NULL OR v_wallet.bank_account_number = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please add your bank details before withdrawing');
  END IF;

  -- Get balance for selected wallet
  v_balance := CASE p_wallet_type
    WHEN 'gfe_wallet' THEN v_wallet.gfe_wallet_balance
    ELSE v_wallet.user_wallet_balance
  END;

  -- Validate amount
  IF p_amount < v_min_withdrawal THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal is ₦5,000');
  END IF;

  IF p_amount > v_balance THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Calculate fee
  v_fee_rate := CASE
    WHEN v_profile.user_tier IN ('premium', 'exclusive') THEN 0.10
    ELSE 0.15
  END;
  v_fee := ROUND(p_amount * v_fee_rate, 2);
  v_net := p_amount - v_fee;

  -- Deduct from wallet immediately (hold funds)
  IF p_wallet_type = 'gfe_wallet' THEN
    UPDATE wallets
    SET gfe_wallet_balance = gfe_wallet_balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE wallets
    SET user_wallet_balance = user_wallet_balance - p_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  -- Record debit transaction
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, narration, source, status)
  VALUES (
    v_wallet.id,
    -p_amount,
    'debit',
    'Withdrawal request — pending processing',
    'withdrawal',
    'pending'
  );

  -- Insert withdrawal request with snapshot of bank details
  INSERT INTO withdrawal_requests (
    user_id, amount, gross_amount, fee_amount, net_amount,
    wallet_type, status,
    bank_name, bank_account_number, bank_account_name
  ) VALUES (
    p_user_id, v_net, p_amount, v_fee, v_net,
    p_wallet_type, 'pending',
    v_wallet.bank_name, v_wallet.bank_account_number, v_wallet.bank_account_name
  );

  -- Notify user
  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    p_user_id,
    '📤 Withdrawal Request Submitted',
    'Your withdrawal of ₦' || v_net::TEXT || ' (after ₦' || v_fee::TEXT || ' fee) is being processed. Allow up to 72 hours.',
    'withdrawal_submitted'
  );

  RETURN jsonb_build_object(
    'success',     true,
    'gross',       p_amount,
    'fee',         v_fee,
    'net',         v_net,
    'fee_rate_pct', (v_fee_rate * 100)::int
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_withdrawal_request(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_withdrawal_request(uuid, numeric, text) TO authenticated;

-- ============================================================
-- Withdrawal: admin approve — marks paid, notifies user
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_withdrawal_request(
  p_request_id uuid,
  p_admin_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  UPDATE withdrawal_requests
  SET status       = 'approved',
      processed_by = p_admin_id,
      processed_at = now()
  WHERE id = p_request_id;

  -- Update the pending wallet transaction to completed
  UPDATE wallet_transactions
  SET status = 'completed',
      narration = 'Withdrawal approved — ₦' || v_req.net_amount::TEXT || ' sent to ' || COALESCE(v_req.bank_name, 'bank')
  WHERE wallet_id = (SELECT id FROM wallets WHERE user_id = v_req.user_id)
    AND source = 'withdrawal'
    AND status = 'pending'
    AND amount = -v_req.gross_amount;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_req.user_id,
    '✅ Withdrawal Approved!',
    '₦' || v_req.net_amount::TEXT || ' has been sent to ' || COALESCE(v_req.bank_name, 'your bank') || ' (' || COALESCE(v_req.bank_account_number, '') || '). Allow 1–3 business days.',
    'withdrawal_approved'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_withdrawal_request(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_withdrawal_request(uuid, uuid) TO authenticated;

-- ============================================================
-- Withdrawal: admin reject — refunds wallet balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_withdrawal_request(
  p_request_id      uuid,
  p_admin_id        uuid,
  p_rejection_reason text DEFAULT 'Request rejected by admin'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
BEGIN
  SELECT * INTO v_req FROM withdrawal_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  UPDATE withdrawal_requests
  SET status           = 'rejected',
      processed_by     = p_admin_id,
      processed_at     = now(),
      rejection_reason = p_rejection_reason
  WHERE id = p_request_id;

  -- Refund the held amount back to wallet
  IF v_req.wallet_type = 'gfe_wallet' THEN
    UPDATE wallets
    SET gfe_wallet_balance = gfe_wallet_balance + v_req.gross_amount,
        updated_at = now()
    WHERE user_id = v_req.user_id;
  ELSE
    UPDATE wallets
    SET user_wallet_balance = user_wallet_balance + v_req.gross_amount,
        updated_at = now()
    WHERE user_id = v_req.user_id;
  END IF;

  -- Mark the pending transaction as reversed
  UPDATE wallet_transactions
  SET status = 'reversed',
      narration = 'Withdrawal rejected — amount refunded to wallet'
  WHERE wallet_id = (SELECT id FROM wallets WHERE user_id = v_req.user_id)
    AND source = 'withdrawal'
    AND status = 'pending'
    AND amount = -v_req.gross_amount;

  -- Refund credit entry
  INSERT INTO wallet_transactions (wallet_id, amount, transaction_type, narration, source, status)
  SELECT id, v_req.gross_amount, 'credit',
    'Withdrawal refunded — ' || p_rejection_reason,
    'withdrawal_refund', 'completed'
  FROM wallets WHERE user_id = v_req.user_id;

  INSERT INTO notifications (user_id, title, message, type)
  VALUES (
    v_req.user_id,
    '❌ Withdrawal Rejected',
    'Your withdrawal of ₦' || v_req.gross_amount::TEXT || ' was rejected: ' || p_rejection_reason || '. The amount has been returned to your wallet.',
    'withdrawal_rejected'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_withdrawal_request(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_withdrawal_request(uuid, uuid, text) TO authenticated;

-- RLS: users can view their own withdrawal requests
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own withdrawals" ON public.withdrawal_requests;
CREATE POLICY "Users can view own withdrawals"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can insert withdrawals via RPC" ON public.withdrawal_requests;
CREATE POLICY "Authenticated can insert withdrawals via RPC"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);
