const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { config } = require('../config/env');
const { normalizeString } = require('./validation');

const uploadsRoot = path.join(__dirname, '..', 'uploads', 'events');

const ensureEventUploadsDir = async () => {
  await fs.mkdir(uploadsRoot, { recursive: true });
  return uploadsRoot;
};

const getPublicBaseUrl = () => process.env.PUBLIC_BASE_URL || '';

const detectExtension = ({ mimeType, fileName } = {}) => {
  const normalizedMimeType = normalizeString(mimeType).toLowerCase();
  if (normalizedMimeType.includes('png')) return '.png';
  if (normalizedMimeType.includes('webp')) return '.webp';
  if (normalizedMimeType.includes('heic')) return '.heic';
  if (normalizedMimeType.includes('heif')) return '.heif';

  const normalizedFileName = normalizeString(fileName).toLowerCase();
  const ext = path.extname(normalizedFileName);
  if (ext) return ext;

  return '.jpg';
};

const storeEventUploadFromBuffer = async ({ buffer, mimeType, fileName }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('La imagen es obligatoria');
  }

  const dir = await ensureEventUploadsDir();
  const uniqueName = `${Date.now()}-${crypto.randomUUID()}${detectExtension({ mimeType, fileName })}`;
  const absolutePath = path.join(dir, uniqueName);

  await fs.writeFile(absolutePath, buffer);

  return {
    fileName: uniqueName,
    absolutePath,
    publicUrl: getPublicBaseUrl()
      ? `${getPublicBaseUrl().replace(/\/$/, '')}/uploads/events/${uniqueName}`
      : `/uploads/events/${uniqueName}`,
    mimeType: normalizeString(mimeType).toLowerCase() || 'image/jpeg',
    size: buffer.length,
  };
};

module.exports = {
  ensureEventUploadsDir,
  getPublicBaseUrl,
  storeEventUploadFromBuffer,
};
