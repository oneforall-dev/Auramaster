import crypto from 'crypto';

// Master Server Key for Envelope Encryption (read from process.env or fallback to deterministic secret)
const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY || 'auramaster_vps_master_encryption_key_2026_aes256gcm_secret_9982';

/**
 * Derives a unique 256-bit encryption key per user using PBKDF2 with SHA-512.
 * Ensures strict cryptographic separation between user vaults.
 */
function deriveUserKey(userId: string, masterKey: string = MASTER_KEY): Buffer {
  const salt = `auramaster_salt_${userId}_google_oauth_v1`;
  return crypto.pbkdf2Sync(masterKey, salt, 100000, 32, 'sha512');
}

/**
 * Encrypts an API Key using AES-256-GCM with a random 96-bit IV.
 * Returns encrypted ciphertext, IV, and 128-bit authentication tag.
 */
export function encryptApiKey(plainKey: string, userId: string): {
  encryptedKey: string;
  iv: string;
  authTag: string;
  maskedKey: string;
} {
  const cleanKey = plainKey.trim();
  const userKey = deriveUserKey(userId);
  const iv = crypto.randomBytes(12); // 96-bit standard GCM IV

  const cipher = crypto.createCipheriv('aes-256-gcm', userKey, iv);
  let encrypted = cipher.update(cleanKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  // Masked representation for safe UI display (e.g. AIza...4xQ9)
  const maskedKey = cleanKey.length > 8
    ? `${cleanKey.slice(0, 4)}••••••••••••${cleanKey.slice(-4)}`
    : '••••••••••••';

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag,
    maskedKey
  };
}

/**
 * Decrypts an API Key using AES-256-GCM.
 * Verifies authentication tag to detect any tampering or corruption.
 */
export function decryptApiKey(
  encryptedKey: string,
  ivHex: string,
  authTagHex: string,
  userId: string
): string {
  const userKey = deriveUserKey(userId);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', userKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
