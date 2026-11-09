import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET || process.env.R2_BUCKET;
const accessKeyId =
  process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
const secretAccessKey =
  process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
const accountId = process.env.R2_ACCOUNT_ID;
const endpoint =
  process.env.S3_ENDPOINT ||
  (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
const region = process.env.S3_REGION || "auto";

export const storageConfigured = Boolean(
  bucket && accessKeyId && secretAccessKey && endpoint,
);

const client = storageConfigured
  ? new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      credentials: { accessKeyId, secretAccessKey },
    })
  : null;

function requireClient() {
  if (!client) {
    const error = new Error("Object storage is not configured");
    error.status = 503;
    throw error;
  }
  return client;
}

export async function createUploadUrl(key, contentType) {
  return getSignedUrl(
    requireClient(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || "application/octet-stream",
    }),
    { expiresIn: 600 },
  );
}

export async function putObject(key, body, contentType) {
  await requireClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
    }),
  );
}

export async function createDownloadUrl(key) {
  return getSignedUrl(
    requireClient(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 300 },
  );
}

export async function getObjectStream(key) {
  const result = await requireClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return result;
}

export async function deleteObject(key) {
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
