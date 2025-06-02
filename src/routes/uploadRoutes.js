import express from "express";
import fs from "fs";
import multer from "multer";
import { deleteFile, uploadFile } from "../services/s3Service.js";

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure uploads directory exists
    if (!fs.existsSync('uploads')) {
      fs.mkdirSync('uploads', { recursive: true });
    }
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow only images
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Max 10 files
  }
});

router.post("/upload", upload.array("images", 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded" });
  }

  // Validate all files before processing
  const invalidFiles = req.files.filter(file => !file.mimetype.startsWith('image/'));
  if (invalidFiles.length > 0) {
    // Clean up invalid files
    invalidFiles.forEach(file => {
      if (file.path) fs.unlinkSync(file.path);
    });
    return res.status(400).json({
      message: "Invalid file types detected",
      invalidFiles: invalidFiles.map(f => f.originalname)
    });
  }

  const results = {
    successful: [],
    failed: []
  };

  try {
    // Process files in chunks of 3 for better performance
    const chunkSize = 3;
    const files = [...req.files];

    while (files.length > 0) {
      const chunk = files.splice(0, chunkSize);
      const chunkPromises = chunk.map(async (file) => {
        try {
          const result = await uploadFile(file);
          results.successful.push({
            originalName: file.originalname,
            fileUrl: result.fileUrl,
            fileName: result.fileName,
            size: file.size,
            mimetype: file.mimetype
          });
        } catch (error) {
          results.failed.push({
            originalName: file.originalname,
            error: error.message
          });
        } finally {
          // Clean up temp file regardless of success/failure
          if (file.path) {
            try {
              fs.unlinkSync(file.path);
            } catch (e) {
              console.error(`Error cleaning up file ${file.originalname}:`, e);
            }
          }
        }
      });

      await Promise.all(chunkPromises);
    }

    const response = {
      message: results.failed.length === 0 ? "All uploads successful" : "Some uploads failed",
      totalProcessed: req.files.length,
      successCount: results.successful.length,
      failureCount: results.failed.length,
      successful: results.successful,
    };

    if (results.failed.length > 0) {
      response.failed = results.failed;
    }

    const statusCode = results.failed.length === 0 ? 200 : 207; // Use 207 Multi-Status if some failed
    res.status(statusCode).json(response);

  } catch (error) {
    // Handle catastrophic errors
    req.files.forEach(file => {
      try {
        if (file.path) fs.unlinkSync(file.path);
      } catch (e) {
        console.error("Error cleaning up file:", e);
      }
    });

    res.status(500).json({
      message: "Upload process failed",
      error: error.message
    });
  }
});

router.delete("/delete", async (req, res) => {
  const { key } = req.query;

  if (!key) {
    return res.status(400).json({ message: "Missing 'key' query parameter" });
  }

  try {
    // Extract filename from S3 URL if full URL is provided
    let fileKey = key;
    if (key.includes("amazonaws.com/")) {
      fileKey = key.split("amazonaws.com/")[1];
    }

    const result = await deleteFile(fileKey);
    res
      .status(200)
      .json({ message: "File deleted successfully", key: result.key });
  } catch (error) {
    if (error.name === "NoSuchKey") {
      return res
        .status(404)
        .json({ message: "File not found", error: error.message });
    }
    res
      .status(500)
      .json({ message: "Failed to delete file", error: error.message });
  }
});

export default router;
