"use client"

import { useState, useEffect } from "react"
import { Type, Code } from "lucide-react"
import { detectCodeLanguage } from "../../utils/codeUtils"
import "./TextInput.css"

const TextInput = ({ value, onChange }) => {
  const [isCodeDetected, setIsCodeDetected] = useState(false)
  const [detectedLanguage, setDetectedLanguage] = useState("")

  useEffect(() => {
    const language = detectCodeLanguage(value)
    setIsCodeDetected(!!language)
    setDetectedLanguage(language || "")
  }, [value])

  const handlePaste = (e) => {
    // Let the default paste behavior happen, then check for code
    setTimeout(() => {
      const pastedText = e.target.value
      const language = detectCodeLanguage(pastedText)
      if (language) {
        setIsCodeDetected(true)
        setDetectedLanguage(language)
      }
    }, 0)
  }

  return (
    <div className="text-input">
      <div className="text-input-header">
        <h3 className="text-input-title">Text Content</h3>
        {isCodeDetected && (
          <div className="code-indicator">
            <Code className="code-icon" />
            <span className="code-language">{detectedLanguage}</span>
          </div>
        )}
      </div>

      <div className="textarea-container">
        <textarea
          className={`text-area ${isCodeDetected ? "code-detected" : ""}`}
          placeholder="Enter text content or paste code here..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          rows={12}
        />

        {!value && (
          <div className="textarea-placeholder-icon">
            <Type className="placeholder-icon" />
          </div>
        )}
      </div>

      <div className="text-input-footer">
        <span className="character-count">{value.length} characters</span>
      </div>
    </div>
  )
}

export default TextInput
