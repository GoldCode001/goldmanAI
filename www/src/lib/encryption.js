/**
 * Client-side encryption using Web Crypto API
 * Keys are derived from wallet signatures
 */

/**
 * Derive an encryption key from a signature using PBKDF2
 * @param {string} signature - The wallet signature
 * @param {string} salt - Optional salt (default: 'goldman-ai-salt')
 * @returns {Promise<CryptoKey>} The derived AES-GCM key
 */
export async function deriveKeyFromSignature(signature, salt = 'goldman-ai-salt') {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(signature),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt a text message using AES-GCM
 * @param {string} text - The message to encrypt
 * @param {CryptoKey} key - The encryption key
 * @returns {Promise<string>} Base64 encoded string of IV + Encrypted Data
 */
export async function encryptMessage(text, key) {
  const enc = new TextEncoder();
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    enc.encode(text)
  );

  // Combine IV and encrypted data
  const ivArray = Array.from(iv);
  const encryptedArray = Array.from(new Uint8Array(encrypted));
  const combined = new Uint8Array(ivArray.concat(encryptedArray));
  
  // Convert to Base64
  return btoa(String.fromCharCode.apply(null, combined));
}

/**
 * Decrypt a message using AES-GCM
 * @param {string} encryptedData - Base64 encoded string of IV + Encrypted Data
 * @param {CryptoKey} key - The encryption key
 * @returns {Promise<string>} The decrypted text
 */
export async function decryptMessage(encryptedData, key) {
  try {
    // Decode Base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(c => c.charCodeAt(0))
    );

    // Extract IV (first 12 bytes) and data
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[Encrypted Message]';
  }
}

/**
 * Export key to raw format (for debugging/storage if needed - be careful)
 */
export async function exportKey(key) {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode.apply(null, new Uint8Array(exported)));
}
