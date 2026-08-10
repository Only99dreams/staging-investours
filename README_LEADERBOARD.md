# Investours — AI Challenge Leaderboard

## Overview

The AI Challenge Leaderboard ranks participants by their **Business Plan Funding Readiness Score** (primary) with **XP Points** as the tiebreaker. At the end of each challenge edition, an admin declares a champion 🏆 and clears all data to start fresh.

---

## Scoring System

| Metric | Source | Weight |
|---|---|---|
| Funding Readiness Score (0–100) | Extracted from Section 11 of AI-generated business plan | **Primary** (sort first) |
| XP Points | Earned per AI Tutor question answered | Tiebreaker (sort second) |

### Funding Readiness Score Colors
| Score Range | Color | Meaning |
|---|---|---|
| 80–100 | 🟢 Green | Highly funding-ready |
| 60–79 | 🟡 Amber | Moderately ready |
| 40–59 | 🟠 Orange | Needs improvement |
| 0–39 | ⚫ Grey | Early stage |

---

## How the Score is Calculated

The AI generates a business plan with 12 sections. Section 11 is **Funding Readiness Assessment**, which always ends with:

```
Funding Readiness Score (0-100): XX/100
```

When a user saves their plan, `BusinessPlanGenerator.tsx` runs `extractFundingScore()` which uses this regex:

```ts
/funding\s+readiness\s+score[^\d]*(\d{1,3})/i
```

The extracted score is saved to `business_plans.funding_readiness_score`. The leaderboard RPC picks the **best (MAX) score** across all of a user's saved plans.

---

## Database Schema

### `business_plans` table (updated)
```sql
funding_readiness_score integer DEFAULT 0  -- added by migration 20260806000000
```

### `ai_challenge_editions` table
```sql
CREATE TABLE public.ai_challenge_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',  -- active | ended
  champion_user_id uuid REFERENCES public.profiles(id),
  champion_declared_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## RPCs

### `get_tutor_leaderboard()`
Returns all participants sorted by `funding_readiness_score DESC`, then `xp_total DESC`.

**Returns:**
```json
{
  "user_id": "uuid",
  "full_name": "string",
  "email": "string",
  "xp_total": 7040,
  "level": "beginner | intermediate | advanced",
  "streak_days": 0,
  "badges": [],
  "funding_readiness_score": 65,
  "plans_count": 1
}
```

### `clear_challenge_edition(p_edition_id, p_champion_user_id?)`
Admin-only. Ends an edition, declares champion, and resets all scores.

**What it resets:**
- `tutor_user_levels.xp_total` → 0
- `tutor_user_levels.streak_days` → 0
- `tutor_user_levels.badges` → `[]`
- `business_plans.funding_readiness_score` → 0

---

## Migration

File: `supabase/migrations/20260806000000_ai_challenge_leaderboard.sql`

Run in **Supabase SQL Editor** if not yet applied:
```sql
DROP FUNCTION IF EXISTS public.get_tutor_leaderboard();
-- then paste full migration file contents
```

---

## Frontend Components

### User Dashboard — `/dashboard/leaderboard`
File: `src/components/dashboard/sections/LeaderboardSection.tsx`

- **AI Challenge tab**: Shows funding score (large, color-coded with progress bar) + XP (small, underneath)
- **Referral tab**: Shows follower count and earnings
- Active edition name shown as badge in header
- Real-time updates via Supabase Realtime on `tutor_user_levels` and `business_plans` tables

### Admin Panel — `/admin/ai-challenge`
File: `src/components/admin/tabs/AIChallengeTab.tsx`

Features:
- **Create Edition**: Name + description → sets status to `active`
- **Live Leaderboard Table**: Top 20 participants with scores
- **End Edition & Declare Champion**: Dropdown of top 20 participants, irreversible warning, clears all data
- **Past Editions Table**: History of all ended editions with champions

---

## Current Leaderboard (as of backfill — 2026-08-06)

| Rank | Participant | Funding Score | XP | Plans |
|---|---|---|---|---|
| 🥇 | Enakireru Edafe Moses | 65/100 | 7,040 | 1 |
| 🥈 | EMMANUEL OLUSEGUN | 65/100 | 20 | 2 |
| 🥉 | Lukman Ibrahim Muhammad | 65/100 | 10 | 1 |
| #4 | Admin Admin | 45/100 | 20 | 1 |
| #5 | Michael Ilori | 0/100 | 20,320 | 1 |

> Note: Michael Ilori leads on XP (20,320) but ranks #5 because his saved plan has no funding score yet — he needs to re-save his plan to capture the score.

---

## How to Start a New Edition

1. Go to **`/admin/ai-challenge`**
2. Click **"New Edition"**
3. Enter a name (e.g. `AI Challenge — Season 1`) and optional description
4. Click **"Create Edition"** — it appears on the leaderboard immediately

---

## How to End an Edition & Declare Champion

1. Go to **`/admin/ai-challenge`**
2. Click **"End & Declare Champion"** on the active edition
3. Select the champion from the dropdown (pre-sorted by score)
4. Click **"End Edition & Clear Data"**

⚠️ **This is irreversible.** All XP, streaks, badges, and funding scores are reset to 0.

---

## Backfilling Existing Plans

If plans were saved before the `funding_readiness_score` column existed, backfill via the REST API:

```sh
curl -X PATCH "https://seizblulwtalsucqguld.supabase.co/rest/v1/business_plans?id=eq.<plan_id>" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "apikey: <service_role_key>" \
  -d '{"funding_readiness_score": <score>}'
```

Or run this SQL to auto-extract scores from existing plan text:

```sql
-- Extract and update scores from existing plan content
UPDATE public.business_plans
SET funding_readiness_score = (
  regexp_match(plan_content, 'funding\s+readiness\s+score[^\d]*(\d{1,3})', 'i')
)[1]::integer
WHERE plan_content ~* 'funding\s+readiness\s+score[^\d]*\d{1,3}'
  AND funding_readiness_score = 0;
```

---

## Files Changed

| File | Change |
|---|---|
| `supabase/migrations/20260806000000_ai_challenge_leaderboard.sql` | New migration: `ai_challenge_editions` table, updated `get_tutor_leaderboard` RPC, `clear_challenge_edition` RPC |
| `src/components/dashboard/sections/LeaderboardSection.tsx` | Full rewrite: funding score prominent, XP tiny, edition badge, real-time |
| `src/components/admin/tabs/AIChallengeTab.tsx` | New admin tab: create/end editions, declare champion, live leaderboard |
| `src/pages/AdminDashboard.tsx` | Added `AIChallengeTab` route at `/admin/ai-challenge` |
| `src/components/admin/AdminSidebar.tsx` | Added "AI Challenge" nav item with Trophy icon |
| `src/pages/BusinessPlanGenerator.tsx` | Added `extractFundingScore()`, saves score on every plan save/update, shows score badge in toolbar |
