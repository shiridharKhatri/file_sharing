import crypto from "crypto"
import {
  File,
  FileText,
  ImageIcon,
  Video,
  Music,
  Archive,
  Code,
  Database,
  FileSpreadsheet,
  Paperclip,
} from "lucide-react"

export function generateShareId() {
  return crypto.randomBytes(8).toString("hex")
}

export function calculateExpiryDate(expiry) {
  const now = new Date()

  switch (expiry) {
    case "10min":
      return new Date(now.getTime() + 10 * 60 * 1000)
    case "1hr":
      return new Date(now.getTime() + 60 * 60 * 1000)
    case "6hr":
      return new Date(now.getTime() + 6 * 60 * 60 * 1000)
    case "24hr":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000)
    case "7d":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    case "never":
      return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
    default:
      return new Date(now.getTime() + 60 * 60 * 1000)
  }
}

/**
 * Detect programming language from text content
 * @param {string} text - Text content to analyze
 * @returns {string|null} Detected language or null
 */
export const detectCodeLanguage = (text) => {
  if (!text || text.trim().length < 10) return null

  const patterns = {
    javascript: [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /=>\s*{/,
      /console\.log\(/,
      /require\(/,
      /import\s+.*from/,
    ],
    python: [
      /def\s+\w+\s*\(/,
      /import\s+\w+/,
      /from\s+\w+\s+import/,
      /print\(/,
      /if\s+__name__\s*==\s*['"]__main__['"]/,
      /class\s+\w+.*:/,
    ],
    java: [
      /public\s+class\s+\w+/,
      /public\s+static\s+void\s+main/,
      /System\.out\.println/,
      /import\s+java\./,
      /private\s+\w+\s+\w+/,
    ],
    css: [/\.\w+\s*{/, /#\w+\s*{/, /\w+\s*:\s*[^;]+;/, /@media\s*\(/, /background-color\s*:/],
    html: [/<html/i, /<head/i, /<body/i, /<div/i, /<script/i, /<style/i],
    json: [/^\s*{[\s\S]*}\s*$/, /^\s*\[[\s\S]*\]\s*$/, /"[\w-]+"\s*:\s*"[^"]*"/, /"[\w-]+"\s*:\s*\d+/],
  }

  // Count matches for each language
  const scores = {}

  Object.keys(patterns).forEach((lang) => {
    scores[lang] = 0
    patterns[lang].forEach((pattern) => {
      if (pattern.test(text)) {
        scores[lang]++
      }
    })
  })

  // Find language with highest score
  let maxScore = 0
  let detectedLang = null

  Object.keys(scores).forEach((lang) => {
    if (scores[lang] > maxScore) {
      maxScore = scores[lang]
      detectedLang = lang
    }
  })

  // Return detected language if confidence is high enough
  return maxScore >= 2 ? detectedLang : null
}

/**
 * Get file icon component based on MIME type
 * @param {string} mimeType - MIME type of the file
 * @returns {React.Component} Lucide icon component
 */
export const getFileIcon = (mimeType) => {
  if (!mimeType) return Paperclip

  // Image files
  if (mimeType.startsWith("image/")) {
    return ImageIcon
  }

  // Video files
  if (mimeType.startsWith("video/")) {
    return Video
  }

  // Audio files
  if (mimeType.startsWith("audio/")) {
    return Music
  }

  // Text files
  if (mimeType.startsWith("text/") || mimeType === "application/json") {
    return FileText
  }

  // Code files
  if (
    mimeType === "application/javascript" ||
    mimeType === "text/javascript" ||
    mimeType === "application/typescript" ||
    mimeType === "text/x-python" ||
    mimeType === "text/x-java-source" ||
    mimeType === "text/x-c" ||
    mimeType === "text/x-c++" ||
    mimeType === "text/html" ||
    mimeType === "text/css"
  ) {
    return Code
  }

  // Spreadsheet files
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    return FileSpreadsheet
  }

  // Database files
  if (mimeType.includes("database") || mimeType === "application/x-sqlite3") {
    return Database
  }

  // Archive files
  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    mimeType.includes("tar") ||
    mimeType.includes("gzip") ||
    mimeType === "application/x-7z-compressed"
  ) {
    return Archive
  }

  // Default file icon
  return File
}

/**
 * Get language file extension
 * @param {string} language - Programming language
 * @returns {string} File extension
 */
export const getLanguageExtension = (language) => {
  const extensions = {
    javascript: ".js",
    python: ".py",
    java: ".java",
    css: ".css",
    html: ".html",
    json: ".json",
    typescript: ".ts",
    cpp: ".cpp",
    c: ".c",
    php: ".php",
    ruby: ".rb",
    go: ".go",
    rust: ".rs",
    swift: ".swift",
    kotlin: ".kt",
    scala: ".scala",
    plaintext: ".txt",
  }

  return extensions[language] || ".txt"
}

/**
 * Download text content as file
 * @param {string} content - Text content to download
 * @param {string} filename - Name of the file
 */
export const downloadTextAsFile = (content, filename) => {
  const element = document.createElement("a")
  const file = new Blob([content], { type: "text/plain" })
  element.href = URL.createObjectURL(file)
  element.download = filename
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

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
