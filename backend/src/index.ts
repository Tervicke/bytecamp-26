import express from "express";
import transactionsRoutes from "./routes/transactions.routes.js";
import authRoutes from './routes/auth.routes.ts';
import { verifyToken } from './middleware/auth.ts';
import { connectNeo4j } from "./lib/neo4j/neo4j.ts";

const app = express();

app.use(express.json());

// Basic CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

await connectNeo4j();

app.use('/api/auth', authRoutes);

// Protected routes
// app.use("/api/transactions", verifyToken, transactionsRoutes);
app.use("/api/transactions", transactionsRoutes);

app.get("/", (req, res) => {
  res.send("Server running with Bun + Express + TypeScript");
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
