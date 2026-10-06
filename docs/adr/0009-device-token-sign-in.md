# 0009: Sign in with a per-phone token from an invite code, no passwords

- **Status:** Accepted, 2026-09-29 (Phase 1 build)
- Backfilled 2026-10-01 from `server/src/auth.ts` and `src/lib/session.ts`.

## Context
Parents and a teen need to get set up in a minute, with no email or password to forget. The driver's phone must stay signed in while locked, because drives are logged in the background.

## Decision
- A parent starts a family; everyone else joins with a 6-character invite code a parent makes (one use, expires after 7 days).
- On sign-up the server makes a long random token (32 bytes) for that phone and stores only its SHA-256 hash.
- The phone keeps the token in the iPhone keychain, readable after first unlock.
- Sign-ups are limited to 10 tries per minute per network address (added 2026-10-01).

## Consequences
No email or password is collected. A lost phone means joining again with a new code. Tokens do not expire; a parent can sign a phone out for good by removing the member.
