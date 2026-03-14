import { Router } from "express";
import multer from "multer";
import { uploadTransactionsCSV } from "../controllers/transactions.controller.js";

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

router.post("/upload", upload.single("file"), uploadTransactionsCSV);

export default router;
