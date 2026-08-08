# Investours — AI-Powered Financial Intelligence Platform

**Investours** is a full-stack web application that helps individuals, cooperatives, NGOs, and licensed financial firms build smarter businesses, improve financial literacy, detect investment scams, and access income-building opportunities — all powered by AI.

---

## Tech Stack

- **Vite** — build tool and dev server
- **TypeScript** — type-safe JavaScript
- **React** — UI framework
- **shadcn/ui** — component library built on Radix UI
- **Tailwind CSS** — utility-first styling
- **Supabase** — backend (PostgreSQL database, auth, storage, edge functions)
- **React Query** — server state management
- **Framer Motion** — animations
- **Vercel** — deployment (with a serverless API route)

---

## Getting Started

```sh
# 1. Clone the repo
git clone <YOUR_GIT_URL>

# 2. Navigate into the project
cd staging-investours-main

# 3. Install dependencies
npm i

# 4. Start the dev server
npm run dev
```

---

## Project Structure

```
staging-investours-main/
├── api/                        # Vercel serverless functions
├── public/                     # Static assets
├── src/
│   ├── assets/                 # Images and logos
│   ├── components/             # Reusable UI components
│   │   ├── admin/              # Admin panel components
│   │   │   └── tabs/           # Individual admin tab panels
│   │   ├── dashboard/          # User dashboard components
│   │   │   └── sections/       # Individual dashboard section panels
│   │   ├── home/               # Homepage-specific components
│   │   ├── onboarding/         # Onboarding flow components
│   │   ├── tutor/              # Financial tutor components
│   │   └── ui/                 # shadcn/ui base components
│   ├── hooks/                  # Custom React hooks
│   ├── integrations/supabase/  # Supabase client and generated types
│   ├── lib/                    # Utility functions and helpers
│   └── pages/                  # Top-level route pages
├── supabase/
│   ├── functions/              # Deno edge functions (AI backends)
│   └── migrations/             # SQL migration history
└── vercel.json                 # Vercel deployment config
```

---

## File-by-File Summary

### Entry Points

#### `src/main.tsx`
The React application entry point. Mounts the root `App` component into the `#root` DOM element and imports global CSS.

#### `src/App.tsx`
The root component. Sets up:
- `QueryClientProvider` (React Query)
- `AuthProvider` (global auth context)
- `TooltipProvider`, `Toaster`, `Sonner` (UI feedback)
- `BrowserRouter` with all application routes

All routes are defined here, mapping URL paths to page components (e.g. `/dashboard/*` → `Dashboard`, `/admin/*` → `AdminDashboard`).

#### `index.html`
The HTML shell. Loads the Vite entry point and sets the page title.

---

### Pages (`src/pages/`)

#### `Welcome.tsx`
The splash/landing page at `/`. Displays the Investours logo, tagline, a list of core features, and social media links (Twitter, Instagram, WhatsApp, YouTube). Has a single CTA button that navigates to `/home`.

#### `Home.tsx`
The main marketing homepage at `/home`. Contains:
- A hero section with an AI Business Plan Generator CTA card and an AI Financial Tutor search bar
- A leaderboard teaser card
- A "Why Choose Investours?" trust section with three value pillars
- A CTA section linking to signup
- Uses `CommunitySection` and `Header`/`Footer` components

#### `Auth.tsx`
The login and forgot-password page at `/auth`. Supports two modes via URL param (`?mode=login` or `?mode=forgot`). Handles:
- Email/password login via Supabase auth
- Password reset email dispatch (redirects to `/reset-password`)
- Redirects already-authenticated users to `/dashboard`

#### `ResetPassword.tsx`
Handles the password reset flow at `/reset-password`. Reads the `code` and `type` URL params from the reset email link, exchanges the recovery code for a Supabase session, then lets the user set a new password. Shows appropriate error/success states.

#### `SignupTypeSelection.tsx`
The account creation page at `/signup`. First shows three account type cards (Individual, B2B Partner, Licensed Firm). Once a type is selected, renders a tailored signup form with type-specific fields. On submit, calls Supabase auth `signUp`, creates the user profile, and optionally creates a `groups` or `firms` record. Handles referral codes from URL params or `sessionStorage`.

#### `SignupForm.tsx`
An older/alternative signup form component (route-param based, e.g. `/signup/:type`). Functionally similar to `SignupTypeSelection` but accessed via a URL type param. Supports `individual`, `group`, and `firm` account types with the same Supabase logic.

#### `CompleteProfile.tsx`
The profile completion page at `/complete-profile`. Shown after signup. Collects additional user data: date of birth, occupation, sector, institution, residential address, languages spoken, and signup reasons. If the user selects "Become a GFE (Grassroots Financial Educator)", they must agree to GFE terms. On submit, updates the `profiles` table and sets `profile_completed = true`, then redirects to `/dashboard`.

#### `Dashboard.tsx`
The authenticated user dashboard at `/dashboard/*`. Protected — redirects unauthenticated users to `/auth`. Uses a responsive layout with a collapsible sidebar (`DashboardSidebar`) and a header (`DashboardHeader`). Nested routes render individual section components:

| Route | Section |
|---|---|
| `/dashboard/education` | Education & Mentorship |
| `/dashboard/profile` | User Profile |
| `/dashboard/wallets` | Wallets & Earnings |
| `/dashboard/investments` | Investments |
| `/dashboard/certificates` | Certificates |
| `/dashboard/followers` | Referrals & Followers |
| `/dashboard/messages` | Messages |
| `/dashboard/settings` | Settings |
| `/dashboard/notifications` | Notifications |
| `/dashboard/plans` | Saved Business Plans |
| `/dashboard/ai-reports` | AI Scam Detection Reports |
| `/dashboard/leaderboard` | Leaderboard |
| `/dashboard/microinsurance` | Microinsurance (coming soon) |
| `/dashboard/sdg` | SDG Impact (coming soon) |

#### `AdminDashboard.tsx`
The admin control panel at `/admin/*`. Only accessible to users with the `admin` role — redirects others to `/dashboard`. Uses `AdminSidebar` and `AdminHeader`. Nested routes render admin tab components for managing every aspect of the platform:

| Route | Tab |
|---|---|
| `/admin/users` | User management |
| `/admin/groups` | B2B groups |
| `/admin/gfes` | Grassroots Financial Educators |
| `/admin/firms` | Licensed firms |
| `/admin/investments` | Investment listings |
| `/admin/ai-tools` | AI tool usage stats |
| `/admin/education` | Education modules |
| `/admin/community` | Community posts moderation |
| `/admin/wallets` | Wallet balances |
| `/admin/deposit-requests` | Manual deposit approvals |
| `/admin/payouts` | Payout requests |
| `/admin/referrals` | Referral commissions |
| `/admin/campaigns` | Marketing campaigns |
| `/admin/business-plan-stats` | Business plan analytics |
| `/admin/promo-codes` | Promo code management |
| `/admin/resources` | Resource library |
| `/admin/messages` | Platform messages |
| `/admin/support` | Support tickets |
| `/admin/advertising` | Advertising management |
| `/admin/settings` | Platform settings |

#### `Vetting.tsx`
The AI Scam Detector page at `/vetting`. Has three tabs:
- **Quick Search** — free, no login required. Submits a query to the `scam-detection` edge function for a fast risk assessment (safe / warning / danger) with key findings.
- **Deep Analysis** — login required. Submits to the same edge function for a comprehensive analysis including risk score (0–100), red flags, green flags, regulatory status, and similar known scams.
- **Support** — premium-gated. Prompts users to upgrade for personalized support.
After each analysis, a `ScamDetectorSurvey` component is shown to collect feedback.

#### `FinancialTutor.tsx`
The AI Financial Tutor chat interface at `/tutor`. Login required. Features:
- An onboarding flow (`FinancialTutorOnboarding`) to set the user's learning level (beginner / intermediate / advanced) on first visit
- A chat UI that sends messages to the `financial-tutor` edge function (powered by Gemini 2.5 Flash)
- XP (experience points) awarded per question answered, tracked in `tutor_user_progress` and `tutor_user_levels`
- Stage progression buttons to advance from Beginner → Intermediate → Advanced (premium-gated for intermediate/advanced)
- A certificate download feature that generates a PNG certificate using the Canvas API and saves a record to `user_certificates`
- Vetting keyword detection — if the user asks about scams or investment safety, they are redirected to `/vetting`
- A post-session survey (`TutorPostSurvey`) shown after the first AI response

#### `BusinessPlanGenerator.tsx`
The AI Business Plan Generator at `/business-plan`. Login required. Features:
- A multi-section form collecting founder info, business details, and funding goals
- Calls the `business-plan` edge function to generate a 12-section structured business plan
- Five plan versions: Standard, Grant, Investor, Loan, Accelerator
- Per-section controls: Edit, Regenerate, Improve (with custom prompt), Delete
- Adjust overall plan length (shorter/longer)
- Save plans to the `business_plans` table (free users: up to 3 saves; premium: unlimited)
- Download as PDF or DOCX (premium only) via `planExport.ts`
- Analytics events tracked to `business_plan_analytics`
- Saved plans can be loaded back from the dashboard

#### `Community.tsx`
The Investours Opportunity Hub at `/community`. A social feed for sharing opportunities, grants, jobs, partnerships, scholarships, and announcements. Features:
- Category filtering (fetched from `post_categories` table, with hardcoded defaults as fallback)
- Real-time post updates via Supabase Realtime channel
- Create posts with text, image (max 3MB), video (max 5MB), or document attachments (uploaded to Supabase Storage)
- Like, comment, and share posts (Facebook, Twitter, LinkedIn, WhatsApp, Email, Copy Link)
- Share links include the user's referral code
- Video thumbnail generation using the Canvas API
- Deep-link to a specific post via `?post=<id>` URL param (scrolls and highlights the post)
- Admin users can delete any post
- Community stats (total members, total posts, active today)

#### `Pricing.tsx`
The pricing page at `/pricing`. Displays:
- Free Plan (₦0/month) with feature list
- Premium Plan with four billing options: Monthly (₦4,500), Quarterly (₦12,000), Bi-annual (₦22,500), Annual (₦45,000), and B2B Annual (₦120,000)
- Institutional Access section for government MDAs, NGOs, cooperatives, and corporations
- All prices shown exclusive of 7.5% VAT

#### `SubscriptionPage.tsx`
The subscription checkout page at `/subscribe`. Reads the `?plan=` URL param to pre-select a plan. Shows all plan cards with upgrade/current-plan states for existing subscribers. On plan selection, renders the `SubscriptionPayment` component.

#### `NotFound.tsx`
The 404 / catch-all page. Displays a "Coming Soon" message and a link back to home. Logs the attempted route to the console.

---

### Components (`src/components/`)

#### `Header.tsx`
The sticky top navigation bar used on public pages. Shows the Investours logo, nav links (Home, My Plans, Learning, Scam Detector, Safe Offers, Opportunity Hub, Pricing), and an auth section. When logged in, shows a dropdown with the user's avatar, name, tier badge, and links to Dashboard, Profile, Settings, Admin Panel (if admin), and Firm Dashboard (if firm staff). Fully responsive with a mobile hamburger menu.

#### `ProtectedRoute.tsx`
A route wrapper component that redirects unauthenticated users to `/auth`. Supports optional `requireAdmin` (redirects non-admins to `/dashboard`) and `requireComplete` (redirects users with incomplete profiles to `/complete-profile`) props.

#### `SubscriptionPayment.tsx`
The payment flow component used inside `SubscriptionPage`. Handles:
- Promo code validation via the `validate_promo_code` Supabase RPC
- Pricing breakdown with VAT (7.5%) and discount calculations
- Bank transfer payment method (renders `ManualDepositForm`)
- Card payment (coming soon, disabled)
- Free subscription activation for 100% discount promo codes via `activate_free_subscription` RPC

#### `ManualDepositForm.tsx`
A form for submitting manual bank transfer proof of payment. Users enter the amount, upload a screenshot/receipt, and submit. The admin then reviews and approves the deposit in the admin panel.

#### `ScamDetectorSurvey.tsx`
A short feedback survey shown after a scam detection analysis. Collects user satisfaction and usefulness ratings. Saves responses to the database.

#### `TutorPreSurvey.tsx` / `TutorPostSurvey.tsx`
Short surveys shown before and after AI Financial Tutor sessions to collect user feedback and learning goals.

#### `NavLink.tsx`
A styled navigation link component used in sidebars and navigation menus.

#### `home/CommunitySection.tsx`
A preview section of the Opportunity Hub shown on the homepage. Displays recent community posts to encourage users to join.

#### `onboarding/FinancialTutorOnboarding.tsx`
The onboarding flow for first-time Financial Tutor users. Asks the user to self-assess their financial knowledge level (beginner, intermediate, advanced) and saves the result to `localStorage` and the `tutor_user_levels` table.

#### `tutor/TutorHomepage.tsx`
An alternative homepage view for the Financial Tutor feature, showing learning paths and suggested topics.

#### `dashboard/DashboardSidebar.tsx`
The left sidebar for the user dashboard. Lists all dashboard navigation links with icons. Collapses to a mobile sheet drawer on small screens.

#### `dashboard/DashboardHeader.tsx`
The top header bar for dashboard pages. Shows the current section title and a hamburger menu button for mobile.

#### `dashboard/sections/` (12 section components)
Each file renders the content for one dashboard section:

| File | Description |
|---|---|
| `ProfileSection.tsx` | View and edit user profile, avatar, bio |
| `WalletsSection.tsx` | View wallet balance, earnings, withdrawal requests |
| `EducationSection.tsx` | Browse and complete financial literacy modules, track progress |
| `InvestmentsSection.tsx` | View active and past investments |
| `CertificatesSection.tsx` | View and download earned certificates |
| `ReferralsSection.tsx` | Referral link, follower count, commission earnings |
| `MessagesSection.tsx` | In-platform messaging |
| `AIReportsSection.tsx` | History of AI scam detection reports |
| `NotificationsSection.tsx` | Platform notifications |
| `SettingsSection.tsx` | Account settings, password change, notification preferences |
| `LeaderboardSection.tsx` | Top learners ranked by XP |
| `SavedPlansSection.tsx` | List of saved business plans with load/delete actions |

#### `admin/AdminSidebar.tsx`
The collapsible left sidebar for the admin panel. Lists all admin navigation links. Animates between expanded (64px) and collapsed (16px) states on desktop.

#### `admin/AdminHeader.tsx`
The top header bar for the admin panel. Shows a menu toggle button and admin-specific actions.

#### `admin/AdminOverview.tsx`
The admin dashboard home screen. Shows platform-wide stats: total users, active subscriptions, revenue, community posts, business plans generated, and recent activity.

#### `admin/DepositRequestsManager.tsx`
A dedicated admin component for reviewing and approving/rejecting manual bank transfer deposit requests. Shows uploaded payment proof images and allows the admin to activate subscriptions.

#### `admin/tabs/` (20 tab components)
Each file is a full admin management panel for one domain area. They all follow a similar pattern: fetch data from Supabase, display in a table, and provide create/edit/delete actions. Key tabs include:
- `UsersTab.tsx` — search, view, edit, and manage all user accounts and roles
- `WalletsTab.tsx` — view and adjust user wallet balances
- `PayoutsTab.tsx` — approve or reject payout requests
- `ReferralsTab.tsx` — view referral chains and commission payouts
- `PromoCodesTab.tsx` — create and manage discount promo codes
- `BusinessPlanStatsTab.tsx` — analytics on business plan generation events
- `AIToolsTab.tsx` — usage statistics for AI features
- `CommunityTab.tsx` — moderate community posts and comments
- `EducationTab.tsx` — manage financial literacy modules and lessons
- `SettingsTab.tsx` — platform-wide configuration settings

#### `ui/` (40+ components)
All shadcn/ui base components: `accordion`, `alert`, `avatar`, `badge`, `button`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `dialog`, `drawer`, `dropdown-menu`, `form`, `input`, `label`, `pagination`, `popover`, `progress`, `radio-group`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `slider`, `switch`, `table`, `tabs`, `textarea`, `toast`, `toaster`, `toggle`, `tooltip`, and more.

#### `ui/Footer.tsx`
The site-wide footer component. Shows the Investours logo, navigation links, social media icons, and copyright notice.

---

### Hooks (`src/hooks/`)

#### `useAuth.tsx`
The central authentication hook and context provider. Wraps the entire app via `AuthProvider`. Manages:
- `user` — the Supabase `User` object
- `session` — the active Supabase session
- `profile` — the user's row from the `profiles` table (includes `user_tier`, `user_type`, `is_gfe`, `referral_code`, etc.)
- `roles` — array of role strings from `user_roles` table (e.g. `['admin']`)
- `isLoading` — auth initialization state
- `isAdmin` — derived boolean
- `signUp`, `signIn`, `signOut`, `refreshProfile` — auth action functions

Listens to Supabase `onAuthStateChange` to keep state in sync.

#### `use-mobile.tsx`
A hook that returns `true` when the viewport width is below the mobile breakpoint (768px). Used to conditionally render mobile vs desktop layouts.

#### `use-toast.ts`
The toast notification hook from shadcn/ui. Provides `toast()` for showing success, error, and info notifications.

---

### Integrations (`src/integrations/supabase/`)

#### `client.ts`
Creates and exports the Supabase client instance using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` environment variables. Configured with `localStorage` session persistence and auto token refresh.

#### `types.ts`
Auto-generated TypeScript types for the entire Supabase database schema. Provides full type safety for all table queries, RPC calls, and storage operations.

---

### Lib (`src/lib/`)

#### `utils.ts`
Shared utility functions:
- `cn()` — merges Tailwind CSS class names using `clsx` + `tailwind-merge`
- `generateVideoThumbnail()` — extracts a JPEG thumbnail from a video URL using the Canvas API
- `updateShareOGTags()` — dynamically updates Open Graph and Twitter Card meta tags in the document head for social sharing

#### `planExport.ts`
Business plan export utilities:
- `downloadDOCX()` — converts the markdown-like plan text to a styled HTML document and downloads it as a `.doc` file
- `downloadPDF()` — opens the same HTML in a new browser window and triggers the print dialog for PDF saving
- `planToHTML()` — internal function that converts the plan text (with `##` headings, bullet lists, and markdown tables) into a fully styled HTML document with a table of contents

#### `LinkifiedText.tsx`
A React component that renders text with URLs automatically converted to clickable `<a>` links. Used in community post content and comments.

---

### Supabase Edge Functions (`supabase/functions/`)

All edge functions run on Deno and call the Lovable AI Gateway (Google Gemini 2.5 Flash).

#### `business-plan/index.ts`
Handles all AI business plan operations. Accepts an `action` field:
- `generate` — creates a full 12-section business plan from form data
- `switch_version` — regenerates the plan tailored for a specific funding type (grant, investor, loan, accelerator)
- `regenerate_section` — rewrites a single section of an existing plan
- `improve_section` — rewrites a section based on user-provided improvement instructions
- `adjust_length` — rewrites the entire plan to be shorter or longer

Uses a detailed system prompt that defines all 12 required sections and their expected content.

#### `financial-tutor/index.ts`
Powers the AI Financial Tutor chat. Accepts the full message history, user ID, and user level. Applies a level-specific system prompt:
- **Beginner** — simple analogies and everyday language
- **Intermediate** — practical examples with numbers
- **Advanced** — professional terminology and portfolio theory

Always instructs the AI to include a quiz question and suggest the next lesson. Directs investment-specific questions to the Vetting tool.

#### `scam-detection/index.ts`
Powers the AI Scam Detector. Accepts a `query` string and `analysisType` (`quick` or `deep`):
- **Quick** — returns `riskLevel` (safe/warning/danger), a summary, key findings, and a recommendation as JSON
- **Deep** — returns a full analysis with `riskScore` (0–100), `riskLevel`, company analysis, red flags, green flags, regulatory status, similar scams, recommendations, and confidence level as JSON

Logs every search to the `ai_search_logs` table.

---

### API (`api/`)

#### `share.ts`
A Vercel serverless function at `/api/share`. Used for social media link previews. When a community post is shared, this endpoint:
1. Fetches the post content and author name from Supabase
2. Builds a full HTML page with Open Graph and Twitter Card meta tags (title, description, image)
3. Immediately redirects the browser to the actual community page (`/community?post=<id>`)

This ensures social media crawlers see rich preview metadata while users are redirected instantly.

---

### Configuration Files

#### `vite.config.ts`
Vite build configuration. Sets up the `@` path alias pointing to `src/`, and includes the React plugin.

#### `tailwind.config.ts`
Tailwind CSS configuration. Defines the custom color palette (`investours-gold`, `investours-coral`, etc.), custom animations (`float`, `fade-in`), and the `gradient-hero`, `gradient-primary`, and `glass` utility classes used throughout the app.

#### `components.json`
shadcn/ui configuration. Specifies the component style, TypeScript settings, Tailwind config path, and import aliases.

#### `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`
TypeScript configuration files. `tsconfig.app.json` configures the browser build with strict mode and the `@` path alias. `tsconfig.node.json` configures the Vite config file build.

#### `eslint.config.js`
ESLint configuration using the flat config format. Enables React Hooks and React Refresh rules.

#### `postcss.config.js`
PostCSS configuration for Tailwind CSS and Autoprefixer.

#### `vercel.json`
Vercel deployment configuration. Rewrites all routes to `index.html` for SPA client-side routing, and maps `/api/share` to the `api/share.ts` serverless function.

#### `package.json`
Project dependencies and scripts. Key dependencies include React 18, React Router v6, Supabase JS v2, React Query v5, Framer Motion, Lucide React (icons), and shadcn/ui component primitives.

#### `.env`
Environment variables (not committed to version control). Required variables:
- `VITE_SUPABASE_URL` — your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — your Supabase anon/public key

---

### Supabase Migrations (`supabase/migrations/`)

The `migrations/` folder contains the full SQL history of the database schema, applied in chronological order. Key migrations include:

| Migration | Description |
|---|---|
| `20251220143858` | Initial schema: profiles, groups, firms, investments, posts, wallets |
| `20251221060842` | User roles and admin access |
| `20251223120000` | Email opt-in field on profiles |
| `20260125010815` | BDE (Business Development Educator) fields |
| `20260125011115` | Referral commission system |
| `20260125011245` | Engagement credit system |
| `20260125011500` | Seed financial education modules |
| `20260125012000` | Manual deposit system |
| `20260202000000` | Promo codes table and validation RPC |
| `20260203000000` | Free subscription activation RPC |
| `20260417000000` | Commission wallet routing fix |
| `20260426000000` | AI survey tables (scam detector and tutor surveys) |
| `20260530000000` | Tutor learning path tables (lessons, progress, levels) |
| `20260531000000` | Tutor leaderboard RPC |
| `20260601000000` | Referral commission approval workflow |
| `20260621000001` | Business plans table |
| `20260621000002` | Certificate download count tracking |
| `20260622000000` | Business plan analytics table |
| `20260724000000` | Flexible post categories and admin delete permissions |

---

## Deployment

The app is deployed on **Vercel**. To deploy:

1. Push to your connected Git repository
2. Vercel automatically builds and deploys
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel environment variables

Or use [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) → Share → Publish.

### Custom Domain

Navigate to Project > Settings > Domains in Lovable or Vercel to connect a custom domain.
See: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
