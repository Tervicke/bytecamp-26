import express from "express";
import transactionsRoutes from "./routes/transactions.routes.js";
import { connectNeo4j } from "./lib/neo4j/neo4j.ts";

const app = express();

app.use(express.json());

await connectNeo4j();
app.use("/api/transactions", transactionsRoutes);

app.get("/", (req, res) => {
  res.send("Server running with Bun + Express + TypeScript");
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

