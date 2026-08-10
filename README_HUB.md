# README_HUB.md — Opportunity Hub & UI Improvements

## Summary

This document covers all changes made to the Investours platform in this session, spanning post engagement gating, share link fixes, admin category management, UI layout changes, and cross-feature navigation improvements.

---

## Changes Made

### 1. Post Engagement Gating (Loves & Comments)

**File:** `src/pages/Community.tsx`

**What changed:**
- Clicking the ❤️ Love button without being logged in now shows a toast: *"Login Required — Please sign up or login to love posts."*
- Clicking the 💬 Comment button without being logged in now shows a toast: *"Login Required — Please sign up or login to comment."*
- Logged-in users are unaffected — engagement works exactly as before.

**Why:**
- Drives signups: visitors can see engagement counts but cannot interact without an account.
- Supports the Investours AI Challenge — video engagement (loves and comments) can now be meaningfully tracked per contestant since only authenticated users can engage.

---

### 2. Share Link Fix — Posts Now Deep-Link Correctly

**File:** `src/pages/Community.tsx`

**What changed:**
- Share links now use `/community?post=<id>&ref=<referral_code>` (direct deep-link to the post).
- Previously, share links pointed to `/api/share?post=<id>` which is a server-side redirect endpoint intended only for social media crawlers (OG tag injection), not for human users clicking shared links.
- Sharing no longer requires login — anyone can share a post.
- Only logged-in users get their referral code appended to the URL and the share event logged to `post_shares`.

**Share platforms supported:** Facebook, Twitter/X, LinkedIn, WhatsApp, Email, Copy Link.

**Why:**
- Shared links now open the correct post immediately for the recipient.
- Referral tracking still works for logged-in sharers.
- Unauthenticated users can still share (viral spread), but won't earn referral credit.

---

### 3. Admin Post Category Change

**File:** `src/pages/Community.tsx`

**What changed:**
- Admin users now see every post's category badge as **clickable**.
- Clicking the badge opens an inline select dropdown + Save / ✕ Cancel controls directly on the post card — no dialog or page reload needed.
- On save, calls `supabase.from('posts').update({ category })` and updates local state immediately.
- Non-admin users see the badge as read-only (no change in behaviour).

**State added:**
```ts
const [changeCategoryPostId, setChangeCategoryPostId] = useState<string | null>(null);
const [newCategoryValue, setNewCategoryValue] = useState<string>("");
```

**Handler added:**
```ts
const handleChangeCategory = async (postId: string, category: string) => { ... }
```

**Why:**
- Admins need to correct miscategorised posts without deleting and reposting.
- Keeps the correct category filter working for all users.

---

### 4. "Create Post" Button Moved to Top

**File:** `src/pages/Community.tsx`

**What changed:**
- The "Create Post" button is now in the **page header**, sitting alongside the Members and Posts stats counters — above the category filter row.
- The sidebar "Create Post" card (with "New Post" button) has been **removed**.
- The full post creation dialog (category select, content textarea, file attachment) is now triggered from the header button.

**Before:**
```
[Title & Description]          [Members] [Posts]
[Category Filter Row]
[Posts Feed]    [Sidebar: Create Post Card | Stats | Join CTA]
```

**After:**
```
[Title & Description]    [Create Post Button] [Members] [Posts]
[Category Filter Row]
[Posts Feed]             [Sidebar: Stats | Join CTA]
```

**Why:**
- The "Create Post" action is primary — it should be immediately visible at the top of the page.
- Reduces sidebar clutter.

---

### 5. "Check Opportunity Hub" Button on Business Plan Generator

**Files:** `src/pages/BusinessPlanGenerator.tsx`

**What changed:**
- After a business plan is generated, the bottom actions row now includes a **"Check Opportunity Hub"** button.
- Links directly to `/community`.
- Sits between "Generate Another Plan" and "Upgrade to Premium" (if on free tier).

**Code added:**
```tsx
import { useNavigate, useLocation, Navigate, Link } from "react-router-dom";

// In bottom actions:
<Link to="/community">
  <Button variant="outline">
    <Users className="w-4 h-4 mr-2" /> Check Opportunity Hub
  </Button>
</Link>
```

**Icon added to import:** `Users` from `lucide-react`.

**Why:**
- After generating a business plan, users are primed to seek funding, partnerships, and opportunities — the Opportunity Hub is the natural next step.
- Increases cross-feature engagement and time-on-platform.

---

### 6. Education Module Share — Thumbnail Preview in Share Dialog

**File:** `src/components/dashboard/sections/EducationSection.tsx`

**What changed:**
- The share dropdown inside the video player dialog now shows a **thumbnail preview** of the module before the share options.
- Thumbnail is extracted via `getVideoThumbnail()` (YouTube `hqdefault.jpg` or `thumbnail_url` field).
- Shows the module title below the thumbnail.
- Only renders the preview block if a thumbnail is available.

**Why:**
- Users sharing education content can confirm they're sharing the right module.
- The thumbnail appears in social media link previews (OG tags), so showing it in the share UI sets correct expectations.

---

### 7. "View All" Label on Homepage

**File:** `src/components/home/CommunitySection.tsx`

**What changed:**
- The button at the bottom of the homepage Opportunity Hub preview section changed from **"View All Opportunities"** to **"View All"**.

**Why:**
- Shorter, cleaner label. The context (Opportunity Hub section) already makes it clear what "all" refers to.

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/Community.tsx` | Like/comment login gate, share URL fix, admin category change, Create Post moved to header, sidebar card removed |
| `src/components/home/CommunitySection.tsx` | "View All Opportunities" → "View All" |
| `src/pages/BusinessPlanGenerator.tsx` | Added `Link` import, `Users` icon, "Check Opportunity Hub" button |
| `src/components/dashboard/sections/EducationSection.tsx` | Thumbnail preview in share dropdown inside video dialog |

---

## No Database Changes

All changes in this session are **frontend only**. No new migrations, no new Supabase tables, no new RPC functions, no new edge functions.

---

## TypeScript

All changes pass `npx tsc --noEmit` with **zero errors**.
