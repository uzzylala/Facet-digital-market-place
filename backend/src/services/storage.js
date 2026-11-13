import { randomUUID } from 'node:crypto';
import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

export const s3 = new S3Client({
  endpoint: config.s3.endpoint,
  region: config.s3.region,
  credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

const Bucket = config.s3.bucket;

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket }));
  } catch (err) {
    if (err?.$metadata?.httpStatusCode !== 404 && err?.name !== 'NotFound') throw err;
    await s3.send(new CreateBucketCommand({ Bucket }));
    console.log(`✓ Created storage bucket "${Bucket}"`);
  }
}

const safeName = (name) => name.replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').slice(-120);

export const keys = {
  media: (productId, originalName) => `media/${productId}/${randomUUID()}-${safeName(originalName)}`,
  file: (productId, originalName) => `files/${productId}/${randomUUID()}-${safeName(originalName)}`,
};

export const isPublicMediaKey = (key) => key.startsWith('media/');

export async function putObject(key, buffer, contentType) {
  await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: buffer, ContentType: contentType }));
  return key;
}

export async function deleteObjects(keyList) {
  const Objects = keyList.filter(Boolean).map((Key) => ({ Key }));
  if (!Objects.length) return;
  await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects } })).catch((err) => {
    console.warn('Storage cleanup failed:', err.message);
  });
}

export function signedMediaUrl(key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: key }), { expiresIn });
}

export function signedDownloadUrl(key, fileName, expiresIn = 300) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeName(fileName)}"`,
    }),
    { expiresIn },
  );
}
