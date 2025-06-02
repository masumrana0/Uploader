import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import uploadRoutes from "./src/routes/uploadRoutes.js";

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());

// Apply routes
app.use("/api", uploadRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("Uploader (AWS SDK v3) is running");
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
