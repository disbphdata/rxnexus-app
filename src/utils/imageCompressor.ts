/**
 * Utility to resize and compress images into JPEG base64 data URLs
 * to ensure Firestore documents stay well within the 1MB document limit.
 */
export function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    const processImage = () => {
      let width = img.width;
      let height = img.height;

      if (!width || !height) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        return;
      }

      // Calculate scale ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
        return;
      }

      // Draw image to canvas
      ctx.fillStyle = '#FFFFFF'; // White background for transparent PNGs converted to JPEG
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Export as JPEG with specified quality
      let compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

      // If still above 600KB base64 string length (~450KB binary), compress further down
      if (compressedDataUrl.length > 600000 && (width > 800 || height > 800)) {
        const smallerCanvas = document.createElement('canvas');
        const scale = 800 / Math.max(width, height);
        smallerCanvas.width = Math.round(width * scale);
        smallerCanvas.height = Math.round(height * scale);

        const sCtx = smallerCanvas.getContext('2d');
        if (sCtx) {
          sCtx.fillStyle = '#FFFFFF';
          sCtx.fillRect(0, 0, smallerCanvas.width, smallerCanvas.height);
          sCtx.drawImage(img, 0, 0, smallerCanvas.width, smallerCanvas.height);
          compressedDataUrl = smallerCanvas.toDataURL('image/jpeg', 0.65);
        }
      }

      resolve(compressedDataUrl);
    };

    img.onerror = (err) => {
      console.error('Image compression error:', err);
      reject(err);
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
      if (img.complete) {
        processImage();
      } else {
        img.onload = processImage;
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
        img.onload = processImage;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
