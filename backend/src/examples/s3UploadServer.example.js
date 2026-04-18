import express from "express";
import dotenv from "dotenv";
import { upload } from "../middleware/upload.js";
import { uploadFile } from "../controllers/uploadController.js";

dotenv.config();

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "S3 upload server is running." });
});

app.post("/api/upload", upload.single("file"), uploadFile);

app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
