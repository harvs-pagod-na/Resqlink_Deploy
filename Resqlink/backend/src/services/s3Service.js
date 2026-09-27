const crypto = require('crypto');

/**
 * Direct-To-Storage Pre-signed URL Factory
 * Provides pre-signed URLs for zero-backend-bottleneck media ingestion (AWS S3 or direct object storage).
 */
const generatePresignedUploadUrl = async (userId, mimeType, extension = 'jpg') => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'video/mp4',
    'video/quicktime',
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
    throw new Error(`Unsupported media MIME type: ${mimeType}`);
  }

  const randomString = crypto.randomBytes(12).toString('hex');
  const safeExt = extension.replace(/^\./, '');
  const key = `incidents/${userId}/${Date.now()}-${randomString}.${safeExt}`;

  const bucket = process.env.AWS_S3_BUCKET_NAME || 'resqlink-storage-bucket';
  const region = process.env.AWS_REGION || 'ap-southeast-1';

  // If AWS S3 credentials are configured in environment
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    try {
      // Lazy load SDK if installed
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

      const s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: mimeType,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      return {
        uploadUrl,
        key,
        publicUrl: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
        provider: 'AWS_S3',
      };
    } catch (err) {
      console.warn('[S3Service] AWS SDK initialization fallback:', err.message);
    }
  }

  // Production-grade direct endpoint fallback
  const baseUrl = process.env.APP_URL || 'http://localhost:5000';
  return {
    uploadUrl: `${baseUrl}/api/resq/direct-upload/${key}`,
    key,
    publicUrl: `${baseUrl}/uploads/${key}`,
    provider: 'DIRECT_EDGE',
  };
};

module.exports = {
  generatePresignedUploadUrl,
};
