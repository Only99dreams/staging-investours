# Investours — Paystack Payment Integration

## Keys & Credentials

| Key | Value |
|---|---|
| Paystack Public Key | `pk_live_5d3ca78510542fd9cca086e0caa675eede075dfc` |
| Paystack Secret Key | Stored as Supabase edge function secret `PAYSTACK_SECRET_KEY` (never in client code) |
| Supabase Project ID | `seizblulwtalsucqguld` |
| Supabase URL | `https://seizblulwtalsucqguld.supabase.co` |

---

## Architecture

```
Browser (react-paystack popup)
  └── Paystack processes payment
        ├── onSuccess callback → calls activate_paystack_subscription RPC (instant activation)
        └── Paystack webhook → POST /functions/v1/paystack-webhook (server-side verification backup)
```

- **Client-side**: `src/components/SubscriptionPayment.tsx` — opens Paystack popup, calls RPC on success
- **Webhook**: `supabase/functions/paystack-webhook/index.ts` — verifies HMAC-SHA512 signature, calls same RPC
- **RPC**: `activate_paystack_subscription` — logs to `paystack_payments` table, upgrades `profiles.user_tier` to `premium`

---

## Plan Prices

| Plan | Price (excl. VAT) | VAT (7.5%) | Total at Checkout |
|---|---|---|---|
| Monthly | ₦4,500 | ₦337.50 | ₦4,837.50 |
| Quarterly | ₦12,000 | ₦900 | ₦12,900 |
| Bi-Annual | ₦22,500 | ₦1,687.50 | ₦24,187.50 |
| Annual | ₦45,000 | ₦3,375 | ₦48,375 |
| B2B Annual | ₦120,000 | ₦9,000 | ₦129,000 |

---

## Test Account

| Field | Value |
|---|---|
| Email | `mondaymichael161@gmail.com` |
| Password | `TestPass123!` |
| Status | Email confirmed, free tier |
| User ID | `8748fd3e-555c-4943-b499-a01b3f18d2e0` |

---

## Test Promo Codes

| Code | Discount | Plan | Expires | Max Uses |
|---|---|---|---|---|
| `TEST50` | 50% off | Monthly | 2027-01-01 | 10 |
| `FREE100` | 100% free | Monthly | 2027-01-01 | 10 |

### How they behave in the UI
- `TEST50` on monthly → total drops from ₦4,837.50 to ₦2,418.75, Paystack popup opens
- `FREE100` on monthly → Paystack button is replaced with "Activate Free Subscription" button (no payment needed)

---

## Paystack Test Cards (use with `pk_test_...` key)

Swap `VITE_PAYSTACK_PUBLIC_KEY` in `.env` to your test key from Paystack Dashboard → Settings → API Keys.

| Field | Value |
|---|---|
| Card Number | `4084 0840 8408 4081` |
| Expiry | `01/25` |
| CVV | `408` |
| PIN | `0000` |
| OTP | `123456` |

---

## Webhook Setup (Paystack Dashboard)

1. Go to **Paystack Dashboard → Settings → API Keys & Webhooks**
2. Add webhook URL: `https://seizblulwtalsucqguld.supabase.co/functions/v1/paystack-webhook`
3. The webhook verifies every request using HMAC-SHA512 — invalid signatures return `401`

---

## Deploying the Webhook Function

```sh
# Login to Supabase CLI
npx supabase login

# Set the secret key
npx supabase secrets set PAYSTACK_SECRET_KEY=sk_live_ff468a3c47464a24d4930e095da93541ff1c895d --project-ref seizblulwtalsucqguld

# Deploy the webhook function
npx supabase functions deploy paystack-webhook --project-ref seizblulwtalsucqguld
```

---

## Cleanup — Remove Test Data via CLI

### Delete test promo codes
```sh
# Delete TEST50
curl -X DELETE "https://seizblulwtalsucqguld.supabase.co/rest/v1/promo_codes?code=eq.TEST50" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "apikey: <service_role_key>"

# Delete FREE100
curl -X DELETE "https://seizblulwtalsucqguld.supabase.co/rest/v1/promo_codes?code=eq.FREE100" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "apikey: <service_role_key>"
```

### Delete test payment records
```sh
curl -X DELETE "https://seizblulwtalsucqguld.supabase.co/rest/v1/paystack_payments?reference=like.INV-TEST*" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "apikey: <service_role_key>"
```

### Delete test user account
```sh
# Delete from auth (cascades to profiles, wallets, etc.)
curl -X DELETE "https://seizblulwtalsucqguld.supabase.co/auth/v1/admin/users/8748fd3e-555c-4943-b499-a01b3f18d2e0" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "apikey: <service_role_key>"
```

### Reset a user back to free tier
```sh
curl -X PATCH "https://seizblulwtalsucqguld.supabase.co/rest/v1/profiles?id=eq.<user_id>" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <service_role_key>" \
  -H "apikey: <service_role_key>" \
  -d '{"user_tier":"free","subscription_type":null,"subscription_expires_at":null}'
```

### Confirm all unconfirmed users (run in Supabase SQL Editor)
```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;
```

---

## Test Results Log

| Test | Result | Date |
|---|---|---|
| Invalid webhook signature | ✅ 401 Invalid signature | 2026-08-05 |
| Missing metadata in webhook | ✅ 400 Missing metadata | 2026-08-05 |
| RPC activates subscription | ✅ 200, user_tier → premium | 2026-08-05 |
| Duplicate reference upsert | ✅ 200, no error | 2026-08-05 |
| Valid webhook end-to-end | ✅ 200 OK, profile → annual, expires 2027 | 2026-08-05 |
| Payment records logged | ✅ Records in paystack_payments table | 2026-08-05 |
| Login with confirmed account | ✅ 200, access_token returned | 2026-08-05 |

---

## Known Issues & Notes

- **Email confirmation**: Supabase has email confirmation ON by default. New signups cannot log in until confirmed. Either turn it off in **Authentication → Providers → Email → Confirm email** or confirm users manually via SQL.
- **Email rate limit**: Supabase free tier limits signup emails. Use the admin API to create test users: `POST /auth/v1/admin/users` with `email_confirm: true`.
- **Schema cache**: After running SQL migrations, Supabase's auth service may return `500 Database error querying schema`. Fix by going to **Settings → General → Restart server** in the dashboard.
- **Subscribe page redirect**: Users already on the `annual` plan are redirected away from `/subscribe`. Reset to free tier using the cleanup command above before testing.
