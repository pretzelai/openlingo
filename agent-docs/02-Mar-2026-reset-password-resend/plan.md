# Reset Password with Resend — Implementation Plan

## Research Findings

### Current State

- **Better Auth v1.4.18** is configured at `lib/auth.ts` with `emailAndPassword: { enabled: true }` but **no `sendResetPassword` callback** — meaning password reset is entirely disabled.
- **No email provider** exists in the project. No `resend` package, no SMTP config, no email templates.
- The `verification` table already exists in the DB schema (`lib/db/schema.ts:59-66`) — this is the standard Better Auth table used to store password reset tokens. No migration needed.
- The auth client (`lib/auth-client.ts`) is minimal — just `createAuthClient()` with no plugins. Better Auth's client already exposes `authClient.requestPasswordReset()` and `authClient.resetPassword()` out of the box when the server is configured.
- The sign-in form (`components/auth/sign-in-form.tsx`) has **no "Forgot password?" link**.
- Auth pages live under the `(auth)` route group, which uses a centered card layout (`app/(auth)/layout.tsx`).
- Cloudflare Turnstile is used on sign-in/sign-up via a custom Better Auth plugin (`lib/turnstile-plugin.ts`) that intercepts `/sign-in/email` and `/sign-up/email` paths.

### Better Auth Password Reset Flow

According to the Better Auth docs, the flow is:

1. **Server config**: Add `sendResetPassword` callback to `emailAndPassword` config. This receives `{ user, url, token }` and a `request` object. The callback should send an email with the reset URL.
2. **Client — request reset**: Call `authClient.requestPasswordReset({ email, redirectTo })`. This triggers the `sendResetPassword` callback on the server if the user exists. The `redirectTo` URL is where the user lands after clicking the link — Better Auth appends `?token=VALID_TOKEN` (or `?error=INVALID_TOKEN` if expired).
3. **Client — reset password**: On the reset page, extract the `token` from the URL query params and call `authClient.resetPassword({ newPassword, token })`.
4. **Optional**: `onPasswordReset` callback for post-reset logic (logging, etc.).

### Resend Integration

- Install the `resend` npm package.
- Initialize with `RESEND_API_KEY` environment variable.
- Use `resend.emails.send()` with `html` content (simple HTML email, no need for React Email given the simplicity).
- The `from` address should use a verified domain. We'll use an env var `RESEND_FROM_EMAIL` to keep it configurable.

## Design Decisions

1. **Email utility module**: Create `lib/email.ts` that initializes the Resend client and exports a `sendEmail` helper function. This keeps email logic centralized and reusable for future emails (e.g., email verification, welcome emails).
2. **No React Email dependency**: The reset password email is simple enough that we'll use plain HTML. No need to add `@react-email/*` packages.
3. **Three new pages under `(auth)` route group**:
  - `/forgot-password` — Form to request the reset email (email input only).
  - `/reset-password` — Form to set a new password (receives `?token=` from the email link). Also handles `?error=INVALID_TOKEN` for expired/invalid tokens.
4. **Turnstile protection on forgot-password**: We will NOT add Turnstile to the forgot-password form. Better Auth already rate-limits and doesn't reveal whether an email exists. Adding Turnstile here would add friction without meaningful security benefit. If desired later, the existing Turnstile plugin can be extended.
5. **Environment variables**: Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `example.env.local`.
6. **Avoid awaiting email send**: Per Better Auth docs, avoid awaiting the email send to prevent timing attacks (which could reveal whether an email exists). We'll use `void` to fire-and-forget.
7. **Success messaging**: After requesting a reset, always show the same success message regardless of whether the email exists — "If an account exists with that email, you'll receive a reset link." This prevents email enumeration.
8. **Password validation**: Match existing sign-up form behavior — minimum 8 characters.

## Edge Cases & Attention Points

- **Token expiration**: Better Auth handles token expiry internally. If the token is expired, the redirect URL will have `?error=INVALID_TOKEN`. The reset-password page must handle this gracefully with a message and link to re-request.
- **User already signed in**: No special handling needed — the auth layout doesn't block authenticated users from accessing auth pages.
- **Google-only users**: If a user signed up with Google and tries to reset password, Better Auth won't find a credential account. The `sendResetPassword` callback won't be triggered (or will be, but the reset won't work). The UX should handle this gracefully — the "check your email" message is shown regardless, which is fine.
- **Missing `RESEND_API_KEY`**: The email helper should log a warning if the key is not set (dev mode) rather than crashing. This allows local development without Resend configured.
- `**redirectTo` URL**: Must be a full URL. We'll construct it from `BETTER_AUTH_BASE_URL` env var + `/reset-password`.

## Files to Create / Modify


| File                                       | Action     | Purpose                                                       |
| ------------------------------------------ | ---------- | ------------------------------------------------------------- |
| `lib/email.ts`                             | **CREATE** | Resend client initialization + `sendEmail` helper             |
| `lib/auth.ts`                              | **MODIFY** | Add `sendResetPassword` callback to `emailAndPassword` config |
| `components/auth/sign-in-form.tsx`         | **MODIFY** | Add "Forgot password?" link below password field              |
| `app/(auth)/forgot-password/page.tsx`      | **CREATE** | Forgot password page (server component)                       |
| `components/auth/forgot-password-form.tsx` | **CREATE** | Forgot password form (client component)                       |
| `app/(auth)/reset-password/page.tsx`       | **CREATE** | Reset password page (server component)                        |
| `components/auth/reset-password-form.tsx`  | **CREATE** | Reset password form (client component)                        |
| `example.env.local`                        | **MODIFY** | Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL`                  |


## Implementation Steps

- 1. Install the `resend` npm package via `bun add resend`
- 1. Create `lib/email.ts` — Resend client init + `sendEmail` helper
- 1. Modify `lib/auth.ts` — Add `sendResetPassword` callback that sends the reset email using Resend
- 1. Add `RESEND_API_KEY` and `RESEND_FROM_EMAIL` to `example.env.local`
- 1. Create `components/auth/forgot-password-form.tsx` — Email input form, calls `authClient.requestPasswordReset()`, shows success/error messages
- 1. Create `app/(auth)/forgot-password/page.tsx` — Server component page wrapping the form
- 1. Create `components/auth/reset-password-form.tsx` — New password form, reads `token` from URL, calls `authClient.resetPassword()`, handles `?error=INVALID_TOKEN`
- 1. Create `app/(auth)/reset-password/page.tsx` — Server component page wrapping the form
- 1. Modify `components/auth/sign-in-form.tsx` — Add "Forgot password?" link after the password input
- 1. Verify the build compiles without errors (`bun run build` or `bun run dev`)

