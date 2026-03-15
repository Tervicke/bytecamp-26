# ByteCamp 26 - AML Shield for Money Laundering Detection

A MVP (module based) for real-time visualization, analysis, and flagging of financial transactions and entities. The platform models transaction networks as a graph to detect patterns and anomalies, providing investigators with an interactive dashboard and node-link graph visualization.

## 🌐 Live Demo

You can access the live application here: **[https://bytecamp-frontend.onrender.com](https://bytecamp-frontend.onrender.com)**

**Test Credentials:**
- **Username:** `admin`
- **Password:** `admin123`

## 🚀 Features

* **Interactive Graph Visualization:** Visualizes entities (users/accounts), transactions (funds transfers), and companies using a 2D force-directed graph.
* **Transaction Monitoring:** Upload, view, and analyze large datasets of transaction histories via CSV.
* **Entity Analysis & Flagging:** Identifies anomalous behaviors and flags suspicious entities, transactions and other relevant associates for review.
* **Dashboard Analytics:** High-level metrics, charts, and transaction velocity visualizations.
* **Authentication:** Secure login and session management functionality specific for the authorized transaction analysts.
* **Real-time Ready & High Performance:** Built on modern, fast tooling including Bun, Vite, and Neo4j.

## 💻 Tech Stack

### Frontend
- **Framework:** React 19 + Vite
- **Styling:** Tailwind CSS + Lucide React (Icons)
- **State & Data Fetching:** Zustand, React Query (@tanstack/react-query)
- **Routing:** React Router v7
- **Visualization:** React Force Graph 2D, Recharts

### Backend
- **Runtime & Package Manager:** Bun (v1.2+)
- **Server Framework:** Express (TypeScript)
- **Primary Database:** Neo4j (Graph Database for transactions and entities)
- **Auth Database:** SQLite (Local `auth.db`)

---

## 📂 File Structure

```text
bytecamp-26/
├── backend/                  # Node.js + Express API Backend
│   ├── src/
│   │   ├── controllers/      # Route logic handlers
│   │   ├── db/               # SQLite Auth database configurations
│   │   ├── lib/              # Shared libraries (Neo4j connection logic)
│   │   ├── middleware/       # Express middlewares (Auth, etc.)
│   │   ├── routes/           # API route definitions
│   │   ├── services/         # Core business logic
│   │   └── types/            # TypeScript type definitions
│   ├── .env.example          # Template environment variables
│   └── package.json          # Backend dependencies
├── frontend/                 # React + Vite Frontend
│   ├── src/
│   │   ├── assets/           # Static assets
│   │   ├── components/       # Reusable React components (Layout, UI)
│   │   ├── lib/              # Frontend utilities and query client
│   │   ├── pages/            # Page-level components (Dashboard, Graph, Transactions)
│   │   └── store/            # Zustand state stores
│   ├── .env.example          # Template environment variables for Vite
│   └── package.json          # Frontend dependencies
├── docker/                   # Dockerfiles for containerization
│   ├── Dockerfile.backend    # Backend instructions targetting bun
│   └── Dockerfile.frontend   # Frontend instructions
├── docker-compose.yml        # Orchestration for multi-container deployment
└── README.md                 # This file
```

---

## ⚙️ Configuration & Setup

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+) installed on your machine.
- A **Neo4j** database instance (either [AuraDB](https://neo4j.com/cloud/platform/aura-graph-database/) cloud or local desktop).
- (Optional) [Docker](https://www.docker.com/) for containerized deployment.

### 1. Environment Variables Configuration

Before running the application, you need to configure the environment variables for both the backend and frontend.

**Backend Configuration:**
1. Navigate to the `backend/` directory.
2. Copy `.env.example` to `.env`.
3. Fill in your Neo4j credentials:
   ```env
   connection_url="neo4j+s://<YOUR_INSTANCE_ID>.databases.neo4j.io"
   Username="neo4j"
   Password="<YOUR_PASSWORD>"
   connection_query_api_url="https://<YOUR_INSTANCE_ID>.databases.neo4j.io"
   JWT_SECRET="<YOUR_JWT_SECRET>"
   ```

**Frontend Configuration:**
1. Navigate to the `frontend/` directory.
2. Copy `.env.example` to `.env`.
3. Set the API URL and Mock configurations:
   ```env
   VITE_API_BASE_URL=http://localhost:3000/api
   ```

---

## 🏃 Running the Application (Manual Setup)

If you prefer to run the application directly on your host machine without Docker:

### Start the Backend
```bash
cd backend
bun install
bun run src/index.ts
```
*The backend server will start on `http://localhost:3000`.*

### Start the Frontend
In a new terminal instance:
```bash
cd frontend
bun install     # or npm install
bun run dev     # or npm run dev
```
*The frontend development server will start on `http://localhost:5173`.*

---

## 🐳 Containerized Deployment (Docker)

The repository includes `Dockerfile` configurations and a `docker-compose.yml` for simplified, reproducible deployments.

1. Ensure your `.env` files are created in both `/backend` and `/frontend` as outlined in the Configuration step.
2. From the root `bytecamp-26/` directory, run:
   ```bash
   docker compose up --build
   ```
3. Docker will build and start both the **Backend** and **Frontend** services.
   - Frontend accessible at: `http://localhost:5173`
   - Backend accessible at: `http://localhost:3000`

To stop the containers, use `Ctrl+C` or run:
```bash
docker compose down
```
