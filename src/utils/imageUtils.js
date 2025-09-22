/**
 * Utility functions for handling image format conversions
 */

/**
 * Convert various image formats to JPEG binary data
 * @param {Blob|ArrayBuffer|string|File} imageData - Input image data
 * @param {number} quality - JPEG quality (0-1, default 0.85)
 * @returns {Promise<Blob>} JPEG blob
 */
export const convertToJpegBlob = async (imageData, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    try {
      if (imageData instanceof Blob) {
        // Already a blob, check if it's JPEG
        if (imageData.type === 'image/jpeg') {
          resolve(imageData);
          return;
        }
        // Convert other blob types to JPEG
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(imageData);
      } else if (imageData instanceof ArrayBuffer) {
        // ArrayBuffer - create blob and convert
        const blob = new Blob([imageData], { type: 'image/jpeg' });
        resolve(blob);
      } else if (typeof imageData === 'string') {
        // Base64 string
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob(resolve, 'image/jpeg', quality);
        };
        img.onerror = reject;
        img.src = imageData;
      } else if (imageData instanceof File) {
        // File object
        convertToJpegBlob(imageData, quality).then(resolve).catch(reject);
      } else {
        reject(new Error('Unsupported image data format'));
      }
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Convert image data to ArrayBuffer for binary transmission
 * @param {Blob|ArrayBuffer|string|File} imageData - Input image data
 * @param {number} quality - JPEG quality (0-1, default 0.85)
 * @returns {Promise<ArrayBuffer>} Binary image data
 */
export const convertToBinaryData = async (imageData, quality = 0.85) => {
  const blob = await convertToJpegBlob(imageData, quality);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
};

/**
 * Convert binary data to base64 string
 * @param {ArrayBuffer|Uint8Array} binaryData - Binary data
 * @returns {string} Base64 string
 */
export const binaryToBase64 = (binaryData) => {
  if (binaryData instanceof ArrayBuffer) {
    const bytes = new Uint8Array(binaryData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  } else if (binaryData instanceof Uint8Array) {
    let binary = '';
    for (let i = 0; i < binaryData.length; i++) {
      binary += String.fromCharCode(binaryData[i]);
    }
    return btoa(binary);
  }
  throw new Error('Unsupported binary data format');
};

/**
 * Convert base64 string to binary data
 * @param {string} base64String - Base64 string
 * @returns {ArrayBuffer} Binary data
 */
export const base64ToBinary = (base64String) => {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Create a blob URL from binary data
 * @param {ArrayBuffer|Uint8Array} binaryData - Binary data
 * @param {string} mimeType - MIME type (default: 'image/jpeg')
 * @returns {string} Blob URL
 */
export const createBlobUrl = (binaryData, mimeType = 'image/jpeg') => {
  const blob = new Blob([binaryData], { type: mimeType });
  return URL.createObjectURL(blob);
};

/**
 * Clean up blob URL to prevent memory leaks
 * @param {string} blobUrl - Blob URL to revoke
 */
export const revokeBlobUrl = (blobUrl) => {
  if (blobUrl && blobUrl.startsWith('blob:')) {
    URL.revokeObjectURL(blobUrl);
  }
};
