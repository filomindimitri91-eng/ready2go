# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database (production/Vercel)**: GitHub JSON DB (`artifacts/api-server/src/github-db.ts`) — stores data as JSON files in a private GitHub repo (`filomindimitri91-eng/ready2go-data`)
- **Database (local dev)**: same GitHub JSON DB — uses GITHUB_TOKEN + GITHUB_DB_OWNER + GITHUB_DB_REPO env vars
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build (local)**: esbuild → `.mjs` ESM bundle (via `artifacts/api-server/build.mjs`); `openai` marked as external
- **Build (Vercel)**: `@vercel/node` per-file TypeScript transpilation → CJS. CRITICAL: `api/package.json` MUST have `"type": "commonjs"` — having `"type": "module"` causes Node.js to load the CJS output as ESM → FUNCTION_INVOCATION_FAILED. `api/index.ts` uses a lazy dynamic import with error handling. Pino uses `process.stdout` in production to avoid worker thread issues in Lambda.
- **Vercel production URL**: `https://ready2go-api-server.vercel.app`

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── ready2go/           # React + Vite frontend (Ready2Go app)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
├── pnpm-workspace.yaml     # pnpm workspace
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## Application: Ready2Go

A travel planning app in French where users can:
- Create a username (no password needed)
- Create trips with name, destination, dates, description
- Share trips via invite codes
- Add events to trips (activite, transport, logement, reunion, autre)
- View the trip program grouped by date
- See group members

### Routes
- `/` - Dashboard (list of user's trips)
- `/login` - Login/onboarding page (create username)
- `/voyage/:id` - Trip details (program + group tabs)

### Features
- Username-only authentication (stored in localStorage)
- Create/join trips via 8-char invite codes
- 5 event types: activité, transport, logement, restauration, autre
- Per-event pricing with `pricePerPerson` and `priceType` (per_person/per_adult/per_group)
- Events can be `forAll: true` (partagé avec tous) or personal (`participantIds: [userId]`)
- Edit events via modal (PUT endpoint); admins can edit any event, members can edit personal ones
- **Participant profiles**: selector in Programme tab (filter events per participant)
- **Admin system**: creator auto-assigned admin role; admins can promote/demote (max 4 admins)
- Groupe tab: "Administrateurs" section with promote/demote buttons; role badges
- Budget tab: "Par participant" view (2+ members) shows per-member cost breakdown
- Budget tab with adults/children count, per-event cost breakdown, and AI estimation
- Map-based location search (Nominatim/OpenStreetMap)
- Group tab with invite code + real-time member location sharing
- Tab order: Programme > Budget > Groupe > Assistant

### API Endpoints
- `POST /api/users` - Create or find user by username
- `GET /api/users/:userId` - Get user
- `GET /api/trips?userId=X` - Get trips for user
- `POST /api/trips` - Create trip (auto-generates 8-char invite code; creator becomes admin)
- `POST /api/trips/join` - Join trip with invite code
- `GET /api/trips/:tripId` - Trip details with members (incl. roles) and events
- `DELETE /api/trips/:tripId` - Delete trip (creator only)
- `GET /api/trips/:tripId/members` - Get members with roles
- `PATCH /api/trips/:tripId/members/:userId/role` - Change member role (admin only, max 4 admins)
- `GET /api/trips/:tripId/events` - Get events
- `POST /api/trips/:tripId/events` - Create event (supports forAll, participantIds)
- `PUT /api/trips/:tripId/events/:eventId` - Update event (permission-aware)
- `DELETE /api/trips/:tripId/events/:eventId` - Delete event
- `POST /api/ai/budget` - AI budget estimation (accepts customNotes)

### DB Schema (GitHub JSON DB)
- `users` - id, username (unique), createdAt
- `trips` - id, name, destination, description, startDate, endDate, inviteCode (unique, 8 chars), creatorId
- `members` - id, tripId, userId, **role** ("member"|"admin"), joinedAt
- `events` - id, tripId, type, title, location, date, startTime, endTime, notes, creatorId, pricePerPerson, priceType, **forAll** (boolean), **participantIds** (number[]|null), transportData, lodgingData, restaurationData, activiteData, createdAt

### Key Components
- `artifacts/ready2go/src/pages/trip-details.tsx` — main trip page (5 tabs)
- `artifacts/ready2go/src/components/budget-tab.tsx` — budget breakdown + AI estimation
- `artifacts/ready2go/src/components/price-section.tsx` — shared price input + priceType selector
- `artifacts/ready2go/src/components/activite-form.tsx`, `restauration-form.tsx`, `lodging-form.tsx`, `transport-form.tsx` — event forms

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/ready2go` (`@workspace/ready2go`)

React + Vite frontend. Mobile-first, Tailwind CSS, framer-motion animations.
Uses `@workspace/api-client-react` for type-safe API calls via React Query.

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`.
- `src/routes/health.ts` — health check
- `src/routes/users.ts` — user creation/retrieval
- `src/routes/trips.ts` — trips, events, members CRUD

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.
- `src/schema/users.ts` — users table
- `src/schema/trips.ts` — trips and trip_members tables
- `src/schema/events.ts` — events table

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config.
Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client.

### `scripts` (`@workspace/scripts`)

Utility scripts package.
