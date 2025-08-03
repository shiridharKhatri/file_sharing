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
 * Get syntax highlighting class for detected language
 * @param {string} language - Programming language
 * @returns {string} CSS class name for syntax highlighting
 */
export const getSyntaxHighlightClass = (language) => {
  const classMap = {
    javascript: "language-js",
    python: "language-python",
    java: "language-java",
    css: "language-css",
    html: "language-html",
    json: "language-json",
  }

  return classMap[language] || "language-text"
}
