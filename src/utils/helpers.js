import { File, ImageIcon, FileText, Archive, Music, Video, Code, FileSpreadsheet, Database, Layers } from "lucide-react"

export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

export const detectCodeLanguage = (text) => {
  if (!text || text.trim().length < 10) return "plaintext"

  const patterns = {
    javascript: [
      /function\s+\w+\s*\(/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /=>\s*{/,
      /console\.log\(/,
      /import.*from/,
      /require\(/,
      /\.addEventListener/,
      /document\./,
      /window\./,
    ],
    python: [
      /def\s+\w+\s*\(/,
      /import\s+\w+/,
      /from\s+\w+\s+import/,
      /print\(/,
      /if\s+__name__\s*==\s*['"]__main__['"]/,
      /class\s+\w+.*:/,
      /\.append\(/,
      /range\(/,
      /len\(/,
    ],
    css: [
      /\.\w+\s*{/,
      /#\w+\s*{/,
      /\w+\s*:\s*[^;]+;/,
      /@media\s*\(/,
      /background-color\s*:/,
      /flex-direction\s*:/,
      /border-radius\s*:/,
    ],
    html: [/<html/i, /<head/i, /<body/i, /<div/i, /<script/i, /<style/i, /<meta/i, /<link/i],
    json: [
      /^\s*{[\s\S]*}\s*$/,
      /^\s*\[[\s\S]*\]\s*$/,
      /"[\w-]+"\s*:\s*"[^"]*"/,
      /"[\w-]+"\s*:\s*\d+/,
      /"[\w-]+"\s*:\s*true|false/,
    ],
    sql: [
      /SELECT\s+.*FROM/i,
      /INSERT\s+INTO/i,
      /UPDATE\s+.*SET/i,
      /DELETE\s+FROM/i,
      /CREATE\s+TABLE/i,
      /ALTER\s+TABLE/i,
    ],
    markdown: [/^#{1,6}\s+/m, /\*\*.*\*\*/, /\*.*\*/, /\[.*\]$$.*$$/, /```[\s\S]*```/, /^\s*[-*+]\s+/m],
    xml: [/<\?xml/i, /<\/\w+>/, /<\w+[^>]*\/>/, /<\w+[^>]*>[\s\S]*<\/\w+>/],
    java: [
      /public\s+class\s+\w+/,
      /public\s+static\s+void\s+main/,
      /System\.out\.println/,
      /import\s+java\./,
      /private\s+\w+\s+\w+/,
    ],
    php: [/<\?php/, /\$\w+\s*=/, /echo\s+/, /function\s+\w+\s*\(/, /class\s+\w+/],
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
  let detectedLang = "plaintext"

  Object.keys(scores).forEach((lang) => {
    if (scores[lang] > maxScore) {
      maxScore = scores[lang]
      detectedLang = lang
    }
  })

  return maxScore >= 2 ? detectedLang : "plaintext"
}

export const getLanguageExtension = (language) => {
  const extensions = {
    javascript: ".js",
    python: ".py",
    css: ".css",
    html: ".html",
    json: ".json",
    sql: ".sql",
    markdown: ".md",
    xml: ".xml",
    java: ".java",
    php: ".php",
    plaintext: ".txt",
  }
  return extensions[language] || ".txt"
}

export const downloadTextAsFile = (text, filename) => {
  const blob = new Blob([text], { type: "text/plain" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const getFileIcon = (mimeType) => {
  const typeMap = {
    image: ImageIcon,
    video: Video,
    audio: Music,
    archive: Archive,
    code: Code,
    document: FileText,
    spreadsheet: FileSpreadsheet,
    database: Database,
    design: Layers,
    default: File,
  }

  if (mimeType.startsWith("image/")) return typeMap.image
  if (mimeType.startsWith("video/")) return typeMap.video
  if (mimeType.startsWith("audio/")) return typeMap.audio
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar")) return typeMap.archive
  if (mimeType.includes("text") || mimeType.includes("json") || mimeType.includes("javascript")) return typeMap.code
  if (mimeType.includes("pdf") || mimeType.includes("document") || mimeType.includes("word")) return typeMap.document
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return typeMap.spreadsheet
  if (mimeType.includes("database") || mimeType.includes("sql")) return typeMap.database
  if (mimeType.includes("photoshop") || mimeType.includes("illustrator")) return typeMap.design

  return typeMap.default
}

export const validateForm = ({ files, textContent, password, selectedMode }) => {
  const errors = {}

  if (files.length === 0 && !textContent.trim()) {
    errors.content = "Add files or content to share"
  }

  if (selectedMode === "private") {
    if (!password || password.length < 6) {
      errors.password = "Password required (6+ characters)"
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  if (totalSize > 100 * 1024 * 1024) {
    errors.files = "Total file size cannot exceed 100MB"
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export const applySyntaxHighlighting = (text, language) => {
  if (!text) return text

  const patterns = {
    html: [
      { pattern: /(&lt;!doctype\s+[^&]*&gt;)/gi, className: "doctype" },
      { pattern: /(&lt;\/?)([a-zA-Z][a-zA-Z0-9]*)/g, className: "tag" },
      { pattern: /(\s)([a-zA-Z-]+)(=)/g, className: "attribute" },
      { pattern: /(=)("([^"]*)"|'([^']*)')/g, className: "string" },
      { pattern: /(&lt;!--[\s\S]*?--&gt;)/g, className: "comment" },
    ],
    javascript: [
      {
        pattern:
          /\b(const|let|var|function|return|if|else|for|while|do|break|continue|switch|case|default|try|catch|finally|throw|new|this|typeof|instanceof|in|of|class|extends|import|export|from|as|async|await)\b/g,
        className: "keyword",
      },
      { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, className: "boolean" },
      { pattern: /\b\d+\.?\d*\b/g, className: "number" },
      { pattern: /(["'`])((?:\\.|(?!\1)[^\\])*?)\1/g, className: "string" },
      { pattern: /\/\/.*$/gm, className: "comment" },
      { pattern: /\/\*[\s\S]*?\*\//g, className: "comment" },
      { pattern: /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=\()/g, className: "function" },
    ],
    python: [
      {
        pattern:
          /\b(def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|break|continue|pass|lambda|and|or|not|in|is|True|False|None)\b/g,
        className: "keyword",
      },
      { pattern: /\b\d+\.?\d*\b/g, className: "number" },
      { pattern: /(["'])((?:\\.|(?!\1)[^\\])*?)\1/g, className: "string" },
      { pattern: /#.*$/gm, className: "comment" },
      { pattern: /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, className: "function" },
    ],
    css: [
      { pattern: /([.#]?[a-zA-Z][a-zA-Z0-9_-]*)\s*{/g, className: "selector" },
      { pattern: /([a-zA-Z-]+)\s*:/g, className: "property" },
      { pattern: /:\s*([^;]+);/g, className: "value" },
      { pattern: /\/\*[\s\S]*?\*\//g, className: "comment" },
    ],
    json: [
      { pattern: /"([^"\\]|\\.)*"/g, className: "string" },
      { pattern: /\b\d+\.?\d*\b/g, className: "number" },
      { pattern: /\b(true|false|null)\b/g, className: "boolean" },
    ],
  }

  const langPatterns = patterns[language] || []
  let highlightedText = text

  // Escape HTML first
  highlightedText = highlightedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  // Apply syntax highlighting
  langPatterns.forEach(({ pattern, className }) => {
    highlightedText = highlightedText.replace(pattern, `<span class="syntax-${className}">$&</span>`)
  })

  return highlightedText
}
