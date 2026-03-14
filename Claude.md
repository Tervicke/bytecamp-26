# AML Shield — Anti-Money Laundering Shell Company Network Detector
## Development Guidelines (Hackathon: 24h Build)

---

## Project Overview

**AML Shield** is an intelligent Anti-Money Laundering (AML) platform that detects sophisticated laundering activity embedded in layered shell company networks. Instead of flagging individual suspicious transactions, AML Shield analyzes the **entire entity relationship graph** — companies, their beneficial owners, stakeholders, and bank accounts — to surface structurally suspicious fund flows.

**Problem Statement**: Modern money laundering routes illicit funds through chains of legally registered shell companies across jurisdictions. Each individual transaction looks legitimate in isolation; the crime only becomes visible when viewed at the network level.

**Key Insight**: We build a knowledge graph in Neo4j on top of transactional ledger data in Supabase (Postgres). Graph algorithms (cycle detection, centrality, cash-flow ratio analysis) run at ingestion time and continuously flag nodes with a risk priority: **Critical → High → Medium → Low → None**.

---

## Core Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│  (Vite + TypeScript + Tailwind + react-force-graph)     │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API
┌─────────────────────▼───────────────────────────────────┐
│                   Express Backend (Bun)                  │
│          TypeScript + Zod + Pino logger                  │
└──────────┬──────────────────────────┬───────────────────┘
           │                          │
┌──────────▼───────────┐  ┌──────────▼──────────────────┐
│  Neo4j (Graph DB)    │  │  Supabase Postgres + Prisma  │
│  - Entity graph      │  │  - Audit-grade ledger        │
│  - Relationship maps │  │  - Transaction records       │
│  - Graph algorithms  │  │  - Flag history              │
└──────────────────────┘  └──────────────────────────────┘
```

### Data Flow
1. **Static data** (companies, people, bank accounts, ownership links) is seeded from CSVs at startup  
2. **Transaction ingestion** (`POST /api/transactions`) writes to Postgres AND creates/updates Neo4j nodes/edges  
3. **Graph analysis pipeline** runs automatically post-ingestion: cycle detection → volume checks → cash-flow ratio → layering propagation  
4. **Flagging** cascades through the graph: direct entities → Critical, Layer-1 connections → High, Layer-2 → Medium, Layer-3 → Low  
5. **Frontend** fetches flagged entities, transaction trails, and renders the interactive force-directed graph  

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Bun 1.x |
| Backend | Express.js + TypeScript |
| Graph DB | Neo4j 5.x Community (Docker) |
| Neo4j Driver | `neo4j-driver` (official JS driver) |
| Relation DB | Supabase Postgres 15 |
| ORM | Prisma |
| Validation | Zod |
| Logging | Pino |
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS |
| Graph Viz | `react-force-graph` (2D/3D force-directed) |
| State | Zustand |
    | Data Fetching | TanStack Query (React Query) |
| Charts | Recharts |

---

## Feature Set (MVP — 24h)

### 1. Cycle Detection
- Use Neo4j Cypher: `MATCH p=(n)-[:TRANSFERS_TO*2..10]->(n) RETURN p`
- Any entity involved in a circular fund flow is flagged **Critical**
- All entities within the cycle chain are also flagged with cascading priority

### 2. High Transaction Volume Flag
- If a bank account has `>= THRESHOLD` transactions in a rolling 30-day window, it is flagged
- Default threshold: configurable via `VOLUME_THRESHOLD` env var (default: 10)
- Flagged account → **Critical**, account owner → **Critical**, linked company → **High**

### 3. Cash Flow Ratio Flag
- If cash (non-electronic, non-wire) inflow > 70% of total inflow for a bank account → flag
- Bank account → **Critical**, all associated beneficial owners/directors → **Critical**, linked shell companies → **High**

### 4. Transaction Tracking
- Admin can click any flagged transaction in the UI to see full trail:
  `Sender Entity → Bank Account → Receiver Entity` with timestamps, amounts, labels
- The Neo4j graph trace is rendered as a highlighted subgraph in the force-directed view

### 5. Shell Company Layering & Priority Propagation
- Every company node has a `layer` integer (0 = directly flagged, 1 = one hop away, etc.)
- When a company is flagged Critical:
  - Layer 0 (the company itself): **Critical**
  - Layer 1 entities (direct owners, subsidiaries, shared bank accounts): **High**  
  - Layer 2: **Medium**
  - Layer 3+: **Low**
- Layering is triggered by the `propagateFlags(entityId)` graph traversal service

### Flag Priority Enum
```
CRITICAL > HIGH > MEDIUM > LOW > NONE
```
A node's flag level is always the **maximum** of all reasons it has been flagged.

---

## Graph Model (Neo4j)

### Node Types

| Label | Key Properties |
|-------|---------------|
| `Company` | id, name, jurisdiction, registrationNumber, incorporatedDate, companyType, industry, address, isShell, flagLevel, flagReasons[] |
| `Person` | id, name, nationality, dob, passportNumber, email, phone, role, flagLevel, flagReasons[] |
| `BankAccount` | id, accountNumber, bankName, bankCountry, currency, balance, openedDate, accountType, swiftCode, flagLevel |

### Relationship Types

| Relationship | From → To | Properties |
|-------------|-----------|------------|
| `OWNS` | Person → Company | ownershipPct, effectiveDate, ownershipType, notes |
| `HOLDS_ACCOUNT` | Company → BankAccount | since, accountType |
| `TRANSFERS_TO` | BankAccount → BankAccount | **id**, amount, currency, txnDate, txnType, description, referenceNumber, isSuspicious, flagLevel, flagReasons[] |
| `SUBSIDIARY_OF` | Company → Company | sharesPct, effectiveDate, relationshipType, notes |

### Example Cypher — Cycle Detection
```cypher
MATCH path = (start:BankAccount)-[:TRANSFERS_TO*2..8]->(start)
WHERE length(path) > 0
RETURN path
```

### Example Cypher — Flag Propagation
```cypher
MATCH path = (flagged:Company {id: $companyId})-[*1..3]-(neighbor)
WITH neighbor, min(length(path)) AS hops
SET neighbor.flagLevel = CASE
  WHEN hops = 1 THEN 'HIGH'
  WHEN hops = 2 THEN 'MEDIUM'
  WHEN hops = 3 THEN 'LOW'
  ELSE neighbor.flagLevel
END
```

---

## Project Structure

```
bytecamp-26/
├── Claude.md                    # This file
├── seed/                        # Seed CSVs
│   ├── companies.csv
│   ├── persons.csv
│   ├── bank_accounts.csv
│   ├── ownership.csv
│   ├── subsidiaries.csv
│   └── transactions.csv
├── backend/
│   ├── src/
│   │   ├── app.ts               # Express app setup
│   │   ├── server.ts            # Bun entry point
│   │   ├── lib/
│   │   │   ├── neo4j.ts         # Neo4j driver singleton
│   │   │   ├── prisma.ts        # Prisma client singleton
│   │   │   └── logger.ts        # Pino logger
│   │   ├── routes/
│   │   │   ├── transactions.routes.ts
│   │   │   ├── entities.routes.ts
│   │   │   ├── graph.routes.ts
│   │   │   └── flags.routes.ts
│   │   ├── controllers/
│   │   │   ├── transactions.controller.ts
│   │   │   ├── entities.controller.ts
│   │   │   ├── graph.controller.ts
│   │   │   └── flags.controller.ts
│   │   ├── services/
│   │   │   ├── graph.service.ts         # Neo4j CRUD + queries
│   │   │   ├── analysis.service.ts      # Detection algorithms
│   │   │   ├── flagging.service.ts      # Flag + propagation logic
│   │   │   └── seed.service.ts          # CSV → Neo4j seeding
│   │   ├── middleware/
│   │   │   ├── error.ts
│   │   │   └── validate.ts
│   │   └── types/
│   │       └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── GraphVisualization.tsx   # react-force-graph wrapper
│   │   │   ├── FlaggedEntities.tsx
│   │   │   ├── TransactionTracker.tsx
│   │   │   ├── AlertsPanel.tsx
│   │   │   └── EntityDetail.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Graph.tsx
│   │   │   ├── Transactions.tsx
│   │   │   └── Entities.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   └── hooks/
│   │   └── store/
│   │       └── aml.store.ts
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.ts
└── docker-compose.yml           # Neo4j
```

---

## API Endpoints

### Transactions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/transactions` | Ingest new transaction, triggers analysis pipeline |
| GET | `/api/transactions` | List all transactions with flag status |
| GET | `/api/transactions/:id/trail` | Full graph trail for a transaction |
| GET | `/api/transactions/flagged` | Only suspicious/flagged transactions |

### Entities
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/entities/companies` | All companies with flag levels |
| GET | `/api/entities/persons` | All persons with flag levels |
| GET | `/api/entities/bank-accounts` | All bank accounts with flag levels |
| GET | `/api/entities/:id` | Single entity with full details |

### Graph
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/graph/full` | Full graph (nodes + edges) for visualization |
| GET | `/api/graph/subgraph/:entityId` | Subgraph centered around an entity |
| GET | `/api/graph/cycles` | All detected cycles |

### Flags
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/flags` | All current flags with reasons |
| POST | `/api/flags/run-analysis` | Manually trigger full analysis pipeline |
| PATCH | `/api/flags/:entityId` | Override flag level (admin) |


## Detection Algorithms

### Algorithm 1: Cycle Detection
```typescript
// In analysis.service.ts
async detectCycles(): Promise<CycleResult[]> {
  const result = await neo4j.run(`
    MATCH path = (start:BankAccount)-[:TRANSFERS_TO*2..8]->(start)
    RETURN [node IN nodes(path) | node.id] AS cycle,
           [rel IN relationships(path) | rel.transactionId] AS txnIds
    LIMIT 100
  `);
  // Flag all nodes in each cycle as CRITICAL
}
```

### Algorithm 2: High Volume Detection
```typescript
async detectHighVolumeAccounts(threshold = 10): Promise<string[]> {
  const result = await neo4j.run(`
    MATCH (a:BankAccount)<-[:FROM_ACCOUNT]-(t:Transaction)
    WHERE t.txnDate >= datetime() - duration('P30D')
    WITH a, count(t) AS txnCount
    WHERE txnCount >= $threshold
    RETURN a.id, txnCount
  `, { threshold });
}
```

### Algorithm 3: Cash Flow Ratio
```typescript
async detectHighCashFlowAccounts(threshold = 0.70): Promise<string[]> {
  const result = await neo4j.run(`
    MATCH (a:BankAccount)<-[:TO_ACCOUNT]-(t:Transaction)
    WITH a,
         SUM(CASE WHEN t.txnType = 'cash' THEN t.amount ELSE 0 END) AS cashIn,
         SUM(t.amount) AS totalIn
    WHERE totalIn > 0 AND (cashIn / totalIn) >= $threshold
    RETURN a.id, cashIn/totalIn AS ratio
  `, { threshold });
}
```

### Algorithm 4: Flag Propagation (Layering)
```typescript
async propagateFlags(entityId: string, entityType: string): Promise<void> {
  // Hop 1 = HIGH, Hop 2 = MEDIUM, Hop 3 = LOW
  await neo4j.run(`
    MATCH (root {id: $entityId})
    MATCH path = (root)-[*1..3]-(neighbor)
    WHERE neighbor <> root
    WITH neighbor, min(length(path)) AS hops
    SET neighbor.flagLevel = CASE
      WHEN hops = 1 AND (neighbor.flagLevel IS NULL OR neighbor.flagLevel = 'NONE' OR neighbor.flagLevel = 'LOW') THEN 'HIGH'
      WHEN hops = 2 AND (neighbor.flagLevel IS NULL OR neighbor.flagLevel = 'NONE') THEN 'MEDIUM'
      WHEN hops = 3 AND (neighbor.flagLevel IS NULL OR neighbor.flagLevel = 'NONE') THEN 'LOW'
      ELSE neighbor.flagLevel
    END
  `, { entityId });
}
```

---

## Seed Data Strategy

The `data/` directory contains CSVs with realistic demo data representing a fictional multi-jurisdictional shell company laundering network. The seeder:

1. Reads all CSVs on backend startup (or via `POST /api/seed`)
2. Creates Neo4j nodes for each Company, Person, BankAccount
3. Creates relationships: OWNS, CONTROLS, HOLDS_ACCOUNT, SUBSIDIARY_OF, WORKS_FOR
4. Inserts base transactions into both Postgres and Neo4j
5. Runs initial analysis pipeline to pre-populate flags

### CSV Files
| File | Description |
|------|-------------|
| `companies.csv` | 20 shell + legitimate companies across 5 jurisdictions |
| `persons.csv` | 15 persons (beneficial owners, directors, nominees) |
| `bank_accounts.csv` | 30 bank accounts linked to companies |
| `ownership.csv` | Ownership % relationships (Person → Company) |
| `subsidiaries.csv` | Company → Company subsidiary links |
| `transactions.csv` | 80+ transactions including circular flows and cash-heavy patterns |

---

## Development Workflow

### Prerequisites
```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash

# Start Neo4j + Postgres via Docker
docker-compose up -d

# Backend
cd backend && bun install && bun run dev

# Frontend
cd frontend && bun install && bun run dev
```

### Environment Variables
```env
# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/amlshield
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
PORT=3001
VOLUME_THRESHOLD=10
CASH_FLOW_THRESHOLD=0.70
ANALYSIS_ON_INGEST=true
```

### docker-compose.yml (minimal)
```yaml
version: '3.8'
services:
  neo4j:
    image: neo4j:5
    ports:
      - "7474:7474"   # Browser UI
      - "7687:7687"   # Bolt protocol
    environment:
      NEO4J_AUTH: neo4j/password
    volumes:
      - neo4j_data:/data

  postgres:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: amlshield
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    volumes:
      - pg_data:/var/lib/postgresql/data

volumes:
  neo4j_data:
  pg_data:
```

---

## Code Quality Standards

### TypeScript (Pragmatic — same as Sabai Flow)
- `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- `noUnusedLocals: false` — don't block on warnings
- All external inputs validated with **Zod**

### Naming
- Files: `kebab-case.ts`
- Functions/variables: `camelCase`
- Types/interfaces: `PascalCase`
- Neo4j labels: `PascalCase` (e.g., `Company`, `BankAccount`)
- Neo4j relationships: `SCREAMING_SNAKE_CASE` (e.g., `TRANSFERS_TO`)
- Postgres tables: `snake_case` plural

### Commit Convention
```
feat(graph): add cycle detection algorithm
feat(flagging): implement layered propagation
fix(seed): correct ownership CSV parsing
```

---

## Graph Visualization Notes

Using `react-force-graph` for the frontend visualization:
- **Node colors**: Red = Critical, Orange = High, Yellow = Medium, Blue = Low, Gray = None
- **Node shapes**: Circle = Company, Diamond = Person, Square = BankAccount, Triangle = Transaction
- **Edge colors**: Red = suspicious transaction path, Gray = normal relationship
- **Interactions**: Click node → show detail panel, Click edge → show transaction info
- On cycle detection, the cycle path is highlighted with animated dashes

### Graph Data Shape (API response for `/api/graph/full`)
```typescript
interface GraphData {
  nodes: Array<{
    id: string;
    label: string;          // Node type
    name: string;
    flagLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
    properties: Record<string, unknown>;
  }>;
  links: Array<{
    source: string;
    target: string;
    type: string;           // relationship type
    properties: Record<string, unknown>;
  }>;
}
```

---

## Success Criteria (24h Hackathon)

- [ ] Neo4j running, entity graph seeded from CSVs
- [ ] Transaction ingestion triggers automated analysis pipeline
- [ ] Cycle detection finds and flags circular fund flows
- [ ] High-volume bank account detection working
- [ ] Cash flow ratio (>70%) detection working
- [ ] Flag propagation cascades through layers correctly
- [ ] React force-directed graph renders company network
- [ ] Flagged entities highlighted with correct colors
- [ ] Transaction trail view for suspicious transactions
- [ ] Admin can manually trigger analysis re-run
- [ ] At least one clear demo scenario showing a full laundering network being detected

---

*"Follow the money, follow the graph."*
*Last Updated: 2026-03-14 | Version: 1.0 (Hackathon Edition)*
