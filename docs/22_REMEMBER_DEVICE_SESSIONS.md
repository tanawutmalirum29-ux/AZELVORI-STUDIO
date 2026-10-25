# Remembered Device Sessions — AZELVORI

## Current behavior before this change

Both existing Cognito app clients had 8-hour **refresh** token validity. Access/ID tokens lasted 5 minutes and refreshed on API use, but sign-in ended when the short refresh token expired or the browser's tab-scoped sessionStorage was lost.

## Behavior after deploying these changes

- **Studio founder and clients:** first-party email/password/MFA login now includes a checked-by-default "remember this device" checkbox. New Cognito refresh tokens last **30 days** from initial sign-in. A different tab or browser restart can restore the session without entering the password again during that 30-day validity window.
- **Employees:** employee-key login also defaults to "remember this device"; refresh tokens last **365 days** after sign-in. The user can uncheck the box on a shared computer; that session remains tab-only.
- When remembered, the browser stores *only the opaque refresh token* in localStorage; access/ID JWTs are short-lived and stored only in sessionStorage (or restored on demand via Cognito). Passwords, OTPs and MFA setup secrets are never persisted. The hosted Cognito fallback continues to use tab-scoped sessions.
- A refresh is performed on the next authenticated request. Temporary connection failures do not erase the saved session; explicit logout deletes both local and tab session storage and revokes the refresh token.
- **Revoked employee credentials:** backend checks the active employee grant at each employee API request. Even if a client holds an unexpired access token or long-lived refresh token, it cannot read or send employee data after founder revocation. Cognito disables the old user account and new logins fail. Reissuing the numeric key creates a different Cognito user identity, never restoring old tokens.
- Because Cognito refresh expiration is fixed (not sliding), **neither session is literally permanent**. Reauthentication will be needed by day 30 (studio) or day 365 (employee), and also after explicit logout, administrator revocation, deleting site data, changing browser/device, or certain privacy-browser storage cleanup.
- Web storage is vulnerable to same-origin script injection; use this feature only on trusted devices. A secure HttpOnly cookie session with backend-managed rotating token state would offer stronger protection but is a separate architectural project. CSP, dependency auditing, HTTPS and short-lived JWTs should remain enforced.

## Deployment

1. Merge only after CI, native TypeScript, integration/unit tests, Playwright Chromium/WebKit and CDK synthesis pass.
2. Confirm Amplify deploy of the corresponding main commit.
3. In Sydney, the existing AWS account and `Azelvori-staging` stack, review `cdk diff` with the existing context: `stage=staging`, `appOrigin=https://main.d3uhwi8blbgrci.amplifyapp.com`, `intakeEnabled=false`, `legalReady=false`, `lambdaConcurrency=shared`.
4. Expected changes: `EmployeeWebClient.RefreshTokenValidity=365 days` and `WebClient.RefreshTokenValidity=30 days`. **No** existing user pool, API or database replacement/deletion.
5. Deploy only after reviewing the exact diff. Old sessions that were issued before this change may still expire after 8 hours; log in once after deployment to obtain a newly issued long-lived refresh token.
6. Test owner MFA flow, staff login via numeric key, browser refresh and close/reopen, checkbox unchecked path, manual logout, staff account disable while another browser has a live token, and a temporary network outage.

## Operational note

Long-lived sessions make physical device loss or stolen browser storage more important. Disable a compromised employee key immediately. For an administrator's lost device, revoke sessions in Cognito and consider a password reset. Do not add passwords or refresh tokens to application logs, screenshots or support tickets.
