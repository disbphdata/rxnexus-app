import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { compressImage } from './imageCompressor';

export function isStorageUrl(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('https://') || value.startsWith('http://');
}

export function isBase64Image(value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('data:image/');
}

export function estimateBase64Bytes(value?: string): number {
  if (!value || !isBase64Image(value)) return 0;
  const commaIdx = value.indexOf(',');
  const payloadLength = commaIdx >= 0 ? value.length - commaIdx - 1 : value.length;
  return Math.round(payloadLength * 0.75);
}

/**
 * Attempts to upload a base64 JPEG data URL to Firebase Storage under `prescriptions/`.
 * Uses a timeout so booking submission never hangs if Storage is not enabled yet.
 */
export interface StorageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadBase64ToStorage(
  dataUrl: string,
  bookingId: string,
  timeoutMs = 6000
): Promise<StorageUploadResult> {
  try {
    const safeId = bookingId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `prescriptions/${safeId}_${Date.now()}.jpg`;
    const storageRef = ref(storage, storagePath);

    const uploadPromise = (async () => {
      await uploadString(storageRef, dataUrl, 'data_url', {
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=31536000'
      });
      return await getDownloadURL(storageRef);
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Firebase Storage upload timed out')), timeoutMs);
    });

    const downloadUrl = await Promise.race([uploadPromise, timeoutPromise]);
    return { success: true, url: downloadUrl };
  } catch (err: any) {
    const msg = err?.code || err?.message || 'Storage upload failed';
    return { success: false, error: msg };
  }
}

/**
 * Compresses image if needed, then tries to store it in Firebase Storage (keeping only URL in Firestore).
 * Automatically falls back to compressed JPEG Base64 in Firestore if Storage is unavailable/unconfigured.
 */
export async function preparePrescriptionImageForSave(
  imageInput: string,
  bookingId: string
): Promise<{ value: string; storedIn: 'none' | 'storage' | 'firestore' }> {
  if (!imageInput) {
    return { value: '', storedIn: 'none' };
  }

  if (isStorageUrl(imageInput)) {
    return { value: imageInput, storedIn: 'storage' };
  }

  let safeDataUrl = imageInput;
  if (safeDataUrl.length > 350000) {
    try {
      safeDataUrl = await compressImage(safeDataUrl, 1000, 1000, 0.70);
    } catch (err) {
      console.error('Failed to compress image before storage upload:', err);
    }
  }

  const uploadRes = await uploadBase64ToStorage(safeDataUrl, bookingId);
  if (uploadRes.success && uploadRes.url) {
    return { value: uploadRes.url, storedIn: 'storage' };
  }

  console.warn('[PrescriptionStorage] Falling back to Firestore compressed JPEG:', uploadRes.error || 'Unknown');
  return { value: safeDataUrl, storedIn: 'firestore' };
}

/**
 * Deletes an image from Firebase Storage if `url` is a Firebase Storage download URL.
 * Silently ignores errors so database cleanup is never blocked.
 */
export async function deletePrescriptionFromStorage(url?: string): Promise<void> {
  if (!isStorageUrl(url) || !url) return;
  try {
    if (!url.includes('firebasestorage')) return;
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('[PrescriptionStorage] Could not delete Storage object:', err);
  }
}
