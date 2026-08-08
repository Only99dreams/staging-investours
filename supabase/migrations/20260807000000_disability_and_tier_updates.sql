-- Add disability field to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disability text DEFAULT NULL;

-- Add new values to the user_tier enum
-- (ADD VALUE is safe and non-destructive; IF NOT EXISTS prevents errors on re-run)
ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'monthly';
ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'quarterly';
ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'annual';
ALTER TYPE user_tier ADD VALUE IF NOT EXISTS 'business';
