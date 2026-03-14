import express from "express"

const app = express()

app.use(express.json())

app.get("/", (req, res) => {
  res.send("Server running with Bun + Express + TypeScript")
})

const PORT = 3000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})