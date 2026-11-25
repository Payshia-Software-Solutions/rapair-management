# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Monorepo of separate apps with no shared root build. Each app has its own dependencies and config.

- `front-end/`: main Next.js app (App Router, `src/app`). Port 9003.
- `server/`: main PHP API. Served under the `/api/...` path.
- `nexus-portal-ui/`: separate Next.js 16 app for the Nexus Portal.
- `nexus-portal-server/`: PHP API for the Nexus Portal (Composer deps in `vendor/`).
- `desktop_pos/`, `mobile_pos/`, `room-kiosk-app/`, `local-printer/`, `local-printer-py/`: clients and helpers. 
- Don't add one-off scripts to the repo; keep them in a local scratch folder.

## Commands

### front-end (`cd front-end`)
- `npm run dev`: starts `server.js` in dev mode on port 9003. Use this one. It wraps Next and returns a 500 page instead of crashing on missing `.next` artifacts.
- `npm run dev:next` / `npm run dev:turbopack`: plain `next dev`, without the wrapper.
- `npm run build` then `npm start`: production run on port 9003.
- `npm run lint`, `npm run typecheck` (`tsc --noEmit`).
- `npm run genkit:dev`: Genkit flows in `src/ai/`.
- No test runner is configured.

### nexus-portal-ui (`cd nexus-portal-ui`)
- `npm run dev`, `npm run build`, `npm run lint`.
- This is Next 16, which has breaking changes. Read `node_modules/next/dist/docs/` before writing code (see `AGENTS.md`).

### PHP backends
- No build step and no test suite. Install deps with `composer install` in `server/` or `nexus-portal-server/`.
- No verification scripts are kept in the repo. Debug/test scripts must never go in `server/public/` (the deploy excludes `test_*`, `debug_*`, `check_*`, `fix_*`, `seed_*`, `migrate_*`, `scratch_*` there).

### Deployment
- Pushing to `live-prod` FTP-deploys `./server/` (ERP API, `.github/workflows/erp-api-live-prod.yml`).
- Pushing to `nexus-server-api-live` FTP-deploys `./nexus-portal-server/` (Nexus API, `.github/workflows/nexus-api-live.yml`).
- Workflows exclude `.env*`, `config/config.php`, `scratch/`, `logs/` and uploads. Production config is placed on the server by hand.

## Code navigation

When you need to locate unfamiliar code or trace how a feature works across files, query the existing Graphify graph first. Use a short search phrase, then verify the result in the relevant source files. If the file is already known, open it directly. Reuse the existing graph for routine tasks.

## Architecture (big picture)

### Backend routing (`server/`)
- `server/public/index.php` is the entry point. It sets the timezone to Asia/Colombo, loads `config/config.php`, handles CORS, and then hands off to the router.
- `server/app/core/App.php` maps `/api/{segment}/{method}` to `app/controllers/{Name}Controller.php`. Dashes become CamelCase. Missing controller falls back to `PagesController`.
- Controllers (~122 in `app/controllers/`) extend `core/Controller.php`. Data access goes through models in `app/models/` that extend `core/Model.php`.
- Schema is defined in `app/helpers/*Schema.php` modules and snapshotted in `app/core/schema_snapshot.json`. `SchemaDefinition.php` and `SchemaHelper.php` drive it. Check both before changing a table.
- Business logic lives in `app/helpers/` (accounting, approvals, invoicing, inventory, HR, AI, email, FTP storage, JWT). Controllers should stay thin.

### Multi-tenancy
- Two modes, selected by config and env, not by code branches:
  - One `server/config/config.php` (copy of `config/config.example.php`) reads `server/.env` (copy of `.env.example`). `APP_MODE=single` defines `DB_*`, `JWT_SECRET`, and similar.
  - `APP_MODE=shared`: `app/tenancy/Tenancy.php::boot()` defines per-workspace DB and key constants from a control database (`TENANCY_CONTROL_DB_*`).
- Front-end side: with `NEXT_PUBLIC_TENANT_MODE=shared`, a script in the root layout wraps `window.fetch` and adds `X-Tenant-Host`, so every call carries the workspace domain. `src/lib/tenant.ts` holds this logic.
- `MASTER_KEY` encrypts tenant DB passwords. Never change it once a workspace exists.

### Front-end data flow
- Every API call goes through `src/lib/api/client.ts` (`api()`). It adds the Bearer token from `localStorage.auth_token`, `X-Location-Id` from `localStorage.location_id`, and tenant headers.
- `src/lib/api/*.ts` has one module per domain (orders, finance, inventory, hrm, reports, ...). `index.ts` re-exports them. Add new endpoints to the matching module.
- `api()` rewrites `localhost` in `NEXT_PUBLIC_API_URL` to the page's LAN hostname, so tablets on the same network reach the API.
- Session and role logic is in `src/lib/session.ts`. Navigation is driven by `src/lib/nav-items.ts`, and `src/lib/dashboards.ts` and `home-route.ts` pick the landing page.
- Cross-cutting UI components live in `src/components/` (`dashboard-layout.tsx`, `dock-menu.tsx`, `bizflow-ai-assistant.tsx`, which is mounted globally from `app/layout.tsx`).

### Known gotchas
- `bizflow-ai-assistant.tsx` hides itself by matching path substrings in `HIDDEN_ON`. Add a path there to hide the bot on a page (e.g. `/login`).
- CORS origins are a hard-coded allowlist in `server/public/index.php`. A new frontend origin needs an entry there, unless it's on `nebulync.com` or a registered tenant domain.
