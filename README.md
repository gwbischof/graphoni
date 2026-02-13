# Graphiki

Graphiki is a wiki for graphs. It lets teams build, explore, and curate knowledge graphs through a browser — the same way a traditional wiki lets you collaboratively edit text.

The graph lives in Memgraph and renders in real-time with Sigma.js (WebGL). Nodes and edges are color-coded by type, laid out with ForceAtlas2, and organized into communities you can zoom into hierarchically. Click any node to see its properties, connections, source documents, and financial amounts.

Editing follows a proposal-based workflow: users submit changes with a reason, moderators review and approve them, and approved edits are automatically applied to the graph as Cypher queries. Admins can bypass review for direct edits. Every mutation — whether proposed, approved, or directly applied — is recorded in a PostgreSQL audit log with the exact Cypher that was executed.

Authentication uses NextAuth.js with GitHub OAuth (and a dev credentials provider for local testing). Four roles control access: guests can browse, users can propose edits, mods can review proposals and query the graph, and admins can edit directly and manage users.

### Auth & Roles

| Role | Capabilities |
|---|---|
| **Guest** | Browse graph, view node details |
| **User** | Submit edit proposals, view own proposals |
| **Mod** | Approve/reject proposals, view audit log, execute queries |
| **Admin** | Direct graph edits (bypasses review), manage users, squash audit history |

### Edit Workflow

1. **User** submits a proposal (edit-node, add-node, delete-node, add/edit/delete-edge)
2. Proposal stored in PostgreSQL with `status: pending`, current graph state captured as `dataBefore`
3. **Mod** reviews and approves/rejects
4. On approval: Cypher auto-executed against Memgraph, `status: applied`, audit log written
5. **Admin** can bypass review with "Apply Directly" option (still audit-logged)

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
- **PostgreSQL** — `localhost:5432` (user: `graphiki`, password: `graphiki_dev`, db: `graphiki`)

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
- `admin@graphiki.local` (admin role)
- `mod@graphiki.local` (mod role)

### 4. Configure environment

The default `.env.local` works out of the box for local development:

```env
MEMGRAPH_URI=bolt://localhost:7687
DATABASE_URL=postgresql://graphiki:graphiki_dev@localhost:5432/graphiki
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
- `admin@graphiki.local` — admin role
- `mod@graphiki.local` — mod role
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
| `NEXTAUTH_URL` | Yes | Public URL of the app (e.g. `https://graphiki.example.com`) |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `GITHUB_ID` | Yes | GitHub OAuth App client ID |
| `GITHUB_SECRET` | Yes | GitHub OAuth App client secret |
| `PORT` | No | Server port (default: 3001) |

### Docker image

Build and push the web image:

```bash
cd web
docker build -t graphiki:latest .
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
- **Edit proposals** — Authenticated users submit changes with a reason, stored in PostgreSQL
- **Moderation queue** — Mods approve/reject proposals; approved changes auto-apply to Memgraph
- **Admin direct edits** — Admins bypass review, changes still audit-logged
- **Audit log** — Full history of all graph mutations with Cypher executed, squash support
- **Saved views** — Save and share graph queries by slug
- **Constellation theme** — Animated starfield with mouse parallax, frosted glass panels

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
