# Graphoni

Graphoni is a graph-based wiki web app. It lets teams build, explore, and curate knowledge graphs through a browser — the same way a traditional wiki lets you collaboratively edit text. It's not tied to any specific domain: anything that makes sense as a graph — people and relationships, infrastructure dependencies, research citations, corporate ownership structures — can be a Graphoni wiki.

## How it works

The graph is stored in Memgraph (a Cypher-compatible graph database) and rendered in real-time with Sigma.js over WebGL. Nodes and edges are color-coded by type, laid out with ForceAtlas2, and organized into communities you can zoom into. Click any node to see its properties, connections, and linked documents.

**Views** are saved queries on the graph. A view might show only money transfers, or messages between people, or ownership chains — any subgraph you can express as a Cypher query. Views can be saved by slug and shared as links.

**Editing** follows a proposal-based workflow: users suggest changes with a reason, moderators review and approve them, and approved edits are automatically applied as Cypher queries. Admins can bypass review for direct edits. Every mutation is recorded in a PostgreSQL audit log.

**The API** exposes everything programmatically — query the graph, submit proposals, and approve edits without touching the UI. This makes it possible to build automations, bulk-import data, or integrate with other tools.

### Current status

Early stage. The core components are connected and working: graph rendering, authentication, proposal workflow, moderation queue, audit log, saved views, and the API. Next up:

- **Custom views** — richer saved queries with filtered graph rendering
- **AI chat** — ask the graph questions in natural language and get back relevant subgraphs

### Auth & Roles

| Role | Capabilities |
|---|---|
| **Guest** | Browse graph, view node details |
| **User** | Submit edit proposals, view own proposals |
| **Mod** | Approve/reject proposals, view audit log, execute Cypher queries |
| **Admin** | Direct graph edits (bypasses review), manage users, squash audit history |

### Edit Workflow

1. **User** submits a proposal (edit-node, add-node, delete-node, add/edit/delete-edge)
2. Proposal stored in PostgreSQL with `status: pending`, current graph state captured as `dataBefore`
3. **Mod** reviews and approves/rejects
4. On approval: Cypher auto-executed against Memgraph, `status: applied`, audit log written
5. **Admin** can bypass review with "Apply Directly" option (still audit-logged)

### API

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/api/graph/query` | POST | Mod+ | Execute Cypher queries against the graph |
| `/api/proposals` | GET | User+ | List proposals (filterable by status) |
| `/api/proposals` | POST | User+ | Submit a new edit proposal |
| `/api/proposals/[id]` | PATCH | Mod+ | Approve or reject a proposal |
| `/api/admin/direct-edit` | POST | Admin | Apply an edit directly (bypasses review) |
| `/api/audit` | GET | Mod+ | Query the audit log |
| `/api/views` | GET/POST | Guest/User+ | List or create saved views |

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Python 3.10+ (for ETL only)

## Development Setup

### 1. Start databases

```bash
docker compose up -d memgraph postgres
```

This starts:
- **Memgraph** — Bolt on `localhost:7687`, Lab UI on `localhost:3000`
- **PostgreSQL** — `localhost:5432` (user: `graphoni`, password: `graphoni_dev`, db: `graphoni`)

### 2. Install dependencies

```bash
cd web
npm install
```

### 3. Set up the database

```bash
# Push schema to PostgreSQL (creates all tables)
npm run db:push

# Seed admin and mod users
npm run db:seed
```

This creates two dev users:
- `admin@graphoni.local` (admin role)
- `mod@graphoni.local` (mod role)

### 4. Configure environment

The default `.env.local` works out of the box for local development:

```env
MEMGRAPH_URI=bolt://localhost:7687
DATABASE_URL=postgresql://graphoni:graphoni_dev@localhost:5432/graphoni
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=dev-secret-please-change-in-production-abc123
```

For GitHub OAuth (optional in dev), add:
```env
GITHUB_ID=your_github_oauth_app_id
GITHUB_SECRET=your_github_oauth_app_secret
```

### 5. Load graph data

```bash
# Install Python deps
pip install -r requirements.txt

# Load seed data into Memgraph + export JSON
python graph.py init
python graph.py export-json
```

Or skip this step — the frontend falls back to `public/data/graph.json` if Memgraph has no data.

### 6. Start the dev server

```bash
cd web
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

### Dev sign-in

In development, the sign-in page (`/auth/signin`) has a "Dev Login" form. Enter any of:
- `admin@graphoni.local` — admin role
- `mod@graphoni.local` — mod role
- Any email — auto-creates a user account

### Database management

```bash
npm run db:push      # Push schema changes to PostgreSQL
npm run db:generate  # Generate migration files from schema changes
npm run db:migrate   # Run pending migrations
npm run db:studio    # Open Drizzle Studio (browser-based DB explorer)
npm run db:seed      # Re-seed admin/mod users
```

## Deploying with Docker Compose

### 1. Set environment variables

Create a `.env` file in the project root:

```env
NEXTAUTH_SECRET=generate-a-real-secret-here
GITHUB_ID=your_github_oauth_app_id
GITHUB_SECRET=your_github_oauth_app_secret
```

Generate a secret with: `openssl rand -base64 32`

### 2. Start everything

```bash
docker compose up -d
```

This starts all three services:
- **memgraph** on port 7687 (Bolt) and 3000 (Lab UI)
- **postgres** on port 5432
- **web** on port 3001

The web container automatically runs database migrations on startup via `scripts/start.sh`.

### 3. Seed the database

```bash
# Run seed from inside the web container
docker compose exec web npx tsx lib/db/seed.ts
```

### 4. Load graph data

```bash
# From host, with Python deps installed
MEMGRAPH_URI=bolt://localhost:7687 python graph.py init
```

The app is now live at [http://localhost:3001](http://localhost:3001).

## Deploying to Production

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MEMGRAPH_URI` | Yes | Bolt URI for Memgraph |
| `NEXTAUTH_URL` | Yes | Public URL of the app (e.g. `https://graphoni.example.com`) |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `GITHUB_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_SECRET` | Yes | GitHub OAuth App client secret |
| `PORT` | No | Server port (default: 3001) |

### Docker image

Build and push the web image:

```bash
cd web
docker build -t graphoni:latest .
```

The image runs migrations on startup, so just point `DATABASE_URL` at your PostgreSQL instance.

### GitHub OAuth setup

1. Go to GitHub > Settings > Developer settings > OAuth Apps > New OAuth App
2. Set **Homepage URL** to your production URL
3. Set **Authorization callback URL** to `https://your-domain.com/api/auth/callback/github`
4. Copy the Client ID and Client Secret into your env vars

## graph.py Commands

| Command | Description |
|---|---|
| `python graph.py init` | Create schema, load seed data, generate HTML |
| `python graph.py viz` | Regenerate HTML from current DB |
| `python graph.py export-json` | Export graph as Cytoscape JSON |
| `python graph.py stats` | Show node/edge counts |
| `python graph.py query "MATCH ..."` | Run ad-hoc Cypher query |
| `python graph.py add-person <id> <name> <role>` | Add a person node |

## Features

- **Graph visualization** — Sigma.js with ForceAtlas2 layout, color-coded by type/role
- **Hierarchical zoom** — Community supernodes that expand on double-click
- **Search** — Highlights matching nodes across label, ID, notes
- **Filters** — Toggle node subtypes and edge types
- **Detail panel** — Click any node to see properties, connections, quotes, doc links
- **Saved views** — Save and share graph queries by slug
- **Edit proposals** — Users suggest changes, mods approve, auto-applied as Cypher
- **Admin direct edits** — Admins bypass review, still audit-logged
- **Audit log** — Full history of all graph mutations with executed Cypher
- **REST API** — Query the graph, submit proposals, and approve edits programmatically
- **GitHub OAuth** — Production auth with role-based access control

### Planned

- **Custom views** — Richer saved queries with filtered subgraph rendering
- **AI chat** — Natural language queries that return relevant subgraphs

## Tech Stack

- **Next.js 16** — App Router, React 19
- **Sigma.js** — WebGL graph rendering
- **NextAuth.js v5** — Authentication (GitHub OAuth + dev credentials)
- **Drizzle ORM** — Type-safe PostgreSQL queries
- **PostgreSQL 16** — Users, proposals, audit trail
- **Memgraph** — Graph database (Neo4j-compatible, Bolt protocol)
- **Framer Motion** — Panel animations, starfield parallax
- **shadcn/ui** — UI components (Radix primitives)
- **Tailwind CSS 4** — Styling
- **Docker Compose** — Multi-service orchestration
