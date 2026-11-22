# Deen One — Accounts and mosque proposals

Prepared backend: Supabase Auth + Postgres RLS, with optional sync of display name, selected progress records, and mosque suggestions. Until configured, Deen One keeps its local profile and does NOT claim cloud accounts exist.

## Activate
1. Create a Supabase project and enable email authentication, verification and suitable anti-abuse controls.
2. Run `schema.sql` in Supabase SQL Editor.
3. Set the **public project URL** and **publishable/anon key** in `account.js`. Never put a service_role key or private key in browser code. Restrict auth redirect URLs to your actual app origin.
4. Test signup, email verification, sign-in, sign-out, cross-device sync, unauthenticated denial, and RLS user isolation. The profile sync is an initial implementation; existing app reading progress remains local until explicitly wired to cloud.
5. Review and approve mosque submissions in the Supabase dashboard; publishing approved entries into `data/mosques.json` is a separate manual moderation step.
6. Review privacy policy, retention, consent, data export/deletion, and moderation before production.

The app remains usable without an account. Do not force sign-in for prayer times or Quran reading.

## Google login and biometrics
- In Supabase Auth > Providers, enable Google and configure its OAuth client ID/secret in the **Supabase dashboard**, not in GitHub. Register the callback URL shown by Supabase in Google Cloud and add the deployed Deen One URL to Supabase redirect allowlist.
- The app's **Continue with Google** button calls `signInWithOAuth({provider:'google'})` only after Supabase is configured.
- Biometric login is **not implemented**. Never use a local fingerprint prompt as proof of a cloud identity. Evaluate standards-based WebAuthn/passkeys using a provider that supports passkeys and correct account binding, recovery, device compatibility, and Android WebView behavior. Do not store biometric templates in Deen One.
- Apple sign-in can be considered later, subject to provider configuration and applicable platform requirements.
