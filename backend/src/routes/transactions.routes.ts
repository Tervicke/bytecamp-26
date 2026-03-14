import { Router } from "express";
import multer from "multer";
import { uploadTransactionsCSV, getTransactions } from "../controllers/transactions.controller.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.get("/", getTransactions);
router.post("/upload", upload.single("file"), uploadTransactionsCSV);

export default router;
