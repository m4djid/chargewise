# Vendor DPA register

GDPR Data Processing Agreements for every vendor that processes personal data
(spec §8.3, launch checklist §13). Keep this file current: check the box only
once the DPA is signed/accepted and archived.

| Vendor | Purpose | Data processed | EU residency | DPA link | Status |
| --- | --- | --- | --- | --- | --- |
| Supabase | Database + auth | Emails, profiles, badges, sessions | eu-central-1 (Frankfurt) | https://supabase.com/legal/dpa | [ ] Signed |
| Vercel | Hosting | Request metadata, logs | EU region | https://vercel.com/legal/dpa | [ ] Signed |
| PostHog | Product analytics (consent-gated) | Pseudonymous events | EU cloud | https://posthog.com/handbook/company/dpa | [ ] Signed |
| Sentry | Error monitoring | Error payloads (redacted) | EU-hosted | https://sentry.io/legal/dpa/ | [ ] Signed |
| Resend | Transactional email | Email addresses | EU region SMTP | https://resend.com/legal/dpa | [ ] Signed |
| Upstash | Rate limiting (Redis) | Hashed IPs / counters | EU region | https://upstash.com/trust/dpa.pdf | [ ] Signed |
| Stripe (Phase 2) | Payments — not live in Phase 0/1 | Payment data (Phase 2) | PCI-DSS L1 | https://stripe.com/legal/dpa | [ ] Signed (before Phase 2) |

## Notes

- Re-verify all DPA links quarterly; vendors occasionally move them.
- If a vendor is added or replaced, update this table in the same PR that
  introduces the dependency.
- Launch gate: Supabase, Vercel, PostHog, Sentry, Resend and Upstash must be
  checked before Phase 0 goes public. Stripe is only required before Phase 2.
