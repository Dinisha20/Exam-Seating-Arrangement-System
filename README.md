# Exam Seating Arrangement System — Phase 1

A constraint-based exam seating allocator built for the COE (Controller of
Examinations) workflow. Given a Hall Plan Excel (the format COE already
uses), it maps course codes to actual exam papers, seats every registered
student using a real constraint solver (Google OR-Tools CP-SAT), and
guarantees that no two students writing the same paper ever share or sit
adjacent to a bench.

## Stack

- **Backend:** Python + FastAPI
- **Constraint Solver:** OR-Tools CP-SAT (formal constraint programming —
  proves `OPTIMAL`/`FEASIBLE` when a solution exists, and correctly proves
  `INFEASIBLE` when it doesn't, rather than guessing)
- **Database:** PostgreSQL
- **ORM / Migrations:** SQLAlchemy + Alembic
- **Excel parsing/export:** openpyxl + pandas
- **Frontend:** React + Tailwind CSS (built with Vite)
- **Deployment:** Docker Compose (FastAPI + Postgres), with a multi-stage
  Docker build that compiles the React app and serves it from FastAPI —
  no separate frontend server needed

## Quick start (Docker — recommended)

```bash
docker compose up --build
```

Then open **http://localhost:8000** in your browser. The `web` service runs
`alembic upgrade head` automatically before starting, so the database schema
is created for you — no manual setup needed.

To load demo data so you have something to look at immediately:

```bash
docker compose exec web python -m app.seed
```

This creates 3 halls (120 seats total), 5 course codes mapped across 3
papers (including a cross-department case — CS301 and IT305 both map to the
same DBMS paper), and one exam session ("CAT-I") with 75 registered
students. Go to **Generate Seating** in the UI, select all 3 halls, and
click Generate.

## Running without Docker (local development)

You'll need PostgreSQL running locally.

```bash
# 1. Create the database
createdb exam_seating

# 2. Install Python dependencies
cd backend
pip install -r requirements.txt

# 3. Set the connection string (adjust user/password as needed)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/exam_seating"

# 4. Apply migrations
alembic upgrade head

# 5. (Optional) load demo data
python -m app.seed

# 6. Start the server
uvicorn app.main:app --reload --port 8000
```

At this point the API is running on port 8000, but there's no UI to view yet
— `frontend_dist` only gets created by the Docker build. For local
(non-Docker) development, use the Vite dev server instead:

```bash
cd frontend-react
npm install
npm run dev
```

This opens on **http://localhost:5173** and proxies `/api` calls to the
FastAPI backend on port 8000 (see `vite.config.js`) — use this while
actively editing the UI.

If you want the single-port, production-style setup (`http://localhost:8000`
serving everything, matching what Docker produces) without Docker, build the
frontend and copy it in manually:

```bash
cd frontend-react
npm install
npm run build
cp -r dist ../backend/frontend_dist
```

Then restart the backend and open **http://localhost:8000**.

## How to use it

1. **Papers & Mapping** — define each real exam paper, then map every
   department's course code to it. This is what makes the anti-cheating
   rule correct even when CSE calls a subject `CS301` and IT calls the same
   subject `IT305`.
2. **Halls & Benches** — add halls with a row/column grid and seats-per-bench
   (2, matching real bench seating).
3. **Exam Sessions** — create a session (e.g. "CAT-I", FN/AN).
4. **Upload Students** — upload the Hall Plan Excel for that session. Only
   students whose course code is already mapped to a paper get imported —
   unmapped codes are reported back so you can fix the mapping and re-upload.
5. **Generate Seating** — pick which halls to use and generate. The CP-SAT
   solver either returns a provably valid arrangement or a clear reason why
   none exists (almost always: one paper is too concentrated for the
   selected halls — add more halls or seats).
6. **Seat Map** — visual, colour-coded-by-paper seating chart per hall.
7. **Student Lookup** — search by register number to see hall/bench/seat.
8. **Export** — download the generated arrangement as Excel.

## Project structure

```
esa-fastapi/
├── docker-compose.yml
├── Dockerfile                # multi-stage: builds React, then Python runtime
├── backend/
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/              # migrations (env.py wired to SQLAlchemy models)
│   └── app/
│       ├── main.py           # FastAPI app + all API endpoints
│       ├── models.py         # SQLAlchemy ORM models (matches the ER diagram)
│       ├── schemas.py        # Pydantic request schemas
│       ├── database.py       # engine/session setup
│       ├── solver.py         # OR-Tools CP-SAT constraint engine
│       ├── excel_helper.py   # Hall Plan Excel parser + exporter
│       └── seed.py           # demo data loader
├── frontend-react/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── App.jsx           # layout + tab-based navigation
│       ├── api.js            # fetch helpers
│       ├── components/       # Sidebar, Topbar, Toast
│       └── pages/            # Dashboard, Papers, Halls, Exams, Upload,
│                              # Generate, SeatMap, Lookup
└── sample-data/
    └── sample_hall_plan.xlsx # synthetic example in the real COE format
```

## The constraint engine, briefly

Every seat gets a boolean decision variable per paper (`x[seat][paper] = 1`
if that seat is assigned a student writing that paper). Three constraint
families are given to the CP-SAT solver:

1. Each seat carries at most one paper.
2. Each paper's full registered student count must be seated exactly.
3. For every pair of seats that are "adjacent" (same bench, or neighbouring
   benches within the same row), no two of them may carry the same paper.

This is a textbook CSP encoding, and CP-SAT solves it exactly — not
approximately. On a real dataset with realistic paper concentration (the
largest single paper was 17.6% of the total in the source file this project
was built against), a 3-hall, 120-seat, 75-student session solves in under a
second. If a single paper is so concentrated that no valid arrangement can
exist (e.g. one paper is 90%+ of a small hall), the solver proves that too,
instantly, rather than silently producing a bad result.

## Known limitation (by design, not a bug)

If one paper's registered count exceeds roughly 40–50% of the selected
halls' total capacity, seating becomes mathematically infeasible under the
same-bench + adjacent-bench rule — this is a hard combinatorial limit of the
constraint itself, not a solver weakness. The fix is always operational:
add more halls/benches for that session, or split the paper's students
across more rows.

## What's Phase 1 vs Phase 2

This build covers Phase 1 only (see project docs for the full phase split):
Excel import, paper mapping, CP-SAT seat-level allocation, seat lookup, and
Excel export. Reallocation, dashboard analytics, reports beyond the seating
chart, and notification features are Phase 2.
