# Admin Auth and Preflight

## Admin session hardening

Sensitive ML admin endpoints now support cookie-based admin sessions.

- `POST /api/v1/auth/admin/login`
  - Requires `x-admin-key` header.
  - On success sets `HttpOnly` cookie `viabaq_admin_session`.
- `POST /api/v1/auth/admin/logout`
  - Clears admin session cookie.
- `GET /api/v1/auth/admin/session`
  - Returns `{ authenticated: boolean }`.

`requireAdminAuth` now accepts:

1. Valid admin session cookie, or
2. Valid `x-admin-key` (backward-compatible for scripts).

Frontend `Admin ML` page uses session login/logout and sends admin requests with `credentials: include`.

## Preflight (CI / before push)

From repo root:

```bash
npm run preflight
```

Preflight runs:

1. Frontend lint
2. Backend typecheck
3. Backend lint
4. Backend build
5. Frontend build
6. Smoke checks

If your local Windows environment hits `spawn EPERM` during `next build`, you can run:

```bash
PREFLIGHT_SKIP_FRONTEND_BUILD=1 npm run preflight
```

Use this only for local diagnosis. Keep full preflight in CI.

## Smoke checks

Smoke is optional by default.

- If `SMOKE_BASE_URL` is not set, smoke is skipped with success status.
- If set, smoke checks:
  - `<SMOKE_BASE_URL>/health`
  - `<SMOKE_BASE_URL>/api/v1/predictions/health`

Example:

```bash
SMOKE_BASE_URL=http://localhost:4000 npm run smoke
```
