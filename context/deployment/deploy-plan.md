---
project: hard-feelings
created: 2026-08-05
updated: 2026-08-06
status: shipped
scope: first-production-deploy
platform: Cloudflare Workers
auto_deploy: Cloudflare Workers Builds (on merge; not GHA)
sources:
  - context/foundation/infrastructure.md
  - context/foundation/tech-stack.md
  - wrangler.jsonc
  - package.json
  - .github/workflows/ci.yml
---

# HardFeelings — First Deploy Plan

First production deploy of the Astro 6 SSR app to **Cloudflare Workers**, with **hosted Supabase** for Auth, then **auto-deploy on merge via Cloudflare Workers Builds** (not GitHub Actions).

Tick boxes as you go (`[x]`). Phase headers roll up when every step under them is done.

## Progress

- [x] **Phase A** — Create accounts (Cloudflare, Supabase, Wrangler login)
- [x] **Phase B** — Pre-deploy repo prep (rename Worker)
- [x] **Phase C** — First manual Worker deploy + secrets + smoke
- [x] **Phase D** — GitHub CLI (`gh`) + push repo
- [x] **Phase E** — Workers Builds auto-deploy on merge

## Verdict

**Ship on Cloudflare Workers (not Pages).** Adapter and `wrangler.jsonc` are already Workers-shaped. Flow:

1. Create Cloudflare + Supabase accounts and wire keys (guided below).
2. Rename Worker → one-time manual `wrangler deploy` + runtime secrets + smoke.
3. Install/configure **GitHub CLI (`gh`)**, create the GitHub.com repo, push `master`.
4. Connect **Workers Builds** to that GitHub repo so every merge/push to `master` rebuilds and deploys on Cloudflare.

Do **not** enable Workers Paid yet (auth + dashboard only). Do **not** add a deploy job to GHA — keep `ci.yml` as lint + build gate only.

## Assessment of existing guidance

| Source claim | Status | Correction |
|---|---|---|
| `tech-stack.md` `deployment_target: cloudflare-pages` | **Stale** | Canonical target = **Workers**. |
| `tech-stack.md` `ci_default_flow: auto-deploy-on-merge` | **Intent kept, mechanism changed** | Auto-deploy = **Cloudflare Workers Builds**, not GHA. |
| `infrastructure.md` secrets after deploy | **Risky order** | Runtime secrets before Auth smoke. |
| Worker name `10x-astro-starter` | **Blocker** | Rename to `hard-feelings` before first public URL. |
| Current `origin` = `git.uiol.pl` | **Workers Builds blocker** | Builds supports **GitHub.com** only in this plan — not self-hosted Git. Push via `gh` (Phase D), then connect Builds (Phase E). |

### Gaps closed by this plan

1. Step-by-step **account + key** walkthrough (Cloudflare, Supabase, Wrangler).
2. Hosted Supabase Auth URLs for the Worker origin.
3. Secret dual-store: **Wrangler runtime secrets** vs optional **build variables** vs leftover GHA secrets (lint/build only).
4. Ordered runbook, smoke, rollback, human gates.
5. **GitHub CLI (`gh`)** install, auth, `gh repo create`, push — concrete path off `git.uiol.pl`.
6. **Workers Builds** on merge to the GitHub `master` branch.

## Locked decisions

| Decision | Choice |
|---|---|
| Platform | Cloudflare Workers |
| First ship | Manual `npm run build && npx wrangler deploy` |
| Ongoing deploy | **Cloudflare Workers Builds** on push/merge to production branch |
| Not used for deploy | GitHub Actions (stays lint + build only) |
| Runtime secrets | Worker Variables & Secrets / `wrangler secret put` |
| Production Auth/DB | Hosted Supabase (anon key) |
| Public URL (v1) | `https://hard-feelings.<subdomain>.workers.dev` |
| Production git branch | `master` (matches current default) |
| Deploy / Builds git host | **GitHub.com** (created + pushed with `gh`) |
| Self-hosted `git.uiol.pl` | Keep as optional second remote; not used by Workers Builds |
| Custom domain / Workers Paid | Out of scope for first ship |

---

## Phase A — Create accounts (guided)

Do this once. No code changes yet.

### A1. Cloudflare account

- [x] Open [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
- [x] Sign up with email (or Google/Apple); verify email if prompted
- [x] Skip custom domain for v1 — Workers work on `*.workers.dev` without a zone
- [x] Open **Workers & Pages** in the dashboard; accept any first-time product prompts
- [x] Note **Account name** (needed later for Wrangler / Builds)
- [x] Confirm staying on free tier (Workers Paid **not** required for auth-only first deploy)

**Done when:** you can open Workers & Pages and see “Create” / empty Workers list.

### A2. Supabase account + project

- [x] Open [https://supabase.com/dashboard](https://supabase.com/dashboard) → Sign up / Sign in
- [x] Create **New project** (name e.g. `hard-feelings` / `hard-feelings-prod`, Free plan, region near you)
- [x] Generate and store the **database password** in a password manager (not used by the Worker today)
- [x] Wait until project status is healthy (green)

**Done when:** project home loads without “setting up” spinners.

### A3. Copy Supabase API keys (production runtime)

- [x] Open **Project Settings** (gear) → **API**
- [x] Copy and store `SUPABASE_URL` = Project URL (`https://<project-ref>.supabase.co`)
- [x] Copy and store `SUPABASE_KEY` = **anon `public`** key (JWT starting with `eyJ…`) — never commit
- [x] Confirm you did **not** copy/use the `service_role` key for the Worker
- [x] Keep values handy for Wrangler secrets (Phase C); do not point production at `http://127.0.0.1:54321`

**Local vs prod:** day-to-day `npm run dev` can keep using Docker Supabase + `.dev.vars`. Production Wrangler secrets must use the **hosted** URL above.

### A4. Local Wrangler login (deploy machine)

```bash
cd /path/to/hard-feelings
nvm use          # Node 22.14.0 per .nvmrc
npm ci
npx wrangler login
npx wrangler whoami
```

- [x] `nvm use` / Node 22.14.0 active
- [x] `npm ci` succeeded
- [x] `npx wrangler login` completed (browser approved Cloudflare account from A1)
- [x] `npx wrangler whoami` shows the intended account

**Done when:** `wrangler whoami` lists the intended account.

---

## Phase B — Pre-deploy repo prep

Before the first shared URL:

- [x] In `wrangler.jsonc`, set `"name": "hard-feelings"` (replaces `10x-astro-starter`)
- [x] Optionally set `"name": "hard-feelings"` in `package.json`
- [x] Leave `compatibility_flags: ["nodejs_compat"]` as-is (no change needed)
- [x] Confirm no `limits.cpu_ms`, multi-env `env.*`, or `CLOUDFLARE_ENV` for v1
- [x] Commit the rename on `master` when ready (Builds will deploy this Worker name)

---

## Phase C — First manual Worker deploy + secrets

One-time bootstrap so the Worker exists and Auth works before automation.

### C1. Build & deploy

```bash
npm run lint
npm run build
npx wrangler deploy
```

- [x] `npm run lint` passed
- [x] `npm run build` passed
- [x] `npx wrangler deploy` succeeded
- [x] Copied production URL (e.g. `https://hard-feelings.<subdomain>.workers.dev`)

### C2. Set **runtime** secrets on the Worker

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npx wrangler secret list
```

(Or dashboard: Worker → **Settings** → **Variables and Secrets**.)

- [x] `SUPABASE_URL` set (hosted Project URL)
- [x] `SUPABASE_KEY` set (anon public key)
- [x] `npx wrangler secret list` shows both names (values never printed)

These are **runtime** secrets (Worker isolate). They are **not** Workers Builds “build variables”.

### C3. Configure Supabase Auth URLs for production

In Supabase → **Authentication** → **URL Configuration**:

- [x] **Site URL** = exact Worker origin (e.g. `https://hard-feelings.<subdomain>.workers.dev`)
- [x] **Redirect URLs** includes `https://hard-feelings.<subdomain>.workers.dev/**`
- [x] (Optional) local redirects kept: `http://127.0.0.1:4321/**` and/or `http://localhost:4321/**`
- [x] Email confirmation left **enabled** for production

### C4. Smoke test

- [x] `GET /` → 200, page renders
- [x] `/auth/signup` and `/auth/signin` forms render
- [x] Sign up with a real inbox → `/auth/confirm-email` + confirmation mail arrives
- [x] Confirm email → sign in → `/dashboard` works
- [x] Sign out → `/dashboard` redirects to `/auth/signin`
- [x] `npx wrangler tail` during sign-in → no fatal errors / Error 1102

If Auth says “Supabase is not configured”: secrets missing or wrong Worker name — re-check `wrangler.jsonc` `name` and `secret list`.

---

## Phase D — GitHub CLI (`gh`) + push repo

Workers Builds needs a **GitHub.com** repo. Current `origin` is `git@git.uiol.pl:…` (self-hosted) — Cloudflare cannot attach to it.

### D1. GitHub account

- [x] Open [https://github.com/signup](https://github.com/signup) (or sign in if account exists)
- [x] Verify email
- [x] Decide repo visibility (**private** recommended for this MVP)

**Done when:** you can open github.com logged in.

### D2. Install GitHub CLI

On Ubuntu/Debian (this machine currently has no `gh`):

```bash
# official GitHub CLI apt repo (preferred over outdated distro package)
(type -p wget >/dev/null || sudo apt-get install wget -y) \
  && sudo mkdir -p -m 755 /etc/apt/keyrings \
  && out=$(mktemp) \
  && wget -nv -O"$out" https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  && cat "$out" | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null \
  && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && sudo mkdir -p -m 755 /etc/apt/sources.list.d \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null \
  && sudo apt-get update \
  && sudo apt-get install gh -y

gh --version
```

Fallback: `sudo apt install gh` (may be older).

- [x] `gh` installed
- [x] `gh --version` prints ≥ 2.x

### D3. Authenticate `gh`

```bash
gh auth login
```

Recommended prompts: **GitHub.com** → **HTTPS** (or SSH if keys already set) → authenticate Git **Yes** → **Login with a web browser**.

```bash
gh auth status
gh api user --jq .login
```

- [x] `gh auth login` completed (browser one-time code)
- [x] `gh auth status` shows logged in to github.com
- [x] `gh api user --jq .login` prints your username
- [x] (Only if SSH) SSH key added to GitHub (`gh ssh-key add …`) and `Host github.com` works

### D4. Create the GitHub repo and push `master`

**Option A (recommended):**

```bash
gh repo create hard-feelings \
  --private \
  --source=. \
  --remote=github \
  --push
```

**Option B:** `gh repo create hard-feelings --private --confirm`, then `git remote add github …` and `git push -u github master`.

- [x] Repo `hard-feelings` created on GitHub.com
- [x] Remote `github` added (existing `origin` → `git.uiol.pl` left alone)
- [x] `master` pushed to `github`
- [x] Verified: `git remote -v`, `gh repo view --web`, `git ls-remote github master`

### D5. Dual-remote day-to-day

| Remote | Role |
|---|---|
| `origin` (`git.uiol.pl`) | Existing self-hosted copy — keep if you still use it |
| `github` (GitHub.com) | **Source of truth for Workers Builds + optional GHA lint/build** |

```bash
git push origin master    # optional
git push github master    # required for Cloudflare auto-deploy
```

- [x] Understood: Builds only sees pushes to **`github`**
- [x] (Optional) Documented whether `origin` stays in daily use or is retired later

### D6. Optional — GHA secrets on the new GitHub repo

```bash
# only if CI build fails without them; same hosted Supabase anon pair
gh secret set SUPABASE_URL
gh secret set SUPABASE_KEY
```

- [ ] (Optional) Set `SUPABASE_URL` / `SUPABASE_KEY` as GitHub Actions secrets if CI needs them
- [x] Confirmed these are **not** a substitute for Worker runtime secrets

**Phase D done when:** `gh repo view` works, `master` is on GitHub.com, remote `github` is configured.

---

## Phase E — Auto-deploy on merge (Cloudflare Workers Builds)

**Goal:** merge/push to GitHub `master` → Cloudflare builds and deploys. No deploy step in GHA. Requires Phase D complete.

### E1. Connect the existing Worker to GitHub

- [x] Dashboard → **Workers & Pages** → Worker **`hard-feelings`**
- [x] **Settings** → **Builds** → **Connect**
- [x] Authorized **Cloudflare Workers & Pages** GitHub app for the owning account
- [x] Selected repository **`hard-feelings`** (from Phase D)
- [x] Production branch = `master`
- [x] Root directory = `/`
- [x] Build command = `npm run build`
- [x] Deploy command = `npx wrangler deploy`
- [x] Non-production branch builds **off** for v1
- [x] Confirmed build vars usually unnecessary (`SUPABASE_*` optional at build); runtime secrets stay from Phase C
- [x] (If needed) Build var `NODE_VERSION=22.14.0` — normally covered by `.nvmrc`
- [x] Saved; using Cloudflare automatic API token (unless you supplied your own)

### E2. Prove auto-deploy

- [x] Trivial commit on `master` pushed with `git push github master` (or PR merged on GitHub)
- [x] Worker Deployments / build history: build started and succeeded
- [x] Deploy command succeeded (live Worker updated)
- [x] Smoke checks still pass on `*.workers.dev`
- [x] `npx wrangler secret list` still shows `SUPABASE_URL` + `SUPABASE_KEY`

### E3. Day-2 workflow (acknowledge)

- [x] Push/merge to GitHub `master` → production deploy
- [x] Push only to `origin` (`git.uiol.pl`) → **no** Cloudflare deploy
- [x] GHA remains lint + build only (no `wrangler deploy` in workflow)

### E4. What stays out of GHA

- [x] Confirmed `.github/workflows/ci.yml` has **no** deploy job
- [x] GHA secrets treated as optional build helpers only

---

## Rollback

```bash
npx wrangler deployments list
npx wrangler rollback [VERSION_ID]
```

- [x] Know how to list deployments and roll back (CLI or dashboard)
- [x] Understood: rollback does **not** undo Supabase Auth settings or user rows

---

## Human approval gates

| Action | Who |
|---|---|
| Cloudflare / Supabase signup | Human |
| Creating Supabase project + copying anon key | Human |
| `wrangler login`, first deploy, `secret put` | Human |
| GitHub signup, `gh auth login`, `gh repo create` | Human |
| Authorizing Cloudflare Git app + connecting Builds | Human |
| Custom domain / Workers Paid | Human (later) |
| Agent may | lint, build, edit this plan, read-only `wrangler whoami` / `gh auth status` when authenticated |

---

## Success criteria

### First deploy (Phases A–C)

- [x] Cloudflare + Supabase accounts created
- [x] Worker `hard-feelings` live on `*.workers.dev`
- [x] Runtime secrets `SUPABASE_URL` + `SUPABASE_KEY` (hosted, anon) set
- [x] Supabase Site URL / Redirect URLs match Worker origin
- [x] Smoke checks (C4) all passed
- [x] Rollback path known

### GitHub (Phase D)

- [x] `gh` installed and `gh auth status` OK for GitHub.com
- [x] Repo `hard-feelings` exists on GitHub.com (private OK)
- [x] Remote `github` configured; `master` pushed
- [x] `origin` (`git.uiol.pl`) left intact or consciously retired

### Auto-deploy (Phase E)

- [x] Workers Builds connected to the GitHub `hard-feelings` repo, production branch `master`
- [x] Build command `npm run build`, deploy command `npx wrangler deploy`
- [x] A push/merge to GitHub `master` produces a successful Cloudflare build + live deploy
- [x] No deploy job added to GHA

---

## Deferred

Living backlog — append tasks anytime, each with a **Source**: [`context/deployment/deferred.md`](./deferred.md).

---

## Command cheat sheet

```bash
# Cloudflare
npx wrangler login
npx wrangler whoami

# GitHub CLI
gh auth login
gh auth status
gh repo create hard-feelings --private --source=. --remote=github --push
gh repo view --web
gh secret set SUPABASE_URL   # optional, GHA build only
gh secret set SUPABASE_KEY

# First ship
npm run build && npx wrangler deploy
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
npx wrangler secret list
npx wrangler tail

# Day-2 push (triggers Workers Builds when connected)
git push github master

# Ops
npx wrangler deployments list
npx wrangler rollback [VERSION_ID]
```
