import { File, Code, ImageIcon, FileText, Archive, Music, Video } from "lucide-react"

export function generateShareId() {
  // return crypto.randomBytes(8).toString("hex")
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
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

export function detectCodeLanguage(text) {
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

export function getFileIcon(mimetype) {
  if (mimetype.startsWith("image/")) return ImageIcon
  if (mimetype.startsWith("video/")) return Video
  if (mimetype.startsWith("audio/")) return Music
  if (mimetype.startsWith("text/") || mimetype === "application/json") return FileText
  if (mimetype.includes("zip") || mimetype.includes("rar") || mimetype.includes("tar")) return Archive
  if (mimetype.includes("javascript") || mimetype.includes("python") || mimetype.includes("java")) return Code
  return File
}

export function validateForm({ files, textContent, password, selectedMode }) {
  const errors = []

  if (!textContent.trim()) {
    errors.push("Please enter some content")
  }

  if (selectedMode === "private" && !password.trim()) {
    errors.push("Password is required for private sharing")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

export function downloadTextAsFile(text, filename) {
  const element = document.createElement("a")
  const file = new Blob([text], { type: "text/plain" })
  element.href = URL.createObjectURL(file)
  element.download = filename
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

export function getLanguageExtension(language) {
  const extensions = {
    javascript: ".js",
    python: ".py",
    java: ".java",
    css: ".css",
    html: ".html",
    json: ".json",
    plaintext: ".txt",
  }

  return extensions[language] || ".txt"
}
