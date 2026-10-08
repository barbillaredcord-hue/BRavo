# BRavo 0.3B — Partners foundation

## Scope
External businesses can eventually register, verify ownership of their website, publish services, receive leads and subscribe. Existing websites stay hosted wherever the partner chooses. BR Companion ranks by relevance; paid placement must be clearly labeled and must not silently alter organic relevance.

## Current implementation
Additive SQL migration in `db/migrations/003_bravo_partners.sql`. No public registration, domain verification, payment collection, or partner API is enabled yet. Do not represent demo catalog entries as verified partners.

## Activation order
1. Apply and review schema on BRavo's isolated Neon database; no other BR Studios projects.
2. Add authenticated owner onboarding and membership checks; default new partner to draft.
3. Implement domain ownership proof with DNS TXT or a verification file and manual review; never treat a URL submission as ownership.
4. Allow approved partners to create services and send requests to their own workspace only.
5. Define plan entitlements and integrate a payment provider with verified webhooks and idempotency before activating subscriptions.
6. Add moderation, abuse prevention, privacy notices and operational audit trail.

## Acceptance criteria
No cross-partner access; unapproved listings cannot appear in public search; subscription status comes from verified provider events; organic ranking does not depend on subscription level.
