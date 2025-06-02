import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import { bucketName, s3Client } from "../config/s3Config.js";

export const uploadFile = async (file) => {
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${
    file.originalname
  }`;

  // Create a read stream instead of reading entire file into memory
  const fileStream = fs.createReadStream(file.path);

  const uploadParams = {
    Bucket: bucketName,
    Key: fileName,
    Body: fileStream,
    ContentType: file.mimetype,
    ContentDisposition: "inline", // Makes the file viewable in browser
    CacheControl: "max-age=31536000", // Cache for 1 year
    Metadata: {
      "original-name": encodeURIComponent(file.originalname),
      "upload-date": new Date().toISOString(),
      "file-size": file.size.toString(),
    },
  };

  try {
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    const fileUrl = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    return {
      success: true,
      fileUrl,
      fileName,
      contentType: file.mimetype,
      size: file.size,
      originalName: file.originalname,
    };
  } catch (error) {
    console.error("S3 Upload Error:", {
      file: file.originalname,
      error: error.message,
      errorCode: error.$metadata?.httpStatusCode,
    });
    throw error;
  }
};

export const deleteFile = async (key) => {
  try {
    const decodedKey = decodeURIComponent(key).trim();

    const deleteParams = {
      Bucket: bucketName,
      Key: decodedKey,
    };

    const command = new DeleteObjectCommand(deleteParams);
    const response = await s3Client.send(command);

    // S3 returns 204 for successful deletion
    if (response.$metadata.httpStatusCode === 204) {
      return { success: true, key: decodedKey };
    } else {
      throw new Error(
        `File deletion failed with status code: ${response.$metadata.httpStatusCode}`
      );
    }
  } catch (error) {
    throw error;
  }
};
