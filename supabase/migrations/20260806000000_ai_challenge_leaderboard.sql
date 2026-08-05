-- AI Challenge Editions table
CREATE TABLE IF NOT EXISTS public.ai_challenge_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active', -- active | ended
  champion_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  champion_declared_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_challenge_editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage editions"
  ON public.ai_challenge_editions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view editions"
  ON public.ai_challenge_editions FOR SELECT
  USING (true);

-- Add funding_readiness_score column to business_plans if not present
ALTER TABLE public.business_plans
  ADD COLUMN IF NOT EXISTS funding_readiness_score integer DEFAULT 0;

-- Updated leaderboard RPC: includes best funding readiness score per user
CREATE OR REPLACE FUNCTION public.get_tutor_leaderboard()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  xp_total integer,
  level text,
  streak_days integer,
  badges jsonb,
  funding_readiness_score integer,
  plans_count bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tul.user_id,
    p.full_name,
    p.email,
    COALESCE(tul.xp_total, 0) AS xp_total,
    tul.level,
    COALESCE(tul.streak_days, 0) AS streak_days,
    tul.badges,
    COALESCE(
      (SELECT MAX(bp.funding_readiness_score)
       FROM public.business_plans bp
       WHERE bp.user_id = tul.user_id),
      0
    ) AS funding_readiness_score,
    COALESCE(
      (SELECT COUNT(*) FROM public.business_plans bp WHERE bp.user_id = tul.user_id),
      0
    ) AS plans_count
  FROM public.tutor_user_levels AS tul
  JOIN public.profiles AS p ON p.id = tul.user_id
  ORDER BY funding_readiness_score DESC, tul.xp_total DESC
  LIMIT 100;
$$;

-- RPC: clear leaderboard data for a new edition (admin only)
CREATE OR REPLACE FUNCTION public.clear_challenge_edition(
  p_edition_id uuid,
  p_champion_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Must be admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Mark edition as ended and set champion
  UPDATE public.ai_challenge_editions
  SET
    status = 'ended',
    champion_user_id = p_champion_user_id,
    champion_declared_at = CASE WHEN p_champion_user_id IS NOT NULL THEN now() ELSE NULL END,
    ended_at = now()
  WHERE id = p_edition_id;

  -- Reset XP and streaks for all participants
  UPDATE public.tutor_user_levels
  SET xp_total = 0, streak_days = 0, badges = '[]'::jsonb;

  -- Reset funding readiness scores on business plans
  UPDATE public.business_plans
  SET funding_readiness_score = 0;

  RETURN jsonb_build_object('success', true, 'edition_id', p_edition_id);
END;
$$;
