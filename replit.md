# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

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

### API Endpoints
- `POST /api/users` - Create or find user by username
- `GET /api/users/:userId` - Get user
- `GET /api/trips?userId=X` - Get trips for user
- `POST /api/trips` - Create trip (auto-generates invite code)
- `POST /api/trips/join` - Join trip with invite code
- `GET /api/trips/:tripId` - Trip details with members and events
- `DELETE /api/trips/:tripId` - Delete trip
- `GET /api/trips/:tripId/members` - Get members
- `GET /api/trips/:tripId/events` - Get events
- `POST /api/trips/:tripId/events` - Create event
- `DELETE /api/trips/:tripId/events/:eventId` - Delete event

### DB Schema
- `users` - id, username (unique), created_at
- `trips` - id, name, destination, description, start_date, end_date, invite_code (unique), creator_id
- `trip_members` - id, trip_id, user_id, joined_at
- `events` - id, trip_id, type, title, location, date, start_time, end_time, notes, creator_id, created_at

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
