# PVÖL Förråd

Private Swedish mobile community app, built in the existing `pvol-app` repository. Inspired by the supplied Tisdagsklubben v14 source: private membership, server-side access checks, shared feed and protected photos. PVÖL retains its navy/yellow identity, department categories, recurring meetings and shared attendance statuses with private notes.

## Production

https://pvol-forrad.vercel.app

Existing Vercel project `pvol-forrad`; existing Supabase project `usximvurnararrwsnbit`. No SMTP, email delivery provider or additional paid service is required. Existing hosting/storage quotas apply.

## Design

- Static HTML, CSS and JavaScript, with a Vercel `/api` server proxy.
- Supabase Auth handles password hashing, password login and refresh sessions.
- Tokens live in Secure, HttpOnly, SameSite cookies; no auth token in localStorage.
- State-changing proxy calls require an exact same-origin header.
- The Edge Function `pvol-api` checks Auth identity, live session and active membership on each protected request. All application tables deny direct anon/authenticated access; only the server can query them.
- Invite tokens contain 256 random bits. Only SHA-256 hashes are stored. They expire in seven days and are consumed with a row lock. Signup creates a normal member only. Concurrent losers are cleaned up.
- Existing owner identity remains the main admin. Only the owner can change roles, suspend accounts or create password recovery links. Owner role cannot be granted through the UI.
- Recovery links revoke existing sessions. Suspending members immediately denies all subsequent API access. Private signed photo URLs expire after five minutes.
- User text is escaped; images are re-encoded by the browser and signature/size-checked on the server. CSP blocks inline scripts and framing.
- Attendance is returned only for the authenticated member, including for admins.

## Features

Posts, category filters, private photos, comments, edit/delete permissions, activities and calendar export, alternating weekly meetings and admin overrides, shared attendance statuses with private notes, job pages with instructions and important information, shared question chat, a dialable telephone directory, searchable instructions, invitation revocation, member roles and suspension, password changes and manual password recovery.

## Deploy

Deploy root files and `api/index.mjs` to the existing Vercel project. SQL migrations are in `supabase/migrations`. Deploy `supabase/functions/pvol-api/index.ts` as `pvol-api` with JWT gateway verification disabled because it performs its own Auth and live-session verification. Service credentials are supplied by the existing Edge runtime and are never sent to the browser or Vercel.

## Verification

`node --check app.js` and `node --check api/index.mjs` validate JavaScript syntax. `node tests/frontend.mjs` verifies every rendered view, role menus, text escaping and Swedish timezone transitions. `tests/proxy.py` verifies production cookies, CSRF protection, session refresh and logout with a disposable test account. `tests/e2e.py` checks the live API with disposable test accounts; it requires an operator-created test invitation and explicit test-account promotion before admin tests. Test accounts and test content must be removed after the run.

## Limits

No email ownership verification is claimed: the manually delivered invitation authorizes membership and the chosen address is a login identifier. Account recovery requires a new one-time link from the owner. Supabase's paid leaked-password screening is not required; this app enforces at least 12 characters with letters and numbers. Feed returns the latest 200 posts and 2,000 comments; activities are capped at 500 per fetch. These limits prevent unbounded responses. Existing Supabase data is retained.

Security advisor references: [closed tables with RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) are intentional because this app uses a server-only data layer; [leaked password screening](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains disabled on the existing plan.

## Community features

Every job button opens its own instructions and important information. Administrators create and edit instructions. All active members can chat and add or edit directory entries; authors and administrators can delete them. Directory numbers are validated and use `tel:` links. Attendance statuses are visible to active members; the API strips private notes belonging to others. Chat refreshes every 15 seconds while open, without interrupting a draft. The database extension is in `db/community.sql`.
