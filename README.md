# HardFeelings

Training plans for amateur runners: algorithmic generation first, then a coaching chat that proposes calendar changes. Hard bounds decide what can land; the member accepts or rejects the rest.

Live: [https://hard-feelings.ikul.workers.dev](https://hard-feelings.ikul.workers.dev)

Product contract: [`context/foundation/prd.md`](context/foundation/prd.md). Agent onboarding: [`AGENTS.md`](AGENTS.md).

## What it does

A signed-in member can:

- set weekly km and manage races with A–D priorities
- generate a week into the calendar (optional frozen anchors)
- ask chat to explain a unit or adapt a day, then accept / reject / continue — out-of-bounds proposals cannot be accepted
- edit a workout with undo, and log completed sessions (manually or via chat)

A hidden Admin panel (`/admin`) reviews agent gap reports and sets the project-wide OpenAI chat model. The model never writes the plan; `generatePlan` / `validatePlan` stay first-class.

## Tech stack

- [Astro](https://astro.build/) 6 SSR + [React](https://react.dev/) 19 islands
- [TypeScript](https://www.typescriptlang.org/) 5, [Tailwind CSS](https://tailwindcss.com/) 4, [Zod](https://zod.dev/)
- [Supabase](https://supabase.com/) Auth + Postgres (RLS)
- [Cloudflare Workers](https://workers.cloudflare.com/) (`output: "server"`)

Node **22.14.0** (see `.nvmrc`).

## Getting started

```bash
npm install
cp .env.example .env
cp .env.example .dev.vars
```

Fill `SUPABASE_URL` and `SUPABASE_KEY` (local stack or a hosted project). Then:

```bash
npm run dev
```

### Local Supabase (Docker)

Needs Docker and roughly 7 GB RAM.

```bash
npx supabase start
```

Copy the printed URL and anon key into `.env` and `.dev.vars`:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_KEY=<anon key from CLI output>
```

Apply product tables:

```bash
npx supabase db reset
```

After pulling a new migration without wiping local users:

```bash
npx supabase migration up --local
```

Studio: `http://localhost:54323`. Stop with `npx supabase stop`.

To skip email confirmation locally: Studio → Authentication → Email → Confirm email → off.

To grant `/admin`, insert the user's `auth.users.id`:

```sql
INSERT INTO user_roles (user_id, role) VALUES ('<auth.users id>', 'admin');
```

### Hosted Supabase

| Variable         | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `SUPABASE_URL`   | Project URL → Settings → API                                                      |
| `SUPABASE_KEY`   | `anon` public key → Settings → API                                                |
| `OPENAI_API_KEY` | Server-only. Omit to keep the deterministic chat stub                             |
| `OPENAI_MODEL`   | Optional fallback when Admin has not saved an override. Defaults to `gpt-4o-mini` |

These are **server-only** (`astro:env`). Never expose them to the client.

## Scripts

- `npm run dev` — Cloudflare workerd local server
- `npm run build` / `npm run preview` — production build
- `npm test` / `npm run test:watch` — Vitest
- `npm run lint` / `npm run lint:fix` / `npm run format`

## Routes

| Route                 | Description                                                                   |
| --------------------- | ----------------------------------------------------------------------------- |
| `/`                   | Public landing                                                                |
| `/auth/signin`        | Email/password sign-in                                                        |
| `/auth/signup`        | Email/password sign-up                                                        |
| `/auth/confirm-email` | Post-signup inbox check                                                       |
| `/dashboard`          | Profile, races, calendar, chat (auth required)                                |
| `/admin`              | Hidden reports + project Chat model picker (auth + `user_roles.role = admin`) |

Page protection: `PROTECTED_ROUTES` in `src/middleware.ts`. Product JSON APIs authenticate in the handler (401), not via that list.

## Deployment

Production Worker auto-deploys on push/merge to GitHub `master` (Cloudflare Workers Builds, not GitHub Actions deploy).

Manual:

```bash
npm run build
npx wrangler deploy
```

Runtime secrets: `npx wrangler secret put SUPABASE_URL`, `SUPABASE_KEY`, and for model-written chat `OPENAI_API_KEY` (optional `OPENAI_MODEL`). Without the OpenAI key, chat stays on the local stub. Optional `SENTRY_DSN` enables Worker error tracking (empty or unset is a no-op). Set `SENTRY_ENABLED=false` locally or on a pre-prod Worker to keep a DSN without sending events; omit the flag in production. Also set `SENTRY_DSN` on Workers Builds if you want ingest after auto-deploy.

## CI

GitHub Actions on `master` (push and PR):

- `ci.yml` — lint, `npm test`, production build. Secrets: `SUPABASE_URL`, `SUPABASE_KEY`.
- `review.yml` — OpenRouter code review on same-repo PRs (comment + `ai-cr:*` labels). Secret: `OPENROUTER_API_KEY` (not a Worker / `astro:env` secret). A `fail` verdict still leaves the Review job green.

## License

MIT
