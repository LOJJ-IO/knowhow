# Knohow

Google Workspace knowledge and ownership control — company files stay company-owned.

The **product** is spelled **Knohow**. This repo folder and the engineering vault still use `knowhow`.

## What’s in the repo

| Path | Role |
|---|---|
| `src/` | Next.js landing (App Router) — `/`, `/terms`, `/privacy` |
| `public/` | Served assets (`hero/`, `deck/`, marks) |
| `backend/` | FastAPI service — Google OAuth, org identity, Drive tooling (local / not deployed yet) |
| `second-brain/` | Engineering memory (Obsidian vault) — start at [`Current/Current-Context.md`](second-brain/Current/Current-Context.md) |
| `docs/business/` | Non-app business / scratch media |

Agent-oriented invariants and write-back rules live in [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md).

## Frontend (landing)

```bash
cp .env.example .env   # NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Stack: Next.js 16 · React 19 · Tailwind v4 · TypeScript. The landing works without the backend; **Continue with Google** needs the backend running.

## Backend (optional for landing)

Python 3.12 · FastAPI · SQLAlchemy · Alembic · Postgres.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill Google + DB keys — see docs/gcp-setup.md
alembic upgrade head
uvicorn app.main:app --port 8000 --reload
```

GCP / Railway production deploy is not provisioned yet. Details: [`second-brain/Architecture/Architecture-Overview.md`](second-brain/Architecture/Architecture-Overview.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
