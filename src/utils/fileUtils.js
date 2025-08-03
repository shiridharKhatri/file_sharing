/**
 * Format file size in bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

/**
 * Get file extension from filename
 * @param {string} filename - Name of the file
 * @returns {string} File extension
 */
export const getFileExtension = (filename) => {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2)
}

/**
 * Check if file is an image
 * @param {string} mimeType - MIME type of the file
 * @returns {boolean} True if file is an image
 */
export const isImageFile = (mimeType) => {
  return mimeType.startsWith("image/")
}

/**
 * Check if file is a text file
 * @param {string} mimeType - MIME type of the file
 * @returns {boolean} True if file is a text file
 */
export const isTextFile = (mimeType) => {
  return mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/javascript"
}
