import express from "express";
import transactionsRoutes from "./routes/transactions.routes.js";

const app = express();

app.use(express.json());

app.use("/api/transactions", transactionsRoutes);

app.get("/", (req, res) => {
  res.send("Server running with Bun + Express + TypeScript");
});

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

