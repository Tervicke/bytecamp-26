import { connectNeo4j } from "./lib/neo4j/neo4j.js";
import app from "./app.js";

await connectNeo4j();

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
