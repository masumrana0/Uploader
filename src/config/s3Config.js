import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const region = process.env.AWS_REGION;
const accessId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

export const s3Client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: accessId,
    secretAccessKey: secretAccessKey,
  },
});

export const bucketName = process.env.S3_BUCKET_NAME;
